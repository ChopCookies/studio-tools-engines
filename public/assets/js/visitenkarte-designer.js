/* ══════════════════════════════════════════════════
   visitenkarte-designer.js | Visitenkarte-Designer
   Canvas-Vorschau, PNG-Download und druckbarer
   A4-PDF-Bogen mit 10 Visitenkarten (2 Spalten x 5
   Reihen). Alle Logik client-seitig.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';
  var isEn = window.__siteLang === 'en';
  function txt(de, en) { return isEn ? en : de; }

  /* Konstanten */
  var CARD_W_MM = 85;
  var CARD_H_MM = 55;
  var CARD_W_PX = 1004;   // ~300dpi
  var CARD_H_PX = 649;
  var CARD_W_PT = 240.94; // pt bei 300dpi
  var CARD_H_PT = 155.91;
  var A4_W_PT = 595.28;
  var A4_H_PT = 841.89;

  /* Reine Geometrie: 10 Karten auf A4, 2 Spalten x 5 Reihen.
     Gibt Array von {x,y,w,h} in pt zurueck. */
  function cardGrid(count) {
    count = count || 10;
    var cols = 2, rows = Math.ceil(count / cols);
    /* For single card, center it */
    if (count === 1) { cols = 1; rows = 1; }
    var gutter = 6;
    var totalW = cols * CARD_W_PT + (cols - 1) * gutter;
    var totalH = rows * CARD_H_PT + (rows - 1) * gutter;
    var startX = (A4_W_PT - totalW) / 2;
    var startY = (A4_H_PT - totalH) / 2;
    var positions = [];
    for (var i = 0; i < count; i++) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      positions.push({
        x: startX + col * (CARD_W_PT + gutter),
        y: startY + row * (CARD_H_PT + gutter),
        w: CARD_W_PT,
        h: CARD_H_PT
      });
    }
    return positions;
  }

  /* Normalisierte Kopie des Zustands mit Defaults. */
  function renderCardData(state) {
    var s = state || {};
    return {
      company: (s.company || '').trim(),
      name: (s.name || '').trim(),
      title: (s.title || '').trim(),
      phone: (s.phone || '').trim(),
      mobile: (s.mobile || '').trim(),
      email: (s.email || '').trim(),
      web: (s.web || '').trim(),
      street: (s.street || '').trim(),
      plz: (s.plz || '').trim(),
      city: (s.city || '').trim(),
      template: s.template || 'modern',
      accentColor: s.accentColor || '#2c3e7a',
      textColor: s.textColor || '#222222',
      bgColor: s.bgColor || '#ffffff',
      fontFamily: s.fontFamily || 'sans',
      logoDataUrl: s.logoDataUrl || null
    };
  }

  /* Kontaktzeilen: nur nicht-leere Felder. */
  function contactLines(state) {
    var lines = [];
    if (state.phone) lines.push({ icon: 'telephone', label: txt('Telefon', 'Phone'), text: state.phone });
    if (state.mobile) lines.push({ icon: 'smartphone', label: txt('Mobil', 'Mobile'), text: state.mobile });
    if (state.email) lines.push({ icon: 'mail', label: txt('E-Mail', 'Email'), text: state.email });
    if (state.web) lines.push({ icon: 'globe', label: txt('Webseite', 'Website'), text: state.web });
    return lines;
  }

  /* Hilfsfunktionen */
  function escHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
  }

  function fontStack() {
    var families = {
      sans: 'Helvetica, Arial, sans-serif',
      serif: 'Georgia, "Times New Roman", serif',
      mono: '"Courier New", Courier, monospace',
      display: '"Palatino Linotype", "Book Antiqua", Palatino, serif'
    };
    return families[document.getElementById('vf-font') ? document.getElementById('vf-font').value : 'sans'] || families.sans;
  }

  function getFontFamily() {
    var sel = document.getElementById('vf-font');
    var val = sel ? sel.value : 'sans';
    var map = { sans: 'Helvetica, Arial, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: '"Courier New", Courier, monospace', display: '"Palatino Linotype", "Book Antiqua", Palatino, serif' };
    return map[val] || map.sans;
  }

  /* Zeichnet eine Visitenkarte auf einen Canvas. */
  function drawCard(ctx, data, w, h, scale) {
    scale = scale || 1;
    var cw = w * scale, ch = h * scale;
    ctx.clearRect(0, 0, cw, ch);

    /* Hintergrund */
    ctx.fillStyle = data.bgColor;
    ctx.fillRect(0, 0, cw, ch);

    /* Akzent-Balken oben */
    ctx.fillStyle = data.accentColor;
    ctx.fillRect(0, 0, cw, 6 * scale);

    var pad = 12 * scale;
    var fs = Math.max(8, scale * 10); /* base font size skaliert */

    ctx.fillStyle = data.accentColor;
    ctx.fillRect(pad, pad + 20 * scale, Math.min(60 * scale, cw - pad * 2), 2 * scale);

    /* Logo */
    if (data.logoDataUrl) {
      try {
        var img = new Image();
        /* Logo wird asynchron geladen; fuer synchronen Aufruf
           hier nur ein Platzhalter setzen, echtes Zeichnen
           passiert im der asyncen Variante ueber drawImage. */
      } catch(e) {}
    }

    var y = pad + 30 * scale;

    /* Firma */
    if (data.company) {
      ctx.font = 'bold ' + Math.max(8, fs * 1.4) + 'px ' + getFontFamily();
      ctx.fillStyle = data.accentColor;
      ctx.textAlign = 'left';
      ctx.fillText(data.company, pad, y);
      y += Math.max(12, fs * 1.4) + 4 * scale;
    }

    /* Name */
    if (data.name) {
      ctx.font = 'bold ' + Math.max(10, fs * 1.8) + 'px ' + getFontFamily();
      ctx.fillStyle = data.accentColor;
      ctx.textAlign = 'left';
      ctx.fillText(data.name, pad, y);
      y += Math.max(16, fs * 1.8) + 4 * scale;
    }

    /* Funktion */
    if (data.title) {
      ctx.font = Math.max(8, fs * 1.1) + 'px ' + getFontFamily();
      ctx.fillStyle = data.textColor;
      ctx.textAlign = 'left';
      ctx.fillText(data.title, pad, y);
      y += Math.max(12, fs * 1.1) + 6 * scale;
    }

    /* Trennlinie */
    if (data.company || data.name || data.title) {
      ctx.strokeStyle = data.accentColor;
      ctx.lineWidth = 0.5 * scale;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(cw - pad, y);
      ctx.stroke();
      y += 6 * scale;
    }

    /* Kontaktdaten */
    ctx.font = Math.max(7, fs * 0.95) + 'px ' + getFontFamily();
    ctx.fillStyle = data.textColor;
    ctx.textAlign = 'left';
    var lines = contactLines(data);
    lines.forEach(function(line) {
      if (y + fs > ch - pad) return;
      var icon = '';
      if (line.icon === 'telephone') icon = 'T: ';
      else if (line.icon === 'smartphone') icon = 'M: ';
      else if (line.icon === 'mail') icon = 'E: ';
      else if (line.icon === 'globe') icon = 'W: ';
      else icon = line.label + ': ';
      ctx.fillText(icon + line.text, pad, y);
      y += Math.max(10, fs) + 2 * scale;
    });

    /* Adresse */
    var addrParts = [];
    if (data.street) addrParts.push(data.street);
    if (data.plz || data.city) addrParts.push((data.plz || '') + ' ' + (data.city || ''));
    if (addrParts.length) {
      if (y + fs > ch - pad) return;
      ctx.fillText(addrParts.join(', '), pad, y);
    }
  }

  /* Logo asynchron laden und Karte zeichnen */
  function drawCardWithLogo(canvasEl, data, w, h) {
    var ctx = canvasEl.getContext('2d');
    if (data.logoDataUrl) {
      var img = new Image();
      img.onload = function() {
        ctx.clearRect(0, 0, w, h);
        /* Hintergrund */
        ctx.fillStyle = data.bgColor;
        ctx.fillRect(0, 0, w, h);
        /* Akzent-Balken */
        ctx.fillStyle = data.accentColor;
        ctx.fillRect(0, 0, w, 6);
        var pad = 12, fs = 10;
        ctx.fillStyle = data.accentColor;
        ctx.fillRect(pad, pad + 20, Math.min(60, w - pad * 2), 2);
        /* Logo top-links */
        var logoW = 40, logoH = 40;
        var ly = pad + 30;
        try {
          ctx.drawImage(img, pad, ly, logoW, logoH);
          /* Text rechts vom Logo */
          var textX = pad + logoW + 10;
          var y = pad + 30 + logoH / 2;
          if (data.company) {
            ctx.font = 'bold 14px ' + getFontFamily();
            ctx.fillStyle = data.accentColor;
            ctx.textAlign = 'left';
            ctx.fillText(data.company, textX, y);
            y += 18;
          }
          if (data.name) {
            ctx.font = 'bold 18px ' + getFontFamily();
            ctx.fillStyle = data.accentColor;
            ctx.textAlign = 'left';
            ctx.fillText(data.name, textX, y);
            y += 22;
          }
          if (data.title) {
            ctx.font = '11px ' + getFontFamily();
            ctx.fillStyle = data.textColor;
            ctx.textAlign = 'left';
            ctx.fillText(data.title, textX, y);
            y += 16;
          }
          var lineY = y + 6;
          ctx.strokeStyle = data.accentColor;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(pad, lineY);
          ctx.lineTo(w - pad, lineY);
          ctx.stroke();
          var cy = lineY + 8;
          var lines = contactLines(data);
          ctx.font = '10px ' + getFontFamily();
          ctx.fillStyle = data.textColor;
          lines.forEach(function(line) {
            var icon = line.icon === 'telephone' ? 'T: ' : line.icon === 'smartphone' ? 'M: ' : line.icon === 'mail' ? 'E: ' : line.icon === 'globe' ? 'W: ' : line.label + ': ';
            if (cy + 10 > h - pad) return;
            ctx.fillText(icon + line.text, pad, cy);
            cy += 14;
          });
          var addrParts = [];
          if (data.street) addrParts.push(data.street);
          if (data.plz || data.city) addrParts.push((data.plz || '') + ' ' + (data.city || ''));
          if (addrParts.length && cy + 10 <= h - pad) {
            ctx.fillText(addrParts.join(', '), pad, cy);
          }
        } catch(e) {
          drawCard(ctx, data, w, h, 1);
        }
      };
      img.onerror = function() { drawCard(ctx, data, w, h, 1); };
      img.src = data.logoDataUrl;
    } else {
      drawCard(ctx, data, w, h, 1);
    }
  }

  /* Vorschau aktualisieren */
  function updatePreview() {
    var state = getFormState();
    var data = renderCardData(state);
    var out = document.getElementById('tool-output');
    if (!out) return;

    var previewW = 500;
    var scale = previewW / CARD_W_PX;
    var previewH = Math.round(CARD_H_PX * scale);

    out.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;justify-content:center;margin-bottom:16px;';
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(CARD_W_PX * scale);
    canvas.height = Math.round(CARD_H_PX * scale);
    canvas.style.cssText = 'border:1px solid #ccc;border-radius:4px;max-width:100%;';
    wrapper.appendChild(canvas);
    out.appendChild(wrapper);

    var ctx = canvas.getContext('2d');
    /* Hintergrund weiss fuer Vorschau */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCardWithLogo(canvas, data, canvas.width, canvas.height);

    /* Buttons */
    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;';

    var pngBtn = document.createElement('button');
    pngBtn.type = 'button';
    pngBtn.className = 'btn btn-primary';
    pngBtn.textContent = txt('PNG herunterladen', 'Download PNG');
    pngBtn.addEventListener('click', function() { downloadPNG(data); });
    btns.appendChild(pngBtn);

    var pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.className = 'btn btn-secondary';
    pdfBtn.textContent = txt('PDF Druckbogen herunterladen', 'Download A4 PDF Sheet');
    pdfBtn.addEventListener('click', function() { downloadPDF(data); });
    btns.appendChild(pdfBtn);

    out.appendChild(btns);
  }

  function getFormState() {
    var get = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var getFileData = function(id) {
      var el = document.getElementById(id);
      if (!el || !el.files || !el.files[0]) return null;
      var file = el.files[0];
      return new Promise(function(resolve) {
        var fr = new FileReader();
        fr.onload = function() { resolve(fr.result); };
        fr.onerror = function() { resolve(null); };
        fr.readAsDataURL(file);
      });
    };
    return {
      company: get('vf-company'),
      name: get('vf-name'),
      title: get('vf-title'),
      phone: get('vf-phone'),
      mobile: get('vf-mobile'),
      email: get('vf-email'),
      web: get('vf-web'),
      street: get('vf-street'),
      plz: get('vf-plz'),
      city: get('vf-city'),
      template: get('vf-template'),
      accentColor: get('vf-accent') || '#2c3e7a',
      textColor: get('vf-text') || '#222222',
      bgColor: get('vf-bg') || '#ffffff',
      fontFamily: get('vf-font') || 'sans',
      logoDataUrl: null /* wird async geladen */
    };
  }

  function downloadPNG(data) {
    var canvas = document.createElement('canvas');
    canvas.width = CARD_W_PX;
    canvas.height = CARD_H_PX;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CARD_W_PX, CARD_H_PX);
    drawCardWithLogo(canvas, data, CARD_W_PX, CARD_H_PX);
    canvas.toBlob(function(blob) {
      if (!blob) return;
      var lastname = (data.name || 'card').replace(/\s+/g, '-').toLowerCase();
      downloadBlob(blob, 'visitenkarte-' + lastname + '.png');
    }, 'image/png');
  }

  function downloadPDF(data) {
    var PDFLib_ = (typeof PDFLib !== 'undefined') ? PDFLib : null;
    if (!PDFLib_) {
      var out = document.getElementById('tool-output');
      if (out) out.innerHTML += '<p class="text-muted">' + txt('PDF-Bibliothek konnte nicht geladen werden.', 'PDF library could not be loaded.') + '</p>';
      return;
    }

    var out = document.getElementById('tool-output');
    out.innerHTML += '<p class="text-muted">' + txt('PDF wird erstellt...', 'Creating PDF...') + '</p>';

    var positions = cardGrid(10);
    var chain = Promise.resolve();

    positions.forEach(function(pos) {
      chain = chain.then(function() {
        return new Promise(function(resolve) {
          var c = document.createElement('canvas');
          c.width = CARD_W_PX;
          c.height = CARD_H_PX;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, CARD_W_PX, CARD_H_PX);
          drawCardWithLogo(c, data, CARD_W_PX, CARD_H_PX);
          c.toBlob(function(blob) {
            if (!blob) { resolve(); return; }
            var fr = new FileReader();
            fr.onload = function() { resolve(fr.result); };
            fr.onerror = function() { resolve(null); };
            fr.readAsArrayBuffer(blob);
          }, 'image/png');
        }).then(function(buf) {
          if (!buf) return Promise.resolve(null);
          return PDFLib_.PDFDocument.create().then(function(doc) {
            return doc.embedPng(new Uint8Array(buf)).then(function(img) {
              return { doc: doc, img: img, w: img.width, h: img.height };
            });
          }).then(function(result) {
            if (!result) return Promise.resolve(null);
            var doc = result.doc, img = result.img;
            var page = doc.addPage([A4_W_PT, A4_H_PT]);
            page.drawRectangle({ x: 0, y: 0, width: A4_W_PT, height: A4_H_PT, color: PDFLib_.rgb(1, 1, 1) });
            /* Schnittmarken */
            page.drawRectangle({ x: pos.x, y: pos.y, width: pos.w, height: pos.h, color: PDFLib_.rgb(0.85, 0.85, 0.85) });
            page.drawImage(img, { x: pos.x + 1, y: pos.y + 1, width: pos.w - 2, height: pos.h - 2 });
            return doc.save({ useObjectStreams: true });
          }).then(function(bytes) {
            return bytes;
          });
        });
      });
    });

    chain.then(function(bytes) {
      if (!bytes) {
        out.innerHTML += '<p class="text-muted">' + txt('Fehler beim PDF erstellen.', 'Error creating PDF.') + '</p>';
        return;
      }
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'visitenkarten-a4.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
      if (window.playbook) {
        window.playbook.report({ tool: 'visitenkarte-designer', summary: txt('A4-PDF-Bogen erstellt', 'A4 PDF sheet created') });
      }
    }).catch(function(err) {
      out.innerHTML += '<p class="text-muted">❌ ' + txt('PDF-Fehler:', 'PDF error: ') + (err && err.message ? err.message : err) + '</p>';
    });
  }

  /* UI aufbauen */
  function buildUI() {
    var box = document.getElementById('tool-inputs');
    if (!box) return;

    function addInput(type, id, label, ph, extra) {
      var placeholder, opts = {}, isSelect = false;
      if (ph && typeof ph === 'object' && ph.de !== undefined) {
        placeholder = ph;
      } else if (ph && typeof ph === 'string') {
        placeholder = { de: ph, en: ph };
      } else {
        placeholder = { de: '', en: '' };
      }
      if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
        if (extra.options !== undefined) {
          isSelect = true;
          opts = extra;
        } else {
          opts = extra;
        }
      }
      var lbl = document.createElement('label');
      lbl.className = 'file-label';
      lbl.textContent = txt(label.de, label.en);
      lbl.setAttribute('for', id);
      box.appendChild(lbl);
      var input;
      if (type === 'select') {
        input = document.createElement('select');
        input.id = id;
        input.className = 'form-control';
        (opts.options || []).forEach(function(o) {
          if (o.v !== undefined) {
            var opt = document.createElement('option');
            opt.value = o.v;
            opt.textContent = o.t;
            input.appendChild(opt);
          }
        });
      } else if (type === 'color') {
        input = document.createElement('input');
        input.type = 'color';
        input.id = id;
        input.value = opts.value || '#2c3e7a';
        input.className = 'form-control';
      } else {
        input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.placeholder = txt(placeholder.de, placeholder.en);
        input.className = 'form-control';
        if (opts.required) input.required = true;
      }
      box.appendChild(input);
      return input;
    }

    /* Vorlage */
    addInput('select', 'vf-template', { de: 'Vorlage', en: 'Template' }, '', {
      options: [
        { v: 'modern', t: txt('Modern', 'Modern') },
        { v: 'klassisch', t: txt('Klassisch', 'Classic') },
        { v: 'markant', t: txt('Markant', 'Bold') },
        { v: 'duo', t: txt('Duo', 'Duo') }
      ]
    });

    /* Farben */
    addInput('color', 'vf-accent', { de: 'Akzentfarbe', en: 'Accent color' }, '', { value: '#2c3e7a' });
    addInput('color', 'vf-text', { de: 'Textfarbe', en: 'Text color' }, '', { value: '#222222' });
    addInput('color', 'vf-bg', { de: 'Hintergrundfarbe', en: 'Background color' }, '', { value: '#ffffff' });

    /* Schriftart */
    addInput('select', 'vf-font', { de: 'Schriftart', en: 'Font' }, '', {
      options: [
        { v: 'sans', t: txt('Sans-Serif', 'Sans-Serif') },
        { v: 'serif', t: txt('Serif', 'Serif') },
        { v: 'mono', t: txt('Monospace', 'Monospace') },
        { v: 'display', t: txt('Display', 'Display') }
      ]
    });

    /* Logo-Upload */
    var logoLbl = document.createElement('label');
    logoLbl.className = 'file-label';
    logoLbl.textContent = txt('Logo-Upload (optional)', 'Logo upload (optional)');
    box.appendChild(logoLbl);
    var logoInput = document.createElement('input');
    logoInput.type = 'file';
    logoInput.id = 'vf-logo';
    logoInput.accept = 'image/*';
    logoInput.className = 'form-control';
    logoInput.setAttribute('aria-label', txt('Logo hochladen', 'Upload logo'));
    box.appendChild(logoInput);

    /* Trennlinie */
    var hr = document.createElement('hr');
    hr.style.marginTop = '8px';
    hr.style.marginBottom = '8px';
    box.appendChild(hr);

    /* Firmenname */
    addInput('text', 'vf-company', { de: 'Firma', en: 'Company' }, { de: 'Firmenname', en: 'Company name' });
    addInput('text', 'vf-name', { de: 'Name', en: 'Name' }, { de: 'Voller Name', en: 'Full name' }, { required: true });
    addInput('text', 'vf-title', { de: 'Funktion', en: 'Job title' }, { de: 'Position / Funktion', en: 'Position / Title' });

    /* Kontakt */
    box.appendChild(document.createElement('hr'));
    addInput('tel', 'vf-phone', { de: 'Telefon', en: 'Phone' }, { de: 'Telefonnummer', en: 'Phone number' });
    addInput('tel', 'vf-mobile', { de: 'Mobil', en: 'Mobile' }, { de: 'Mobilnummer', en: 'Mobile number' });
    addInput('email', 'vf-email', { de: 'E-Mail', en: 'Email' }, { de: 'E-Mail Adresse', en: 'Email address' });
    addInput('url', 'vf-web', { de: 'Webseite', en: 'Website' }, { de: 'https://...', en: 'https://...' });

    /* Adresse */
    box.appendChild(document.createElement('hr'));
    addInput('text', 'vf-street', { de: 'Straße', en: 'Street' }, { de: 'Straße und Hausnummer', en: 'Street and number' });
    var addrRow = document.createElement('div');
    addrRow.style.cssText = 'display:flex;gap:8px;';
    var plzInput = document.createElement('input');
    plzInput.type = 'text'; plzInput.id = 'vf-plz'; plzInput.placeholder = txt('PLZ', 'ZIP'); plzInput.className = 'form-control';
    plzInput.style.cssText = 'width:80px;';
    var cityInput = document.createElement('input');
    cityInput.type = 'text'; cityInput.id = 'vf-city'; cityInput.placeholder = txt('Ort', 'City'); cityInput.className = 'form-control';
    addrRow.appendChild(plzInput); addrRow.appendChild(cityInput);
    box.appendChild(addrRow);

    /* Buttons */
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;';

    var previewBtn = document.createElement('button');
    previewBtn.type = 'button'; previewBtn.className = 'btn btn-primary';
    previewBtn.textContent = txt('Vorschau aktualisieren', 'Update preview');
    previewBtn.addEventListener('click', updatePreview);
    btnRow.appendChild(previewBtn);

    box.appendChild(btnRow);

    /* Ausgabe-Bereich */
    var out = document.getElementById('tool-output');
    if (out) {
      out.innerHTML = '<p class="text-muted">' + txt('Erstelle deine Visitenkarte und klicke auf "Vorschau aktualisieren".', 'Create your business card and click "Update preview".') + '</p>';
    }
  }

  /* Init */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }

  /* Node-Test-Exports */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { cardGrid: cardGrid, renderCardData: renderCardData, contactLines: contactLines };
  }
})();
