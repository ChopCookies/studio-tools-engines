/* ══════════════════════════════════════════════════
   urlaubsanspruch-rechner.js — Urlaubsanspruch-Rechner
   Berechnet den gesetzlichen Urlaubsanspruch je Kalenderjahr
   nach dem Bundesurlaubsgesetz (BUrlG).
   Stand: 2026 · Quellen: gesetze-im-internet.de/burlg
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- pure engine (node-testable) -------- */

  function parseISO(s) {
    var p = String(s || '').split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  }
  function lastDayOfMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function addMonths(o, months) {
    var idx = (o.y * 12) + (o.m - 1) + months;
    var y = Math.floor(idx / 12), m = (idx % 12) + 1;
    return { y: y, m: m, d: Math.min(o.d, lastDayOfMonth(y, m)) };
  }
  // ord: yyyy*10000+mm*100+dd for easy comparison
  function ord(o) { return o.y * 10000 + o.m * 100 + o.d; }

  // Vollständige Kalendermonate im Jahr Y, in denen das Arbeitsverhältnis
  // den gesamten Monat bestand (Beschäftigung deckt den Monat voll ab).
  function fullMonthsInYear(Y, start, end) {
    var startO = ord(start), endO = end ? ord(end) : Infinity, count = 0;
    for (var m = 1; m <= 12; m++) {
      var ms = ord({ y: Y, m: m, d: 1 });
      var me = ord({ y: Y, m: m, d: lastDayOfMonth(Y, m) });
      if (startO <= ms && endO >= me) count++;
    }
    return count;
  }

  // §5 Abs. 2 BUrlG: Bruchteile von mindestens einem halben Tag aufrunden.
  // Kleinere Bruchteile (<0.5) bleiben als Bruchteil geschuldet (BAG-Rechtsprechung),
  // sie werden also NICHT auf den nächstkleineren ganzen Tag abgerundet.
  function roundHalf(v) {
    var f = Math.floor(v);
    if ((v - f) >= 0.5) return f + 1;   // ab 0.5 aufrunden (§5 Abs. 2 BUrlG)
    return Math.round(v * 100) / 100;   // <0.5 bleibt als Bruchteil (z. B. 8,33)
  }

  function calcUrlaub(opts) {
    var jahr = +opts.jahr || new Date().getFullYear();
    var start = parseISO(opts.start);
    var end = opts.end ? parseISO(opts.end) : null;
    // Arbeitstage pro Woche: 1-6. BAG-Modus rechnet 4 Wochen × Arbeitstage;
    // §3-Wortlaut-Modus nutzt 24 Werktage (6-Tage-Woche).
    var workdays = +opts.workdays;
    if (!(workdays >= 1 && workdays <= 6)) workdays = 5;
    var einheit = workdays === 6 ? 'Werktage' : 'Arbeitstage';
    if (!start.y || !start.d) return { error: 'Bitte das Eintrittsdatum angeben.' };
    if (end && ord(end) < ord(start)) return { error: 'Das Austrittsdatum liegt vor dem Eintrittsdatum.' };
    if (start.y > jahr) return { error: 'Das Eintrittsdatum liegt nach dem gewählten Urlaubsjahr.' };

    var mode = opts.mode === 'literal' ? 'literal' : 'bag';
    var leaveWerktage = Math.max(1, +opts.leaveWerktage || 24);

    // Vollanspruch: BAG-Variante (4 Wochen × Arbeitstage) oder Wortlaut (§3: 24 Werktage)
    var fullLeave = mode === 'bag' ? 4 * workdays : leaveWerktage;
    var perMonth = fullLeave / 12;

    var startY = { y: jahr, m: 1, d: 1 };
    var endY = { y: jahr, m: 12, d: 31 };

    // Beschäftigung deckt das gesamte Kalenderjahr ab?
    var spanntGanzesJahr = ord(start) <= ord(startY) && (!end || ord(end) >= ord(endY));

    if (spanntGanzesJahr) {
      return {
        jahr: jahr,
        fullLeave: fullLeave,
        anspruch: fullLeave,
        art: 'Vollurlaub (§ 4 i. V. m. § 3 BUrlG)',
        isPartial: false,
        months: 12,
        perMonth: perMonth,
        einheit: einheit,
        edgecase: null
      };
    }

    // --- Teilurlaub ---
    var monthsYear = fullMonthsInYear(jahr, start, end);

    // Wartezeit (§4): 6 volle Monate ab Eintritt
    var wartezeitEnd = addMonths(start, 6);
    var wartezeitErfuellt = end ? (ord(end) >= ord(wartezeitEnd)) : (ord(wartezeitEnd) <= ord(endY));

    var trigger = null, anspruch = 0;

    if (end) {
      if (!wartezeitErfuellt) {
        // §5(1)b: Austritt vor Erfüllung der Wartezeit
        trigger = '§5 Abs. 1 b BUrlG (Austritt vor Erfüllung der Wartezeit)';
        anspruch = roundHalf(perMonth * monthsYear);
      } else if (end.m <= 6) {
        // §5(1)c: Austritt nach Wartezeit in der ersten Jahreshälfte
        trigger = '§5 Abs. 1 c BUrlG (Austritt in der ersten Jahreshälfte nach Wartezeit)';
        anspruch = roundHalf(perMonth * monthsYear);
      } else {
        // Austritt nach Wartezeit in der zweiten Jahreshälfte (§4): voller Anspruch
        trigger = '§4 BUrlG (Austritt nach Wartezeit in der zweiten Jahreshälfte)';
        anspruch = fullLeave;
      }
    } else {
      // kein Austritt (laufendes Verhältnis) — nur relevant, wenn Eintritt im Jahr Y
      if (ord(start) > ord(startY)) {
        if (ord(wartezeitEnd) <= ord(endY)) {
          // Wartezeit wird im laufenden Jahr erfüllt → voller Anspruch für das Jahr
          trigger = '§4 BUrlG (Wartezeit wird im laufenden Jahr erfüllt)';
          anspruch = fullLeave;
        } else {
          // §5(1)a: Eintritt im zweiten Halbjahr, Wartezeit nicht mehr erfüllbar
          trigger = '§5 Abs. 1 a BUrlG (Eintritt im zweiten Halbjahr)';
          anspruch = roundHalf(perMonth * monthsYear);
        }
      } else {
        trigger = '§4 BUrlG (Vollurlaub)';
        anspruch = fullLeave;
      }
    }

    var isPartial = anspruch < fullLeave;

    return {
      jahr: jahr,
      fullLeave: fullLeave,
      anspruch: anspruch,
      art: isPartial ? 'Teilurlaub (' + trigger + ')' : 'Vollurlaub (§ 4 i. V. m. § 3 BUrlG)',
      trigger: trigger,
      isPartial: isPartial,
      months: monthsYear,
      perMonth: perMonth,
      wartezeitErfuellt: wartezeitErfuellt,
      edgecase: wartezeitErfuellt && end && end.m >= 7 ? 'full-on-2nd-half' : null,
      einheit: einheit
    };
  }

  /* -------- UI -------- */

  // Deutsche Dezimaldarstellung (z. B. 8.33 -> 8,33)
  function fmtZahl(n) {
    return String(n).replace('.', ',');
  }

  function render(res) {
    var el = E('tool-output');
    if (!el) return;
    if (res.error) { el.innerHTML = '<p class="muted">' + esc(res.error) + '</p>'; return; }
    var html = '<div class="result-display">';
    html += '<div class="result-label">Urlaubsjahr</div>';
    html += '<div class="result-value">' + res.jahr + '</div>';
    html += '<div style="height:14px"></div>';
    html += '<div class="result-label">Jahresurlaub (voll)</div>';
    html += '<div class="result-value">' + fmtZahl(res.fullLeave) + ' ' + res.einheit + '</div>';
    html += '<div style="height:14px"></div>';
    html += '<div class="result-label">Urlaubsanspruch</div>';
    html += '<div class="result-big">' + fmtZahl(res.anspruch) + ' ' + res.einheit + '</div>';
    html += '<div class="muted">' + esc(res.art) + '</div>';
    if (res.isPartial && res.months > 0) {
      html += '<div class="muted" style="margin-top:6px">' + res.months + ' voller Monat' + (res.months === 1 ? '' : 'e') + ' × ' + res.perMonth.toFixed(2).replace('.', ',') + ' = ' + fmtZahl(res.anspruch) + ' ' + res.einheit + ' (Bruchteile ab 0,5 werden nach §5 Abs. 2 BUrlG aufgerundet, kleinere bleiben bestehen)</div>';
    }
    html += '<div class="muted" style="margin-top:8px">Beendigung: bei Austritt in der zweiten Jahreshälfte nach erfüllter Wartezeit besteht gem. §4 BUrlG der volle Urlaubsanspruch; ein nicht genommener Rest ist bei Beendigung nach §7 Abs. 4 BUrlG abzugelten. Übertragung nur bei dringenden Gründen, Frist 31. März des Folgejahres (§7 Abs. 3).</div>';
    html += '</div>';
    el.innerHTML = html;
  }

  function run() {
    render(calcUrlaub({
      jahr: E('ua-jahr').value,
      start: E('ua-start').value,
      end: E('ua-end').value,
      workdays: E('ua-workdays').value,
      leaveWerktage: E('ua-leave').value,
      mode: E('ua-mode').value
    }));
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    var thisYear = new Date().getFullYear();
    inputs.innerHTML =
      '<div class="field"><label>Urlaubsjahr</label><select id="ua-jahr">' +
        '<option value="' + thisYear + '">' + thisYear + '</option>' +
        '<option value="' + (thisYear + 1) + '">' + (thisYear + 1) + '</option>' +
        '<option value="' + (thisYear - 1) + '">' + (thisYear - 1) + '</option></select></div>' +
      '<div class="field"><label>Eintrittsdatum</label><input type="date" id="ua-start"></div>' +
      '<div class="field"><label>Austrittsdatum (optional)</label><input type="date" id="ua-end"></div>' +
      '<div class="field"><label>Arbeitstage pro Woche</label><select id="ua-workdays">' +
        '<option value="5" selected>5-Tage-Woche</option>' +
        '<option value="6">6-Tage-Woche</option>' +
        '<option value="4">4-Tage-Woche</option>' +
        '<option value="3">3-Tage-Woche</option>' +
        '<option value="2">2-Tage-Woche</option>' +
        '<option value="1">1-Tage-Woche</option></select></div>' +
      '<div class="field"><label>Vertraglicher Jahresurlaub (Werktage)</label><input type="number" id="ua-leave" value="24" min="1"></div>' +
      '<div class="field"><label>Berechnungsart</label><select id="ua-mode">' +
        '<option value="bag" selected>BAG-Rechtsprechung (4 Wochen Minimum, 5-Tage = 20 Tage)</option>' +
        '<option value="literal">Gesetzlicher Wortlaut (§3: 24 Werktage)</option></select></div>' +
      '<div class="row"><button type="button" class="btn-app">Urlaubsanspruch berechnen</button></div>';

    inputs.querySelector('button.btn-app').addEventListener('click', run);
    inputs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calcUrlaub: calcUrlaub, parseISO: parseISO, fullMonthsInYear: fullMonthsInYear };
  }
})();
