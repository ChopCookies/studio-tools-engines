/* ══════════════════════════════════════════════════
   kuendigungsfrist-rechner.js — Kündigungsfrist-Rechner
   Berechnet die gesetzliche Kündigungsfrist und das
   Beendigungsdatum nach §622 BGB.
   Stand: 2026 · Quellen: gesetze-im-internet.de/bgb/__622.html
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- pure engine (node-testable) -------- */

  // German weekday names (Mo=0 … So=6)
  var WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  function iso(obj) {
    var mm = String(obj.m).length < 2 ? '0' + obj.m : String(obj.m);
    var dd = String(obj.d).length < 2 ? '0' + obj.d : String(obj.d);
    return obj.y + '-' + mm + '-' + dd;
  }
  function parseISO(s) {
    var p = String(s || '').split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  }
  function lastDayOfMonth(y, m) {
    return new Date(y, m, 0).getDate(); // day 0 of next month
  }
  // Date arithmetic on {y,m,d} — local, DST-safe
  function addDays(o, n) {
    var dt = new Date(o.y, o.m - 1, o.d + n);
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  }
  function addMonths(o, months) {
    var idx = (o.y * 12) + (o.m - 1) + months;
    var y = Math.floor(idx / 12);
    var m = (idx % 12) + 1;
    var last = lastDayOfMonth(y, m);
    return { y: y, m: m, d: Math.min(o.d, last) };
  }
  function weekday(o) {
    return new Date(o.y, o.m - 1, o.d).getDay(); // 0=So … 6=Sa
  }
  function weekdayName(o) { return WD[(weekday(o) + 6) % 7]; } // Mo=0
  // §193 BGB wird NICHT automatisch angewendet: Das Beendigungsdatum wird als
  // Kalender-Stichtag ausgegeben (wie in gängigen Kündigungsfrist-Rechnern).
  // Ein Hinweis weist darauf hin, dass bei Fristende auf Wochenende/Feiertag
  // (§193) der nächste Werktag gelten kann.

  // Vollendete Beschäftigungsjahre zwischen beginn und stichtag
  function fullYears(begin, stick) {
    var y = stick.y - begin.y;
    if (stick.m < begin.m || (stick.m === begin.m && stick.d < begin.d)) y--;
    return Math.max(0, y);
  }

  // §622 Abs. 2 Tabelle (Arbeitgeberkündigung): [yearsOfService, Monate, Nr]
  var TIERS = [
    [20, 7, 7],
    [15, 6, 6],
    [12, 5, 5],
    [10, 4, 4],
    [8,  3, 3],
    [5,  2, 2],
    [2,  1, 1]
  ];

  function fmtMonths(n) {
    return n === 1 ? '1 Monat' : n + ' Monate';
  }

  function computeKuendigung(opts) {
    var zugang = parseISO(opts.zugang);
    var beginn = parseISO(opts.beginn);
    var istProbezeit = !!opts.probezeit;
    var werKuendigt = opts.werKuendigt === 'arbeitgeber' ? 'arbeitgeber' : 'arbeitnehmer';

    if (!zugang.y || !beginn.y || !zugang.d) {
      return { error: 'Bitte Kündigungsdatum und Beginn des Arbeitsverhältnisses angeben.' };
    }
    var probezeitFrist = 14; // §622 Abs. 3: 2 Wochen

    // --- Probezeit (§622 Abs. 3): längstens 6 Monate ---
    if (istProbezeit) {
      var dauer = fullMonths(beginn, zugang);
      var end = addDays(zugang, probezeitFrist);
      return {
        zugang: iso(zugang),
        beendigungsdatum: iso(end),
        beendigungsWochentag: weekdayName(end),
        fristText: '2 Wochen (14 Kalendertage)',
        fristDetail: 'ab dem Tag nach Zugang der Kündigung',
        norm: '§622 Abs. 3 BGB (Probezeit)',
        normHinweis: dauer >= 6 ? 'Hinweis: Probezeit ist gesetzlich auf max. 6 Monate begrenzt. Prüfen Sie, ob die Probezeit hier noch läuft.' : '',
        probezeitMonate: dauer,
        kuendigungsart: werKuendigt
      };
    }

    // --- Beschäftigungsdauer ---
    // Teilzeit ändert die Kündigungsfrist nach §622 BGB NICHT. Teilzeitfaktoren
    // (0.75 / 0.5) wurden entfernt: sie zählten nur für die Kleinbetriebsregel
    // (§623 KSchG bzw. §622 Abs. 5), nicht für die Frist selbst.
    var jahre = fullYears(beginn, zugang);

    // --- Arbeitnehmerkündigung: immer §622 Abs. 1 (4 Wochen zum 15./Monatsende) ---
    if (werKuendigt === 'arbeitnehmer') {
      var e1 = berechneStichtag(zugang);
      return {
        zugang: iso(zugang),
        beendigungsdatum: iso(e1.datum),
        beendigungsWochentag: e1.wochentag,
        fristText: '4 Wochen',
        fristDetail: 'zum 15. oder zum Ende eines Kalendermonats',
        norm: '§622 Abs. 1 BGB',
        normHinweis: 'Für Arbeitnehmerkündigungen gilt unabhängig von der Dauer der Beschäftigung die Grundfrist des §622 Abs. 1. §622 Abs. 6: Ihre Kündigungsfrist darf vertraglich nicht länger sein als die des Arbeitgebers.',
        anrechenbareJahre: jahre,
        kuendigungsart: werKuendigt
      };
    }

    // --- Arbeitgeberkündigung: §622 Abs. 1 (<2 J.) oder Abs. 2 (≥2 J.) ---
    if (jahre < 2) {
      var e2 = berechneStichtag(zugang);
      return {
        zugang: iso(zugang),
        beendigungsdatum: iso(e2.datum),
        beendigungsWochentag: e2.wochentag,
        fristText: '4 Wochen',
        fristDetail: 'zum 15. oder zum Ende eines Kalendermonats',
        norm: '§622 Abs. 1 BGB',
        normHinweis: 'Beschäftigungsdauer unter 2 Jahren. Die verlängerten Fristen des §622 Abs. 2 greifen erst ab 2 vollendeten Beschäftigungsjahren beim selben Arbeitgeber.',
        anrechenbareJahre: jahre,
        kuendigungsart: werKuendigt
      };
    }

    var gewaehlt = null, nr = 0;
    for (var i = 0; i < TIERS.length; i++) {
      if (jahre >= TIERS[i][0]) { gewaehlt = TIERS[i]; nr = TIERS[i][2]; break; }
    }
    if (!gewaehlt) {
      // defensive — sollte nicht passieren, da jahre >= 2
      var e3 = berechneStichtag(zugang);
      return {
        zugang: iso(zugang),
        beendigungsdatum: iso(e3.datum),
        fristText: '4 Wochen',
        norm: '§622 Abs. 1 BGB',
        kuendigungsart: werKuendigt
      };
    }
    var monate = gewaehlt[1];
    // Geben wir die Kündigung im Monat des Zugangs; Beendigung = Ende des Monats (+ monate).
    var zMonat = { y: zugang.y, m: zugang.m, d: 1 };
    var endMonat = addMonths(zMonat, monate);
    var endAbs2 = { y: endMonat.y, m: endMonat.m, d: lastDayOfMonth(endMonat.y, endMonat.m) };

    return {
      zugang: iso(zugang),
      beendigungsdatum: iso(endAbs2),
      beendigungsWochentag: weekdayName(endAbs2),
      fristText: fmtMonths(monate),
      fristDetail: 'zum Ende eines Kalendermonats',
      norm: '§622 Abs. 2 Nr. ' + nr + ' BGB',
      normHinweis: 'Bei einer Beschäftigungsdauer von mindestens ' + gewaehlt[0] + ' Jahren beim selben Arbeitgeber (§622 Abs. 2).',
      anrechenbareJahre: jahre,
      kuendigungsart: werKuendigt
    };
  }

  function fullMonths(begin, zugang) {
    var m = (zugang.y - begin.y) * 12 + (zugang.m - begin.m);
    if (zugang.d < begin.d) m--;
    return Math.max(0, m);
  }

  // §622 Abs. 1: 4 Wochen zum 15. oder zum Ende eines Kalendermonats
  function berechneStichtag(zugang) {
    if (zugang.d <= 15) {
      var d1 = { y: zugang.y, m: zugang.m, d: lastDayOfMonth(zugang.y, zugang.m) };
      return { datum: d1, wochentag: weekdayName(d1) };
    }
    var nm = addMonths({ y: zugang.y, m: zugang.m, d: 1 }, 1);
    var d2 = { y: nm.y, m: nm.m, d: lastDayOfMonth(nm.y, nm.m) };
    return { datum: d2, wochentag: weekdayName(d2) };
  }

  /* -------- UI -------- */

  function fmtDatum(isoStr) {
    var p = isoStr.split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }

  function render(res) {
    var el = E('tool-output');
    if (!el) return;
    if (res.error) {
      el.innerHTML = '<p class="muted">' + esc(res.error) + '</p>';
      return;
    }
    var html = '<div class="result-display">';
    html += '<div class="result-label">Kündigung eingegangen (Zugang)</div>';
    html += '<div class="result-value" style="font-size:1rem">' + fmtDatum(res.zugang) + '</div>';
    html += '<div style="height:14px"></div>';
    html += '<div class="result-label">Kündigungsfrist</div>';
    html += '<div class="result-big">' + esc(res.fristText) + '</div>';
    html += '<div class="muted">' + esc(res.fristDetail) + '</div>';
    html += '<div style="height:16px"></div>';
    html += '<div class="result-label">Beendigungsdatum des Arbeitsverhältnisses</div>';
    html += '<div class="result-big" style="color:var(--blue2)">' + fmtDatum(res.beendigungsdatum) + ' <span style="font-size:1rem;color:var(--mut)">(' + res.beendigungsWochentag + ')</span></div>';
    html += '<div style="height:14px"></div>';
    html += '<div class="muted">Rechtsgrundlage: <strong>' + esc(res.norm) + '</strong></div>';
    if (res.normHinweis) html += '<div class="muted" style="margin-top:6px">' + esc(res.normHinweis) + '</div>';
    if (res.anrechenbareJahre !== undefined) {
      html += '<div class="muted" style="margin-top:8px">Anrechenbare Beschäftigungsdauer beim selben Arbeitgeber: ' + res.anrechenbareJahre + ' Jahr' + (res.anrechenbareJahre === 1 ? '' : 'e') + '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function run() {
    var opts = {
      zugang: E('kf-zugang').value,
      beginn: E('kf-beginn').value,
      probezeit: E('kf-probezeit').checked,
      werKuendigt: E('kf-wer').value
    };
    render(computeKuendigung(opts));
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="hint" style="margin-bottom:14px;color:var(--fg);border-left:3px solid var(--blue2);padding-left:12px">Dieser Rechner gilt für die <strong>Kündigungsfrist im Arbeitsverhältnis</strong> nach §622 BGB (Arbeitgeber oder Arbeitnehmer). Er behandelt keine anderen Vertragsarten wie Mietverträge oder sonstige Verträge.</div>' +
      '<div class="field"><label>Wer kündigt?</label><select id="kf-wer">' +
        '<option value="arbeitgeber">Arbeitgeber kündigt</option>' +
        '<option value="arbeitnehmer">Arbeitnehmer kündigt</option></select></div>' +
      '<div class="field"><label>Beginn des Arbeitsverhältnisses</label><input type="date" id="kf-beginn"></div>' +
      '<div class="field"><label>Kündigung erhalten (Zugangsdatum)</label><input type="date" id="kf-zugang"></div>' +
      '<div class="field"><label style="display:inline"><input type="checkbox" id="kf-probezeit"> Es läuft eine Probezeit (bis max. 6 Monate)</label></div>' +
      '<div class="row"><button type="button" class="btn-app">Kündigungsfrist berechnen</button></div>' +
      '<details class="kf-ref" style="margin-top:16px">' +
        '<summary style="cursor:pointer;color:var(--blue2);font-weight:600">Staffelung anzeigen, §622 Abs. 2 BGB (Kündigung durch den Arbeitgeber)</summary>' +
        '<div class="muted" style="margin-top:8px;font-size:.9rem;line-height:1.5">' +
          '<table style="width:100%;border-collapse:collapse;font-size:.88rem">' +
            '<tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border);font-weight:600">Beschäftigung im Betrieb</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border);font-weight:600">Frist</th></tr>' +
            '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border)">unter 2 Jahre</td><td style="padding:4px 8px;border-bottom:1px solid var(--border)">4 Wochen zum 15. oder Monatsende (§622 Abs. 1)</td></tr>' +
            '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border)">ab 2 Jahren</td><td style="padding:4px 8px;border-bottom:1px solid var(--border)">1 Monat zum Monatsende</td></tr>' +
            '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border)">ab 5 Jahren</td><td style="padding:4px 8px;border-bottom:1px solid var(--border)">2 Monate zum Monatsende</td></tr>' +
            '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border)">ab 8 Jahren</td><td style="padding:4px 8px;border-bottom:1px solid var(--border)">3 Monate zum Monatsende</td></tr>' +
            '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border)">ab 10 Jahren</td><td style="padding:4px 8px;border-bottom:1px solid var(--border)">4 Monate zum Monatsende</td></tr>' +
            '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border)">ab 12 Jahren</td><td style="padding:4px 8px;border-bottom:1px solid var(--border)">5 Monate zum Monatsende</td></tr>' +
            '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border)">ab 15 Jahren</td><td style="padding:4px 8px;border-bottom:1px solid var(--border)">6 Monate zum Monatsende</td></tr>' +
            '<tr><td style="padding:4px 8px">ab 20 Jahren</td><td style="padding:4px 8px">7 Monate zum Monatsende</td></tr>' +
          '</table>' +
          '<div style="margin-top:8px">Probezeit (§622 Abs. 3 BGB): 2 Wochen, längstens 6 Monate.</div>' +
        '</div>' +
      '</details>';

    inputs.querySelector('button.btn-app').addEventListener('click', run);
    // Enter auf Datumsfeld
    inputs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      computeKuendigung: computeKuendigung,
      iso: iso, parseISO: parseISO, fullYears: fullYears, fullMonths: fullMonths
    };
  }
})();
