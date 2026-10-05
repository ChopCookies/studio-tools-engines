/* ══════════════════════════════════════════════════
   brueckentage-planer.js — Brückentage-Planer
   Zeigt gesetzliche Feiertage je Bundesland & Jahr und
   markiert Brückentage (Feiertage direkt am Wochenende).
   Daten: feiertage-api.de (Stand 21.09.2026), siehe
   brueckentage-data.js (Jahre 2026 bis 2028)
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- i18n (DE default, EN via site lang flag) -------- */
  var DE = (typeof window !== 'undefined' && window.__siteLang !== undefined)
    ? window.__siteLang !== 'en' : true;
  var WD_EN = { 'Mo': 'Mon', 'Di': 'Tue', 'Mi': 'Wed', 'Do': 'Thu', 'Fr': 'Fri', 'Sa': 'Sat', 'So': 'Sun' };
  function wdLabel(w) { return DE ? w : (WD_EN[w] || w); }
  var T = {
    bundesland: DE ? 'Bundesland' : 'Federal state',
    jahr: DE ? 'Jahr' : 'Year',
    btn: DE ? 'Brückentage anzeigen' : 'Show bridge days',
    feiertage: DE ? 'Gesetzliche Feiertage' : 'Public holidays',
    potential: DE ? 'Mit Brückentag-Potenzial' : 'With bridge day potential',
    datum: DE ? 'Datum' : 'Date',
    wochentag: DE ? 'Wochentag' : 'Weekday',
    feiertag: DE ? 'Feiertag' : 'Holiday',
    bruecke: DE ? 'Brückentag / lange Auszeit' : 'Bridge day / long break',
    direkt: DE ? 'direktes 3-Tage-Wochenende' : 'direct 3-day weekend',
    brueckeFrei: DE ? 'frei' : 'off',
    tipp: DE ? 'Tipp: Wer an einem Brückentag Urlaub nimmt, verlängert das Wochenende zu einer langen Auszeit, ohne viele Urlaubstage zu verbrauchen. Frei- bzw. Urlaubstage an Brückentagen sind keine gesetzlichen Feiertage und müssen im Rahmen des individuellen Urlaubsanspruchs beantragt werden.'
          : 'Tip: take a day of leave on a bridge day and you extend the weekend into a long break without using up many vacation days. Days off on bridge days are not public holidays, so you request them through your individual leave entitlement.'
  };

  /* -------- pure engine (node-testable) -------- */

  function data() {
    return (typeof window !== 'undefined' && window.FEIERTAGE_DATA) || (typeof globalThis !== 'undefined' && globalThis.FEIERTAGE_DATA) || null;
  }

  function fmtDE(iso) { // yyyy-mm-dd -> dd.mm.yyyy
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }

  function planBrueckentage(bl, jahr) {
    var d = data();
    if (!d || !d.laender || !d.laender[bl] || !d.laender[bl][String(jahr)]) {
      return { error: 'Für ' + bl + ' / ' + jahr + ' liegen keine Daten vor.' };
    }
    var feiertage = d.laender[bl][String(jahr)].slice().sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    var brueckentage = feiertage.filter(function (f) { return f.br; });
    return {
      bl: bl,
      blName: d.names && d.names[bl] ? d.names[bl] : bl,
      jahr: jahr,
      feiertage: feiertage,
      anzahl: feiertage.length,
      brueckentage: brueckentage,
      anzahlBruecken: brueckentage.length
    };
  }

  /* -------- UI -------- */

  function render(res) {
    var el = E('tool-output');
    if (!el) return;
    if (res.error) { el.innerHTML = '<p class="muted">' + esc(res.error) + '</p>'; return; }

    var html = '<div class="result-display">';
    html += '<div class="row" style="gap:24px;margin-bottom:8px">';
    html += '<div><div class="result-label">' + T.bundesland + '</div><div class="result-value">' + esc(res.blName) + '</div></div>';
    html += '<div><div class="result-label">' + T.jahr + '</div><div class="result-value">' + res.jahr + '</div></div>';
    html += '<div><div class="result-label">' + T.feiertage + '</div><div class="result-value">' + res.anzahl + '</div></div>';
    html += '<div><div class="result-label">' + T.potential + '</div><div class="result-value" style="color:var(--copper)">' + res.anzahlBruecken + '</div></div>';
    html += '</div>';

    html += '<table class="bt-table"><thead><tr><th>' + T.datum + '</th><th>' + T.wochentag + '</th><th>' + T.feiertag + '</th><th>' + T.bruecke + '</th></tr></thead><tbody>';
    res.feiertage.forEach(function (f) {
      var btn = '';
      if (f.br) {
        var longWeekend = '';
        if (f.bd === null || f.bd === undefined || !f.bd) {
          longWeekend = T.direkt;
        } else {
          longWeekend = (DE ? 'Brücke: ' : 'Bridge: ') + wdLabel(f.bw) + ' ' + fmtDE(f.bd) + ' ' + T.brueckeFrei;
        }
        btn = '<span class="bruecke">' + longWeekend + '</span>';
      } else {
        btn = '<span class="muted">&ndash;</span>';
      }
      var wd = esc(wdLabel(f.w || ''));
      html += '<tr class="' + (f.br ? 'row-hl' : '') + '"><td>' + fmtDE(f.d) + '</td><td>' + wd + '</td><td>' + esc(f.n) + '</td><td>' + btn + '</td></tr>';
    });
    html += '</tbody></table>';

    if (res.anzahlBruecken > 0) {
      html += '<div class="muted" style="margin-top:12px">' + esc(T.tipp) + '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function run() {
    render(planBrueckentage(E('bt-bl').value, E('bt-jahr').value));
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    var d = data();
    var blOpts = '';
    if (d && d.names) {
      Object.keys(d.names).forEach(function (code) {
        blOpts += '<option value="' + code + '">' + esc(d.names[code]) + '</option>';
      });
    }
    var thisYear = new Date().getFullYear();
    // Data covers 2026 through 2028 (feiertage-api.de, Stand 21.09.2026).
    var YEARS = [2026, 2027, 2028];
    var yearOpts = YEARS.map(function (y) {
      return '<option value="' + y + '"' + (y === thisYear ? ' selected' : '') + '>' + y + '</option>';
    }).join('');

    inputs.innerHTML =
      '<div class="field"><label>' + T.bundesland + '</label><select id="bt-bl">' + blOpts + '</select></div>' +
      '<div class="field"><label>' + T.jahr + '</label><select id="bt-jahr">' + yearOpts + '</select></div>' +
      '<div class="row"><button type="button" class="btn-app">' + T.btn + '</button></div>';

    inputs.querySelector('button.btn-app').addEventListener('click', run);
    inputs.addEventListener('change', function () { run(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { planBrueckentage: planBrueckentage, fmtDE: fmtDE, data: data };
  }
})();
