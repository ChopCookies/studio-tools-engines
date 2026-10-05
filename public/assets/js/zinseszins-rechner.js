/* ══════════════════════════════════════════════════
   zinseszins-rechner.js: Zinseszins-Rechner
   Berechnet das Wachstum eines Kapitals mit
   jährlichem oder monatlichem Zinseszins und
   optionalen regelmäßigen Einzahlungen.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DE = true;
  if (typeof window !== 'undefined' && window.__siteLang === 'en') DE = false;

  var T = {
    startKapital:   DE ? 'Startkapital'            : 'Starting capital',
    zinssatz:       DE ? 'Zinssatz p.a.'           : 'Interest rate p.a.',
    laufzeit:       DE ? 'Laufzeit'                : 'Term',
    jahre:          DE ? 'Jahre'                   : 'years',
    sparrhythmus:   DE ? 'Sparrhythmus'            : 'Savings rhythm',
    keine:          DE ? 'keine'                   : 'none',
    jaehrlich:      DE ? 'j\u00e4hrlich'           : 'annually',
    monatlich:      DE ? 'monatlich'               : 'monthly',
    sparbeitrag:    DE ? 'Regelm\u00e4\u00dfiger Sparbeitrag' : 'Regular deposit',
    berechnen:      DE ? 'Berechnen'               : 'Calculate',
    endkapital:     DE ? 'Endkapital'              : 'Final capital',
    zinsertrag:     DE ? 'Zinsertrag'              : 'Interest earned',
    eingezahlt:     DE ? 'Eingezahlt gesamt'       : 'Total paid in',
    jahr:           DE ? 'Jahr'                    : 'Year',
    wert:           DE ? 'Wert'                    : 'Value',
    hintKeine:      DE ? 'Sparbeitrag greift nur bei j\u00e4hrlichem oder monatlichem Sparrhythmus.' 
                       : 'Deposits only apply with annual or monthly savings rhythm.'
  };

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- pure calculation engine (node-testable) -------- */

  function compute(args) {
    var startKapital = args.startKapital || 0;
    var zinssatz = args.zinssatz || 0;
    var laufzeitJahre = args.laufzeitJahre || 0;
    var einzahlungJaehrlich = args.einzahlungJaehrlich || 0;
    var sparrhythmus = args.sparrhythmus || 'keine';

    var rate = zinssatz / 100;
    // Deposits only count with an explicit annual/monthly rhythm. 'keine' must
    // ignore the deposit field, even if a value was left in it.
    var deposit = (sparrhythmus === 'jaehrlich' || sparrhythmus === 'monatlich')
      ? (einzahlungJaehrlich || 0) : 0;
    var data = [];
    var wert = startKapital;
    var totalDeposits = 0;

    if (sparrhythmus === 'monatlich') {
      var monthlyRate = rate / 12;
      var monthlyDeposit = deposit / 12;
      for (var jahr2 = 1; jahr2 <= laufzeitJahre; jahr2++) {
        for (var mon = 0; mon < 12; mon++) {
          wert = wert * (1 + monthlyRate) + monthlyDeposit;
        }
        totalDeposits += deposit;
        data.push({ jahr: jahr2, wert: wert });
      }
    } else {
      for (var j = 1; j <= laufzeitJahre; j++) {
        wert = wert * (1 + rate) + deposit;
        totalDeposits += deposit;
        data.push({ jahr: j, wert: wert });
      }
    }

    var endKapital = wert;
    var eingezahlt = startKapital + totalDeposits;
    var zinsertrag = endKapital - eingezahlt;

    return { endKapital: endKapital, zinsertrag: zinsertrag, eingezahlt: eingezahlt, data: data };
  }

  function fmtEuro(n) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  /* -------- UI -------- */

  function renderResult(result) {
    var html = '<div class="result-display">';
    html += '<div class="result-big">' + fmtEuro(result.endKapital) + '</div>';
    html += '<div class="result-label">' + esc(T.endkapital) + '</div>';
    html += '<div class="result-rows">';
    html += '<div class="result-row"><span class="result-label">' + esc(T.zinsertrag) + '</span><span class="result-value">' + fmtEuro(result.zinsertrag) + '</span></div>';
    html += '<div class="result-row"><span class="result-label">' + esc(T.eingezahlt) + '</span><span class="result-value">' + fmtEuro(result.eingezahlt) + '</span></div>';
    html += '</div>';
    html += '<table class="breakdown"><thead><tr><th>' + esc(T.jahr) + '</th><th>' + esc(T.wert) + '</th></tr></thead><tbody>';
    for (var i = 0; i < result.data.length; i++) {
      var d = result.data[i];
      html += '<tr><td>' + d.jahr + '</td><td>' + fmtEuro(d.wert) + '</td></tr>';
    }
    html += '</tbody></table>';
    html += '</div>';
    return html;
  }

  function renderOutput(result) {
    var el = E('tool-output');
    if (!el) return;
    el.innerHTML = renderResult(result);
  }

  function run() {
    var sk = E('zsk-startkapital');
    var zs = E('zsk-zinssatz');
    var lj = E('zsk-laufzeit');
    var sr = E('zsk-sparrhythmus');
    var eb = E('zsk-einzahlung');
    if (!sk || !zs || !lj || !sr || !eb) return;

    var startKapital = parseFloat(sk.value) || 0;
    var zinssatz = parseFloat(zs.value) || 0;
    var laufzeitJahre = parseInt(lj.value, 10) || 0;
    var einzahlungJaehrlich = parseFloat(eb.value) || 0;
    var sparrhythmus = sr.value;

    var result = compute({ startKapital: startKapital, zinssatz: zinssatz, laufzeitJahre: laufzeitJahre, einzahlungJaehrlich: einzahlungJaehrlich, sparrhythmus: sparrhythmus });
    renderOutput(result);
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label for="zsk-startkapital">' + esc(T.startKapital) + ' (\u20ac)</label><input id="zsk-startkapital" type="number" value="10000" step="100"></div>' +
      '<div class="field"><label for="zsk-zinssatz">' + esc(T.zinssatz) + ' (%)</label><input id="zsk-zinssatz" type="number" value="3" step="0.1"></div>' +
      '<div class="field"><label for="zsk-laufzeit">' + esc(T.laufzeit) + ' (' + esc(T.jahre) + ')</label><input id="zsk-laufzeit" type="number" value="10" step="1"></div>' +
      '<div class="field"><label for="zsk-sparrhythmus">' + esc(T.sparrhythmus) + '</label><select id="zsk-sparrhythmus"><option value="keine">' + esc(T.keine) + '</option><option value="jaehrlich">' + esc(T.jaehrlich) + '</option><option value="monatlich">' + esc(T.monatlich) + '</option></select></div>' +
      '<div class="field"><label for="zsk-einzahlung">' + esc(T.sparbeitrag) + ' (\u20ac)</label><input id="zsk-einzahlung" type="number" value="0" step="10"></div>' +
      '<p class="hint" id="zsk-hint" style="display:none">' + esc(T.hintKeine) + '</p>' +
      '<div class="row"><button type="button" class="btn-app">' + esc(T.berechnen) + '</button></div>';

    var btn = inputs.querySelector('button.btn-app');
    btn.addEventListener('click', run);

    // When 'keine' is selected, the deposit field has no effect: grey it out and
    // show a hint instead of silently ignoring a surprising value.
    var sr = E('zsk-sparrhythmus');
    var eb = E('zsk-einzahlung');
    var hint = E('zsk-hint');
    if (sr && eb) {
      var sync = function () {
        var off = (sr.value === 'keine');
        eb.disabled = off;
        if (hint) hint.style.display = off ? 'block' : 'none';
      };
      sr.addEventListener('change', sync);
      sync();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compute: compute, fmtEuro: fmtEuro };
  }
})();
