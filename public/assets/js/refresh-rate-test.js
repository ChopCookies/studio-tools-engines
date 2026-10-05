/* ══════════════════════════════════════════════════
   refresh-rate-test.js: Bildwiederholrate messen
   Misst die tatsächliche Bildwiederholfrequenz (Hz) des
   Displays über requestAnimationFrame, inkl. Durchschnitt,
   Minimum und Maximum. Während der Messung wird der aktuelle
   Wert live angezeigt. Läuft komplett lokal.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }

  /* -------- pure engine (node-testable) -------- */

  // Given an array of frame timestamps (ms) and the measured elapsed
  // duration, compute fps stats. Pure so it can be unit-tested.
  function computeFps(timestamps) {
    if (!timestamps || timestamps.length < 2) {
      return { frames: timestamps ? timestamps.length : 0, avg: 0, min: 0, max: 0 };
    }
    var intervals = [];
    for (var i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    var sum = 0, minInt = Infinity, maxInt = 0, n = 0;
    for (var j = 0; j < intervals.length; j++) {
      var d = intervals[j];
      if (d <= 0) continue;
      n++;
      sum += d;
      if (d < minInt) minInt = d;
      if (d > maxInt) maxInt = d;
    }
    var avg = n ? sum / n : 0;
    return {
      frames: timestamps.length,
      avg: avg ? 1000 / avg : 0,
      min: maxInt ? 1000 / maxInt : 0,
      max: minInt !== Infinity ? 1000 / minInt : 0
    };
  }

  // Current instantaneous fps from the most recent frame interval.
  function liveFps(timestamps) {
    if (!timestamps || timestamps.length < 2) return 0;
    var d = timestamps[timestamps.length - 1] - timestamps[timestamps.length - 2];
    return d > 0 ? 1000 / d : 0;
  }

  /* -------- UI -------- */

  var running = false;
  var timestamps = [];
  var rafId = null;
  var DURATION_MS = 5000;
  var STARTED_AT = 0;

  function round2(n) { return Math.round(n * 100) / 100; }

  function updateLive() {
    var liveEl = E('rf-live');
    if (!liveEl) return;
    var elapsed = ((performance.now() - STARTED_AT) / 1000).toFixed(1);
    var cur = round2(liveFps(timestamps));
    var avg = timestamps.length >= 2 ? round2(computeFps(timestamps).avg) : 0;
    liveEl.innerHTML =
      '<div class="live-value">' + cur + ' Hz</div>' +
      '<div class="live-label">aktuell</div>' +
      '<div class="live-avg">Schnitt bisher: ' + avg + ' Hz</div>' +
      '<div class="live-time">Messung läuft ... ' + elapsed + ' / ' + (DURATION_MS / 1000) + ' s</div>';
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    var res = computeFps(timestamps);
    var el = E('tool-output');
    if (el) {
      var html = '<div class="result-display">';
      html += '<div class="result-big">' + round2(res.avg) + ' Hz</div>';
      html += '<div class="result-label">Durchschnittliche Bildwiederholrate</div>';
      html += '<div class="result-rows">';
      html += '<div class="result-row"><span class="result-label">Minimum</span><span class="result-value">' + round2(res.min) + ' Hz</span></div>';
      html += '<div class="result-row"><span class="result-label">Maximum</span><span class="result-value">' + round2(res.max) + ' Hz</span></div>';
      html += '<div class="result-row"><span class="result-label">Frames</span><span class="result-value">' + res.frames + '</span></div>';
      html += '<div class="result-row"><span class="result-label">Messdauer</span><span class="result-value">' + (DURATION_MS / 1000) + ' s</span></div>';
      html += '</div></div>';
      el.innerHTML = html;
    }
    var liveWrap = E('rf-live-wrap');
    if (liveWrap) liveWrap.style.display = 'none';
    var btn = E('rf-start');
    if (btn) btn.textContent = 'Erneut messen';
  }

  function tick(ts) {
    if (!running) return;
    timestamps.push(ts);
    updateLive();
    if (ts - STARTED_AT >= DURATION_MS) {
      stop();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    timestamps = [];
    STARTED_AT = performance.now();
    running = true;
    var btn = E('rf-start');
    if (btn) btn.textContent = 'Messung läuft ...';
    var hint = E('rf-hint');
    if (hint) hint.style.display = 'block';
    var liveWrap = E('rf-live-wrap');
    if (liveWrap) liveWrap.style.display = 'block';
    var out = E('tool-output');
    if (out) out.innerHTML = '';
    rafId = requestAnimationFrame(tick);
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><button type="button" id="rf-start" class="btn-app">Messung starten</button></div>' +
      '<div class="field" id="rf-live-wrap" style="display:none"><div class="rf-live" id="rf-live"></div></div>' +
      '<div id="rf-hint" class="hint" style="display:none">Die Messung läuft 5 Sekunden. Halte das Fenster sichtbar und bewege es nicht.</div>';

    var btn = E('rf-start');
    btn.addEventListener('click', start);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeFps: computeFps, liveFps: liveFps };
  }
})();
