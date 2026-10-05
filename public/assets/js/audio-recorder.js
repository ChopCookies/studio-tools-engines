/*
   audio-recorder.js | "Audio Recorder – Gain, Noise Gate, Kompressor"
   Wave 2: mono/stereo Pro-Recorder for /audio-recorder (promoted live tool).

   100% client-side Web Audio recorder:
     - microphone source (user-selectable device via enumerateDevices/deviceId)
     - input GAIN (GainNode, dB)
     - NOISE GATE (custom AudioWorklet, threshold/floor/attack/release)
     - COMPRESSOR (DynamicsCompressorNode)
     - live VU meter (AnalyserNode RMS)
     - PAUSE / RESUME (3-control recorder; timer excludes paused segments)
     - record -> N-channel PCM capture via AudioWorklet (mono or stereo,
       depending on what the selected device actually exposes)
     - export interleaved WAV (native 16-bit PCM pack) and MP3 (lazy
       ffmpeg.wasm via lib/ffmpeg-utils.js, same engine as rausch-entfernen)

   The audio never leaves the device. Mic access is permission-gated by the
   browser. True simultaneous multi-mic -> separate files is NOT a portable
   browser API; channel count follows the actual device (mono/stereo), with a
   clear device-selection dropdown and an honest fallback ladder.

   Pure helpers (dbToGain, rms, applyGate, encodeWav16, concatChannels,
   interleaveChannels, fmtDuration, fmtBytes) are Node-testable and exported
   via module.exports.
-----------------------------------------------------------------*/
(function () {
  'use strict';

  var DE = true;
  function isEn() { return typeof window !== 'undefined' && window.__siteLang === 'en'; }
  DE = !isEn();
  function t(de, en) { return isEn() ? en : de; }

  var slug = 'audio-recorder';

  function esc(s) {
    if (window.esc) return window.esc(s);
    if (window.escText) return window.escText(s);
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var inputsEl = null, outputEl = null;

  /* ------------------------ pure engine (node-testable) ------------------------ */

  // dB (e.g. -12) -> linear multiplier.
  function dbToGain(db) { return Math.pow(10, (db || 0) / 20); }

  // Root-mean-square level of a Float32Array (0..1), for meters / dB readout.
  function rms(samples) {
    if (!samples || !samples.length) return 0;
    var sum = 0;
    for (var i = 0; i < samples.length; i++) { var s = samples[i]; sum += s * s; }
    return Math.sqrt(sum / samples.length);
  }

  // Per-sample noise gate with an attack/release envelope on the gate gain.
  // p: { thresholdDb, floorDb, attackS, releaseS, sampleRate, on }
  // Returns a NEW Float32Array (never mutates input).
  function applyGate(samples, p) {
    p = p || {};
    var sr = p.sampleRate || 48000;
    var floor = Math.pow(10, (p.floorDb == null ? -80 : p.floorDb) / 20);
    var atk = p.attackS ? (1 - Math.exp(-1 / (p.attackS * sr))) : 0.001;
    var rel = p.releaseS ? (1 - Math.exp(-1 / (p.releaseS * sr))) : 0.001;
    var on = p.on !== false;
    var thresh = p.thresholdDb == null ? -60 : p.thresholdDb;
    var g = 1.0;
    var out = new Float32Array(samples.length);
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var target = 1;
      if (on && s !== 0) {
        var db = 20 * Math.log10(Math.abs(s) + 1e-12);
        target = db > thresh ? 1 : floor;
      } else if (on && s === 0) {
        target = floor;
      }
      g += (target - g) * (target > g ? atk : rel);
      out[i] = s * g;
    }
    return out;
  }

  // TRUE if `x` is a container of numeric channel arrays (stereo/multi), as
  // opposed to a flat 1-D sample buffer (mono). Used so encodeWav16 stays
  // backwards-compatible with a flat mono Float32Array while also accepting
  // an array of per-channel Float32Arrays.
  function isChannelList(x) {
    return !!x && x.length > 0 && x[0] && typeof x[0].length === 'number' && !(typeof x[0] === 'number');
  }

  // Encode samples to a 16-bit PCM WAV ArrayBuffer. Accepts either:
  //   (a) a flat mono Float32Array/Array   -> 1 channel (backwards compatible)
  //   (b) an array of per-channel Float32  -> N interleaved channels (stereo)
  // Values approx -1..1 (clamped). Returns null on empty/first-channel-empty.
  function encodeWav16(samples, sampleRate) {
    if (!samples) return null;
    var channels = isChannelList(samples) ? samples : [samples];
    var nCh = channels.length;
    var sr = sampleRate || 48000;
    var n = channels[0] ? channels[0].length : 0;
    if (!n) return null;
    var bytesPerSample = 2;
    var dataSize = n * nCh * bytesPerSample;
    var buf = new ArrayBuffer(44 + dataSize);
    var dv = new DataView(buf);
    function wStr(off, s) { for (var i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); }
    function w32(off, v) { dv.setUint32(off, v, true); }
    function w16(off, v) { dv.setUint16(off, v, true); }
    wStr(0, 'RIFF'); w32(4, 36 + dataSize); wStr(8, 'WAVE');
    wStr(12, 'fmt '); w32(16, 16); w16(20, 1); /* PCM */ w16(22, nCh);
    w32(24, sr); w32(28, sr * nCh * bytesPerSample);
    w16(32, nCh * bytesPerSample); w16(34, 16); /* bits */
    wStr(36, 'data'); w32(40, dataSize);
    var o = 44;
    for (var i = 0; i < n; i++) {
      for (var c = 0; c < nCh; c++) {
        var s = channels[c][i];
        if (s == null) s = 0;
        s = Math.max(-1, Math.min(1, s));
        dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        o += 2;
      }
    }
    return buf;
  }

  // Join a list of capture chunks into one buffer per channel.
  // chunks: array where each element is an array of per-channel Float32Arrays
  //         with equal channel count. Returns array of merged channel
  //         Float32Arrays, or null if empty / zero samples.
  function concatChannels(chunks) {
    if (!chunks || !chunks.length) return null;
    var nCh = chunks[0].length;
    var total = 0, i, c;
    for (i = 0; i < chunks.length; i++) total += chunks[i][0].length;
    if (!total) return null;
    var out = [];
    for (c = 0; c < nCh; c++) out.push(new Float32Array(total));
    var o = 0;
    for (i = 0; i < chunks.length; i++) {
      for (c = 0; c < nCh; c++) { out[c].set(chunks[i][c], o); }
      o += chunks[i][0].length;
    }
    return out;
  }

  // Interleave N float channel arrays into a single Float32Array
  // (frame-major: L0 R0 L1 R1 ...). Used for ffmpeg f32le and for the WAV pack
  // path (mono stays identity). Returns null on empty.
  function interleaveChannels(channels) {
    if (!channels || !channels.length) return null;
    var n = channels[0].length;
    if (!n) return null;
    if (channels.length === 1) return channels[0];
    var out = new Float32Array(n * channels.length);
    var p = 0;
    for (var i = 0; i < n; i++) {
      for (var c = 0; c < channels.length; c++) { out[p++] = channels[c][i]; }
    }
    return out;
  }

  function fmtDuration(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function fmtBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  /* ------------------------ AudioWorklet module (blob-loaded) ------------------------ */

  // Two processors in one module:
  //  "ar-gate"   : noise gate (per-sample envelope) + pass-through, ALL channels.
  //  "ar-capture": posts N channel Float32 copies (mono/stereo depending on
  //                how many channels the device actually exposes).
  var WORKLET_SRC =
    'class ARGate extends AudioWorkletProcessor {' +
      'constructor(){ super(); this.g=1.0; }' +
      'static get parameterDescriptors(){ return [' +
        '{name:"threshold",defaultValue:-60,minValue:-160,maxValue:0},' +
        '{name:"floor",defaultValue:-80,minValue:-160,maxValue:0},' +
        '{name:"attack",defaultValue:0.01,minValue:0.0001,maxValue:1},' +
        '{name:"release",defaultValue:0.10,minValue:0.001,maxValue:5},' +
        '{name:"on",defaultValue:1,minValue:0,maxValue:1}' +
      '];}' +
      'process(inputs, outputs, params){' +
        'var inp = inputs[0]; if(!inp) return true;' +
        'var on = params.on[0] > 0.5;' +
        'var thresh = params.threshold[0];' +
        'var floor = Math.pow(10, params.floor[0] / 20);' +
        'var atk = 1 - Math.exp(-1 / (params.attack[0] * sampleRate));' +
        'var rel = 1 - Math.exp(-1 / (params.release[0] * sampleRate));' +
        'for (var c = 0; c < inp.length; c++){' +
          'var ch = inp[c]; var out = outputs[0][c]; if(!ch || !out) continue;' +
          'for (var i = 0; i < ch.length; i++){' +
            'var s = ch[i]; var target = 1;' +
            'if (on && s !== 0){ var db = 20*Math.log10(Math.abs(s)+1e-12); target = db>thresh?1:floor; }' +
            'else if (on && s === 0){ target = floor; }' +
            'this.g += (target - this.g) * (target>this.g?atk:rel);' +
            'out[i] = s * this.g;' +
          '}' +
        '}' +
        'return true;' +
      '}' +
    '}' +
    'class ARCapture extends AudioWorkletProcessor {' +
      'process(inputs){' +
        'var inp = inputs[0]; if(!inp) return true;' +
        'var n = 0; while(n < inp.length && inp[n]) n++;' +
        'var out = new Array(n);' +
        'for (var c = 0; c < n; c++) out[c] = inp[c].slice(0);' +
        'this.port.postMessage(out);' +
        'return true;' +
      '}' +
    '}' +
    'registerProcessor("ar-gate", ARGate);' +
    'registerProcessor("ar-capture", ARCapture);';

  var workletUrl = null;
  function ensureWorkletUrl() {
    if (!workletUrl) workletUrl = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
    return workletUrl;
  }

  /* ------------------------ recording state ------------------------ */

  var ctx = null, sourceNode = null, gainNode = null, gateNode = null;
  var compNode = null, analyser = null, meterDest = null;
  var captureNode = null, stream = null;
  var recChunks = [], recording = false, paused = false, raf = null;
  var lastDb = -90, recordedMs = 0, segStart = 0, timerInt = null, capturedChannels = null;
  var chosenDeviceId = null, detectedChannels = 1;

  /* ------------------------ UI ------------------------ */

  function el(id) { return document.getElementById(id); }

  function buildUI() {
    if (!inputsEl) return;
    inputsEl.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px">' +
        '<div>' +
          '<label style="font-size:.82rem;color:#9fb0c3;display:block;margin-bottom:4px">' +
            t('Mikrofon', 'Microphone') + '</label>' +
          '<select id="' + slug + '-device" style="width:100%;background:#0b1218;border:1px solid #243140;border-radius:8px;color:#e8eef5;padding:10px;font-size:.85rem">' +
            '<option value="">' + t('Standard-Mikrofon', 'Default microphone') + '</option>' +
          '</select>' +
          '<div id="' + slug + '-devicenum" style="font-size:.75rem;color:#9fb0c3;margin-top:4px"></div>' +
        '</div>' +
        '<div>' +
          '<label style="font-size:.82rem;color:#9fb0c3;display:block;margin-bottom:4px">' +
            t('Verstärkung (Gain)', 'Gain') +
            ' <span id="' + slug + '-gainval" style="color:#76A7C9">0 dB</span></label>' +
          '<input type="range" id="' + slug + '-gain" min="-24" max="24" step="0.5" value="0" style="width:100%">' +
        '</div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:14px">' +
        '<div style="border:1px solid #243140;border-radius:10px;padding:12px">' +
          '<label style="font-size:.82rem;color:#9fb0c3;display:flex;align-items:center;gap:6px;margin-bottom:6px">' +
            '<input type="checkbox" id="' + slug + '-gateon" checked> ' + t('Noise Gate', 'Noise gate') + '</label>' +
          '<div style="font-size:.8rem;color:#9fb0c3">' + t('Schwelle', 'Threshold') +
            ' <span id="' + slug + '-gthrval" style="color:#76A7C9">-60 dB</span></div>' +
          '<input type="range" id="' + slug + '-gthr" min="-90" max="-20" step="1" value="-60" style="width:100%">' +
          '<div style="display:flex;gap:12px;margin-top:6px">' +
            '<div style="flex:1;font-size:.8rem;color:#9fb0c3">' + t('Anstieg', 'Attack') + ' <span id="' + slug + '-gatkval" style="color:#76A7C9">10 ms</span>' +
              '<input type="range" id="' + slug + '-gatk" min="1" max="100" step="1" value="10" style="width:100%"></div>' +
            '<div style="flex:1;font-size:.8rem;color:#9fb0c3">' + t('Abklingen', 'Release') + ' <span id="' + slug + '-grelval" style="color:#76A7C9">100 ms</span>' +
              '<input type="range" id="' + slug + '-grel" min="20" max="1000" step="10" value="100" style="width:100%"></div>' +
          '</div>' +
        '</div>' +
        '<div style="border:1px solid #243140;border-radius:10px;padding:12px">' +
          '<label style="font-size:.82rem;color:#9fb0c3;display:flex;align-items:center;gap:6px;margin-bottom:6px">' +
            '<input type="checkbox" id="' + slug + '-compon"> ' + t('Kompressor', 'Compressor') + '</label>' +
          '<div style="font-size:.8rem;color:#9fb0c3">' + t('Schwelle', 'Threshold') +
            ' <span id="' + slug + '-cthrval" style="color:#76A7C9">-24 dB</span></div>' +
          '<input type="range" id="' + slug + '-cthr" min="-60" max="0" step="1" value="-24" style="width:100%">' +
          '<div style="font-size:.8rem;color:#9fb0c3;margin-top:6px">' + t('Ratio', 'Ratio') +
            ' <span id="' + slug + '-crval" style="color:#76A7C9">3:1</span></div>' +
          '<input type="range" id="' + slug + '-cratio" min="1" max="20" step="1" value="3" style="width:100%">' +
        '</div>' +
      '</div>' +

      '<div style="margin-top:14px">' +
        '<label style="font-size:.82rem;color:#9fb0c3;display:flex;align-items:center;gap:6px;margin-bottom:6px">' +
          '<input type="checkbox" id="' + slug + '-monitor" checked> ' +
          t('Eingang live abhören (Monitor)', 'Monitor input live') + '</label>' +
        '<div class="ar-rail" style="height:22px;background:#0b1218;border:1px solid #243140;border-radius:8px;overflow:hidden">' +
          '<div id="' + slug + '-vu" style="height:100%;width:0%;background:linear-gradient(90deg,#2E5F80,#76A7C9);transition:width .06s linear"></div>' +
        '</div>' +
        '<div id="' + slug + '-vudb" style="font-size:.75rem;color:#9fb0c3;margin-top:3px">&ndash;90 dB</div>' +
      '</div>' +

      '<div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
        '<button type="button" class="btn-app" id="' + slug + '-rec" style="font-size:1rem;padding:11px 26px">' +
          t('Aufnahme starten', 'Start recording') + '</button>' +
        '<button type="button" class="btn-app" id="' + slug + '-pause" disabled style="font-size:1rem;padding:11px 22px;opacity:.45">' +
          t('Pause', 'Pause') + '</button>' +
        '<span id="' + slug + '-timer" style="font-size:1rem;font-weight:600;color:#76A7C9">0:00</span>' +
        '<span id="' + slug + '-status" style="font-size:.82rem;color:#9fb0c3"></span>' +
      '</div>' +
      '<div id="' + slug + '-channels" style="font-size:.75rem;color:#9fb0c3;margin-top:8px"></div>';

    // wire live value labels
    var gainEl = el(slug + '-gain');
    gainEl.addEventListener('input', function () { el(slug + '-gainval').textContent = gainEl.value + ' dB'; });
    var gthr = el(slug + '-gthr');
    gthr.addEventListener('input', function () { el(slug + '-gthrval').textContent = gthr.value + ' dB'; });
    var gatk = el(slug + '-gatk');
    gatk.addEventListener('input', function () { el(slug + '-gatkval').textContent = gatk.value + ' ms'; });
    var grel = el(slug + '-grel');
    grel.addEventListener('input', function () { el(slug + '-grelval').textContent = grel.value + ' ms'; });
    var cthr = el(slug + '-cthr');
    cthr.addEventListener('input', function () { el(slug + '-cthrval').textContent = cthr.value + ' dB'; });
    var cratio = el(slug + '-cratio');
    cratio.addEventListener('input', function () { el(slug + '-crval').textContent = cratio.value + ':1'; });

    el(slug + '-rec').addEventListener('click', function () {
      if (recording) stopRecording(); else startRecording();
    });
    el(slug + '-pause').addEventListener('click', function () {
      if (!recording) return;
      if (paused) resumeRecording(); else pauseRecording();
    });
    el(slug + '-monitor').addEventListener('change', function () { applyMonitor(); });

    // populate device list (before recording we need permission; enumerate best-effort)
    populateDevices();
  }

  function setPauseBtn(from) {
    var b = el(slug + '-pause');
    if (!b) return;
    if (!recording) { b.disabled = true; b.style.opacity = '.45'; b.textContent = t('Pause', 'Pause'); return; }
    b.disabled = false; b.style.opacity = '1';
    b.textContent = paused ? t('Fortsetzen', 'Resume') : t('Pause', 'Pause');
  }

  function populateDevices() {
    var select = el(slug + '-device');
    if (!select) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(function (devs) {
      var mics = devs.filter(function (d) { return d.kind === 'audioinput'; });
      select.innerHTML = '<option value="">' + t('Standard-Mikrofon', 'Default microphone') + '</option>';
      mics.forEach(function (m, i) {
        var o = document.createElement('option');
        o.value = m.deviceId;
        o.textContent = (m.label || (t('Mikrofon', 'Microphone') + ' ' + (i + 1)));
        select.appendChild(o);
      });
      var label = t('Mikrofon(e) erkannt', 'microphone(s) detected') + ': ' + mics.length;
      el(slug + '-devicenum').textContent = label;
      select.addEventListener('change', function () { chosenDeviceId = select.value || null; });
    }).catch(function () {});
  }

  function applyMonitor() {
    if (!analyser) return;
    var m = el(slug + '-monitor').checked;
    if (meterDest) { try { meterDest.disconnect(); } catch (e) {} }
    meterDest = m ? ctx.destination : null;
    if (analyser) { try { analyser.disconnect(); } catch (e) {} }
    if (m && ctx) { analyser.connect(ctx.destination); }
  }

  function applyLiveParams() {
    if (gainNode) gainNode.gain.setTargetAtTime(dbToGain(parseFloat(el(slug + '-gain').value)), ctx.currentTime, 0.02);
    if (gateNode) {
      gateNode.parameters.get('threshold').setTargetAtTime(parseFloat(el(slug + '-gthr').value), ctx.currentTime, 0.02);
      gateNode.parameters.get('attack').setTargetAtTime(parseFloat(el(slug + '-gatk').value) / 1000, ctx.currentTime, 0.02);
      gateNode.parameters.get('release').setTargetAtTime(parseFloat(el(slug + '-grel').value) / 1000, ctx.currentTime, 0.02);
      gateNode.parameters.get('on').setTargetAtTime(el(slug + '-gateon').checked ? 1 : 0, ctx.currentTime, 0.02);
    }
    if (compNode && el(slug + '-compon').checked) {
      compNode.threshold.setTargetAtTime(parseFloat(el(slug + '-cthr').value), ctx.currentTime, 0.02);
      compNode.ratio.setTargetAtTime(parseFloat(el(slug + '-cratio').value), ctx.currentTime, 0.02);
    }
  }

  /* ------------------------ recording ------------------------ */

  function meterLoop() {
    raf = requestAnimationFrame(meterLoop);
    if (!analyser) return;
    var buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    var level = rms(buf);
    var db = level > 1e-6 ? 20 * Math.log10(level) : -90;
    var pct = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
    var vu = el(slug + '-vu'); if (vu) vu.style.width = pct + '%';
    var vudb = el(slug + '-vudb'); if (vudb) vudb.textContent = db.toFixed(1) + ' dB';
  }

  function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.AudioContext) {
      setStatus(t('Dein Browser unterstützt keine Mikrofonaufnahme.', 'Your browser does not support microphone recording.'), true);
      return;
    }
    var constraints = { audio: chosenDeviceId
      ? { deviceId: { exact: chosenDeviceId }, channelCount: { ideal: 2 } }
      : { channelCount: { ideal: 2 } } };
    getUserMediaSafe(constraints).then(function (s) {
      stream = s;
      recChunks = [];
      capturedChannels = null;
      recordedMs = 0; paused = false;
      detectedChannels = 1;
      var tr = s.getAudioTracks && s.getAudioTracks()[0];
      if (tr && tr.getSettings) {
        var sc = tr.getSettings().channelCount;
        if (typeof sc === 'number' && sc > 1) detectedChannels = 2;
      }
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = ctx.createMediaStreamSource(stream);
      gainNode = ctx.createGain();
      gainNode.gain.value = dbToGain(parseFloat(el(slug + '-gain').value));
      compNode = ctx.createDynamicsCompressor();
      compNode.threshold.value = parseFloat(el(slug + '-cthr').value);
      compNode.ratio.value = parseFloat(el(slug + '-cratio').value);
      compNode.knee.value = 10; compNode.attack.value = 0.003; compNode.release.value = 0.25;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;

      return ctx.audioWorklet.addModule(ensureWorkletUrl()).then(function () {
        gateNode = new AudioWorkletNode(ctx, 'ar-gate');
        gateNode.parameters.get('threshold').value = parseFloat(el(slug + '-gthr').value);
        gateNode.parameters.get('attack').value = parseFloat(el(slug + '-gatk').value) / 1000;
        gateNode.parameters.get('release').value = parseFloat(el(slug + '-grel').value) / 1000;
        gateNode.parameters.get('on').value = el(slug + '-gateon').checked ? 1 : 0;
        captureNode = new AudioWorkletNode(ctx, 'ar-capture');
        captureNode.port.onmessage = function (e) {
          // record only active chunks (pauses excluded)
          if (recording && !paused) recChunks.push(e.data);
        };

        sourceNode.connect(gainNode);
        gainNode.connect(gateNode);
        gateNode.connect(compNode);
        compNode.connect(analyser);
        if (el(slug + '-monitor').checked) analyser.connect(ctx.destination);

        // capture reads the processed (gated + compressed) bus
        gateNode.connect(captureNode);

        // live param updates while running
        var gainEl = el(slug + '-gain'), gthrEl = el(slug + '-gthr'), gatkEl = el(slug + '-gatk');
        var grelEl = el(slug + '-grel'), cthrEl = el(slug + '-cthr'), cratioEl = el(slug + '-cratio');
        gainEl.addEventListener('input', applyLiveParams);
        gthrEl.addEventListener('input', applyLiveParams);
        gatkEl.addEventListener('input', applyLiveParams);
        grelEl.addEventListener('input', applyLiveParams);
        cthrEl.addEventListener('input', applyLiveParams);
        cratioEl.addEventListener('input', applyLiveParams);
        el(slug + '-gateon').addEventListener('change', applyLiveParams);
        el(slug + '-compon').addEventListener('change', applyLiveParams);

        return ctx.resume();
      });
    }).then(function () {
      recording = true;
      paused = false;
      segStart = Date.now();
      el(slug + '-rec').textContent = t('Aufnahme stoppen', 'Stop recording');
      setStatus(t('Es wird aufgenommen…', 'Recording…'));
      updateChannelNote();
      setPauseBtn();
      startTimer();
      meterLoop();
    }).catch(function (err) {
      setStatus(t('Mikrofon nicht verfügbar oder Zugriff verweigert.', 'Microphone unavailable or access denied.') + (err && err.name ? ' (' + err.name + ')' : ''), true);
      teardown();
    });
  }

  function updateChannelNote() {
    var cEl = el(slug + '-channels');
    if (!cEl) return;
    if (detectedChannels > 1) {
      cEl.textContent = t('Stereo: Der Aufnahme-Bus wird auf 2 Kanälen erfasst.', 'Stereo: the capture bus is recorded on 2 channels.');
    } else {
      cEl.textContent = t(
        'Mono: Dieses Gerät liefert nur 1 Kanal (normal für Smartphones/Standard-Mikrofone).',
        'Mono: this device only exposes 1 channel (normal for phones/default mics).');
    }
  }

  function startTimer() {
    if (timerInt) clearInterval(timerInt);
    timerInt = setInterval(function () {
      var sec = (recordedMs + (paused ? 0 : (Date.now() - segStart))) / 1000;
      el(slug + '-timer').textContent = fmtDuration(sec);
    }, 250);
  }

  function pauseRecording() {
    if (!recording || paused) return;
    recordedMs += (Date.now() - segStart);
    paused = true;
    if (timerInt) clearInterval(timerInt), timerInt = null;
    el(slug + '-timer').textContent = fmtDuration(recordedMs / 1000);
    setStatus(t('Aufnahme pausiert.', 'Recording paused.'));
    setPauseBtn();
  }

  function resumeRecording() {
    if (!recording || !paused) return;
    paused = false;
    segStart = Date.now();
    setStatus(t('Wird fortgesetzt…', 'Resuming…'));
    setPauseBtn();
    startTimer();
  }

  function getUserMediaSafe(constraints) {
    // older Safari uses webkitGetUserMedia; navigator.mediaDevices covers modern.
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) return navigator.mediaDevices.getUserMedia(constraints);
    return new Promise(function (res, rej) {
      var g = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
      if (!g) return rej(new Error('no getUserMedia'));
      g.call(navigator, constraints, res, rej);
    });
  }

  function stopRecording() {
    recording = false;
    paused = false;
    if (timerInt) clearInterval(timerInt), timerInt = null;
    recordedMs += (Date.now() - segStart);
    el(slug + '-rec').textContent = t('Aufnahme starten', 'Start recording');
    setPauseBtn();

    // give the capture worklet one final tick, then teardown
    setTimeout(function () {
      var channels = concatChannels(recChunks);
      teardown();
      if (!channels || !channels[0] || !channels[0].length) { setStatus(t('Keine Audiodaten erfasst.', 'No audio captured.'), true); return; }
      capturedChannels = channels;
      var sr = ctx ? ctx.sampleRate : 48000;
      renderResult(channels, sr);
      setStatus(t('Aufnahme beendet.', 'Recording finished.'));
    }, 120);
  }

  function teardown() {
    if (raf) cancelAnimationFrame(raf), raf = null;
    if (timerInt) clearInterval(timerInt), timerInt = null;
    recording = false; paused = false;
    try { if (sourceNode) sourceNode.disconnect(); } catch (e) {}
    try { if (gainNode) gainNode.disconnect(); } catch (e) {}
    try { if (gateNode) gateNode.disconnect(); } catch (e) {}
    try { if (compNode) compNode.disconnect(); } catch (e) {}
    try { if (analyser) analyser.disconnect(); } catch (e) {}
    try { if (captureNode) captureNode.disconnect(); } catch (e) {}
    try { if (stream) stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) {}
    var vu = el(slug + '-vu'); if (vu) vu.style.width = '0%';
    try { if (ctx && ctx.state !== 'closed') ctx.close(); } catch (e) {}
    ctx = null; stream = null; sourceNode = gainNode = gateNode = compNode = analyser = captureNode = null;
  }

  /* ------------------------ output / export ------------------------ */

  function renderResult(channels, sr) {
    if (!outputEl) return;
    var nCh = channels.length;
    var wav = encodeWav16(channels, sr);
    var dur = channels[0].length / sr;
    var wavUrl = wav ? URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })) : null;
    var fmtTxt = (nCh > 1 ? t('Stereo', 'Stereo') : t('Mono', 'Mono')) + ' · 16-bit';

    var html =
      '<div style="display:grid;gap:12px">' +
        '<audio controls style="width:100%" src="' + wavUrl + '" preload="metadata"></audio>' +
        '<div style="font-size:.85rem;color:#9fb0c3">' +
          t('Dauer', 'Duration') + ': <strong style="color:#e8eef5">' + fmtDuration(dur) + '</strong>' +
          ' · ' + fmtTxt + ' · ' + sr + ' Hz' +
          (wav ? ' · ' + fmtBytes(wav.byteLength) : '') +
        '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<a class="btn-app" style="text-decoration:none;display:inline-block;text-align:center" download="aufnahme.wav" href="' + wavUrl + '">' +
            t('WAV herunterladen', 'Download WAV') + '</a>' +
          '<button type="button" class="btn-app" id="' + slug + '-mp3">' +
            t('MP3 erzeugen', 'Create MP3') + '</button>' +
          '<span id="' + slug + '-mp3stat" style="align-self:center;font-size:.82rem;color:#9fb0c3"></span>' +
        '</div>' +
      '</div>';

    outputEl.innerHTML = html;
    var mp3Btn = el(slug + '-mp3');
    mp3Btn.addEventListener('click', function () { makeMp3(channels, sr); });
  }

  function makeMp3(channels, sr) {
    var stat = el(slug + '-mp3stat');
    if (stat) stat.textContent = t('FFmpeg wird geladen…', 'Loading FFmpeg…');
    var inter = interleaveChannels(channels);
    var nCh = channels.length;
    getFFmpeg().then(function (ffu) {
      return ffu.execFFmpeg({
        inputs: [{ name: 'in.pcm', data: float32ToBytes(inter) }],
        args: ['-f', 'f32le', '-ar', String(sr), '-ac', String(nCh), '-i', 'in.pcm',
               '-c:a', 'libmp3lame', '-b:a', '192k', 'out.mp3'],
        output: 'out.mp3'
      });
    }).then(function (res) {
      if (stat) stat.textContent = '';
      var blob = new Blob([res.data], { type: 'audio/mpeg' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'aufnahme.mp3';
      document.body.appendChild(a); a.click(); a.remove();
      if (stat) stat.textContent = t('MP3 erstellt', 'MP3 ready') + ' · ' + fmtBytes(blob.size);
    }).catch(function (e) {
      if (stat) stat.textContent = t('MP3-Erzeugung nicht möglich (FFmpeg).', 'MP3 creation unavailable (FFmpeg).');
    });
  }

  var ffuPromise = null;
  function getFFmpeg() {
    if (window.ffmpegUtils) return Promise.resolve(window.ffmpegUtils);
    if (ffuPromise) return ffuPromise;
    // bump FF_VER whenever lib/ffmpeg-utils.js changes (Cloudflare stale-cache guard)
    var FF_VER = '20260914-1';
    ffuPromise = import('/assets/js/lib/ffmpeg-utils.js?' + FF_VER).then(function () { return window.ffmpegUtils; });
    return ffuPromise;
  }

  function float32ToBytes(f32) {
    return new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  }

  function setStatus(msg, isErr) {
    var s = el(slug + '-status');
    if (s) { s.textContent = msg; s.style.color = isErr ? '#d98484' : '#9fb0c3'; }
  }

  /* ------------------------ init ------------------------ */

  function setup() {
    inputsEl = el('tool-inputs');
    outputEl = el('tool-output');
    if (!inputsEl || !outputEl) return;
    buildUI();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { dbToGain: dbToGain, rms: rms, applyGate: applyGate, encodeWav16: encodeWav16, concatChannels: concatChannels, interleaveChannels: interleaveChannels, fmtDuration: fmtDuration, fmtBytes: fmtBytes };
  }
})();
