/* ══════════════════════════════════════════════════
   webcam-test.js: Kamera-Test
   Öffnet die Kamera und zeigt das Live-Bild als Vorschau,
   mit Spiegel-Option und einer Kamera-Auswahl (bei mehreren
   Kameras, z. B. Front/Rückkamera am Handy). Erkennt, ob gar
   keine Kamera vorhanden ist. Nur lokal, das Bild verlässt
   das Gerät nicht.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }

  /* -------- UI -------- */

  var stream = null;
  var video = null;
  var devices = [];

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    var wrap = E('wc-preview');
    if (wrap) wrap.style.display = 'none';
    var btn = E('wc-start');
    if (btn) btn.textContent = 'Kamera öffnen';
  }

  // Open the currently selected camera. Used on start and when the user
  // switches to a different camera while a stream is already running.
  function openSelected(keepRunningStatus) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Dein Browser unterstützt keine Kameranutzung (getUserMedia fehlt).', 'err');
      return;
    }
    var sel = E('wc-camera');
    // If we enumerated and found no camera at all, don't even try.
    if (sel && sel.value === '' && devices.length === 0) {
      setStatus('Keine Kamera gefunden. Prüfe, ob eine Kamera angeschlossen ist.', 'err');
      return;
    }
    var constraints = { video: { facingMode: 'user' } };
    if (sel && sel.value) {
      // Use the explicitly selected camera (works for front/back on mobile too).
      constraints = { video: { deviceId: { exact: sel.value } } };
    }
    setStatus('Bitte Kamera-Zugriff erlauben ...', '');
    navigator.mediaDevices.getUserMedia(constraints)
      .then(function (s) { onStream(s, keepRunningStatus); })
      .catch(onError);
  }

  function setStatus(msg, kind) {
    var el = E('wc-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'wc-status ' + (kind || '');
  }

  function onStream(s, keepRunningStatus) {
    stream = s;
    var wrap = E('wc-preview');
    var v = E('wc-video');
    if (!wrap || !v) return;
    v.srcObject = s;
    wrap.style.display = 'block';
    var deviceName = '';
    var sel = E('wc-camera');
    if (sel && sel.value && sel.selectedOptions && sel.selectedOptions[0]) {
      deviceName = ' (' + sel.selectedOptions[0].textContent + ')';
    }
    setStatus('Kamera läuft' + deviceName + '. Das Bild wird nur lokal angezeigt.', 'ok');
    var btn = E('wc-start');
    if (btn && !keepRunningStatus) btn.textContent = 'Kamera schließen';
    loadDevices(); // refresh labels now that permission is granted
  }

  function onError(err) {
    var name = (err && err.name) || 'unbekannter Fehler';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      setStatus('Zugriff verweigert. Bitte erlaube die Kamera im Browser (ggf. in den Einstellungen).', 'err');
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      setStatus('Keine Kamera gefunden. Prüfe, ob eine Kamera angeschlossen und nicht deaktiviert ist.', 'err');
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      setStatus('Kamera wird bereits von einer anderen Anwendung verwendet.', 'err');
    } else {
      setStatus('Kamera konnte nicht geöffnet werden: ' + name + '.', 'err');
    }
  }

  function toggleMirror() {
    var v = E('wc-video');
    if (!v) return;
    var mirrored = v.classList.toggle('wc-mirrored');
    var cb = E('wc-mirror');
    if (cb) cb.checked = mirrored;
  }

  // Populate the camera <select> from enumerateDevices(). Also used to detect
  // "no camera at all" on desktop, where getUserMedia may otherwise hang or
  // fail with a generic error.
  function loadDevices() {
    var sel = E('wc-camera');
    if (!sel) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }
    navigator.mediaDevices.enumerateDevices().then(function (list) {
      devices = list.filter(function (d) { return d.kind === 'videoinput'; });
      if (!sel) return;
      sel.innerHTML = '';
      if (devices.length === 0) {
        var noOpt = document.createElement('option');
        noOpt.value = '';
        noOpt.textContent = 'Keine Kamera gefunden';
        sel.appendChild(noOpt);
        return;
      }
      devices.forEach(function (d, i) {
        var opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || ('Kamera ' + (i + 1));
        sel.appendChild(opt);
      });
    }).catch(function () {});
  }

  function start() {
    // If already running, just close it.
    if (stream) {
      stopStream();
      setStatus('Kamera geschlossen.', 'ok');
      return;
    }
    openSelected(false);
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label for="wc-camera">Kamera</label><select id="wc-camera"><option value="">Kamera wird gesucht ...</option></select></div>' +
      '<div class="field"><button type="button" id="wc-start" class="btn-app">Kamera öffnen</button></div>' +
      '<div class="field"><label class="inline-check"><input type="checkbox" id="wc-mirror"> Bild spiegeln</label></div>' +
      '<div id="wc-status" class="wc-status">Noch nicht gestartet.</div>' +
      '<div id="wc-preview" class="wc-preview" style="display:none"><video id="wc-video" autoplay playsinline muted></video></div>';

    var btn = E('wc-start');
    btn.addEventListener('click', start);
    var mirror = E('wc-mirror');
    mirror.addEventListener('change', toggleMirror);
    video = E('wc-video');
    // Live camera switcher: if a stream is running, changing the selection
    // immediately re-opens the stream on the newly chosen camera.
    var sel = E('wc-camera');
    sel.addEventListener('change', function () {
      if (!stream) return;
      stopStream();
      openSelected(true);
    });
    loadDevices();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
  }
})();
