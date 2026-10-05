/* ══════════════════════════════════════════════════
   mikrofon-test.js: Mikrofon-Test
   Öffnet das Mikrofon und zeigt eine Live-Pegelanzeige
   (Aussteuerungsmesser), damit du prüfen kannst, ob und
   wie laut dein Mikrofon aufnimmt. Nur lokal, kein Upload.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }

  /* -------- pure engine (node-testable) -------- */

  // Normalizes an audio time-domain array (Int8Array / Float32Array,
  // values roughly -1..1 or -128..127) into a 0..1 level.
  function levelFromTimeDomain(arr) {
    if (!arr || !arr.length) return 0;
    var sum = 0;
    var max = 0;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      // Uint8Array (analyser default) is 0..255 centered at 128.
      if (typeof v === 'number' && v > 127 && !(arr instanceof Float32Array) && !(arr instanceof Int8Array)) {
        v = v - 128;
      }
      sum += v * v;
      var a = Math.abs(v);
      if (a > max) max = a;
    }
    var rms = Math.sqrt(sum / arr.length);
    // Normalize: assume full-scale ~128 for int or 1.0 for float.
    var scale = (arr instanceof Float32Array) ? 1.0 : 128;
    rms = Math.min(1, rms / scale);
    var peak = Math.min(1, max / scale);
    return { rms: rms, peak: peak };
  }

  /* -------- UI -------- */

  var stream = null;
  var audioCtx = null;
  var analyser = null;
  var dataArr = null;
  var rafId = null;

  function stopStream() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (audioCtx && audioCtx.close) { audioCtx.close().catch(function () {}); }
    audioCtx = null; analyser = null;
    var bar = E('mf-bar');
    if (bar) bar.style.width = '0%';
    var pct = E('mf-pct');
    if (pct) pct.textContent = '0 %';
    var btn = E('mf-start');
    if (btn) btn.textContent = 'Mikrofon öffnen';
    setStatus('Gestoppt.', 'ok');
  }

  function setStatus(msg, kind) {
    var el = E('mf-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mf-status ' + (kind || '');
  }

  function draw() {
    if (!analyser || !dataArr) return;
    analyser.getByteTimeDomainData(dataArr);
    var bar = E('mf-bar');
    var pct = E('mf-pct');
    if (bar && pct) {
      var lvl = levelFromTimeDomain(dataArr);
      // Apply a gentle smoothing for a readable meter.
      var pctVal = Math.max(0, Math.min(100, Math.round(lvl.rms * 140)));
      bar.style.width = pctVal + '%';
      pct.textContent = pctVal + ' %';
      if (pctVal > 95) bar.style.background = '#d98484';
      else bar.style.background = '#76A7C9';
    }
    rafId = requestAnimationFrame(draw);
  }

  function onStream(s) {
    stream = s;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var src = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      src.connect(analyser);
      dataArr = new Uint8Array(analyser.fftSize);
    } catch (e) {
      setStatus('Audio-Kontext konnte nicht gestartet werden: ' + e.message, 'err');
      stopStream();
      return;
    }
    setStatus('Mikrofon läuft. Sprich oder mache ein Geräusch, um den Pegel zu sehen.', 'ok');
    var btn = E('mf-start');
    if (btn) btn.textContent = 'Mikrofon schließen';
    draw();
  }

  function onError(err) {
    var name = (err && err.name) || 'unbekannter Fehler';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      setStatus('Zugriff verweigert. Bitte erlaube das Mikrofon im Browser.', 'err');
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      setStatus('Kein Mikrofon gefunden.', 'err');
    } else {
      setStatus('Mikrofon konnte nicht geöffnet werden: ' + name + '.', 'err');
    }
  }

  function start() {
    if (stream) { stopStream(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Dein Browser unterstützt keine Mikrofonnutzung.', 'err');
      return;
    }
    setStatus('Bitte Mikrofon-Zugriff erlauben ...', '');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(onStream).catch(onError);
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><button type="button" id="mf-start" class="btn-app">Mikrofon öffnen</button></div>' +
      '<div id="mf-status" class="mf-status">Noch nicht gestartet.</div>' +
      '<div class="mf-meter"><div class="mf-rail"><div id="mf-bar" class="mf-bar"></div></div><div id="mf-pct" class="mf-pct">0 %</div></div>' +
      '<div class="mf-track" id="mf-timeline"></div>';

    var btn = E('mf-start');
    btn.addEventListener('click', start);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { levelFromTimeDomain: levelFromTimeDomain };
  }
})();
