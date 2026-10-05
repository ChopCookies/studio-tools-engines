/* ══════════════════════════════════════════════════
   image-resizer.js | Bildgröße ändern, zuschneiden & drehen
   Nutzt window.imageUtils (NEEDS_IMAGE_LIB).
   - Skaliert in Breite UND Höhe (Höhe = 0 → automatisch).
   - Erlaubt Vergrößern (Upscaling), nicht nur Verkleinern.
   - SVG wird bei Vergrößerung in Zielauflösung neu gerastert (scharf).
   - Optionale KI-Hochskalierung (Real-ESRGAN, 100% lokal im Worker):
     Checkbox #ir-ai -> lädt /assets/vendor/upscale (self-hosted ONNX-Runtime
     Web + realesr-general-x4v3), 4x-Superresolution, dann Final-Resize.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  var DE = (window.__siteLang !== 'en');
  var T = {
    load: DE ? 'Lade zuerst ein Bild.' : 'Load an image first.',
    loading: DE ? 'Wird verarbeitet …' : 'Processing …',
    go: DE ? 'Anwenden' : 'Apply',
    download: DE ? 'Bild laden' : 'Download image'
  };

  function getEl(id) { return document.getElementById(id); }

  var state = { img: null, srcW: 0, srcH: 0, crop: null, isSvg: false, svgText: null };

  var MAX_CANVAS = 16384;

  function badgeHtml(label) {
    return '<span style="display:inline-flex;align-items:center;gap:5px;vertical-align:2px;margin-left:6px;padding:3px 11px 4px;border-radius:13px;font-size:0.74rem;font-weight:800;line-height:1;letter-spacing:.7px;text-transform:uppercase;color:#fff;background:linear-gradient(135deg,#2E5F80,#1a4660);box-shadow:0 1px 3px rgba(30,60,90,.5),inset 0 1px 0 rgba(255,255,255,.25);white-space:nowrap">' +
      '<svg width="11" height="13" viewBox="0 0 24 24" fill="none" stroke="#E0915F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>' +
      label + '</span>';
  }

  // Reine Logik: Zielmaße (inkl. Vergrößerung + Seitenverhältnis-Fit).
  function computeOutput(baseW, baseH, tW, tH, max) {
    max = max || MAX_CANVAS;
    var outW = baseW, outH = baseH;
    if (tW > 0 && tH > 0) {
      var s = Math.min(tW / baseW, tH / baseH);
      outW = baseW * s; outH = baseH * s;
    } else if (tW > 0) {
      outW = tW; outH = baseH * tW / baseW;
    } else if (tH > 0) {
      outH = tH; outW = baseW * tH / baseH;
    }
    var cap = Math.min(1, max / outW, max / outH);
    if (cap < 1) { outW *= cap; outH *= cap; }
    return { w: Math.round(outW), h: Math.round(outH) };
  }

  // Setzt width/height im <svg>-Wurzelelement (behält viewBox) und liefert
  // modifiziertes Markup, damit der Browser die Vektorgrafik in Zielauflösung rastet.
  function injectSvgSize(text, w, h) {
    if (typeof text !== 'string') return null;
    var s = text.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '');
    var replaced = s.replace(/<svg([^>]*)>/i, function(m, attrs) {
      return '<svg' + attrs + ' width="' + w + '" height="' + h + '">';
    });
    return (replaced === s && s.indexOf('<svg') !== 0) ? null : replaced;
  }

  function buildSvgImage(text, w, h) {
    var modified = injectSvgSize(text, w, h);
    return new Promise(function(resolve, reject) {
      if (!modified) { reject(new Error('kein svg')); return; }
      var img = new Image();
      img.onload = function() { resolve(img); };
      img.onerror = function() { reject(new Error('svg raster failed')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(modified);
    });
  }

  function fmtBytes(b) {
    if (window.imageUtils && window.imageUtils.formatBytes) return window.imageUtils.formatBytes(b);
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  // ---------- KI-Hochskalierung (Web Worker, 100% lokal) ----------
  // Zwei selbst-gehostete Modelle (jeweils 4x, Real-ESRGAN):
  //   balanced: realesr-general-x4v3 (~1.2M params, schnell, ganzes Bild, Cap 512)
  //   high:     Real-ESRGAN-x4plus  (~16.7M params, beste Qualität, Kacheln, Cap 256)
  var AI_CAPS = { balanced: 512, high: 256 };
  var AI_MB = { balanced: 15, high: 64 };
  var ai = { worker: null, model: null, ready: null, upResolve: null, upReject: null };

  function aiModel() {
    var s = getEl('ir-ai-quality');
    return (s && s.value === 'high') ? 'high' : 'balanced';
  }
  function aiCap() { return AI_CAPS[aiModel()] || 512; }

  function aiProgressHtml() {
    return '<div style="font-size:0.85rem;color:var(--text-muted);padding:16px 4px">' +
      '<div style="font-weight:600;margin-bottom:8px">' + (DE ? 'Starte KI-Hochskalierung…' : 'Starting AI upscale…') + badgeHtml(DE ? 'Lokale KI' : 'Local AI') + '</div>' +
      '<div style="width:100%;height:9px;background:rgba(128,128,128,.22);border-radius:5px;overflow:hidden"><div style="height:100%;width:30%;background:linear-gradient(90deg,#2E5F80,#76A7C9);animation:ai-progress 1.3s infinite ease-in-out"></div></div>' +
      '<div style="margin-top:7px;font-size:0.78rem">' +
        (DE ? 'Erster Start lädt das KI-Modell (~' + AI_MB[aiModel()] + ' MB, einmalig, wird im Browser gespeichert). Dein Bild verlässt dein Gerät nicht.' : 'First run loads the AI model (~' + AI_MB[aiModel()] + ' MB, once, cached in your browser). Your image never leaves your device.') +
      '</div>' +
      '<style>@keyframes ai-progress{0%{margin-left:-30%}100%{margin-left:100%}}</style></div>';
  }

  function aiLoad(model) {
    model = model || aiModel();
    if (ai.ready && ai.model === model) return ai.ready;
    if (!ai.worker) {
      try { ai.worker = new Worker('/assets/js/image-resizer-ai-worker.js'); }
      catch (e) { return Promise.reject(e); }
      ai.worker.onmessage = function(e) {
        var mm = e.data;
        if (mm.type === 'ready') {
          if (ai.readyResolve) { var r = ai.readyResolve; ai.readyResolve = null; r(); }
        } else if (mm.type === 'error') {
          if (ai.upReject) { var er = ai.upReject; ai.upReject = null; er(new Error(mm.message)); }
          else if (ai.readyReject) { var rr = ai.readyReject; ai.readyReject = null; rr(new Error(mm.message)); }
        } else if (mm.type === 'done' && ai.upResolve) {
          var ur = ai.upResolve; ai.upResolve = null; ur(mm);
        }
      };
      ai.worker.onerror = function() {
        if (ai.upReject) { var er2 = ai.upReject; ai.upReject = null; er2(new Error('worker error')); }
        else if (ai.readyReject) { var rr2 = ai.readyReject; ai.readyReject = null; rr2(new Error('worker error')); }
      };
    }
    ai.model = model;
    ai.ready = new Promise(function(resolve, reject) {
      ai.readyResolve = resolve; ai.readyReject = reject;
      ai.worker.postMessage({ type: 'load', model: model });
    });
    ai.ready['catch'](function() { ai.ready = null; });
    return ai.ready;
  }

  function aiUpscale(width, height, data, model) {
    return new Promise(function(resolve, reject) {
      ai.upResolve = resolve; ai.upReject = reject;
      ai.worker.postMessage({ type: 'upscale', width: width, height: height, data: data, model: model }, [data.buffer]);
    });
  }

  // Baut den (auf den Modell-Cap verkleinerten) RGBA-Input und führt die KI aus.
  function runAI() {
    var output = getEl('tool-output');
    if (output) output.innerHTML = aiProgressHtml();
    var model = aiModel();
    return aiLoad(model).then(function() {
      var cap = aiCap();
      var f = Math.min(1, cap / state.srcW, cap / state.srcH);
      var mw = Math.max(1, Math.round(state.srcW * f));
      var mh = Math.max(1, Math.round(state.srcH * f));
      var c = document.createElement('canvas');
      c.width = mw; c.height = mh;
      var cx = c.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(state.img, 0, 0, mw, mh);
      var id = cx.getImageData(0, 0, mw, mh);
      return aiUpscale(mw, mh, id.data, model);
    }).then(function(r) {
      var o2 = getEl('tool-output');
      if (o2) o2.innerHTML = '';
      return r;
    });
  }

  // ---------- Rendering ----------
  function process() {
    var output = getEl('tool-output');
    if (!state.img) {
      output.innerHTML = '<p class="text-muted">' + T.load + '</p>';
      return;
    }
    var rotate = parseInt(getEl('ir-rotate').value, 10) || 0;
    var format = getEl('ir-format').value;
    var quality = parseInt(getEl('ir-quality').value, 10) / 100;
    var tW = parseInt(getEl('ir-width').value, 10) || 0;
    var tH = parseInt(getEl('ir-height').value, 10) || 0;

    // 1) Drehung der Quelldimensionen
    var rotated = (rotate % 180 !== 0);
    var baseW = rotated ? state.srcH : state.srcW;
    var baseH = rotated ? state.srcW : state.srcH;

    // 2) Zielmaße (Vergrößern erlaubt, Seitenverhältnis bleibt erhalten)
    var out = computeOutput(baseW, baseH, tW, tH, MAX_CANVAS);

    var aiCb = getEl('ir-ai');
    var aiOn = !!(aiCb && aiCb.checked);
    var scale = baseW > 0 ? out.w / baseW : 1;
    var useAI = aiOn && scale > 1.001 && typeof Worker !== 'undefined';

    // 3) Render-Pipeline + Ausgabe
    function run(sSrc, aiUsed) {
      var srcW = sSrc.naturalWidth || sSrc.width || sSrc.clientWidth || state.srcW;
      var srcH = sSrc.naturalHeight || sSrc.height || sSrc.clientHeight || state.srcH;
      var dX = 0, dY = 0, dW = srcW, dH = srcH;
      if (state.crop) {
        var k = srcW / state.srcW;
        dX = state.crop.x * k; dY = state.crop.y * k;
        dW = state.crop.w * k; dH = state.crop.h * k;
      }
      var canvas = document.createElement('canvas');
      canvas.width = out.w;
      canvas.height = out.h;
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rotate * Math.PI / 180);
      ctx.drawImage(sSrc, dX, dY, dW, dH, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);

      window.imageUtils.canvasToBlob(canvas, format, quality).then(function(result) {
        var baseName = (state.img.name || 'bild').replace(/\.[^.]+$/, '');
        var extMap = { jpeg: '.jpg', webp: '.webp', png: '.png' };
        var fileName = baseName + '_angepasst' + (extMap[format] || '.jpg');
        var d = document.createElement('div');
        d.className = 'card';
        d.style.padding = '12px';
        var attr = aiUsed
          ? '<div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">' +
            (DE ? 'KI-Hochskalierung läuft lokal im Browser.' : 'AI upscale runs locally in your browser.') + ' Powered by ' +
            '<a href="https://github.com/xinntao/Real-ESRGAN" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted);text-decoration:underline">Real-ESRGAN</a>.</div>'
          : '';
        d.innerHTML =
          '<div style="margin-bottom:8px">' + (DE ? 'Ausgabe:' : 'Output:') + ' ' + fileName + ' (' + fmtBytes(result.blob.size) + ', ' + canvas.width + '×' + canvas.height + ')</div>' +
          '<button class="btn btn-primary" id="ir-dl">' + T.download + '</button>' + attr;
        output.innerHTML = '';
        output.appendChild(d);

        // Playbook integration: report once the resized image is rendered.
        if (window.playbook) {
          var pbPayload = {
            tool: 'image-resizer',
            summary: (window.__siteLang === 'en' ? 'Image resized: ' : 'Bildgröße geändert: ') + canvas.width + '×' + canvas.height + ', ' + format.toUpperCase() + (aiUsed ? (DE ? ' (KI)' : ' (AI)') : '')
          };
          pbPayload.value = result.dataUrl;
          window.playbook.report(pbPayload);
        }

        var dl = getEl('ir-dl');
        if (dl) {
          dl.addEventListener('click', function() {
            var a = document.createElement('a');
            a.href = result.dataUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            if (window.trackAction) window.trackAction('download');
          });
        }
      });
    }

    function normalRun() {
      run(state.img, false);
    }

    // SVG ohne Zuschnitt -> in Zielauflösung neu gerastert (scharf vergrößert).
    if (!useAI && state.isSvg && !state.crop) {
      var renderW = (rotate % 180 === 0) ? out.w : out.h;
      var renderH = (rotate % 180 === 0) ? out.h : out.w;
      buildSvgImage(state.svgText, renderW, renderH).then(function(svg) {
        run(svg, false);
      }).catch(function() {
        run(state.img, false);
      });
      return;
    }

    if (!useAI) { normalRun(); return; }

    // KI-Pfad: 4x hochskalieren, dann Drehung/Zuschnitt + Final-Resize anwenden.
    runAI().then(function(aiOut) {
      var host = document.createElement('canvas');
      host.width = aiOut.width; host.height = aiOut.height;
      host.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(aiOut.data), aiOut.width, aiOut.height), 0, 0);
      run(host, true);
    }).catch(function() {
      output.innerHTML = '<p class="text-muted">' + (DE ? 'KI-Modell nicht verfügbar – normale Skalierung wird verwendet.' : 'AI model unavailable – using normal scaling.') + '</p>';
      normalRun();
    });
  }

  // Vorschau mit Zuschneide-Rechteck
  function showPreview() {
    var container = getEl('ir-preview');
    if (!container) return;
    container.innerHTML = '';
    var scale = Math.min((container.clientWidth || 400) / state.srcW, 420 / state.srcH, 1);
    var dispW = Math.round(state.srcW * scale);
    var dispH = Math.round(state.srcH * scale);
    var canvas = document.createElement('canvas');
    canvas.width = dispW; canvas.height = dispH;
    canvas.style.maxWidth = '100%';
    canvas.style.cursor = 'crosshair';
    var ctx = canvas.getContext('2d');
    ctx.drawImage(state.img, 0, 0, dispW, dispH);
    container.appendChild(canvas);

    var img = state.img, sx = img.naturalWidth || img.width, sy = img.naturalHeight || img.height;
    var box = null, dragging = false, startX = 0, startY = 0;
    function redraw() {
      ctx.clearRect(0, 0, dispW, dispH);
      ctx.drawImage(state.img, 0, 0, dispW, dispH);
      if (box) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
      }
    }
    canvas.addEventListener('mousedown', function(e) {
      var r = canvas.getBoundingClientRect();
      startX = e.clientX - r.left; startY = e.clientY - r.top;
      box = { x: startX, y: startY, w: 0, h: 0 };
      dragging = true;
      redraw();
    });
    canvas.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      var r = canvas.getBoundingClientRect();
      var cx = e.clientX - r.left, cy = e.clientY - r.top;
      box = {
        x: Math.min(startX, cx), y: Math.min(startY, cy),
        w: Math.abs(cx - startX), h: Math.abs(cy - startY)
      };
      redraw();
    });
    window.addEventListener('mouseup', function() {
      dragging = false;
      if (box && box.w > 4 && box.h > 4) {
        state.crop = {
          x: Math.max(0, Math.round(box.x / scale)),
          y: Math.max(0, Math.round(box.y / scale)),
          w: Math.min(sx, Math.round(box.w / scale)),
          h: Math.min(sy, Math.round(box.h / scale))
        };
      }
    });
    canvas.addEventListener('dblclick', function() {
      box = null; state.crop = null; redraw();
    });
  }

  function onFile() {
    var input = getEl('ir-file');
    if (!input || !input.files || input.files.length === 0) return;
    var file = input.files[0];
    var output = getEl('tool-output');
    if (output) output.innerHTML = '<p class="text-muted">' + T.loading + '</p>';
    window.imageUtils.readFileAsImage(file).then(function(img) {
      state.img = img;
      state.srcW = img.naturalWidth || img.width || 300;
      state.srcH = img.naturalHeight || img.height || 150;
      state.crop = null;
      updateAiAdvice();
      state.isSvg = (/\.svg$/i.test(file.name) || file.type === 'image/svg+xml');
      state.svgText = null;
      if (state.isSvg) {
        var tr = new FileReader();
        tr.onload = function() { state.svgText = (typeof tr.result === 'string') ? tr.result : null; };
        tr.readAsText(file);
      }
      showPreview();
      var output2 = getEl('tool-output');
      if (output2) output2.innerHTML = '<p class="text-muted">' + (DE ? 'Bild geladen (' + state.srcW + '×' + state.srcH + '). Ziehe auf der Vorschau zum Zuschneiden oder klicke „Anwenden". Doppelklick entfernt den Zuschnitt. SVG wird beim Vergrößern in Zielauflösung gerendert.' : 'Image loaded (' + state.srcW + 'x' + state.srcH + '). Drag on the preview to crop, or click "Apply". Double-click removes the crop. SVG is re-rendered at target resolution when upscaling.') + '</p>';
    }).catch(function() {
      var output3 = getEl('tool-output');
      if (output3) output3.innerHTML = '<p class="text-muted">' + (DE ? 'Bild konnte nicht geladen werden.' : 'The image could not be loaded.') + '</p>';
    });
  }

  // Reichert die Registry-Checkbox #ir-ai um Badge + Hinweis an.
  function enrichAiCheckbox() {
    var cb = getEl('ir-ai');
    if (!cb) return;
    var label = cb.closest ? cb.closest('label') : null;
    if (!label) return;
    var span = label.querySelector('span');
    if (span) span.appendChild(document.createRange().createContextualFragment(badgeHtml(DE ? 'Lokale KI' : 'Local AI')));
    var note = document.createElement('div');
    note.style.cssText = 'font-size:0.72rem;color:var(--text-muted);margin:2px 0 0 0;line-height:1.4';
    note.textContent = DE
      ? 'Erzeugt mehr Details beim Vergrößern. Läuft 100% lokal im Browser – dein Bild verlässt dein Gerät nicht.'
      : 'Adds more detail when upscaling. Runs 100% in your browser – your image never leaves your device.';
    label.appendChild(note);
  }

  // Fügt die Qualitäts-/Modell-Auswahl + dynamischen Größen-Hinweis zur KI-Checkbox hinzu.
  function addAiControls() {
    var cb = getEl('ir-ai');
    var label = cb && cb.closest ? cb.closest('label') : null;
    if (!cb || !label) return;
    if (getEl('ir-ai-quality')) return;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin:8px 0 4px;font-size:0.82rem';
    var inner = document.createElement('div');
    inner.style.cssText = 'display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-weight:600';
    inner.innerHTML =
      '<span>' + (DE ? 'Qualität / Modell:' : 'Quality / model:') + '</span>' +
      '<select id="ir-ai-quality" style="font-weight:normal;padding:3px 8px;font-size:0.82rem;border-radius:6px;border:1px solid rgba(128,128,128,.5)">' +
        '<option value="balanced">' + (DE ? 'Balanced · schnell' : 'Balanced · fast') + '</option>' +
        '<option value="high">' + (DE ? 'Hochwertig · Real-ESRGAN-x4plus' : 'High quality · Real-ESRGAN-x4plus') + '</option>' +
      '</select>';
    var adv = document.createElement('div');
    adv.id = 'ir-ai-advice';
    adv.style.cssText = 'font-size:0.72rem;color:var(--text-muted);line-height:1.45;margin-top:4px';
    wrap.appendChild(inner);
    wrap.appendChild(adv);
    label.appendChild(wrap);
    getEl('ir-ai-quality').addEventListener('change', updateAiAdvice);
    updateAiAdvice();
  }

  // Zeigt automatisch an, was bei aktueller Bildgröße + Modell zu erwarten ist:
  // Qualitätsverlust beim schnellen Modell für große Bilder, bzw. lange Laufzeit
  // (Kachel-Superresolution) beim hochwertigen Modell für große Bilder.
  function updateAiAdvice() {
    var adv = getEl('ir-ai-advice');
    if (!adv) return;
    var model = aiModel();
    var m = Math.max(state.srcW, state.srcH);
    var lines = [];
    if (model === 'balanced') {
      if (m > 512) {
        lines.push(DE
          ? 'Großes Bild: Das schnelle Modell verarbeitet höchstens 512 px – bei sehr großen Vergrößerungen geht etwas Schärfe verloren. Für maximale Qualität „Hochwertig“ wählen.'
          : 'Large image: the fast model only processes up to 512 px – very large upscales lose a little sharpness. Choose “High quality” for max quality.');
      } else {
        lines.push(DE ? 'Schnell und für die meisten Bilder ausreichend.' : 'Fast and enough for most images.');
      }
      lines.push(DE ? 'Modell-Download ~15 MB (einmalig, wird im Browser gecacht).' : 'Model download ~15 MB (once, cached in your browser).');
    } else {
      if (m > 128) {
        var ta = Math.max(1, Math.ceil((m - 16) / 112));
        var tiles = ta * ta;
        lines.push(DE
          ? 'Großes Bild: Das hochwertige Modell arbeitet in Kacheln (~' + tiles + '). Das kann je nach Gerät einige Sekunden bis mehrere Minuten dauern. Für schnelle Ergebnisse: Bild auf max. ~256 px pro Seite verkleinern oder Balancen wählen.'
          : 'Large image: the high-quality model works in tiles (~' + tiles + '). This can take seconds to minutes depending on device. For fast results shrink to ~256 px per side or pick Balanced.');
      } else {
        lines.push(DE ? 'Beste Qualität – ideal für kleinere Bilder.' : 'Best quality – ideal for smaller images.');
      }
      lines.push(DE ? 'Modell-Download ~64 MB (einmalig, wird im Browser gecacht).' : 'Model download ~64 MB (once, cached in your browser).');
    }
    adv.innerHTML = lines.join('<br>');
  }

  function buildUI() {
    var inputs = getEl('tool-inputs');
    var output = getEl('tool-output');
    if (!inputs || !output) return;
    if (!getEl('ir-file')) {
      var fi = document.createElement('input');
      fi.type = 'file';
      fi.id = 'ir-file';
      fi.accept = 'image/*';
      fi.style.marginBottom = '10px';
      var label = document.createElement('label');
      label.htmlFor = 'ir-file';
      label.style.display = 'block';
      label.style.marginBottom = '10px';
      label.appendChild(fi);
      label.appendChild(document.createTextNode(' ' + (DE ? 'Bild auswählen' : 'Select an image')));
      inputs.insertBefore(label, inputs.firstChild);
      fi.addEventListener('change', onFile);
    }
    var prev = document.createElement('div');
    prev.id = 'ir-preview';
    prev.style.margin = '10px 0';
    inputs.appendChild(prev);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-generate';
    btn.textContent = T.go;
    inputs.appendChild(btn);
    btn.addEventListener('click', process);
    output.innerHTML = '<p class="text-muted">' + T.load + '</p>';

    enrichAiCheckbox();
    addAiControls();

    if (window.imageUtils && window.imageUtils.getPrefillImageDataUrl) {
      var pre = window.imageUtils.getPrefillImageDataUrl();
      if (pre && getEl('ir-file')) {
        var pf = window.imageUtils.dataUrlToFile(pre, 'weitergeleitet-bild');
        if (window.imageUtils.setInputFile(getEl('ir-file'), pf)) onFile();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fmtBytes: fmtBytes, computeOutput: computeOutput, injectSvgSize: injectSvgSize };
  }
})();
