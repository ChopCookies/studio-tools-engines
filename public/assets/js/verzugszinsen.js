/* ══════════════════════════════════════════════════
   verzugszinsen.js | Verzugszinsen nach § 288 BGB
   Transparenter Schätzer: Basiszinssatz wird als Eingabe übernommen.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';
  var DE = (window.__siteLang !== 'en');
  var BASE_STAND = '01.07.2026'; // BGB-Basiszinssatz (Deutsche Bundesbank), ab 01.07.2026 = 1,52 %
  function E(id){ return document.getElementById(id); }

  // Offizielle Bundesbank-Historie des Basiszinssatzes (§ 247 BGB),
  // Format [Jahr, Monat(1-12), Tag, Wert]. Quelle: Deutsche Bundesbank
  // (Änderung jeweils zum 01.01. / 01.07., hier die effektiven Stände).
  var BASE_HISTORY = [
    [2002,1,1,2.57],[2002,7,1,2.47],[2003,1,1,1.97],[2003,7,1,1.22],
    [2004,1,1,1.14],[2004,7,1,1.13],[2005,1,1,1.21],[2005,7,1,1.17],
    [2006,1,1,1.37],[2006,7,1,1.95],[2007,1,1,2.70],[2007,7,1,3.19],
    [2008,1,1,3.32],[2008,7,1,3.19],[2009,1,1,1.62],[2009,7,1,0.12],
    [2010,1,1,0.12],[2010,7,1,0.12],[2011,1,1,0.12],[2011,7,1,0.37],
    [2012,1,1,0.12],[2012,7,1,0.12],[2013,1,1,-0.13],[2013,7,1,-0.38],
    [2014,1,1,-0.63],[2014,7,1,-0.73],[2015,1,1,-0.83],[2016,1,1,-0.83],
    [2016,7,1,-0.88],[2022,7,1,-0.88],[2023,1,1,1.62],[2023,7,1,3.12],
    [2024,1,1,3.62],[2024,7,1,3.37],[2025,1,1,2.27],[2025,7,1,1.27],
    [2026,1,1,1.27],[2026,7,1,1.52]
  ];
  function mkDate(a) { return new Date(a[0], a[1] - 1, a[2]); }
  // Bis-historisches Intervall: erste Historie-Eintrag, dessen Datum > d
  function nextChange(d) {
    for (var i = 0; i < BASE_HISTORY.length; i++) {
      var t = mkDate(BASE_HISTORY[i]);
      if (t.getTime() > d.getTime()) return t;
    }
    return null;
  }
  function baseAt(d) {
    var val = null;
    for (var i = 0; i < BASE_HISTORY.length; i++) {
      if (mkDate(BASE_HISTORY[i]).getTime() <= d.getTime()) val = BASE_HISTORY[i][3];
    }
    return val;
  }
  // Zerlegt [from, to] in Zinsperioden je Bestand des Basiszinssatzes.
  function segment(from, to) {
    var segs = [];
    var cur = new Date(from.getTime());
    cur.setHours(0, 0, 0, 0);
    to = new Date(to.getTime());
    to.setHours(0, 0, 0, 0);
    while (cur.getTime() < to.getTime()) {
      var nxt = nextChange(cur);
      var end = (nxt && nxt.getTime() < to.getTime()) ? nxt : to;
      var days = Math.round((end.getTime() - cur.getTime()) / 86400000);
      if (days > 0) {
        var base = baseAt(cur);
        segs.push({ start: new Date(cur), end: new Date(end), base: base, days: days });
      }
      cur = end;
    }
    return segs;
  }
  function num(v){ var n=parseFloat(String(v).replace(',','.')); return isFinite(n)?n:0; }

  function calc() {
    var act = parseInt(E('vz-amount').value.replace(/\D/g,'') || '0', 10);
    var base = num(E('vz-base').value);
    var type = E('vz-type').value;
    var pp = (type === 'b2b') ? 9 : 5;
    var fromE = E('vz-from').value ? new Date(E('vz-from').value) : null;
    var toE = E('vz-to').value ? new Date(E('vz-to').value) : null;
    var days = 0;
    if (fromE && toE) {
      days = Math.max(0, Math.round((toE - fromE) / 86400000));
    }
    var out = E('tool-output');
    if (!act || days <= 0) {
      out.innerHTML = '<p class="text-muted">' + (DE ? 'Betrag und Zeitraum angeben.' : 'Enter an amount and a period.') + '</p>';
      return;
    }
    var typeLabel = type === 'b2b' ? (DE ? 'Unternehmen (B2B, 9 Prozentpunkte)' : 'Business (B2B, 9 percentage points)') : (DE ? 'Verbraucher (5 Prozentpunkte)' : 'Consumer (5 percentage points)');
    var manualBase = num(E('vz-base').value);
    var useAuto = E('vz-auto') ? E('vz-auto').checked : true;

    var total = 0, rows = [], segs = [];
    if (useAuto) {
      segs = segment(fromE, toE);
      for (var i = 0; i < segs.length; i++) {
        var sRate = segs[i].base + pp;
        var sTotal = (act * (sRate / 100) / 360) * segs[i].days;
        rows.push({ base: segs[i].base, rate: sRate, days: segs[i].days, total: sTotal });
        total += sTotal;
      }
      if (!rows.length) {
        out.innerHTML = '<p class="text-muted">' + (DE ? 'Für den gewählten Zeitraum liegt kein Basiszinssatz vor.' : 'No base rate available for the selected period.') + '</p>';
        return;
      }
    } else {
      var mRate = manualBase + pp;
      rows.push({ base: manualBase, rate: mRate, days: days, total: (act * (mRate / 100) / 360) * days });
      total = rows[0].total;
    }
    var last = rows[rows.length - 1];
    var fmtD = function(d) { return d.toLocaleDateString('de-DE'); };
    var breakdown = '';
    if (useAuto && rows.length > 1) {
      breakdown = '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border,#ddd);font-size:.85em">' +
        '<div style="font-weight:600;margin-bottom:4px">' + (DE ? 'Anteilig je Zinsperiode (Basiszinssatz-Historie)' : 'Per period (base-rate history)') + '</div>';
      for (var k = 0; k < rows.length; k++) {
        breakdown += '<div style="display:flex;justify-content:space-between;gap:8px;margin:2px 0">' +
          '<span>' + fmtD(segs[k].start) + ' – ' + fmtD(segs[k].end) + ' · ' +
          (DE ? 'Basis ' : 'base ') + rows[k].base.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' % · ' + rows[k].days + (DE ? ' Tage' : ' days') + '</span>' +
          '<b>' + rows[k].total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) + '</b></div>';
      }
      breakdown += '</div>';
    }

    var html =
      '<div class="result-box">' +
        '<div class="result-row"><span>'+ (DE?'Verzugszinsen gesamt':'Total default interest') +'</span><b>'+ total.toLocaleString('de-DE',{style:'currency',currency:'EUR'}) +'</b></div>' +
        '<div class="result-row"><span>'+ (DE?'Zuletzt wirksamer Jahreszinssatz':'Last effective annual rate') +'</span><b>'+ last.rate.toLocaleString('de-DE',{minimumFractionDigits:2}) + ' %</b></div>' +
        '<div class="result-row"><span>'+ (DE?'Basiszinssatz (zuletzt, Stand '+BASE_STAND+')':'Base rate (last, as at '+BASE_STAND+')') +'</span><b>'+ last.base.toLocaleString('de-DE',{minimumFractionDigits:2}) + ' %</b></div>' +
        '<div class="result-row"><span>'+ (DE?'Art des Verzugs':'Type of default') +'</span><b>'+ typeLabel +'</b></div>' +
        '<div class="result-row"><span>'+ (DE?'Tage im Verzug':'Days in default') +'</span><b>'+ days.toLocaleString('de-DE') +'</b></div>' +
        (type === 'b2b' ? '<div class="result-row"><span>'+ (DE?'zzgl. Verzugspauschale':'plus flat damage allowance') +' (§ 288 Abs. 5 BGB)</span><b>40,00 €</b></div>' : '') +
      '</div>' +
      breakdown +
      '<p class="text-muted" style="font-size:.85em;margin-top:10px">'+ (DE ? 'Ermittlung nach § 288 BGB, kaufmännische Zinsmethode (Tage / 360). In der automatischen Berechnung wird der Basiszinssatz je Zinsperiode aus der Bundesbank-Historie angesetzt (gültig 2026: 1,52 %) und bei Änderungen innerhalb deines Zeitraums anteilig aufgeteilt. Für eine abweichende Annahme schalte die automatische Ermittlung aus und trage den Satz selbst ein.' : 'Calculated per § 288 BGB, commercial interest method (days / 360). In automatic mode the base rate from the Bundesbank history is applied per interest period (2026: 1.52 %) and split when it changes within your period. For a custom assumption, switch off automatic mode and enter the rate yourself.') +'</p>';
    out.innerHTML = html;

    // Playbook integration: report this finished step (client-side only).
    if (total >= 0 && window.playbook) window.playbook.report({
      tool: 'verzugszinsen',
      summary: (DE ? 'Verzugszinsen: ' : 'Late interest: ') +
        total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
    });
  }

  function buildUI() {
    var btn = document.createElement('button');
    btn.type='button'; btn.className='btn btn-primary btn-generate';
    btn.textContent = DE ? 'Berechnen' : 'Calculate';
    E('tool-inputs').appendChild(btn);
    btn.addEventListener('click', calc);

    // Bei automatischer Ermittlung das manuelle Basiszinssatz-Feld deaktivieren.
    var autoEl = E('vz-auto');
    var baseEl = E('vz-base');
    function applyAuto() { if (baseEl) baseEl.disabled = !!(autoEl && autoEl.checked); }
    if (autoEl) autoEl.addEventListener('change', applyAuto);
    applyAuto();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) module.exports = { num: num, calc: calc, segment: segment, BASE_HISTORY: BASE_HISTORY };
})();
