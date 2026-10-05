/* ══════════════════════════════════════════════════
   skonto-rechner.js: Skonto-Rechner
   Berechnet den Einspar- und Zahlbetrag bei Inanspruch-
   nahme von Skonto sowie den effektiven Jahreszins,
   der sich aus der frühen Zahlung ergibt.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  }

  /* -------- pure calculation engine (node-testable) -------- */

  function compute(args) {
    var brutto = parseFloat(args.brutto) || 0;
    var skontoProzent = parseFloat(args.skontoProzent) || 0;
    var skontofristTage = parseFloat(args.skontofristTage) || 0;
    var zahlzielTage = parseFloat(args.zahlzielTage) || 0;

    var p = skontoProzent / 100;
    var skontoBetrag = brutto * p;
    var zahlbetragSkonto = brutto - skontoBetrag;

    var tageErspart = zahlzielTage - skontofristTage;
    if (tageErspart < 0) tageErspart = 0;

    var effektiverJahreszins = null;
    if (tageErspart > 0 && (100 - skontoProzent) > 0) {
      effektiverJahreszins = (skontoProzent / (100 - skontoProzent)) * (360 / tageErspart) * 100;
    }

    var alternativZins = parseFloat(args.alternativZins) || 0;
    var zinsdifferenz = null;
    var lohntSich = null;
    if (effektiverJahreszins !== null && alternativZins > 0) {
      zinsdifferenz = effektiverJahreszins - alternativZins;
      lohntSich = zinsdifferenz > 0;
    }

    return {
      skontoBetrag: skontoBetrag,
      zahlbetragSkonto: zahlbetragSkonto,
      tageErspart: tageErspart,
      effektiverJahreszins: effektiverJahreszins,
      alternativZins: alternativZins,
      zinsdifferenz: zinsdifferenz,
      lohntSich: lohntSich
    };
  }

  function fmtEuro(n) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  /* -------- UI -------- */

  function renderResult(result) {
    var html = '<div class="result-display">';
    html += '<div class="result-big">' + fmtEuro(result.zahlbetragSkonto) + '</div>';
    html += '<div class="result-label">Zahlbetrag bei Skonto</div>';
    html += '<div class="result-rows">';
    html += '<div class="result-row"><span class="result-label">Skontobetrag</span><span class="result-value">' + fmtEuro(result.skontoBetrag) + '</span></div>';
    if (result.lohntSich !== null) {
      html += '<div class="result-row"><span class="result-label">Effektivzins vs. Ihr Zins</span><span class="result-value">' + esc(result.effektiverJahreszins.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })) + ' % gegen ' + esc(result.alternativZins.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })) + ' %</span></div>';
      html += '<div class="result-verdict ' + (result.lohntSich ? 'verdict-pos' : 'verdict-neg') + '">' + (result.lohntSich ? 'Skonto lohnt sich: der Effektivzins liegt über Ihrem Finanzierungszins.' : 'Skonto lohnt sich hier eher nicht: Ihr Finanzierungszins liegt über dem Effektivzins.') + '</div>';
    } else {
      html += '<div class="result-row"><span class="result-label">Ersparnis</span><span class="result-value">' + fmtEuro(result.skontoBetrag) + '</span></div>';
    }
    html += '<div class="result-row"><span class="result-label">Tage früher gezahlt</span><span class="result-value">' + result.tageErspart + ' Tage</span></div>';
    html += '<div class="result-row"><span class="result-label">Effektiver Jahreszins</span><span class="result-value">';
    if (result.effektiverJahreszins === null) {
      html += '-';
    } else {
      html += esc(result.effektiverJahreszins.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })) + ' %';
    }
    html += '</span></div>';
    html += '</div>';
    html += '<p class="note">Skonto lohnt sich wirtschaftlich meist dann, wenn der effektive Jahreszins über dem Kredit- oder Alternativzinssatz liegt.</p>';
    html += '</div>';
    return html;
  }

  function renderOutput(result) {
    var el = E('tool-output');
    if (!el) return;
    el.innerHTML = renderResult(result);
  }

  function run() {
    var rb = E('sk-rechnungsbetrag');
    var sp = E('sk-skontosatz');
    var sf = E('sk-skontofrist');
    var zz = E('sk-zahlziel');
    if (!rb || !sp || !sf || !zz) return;

    var brutto = parseFloat(rb.value) || 0;
    var skontoProzent = parseFloat(sp.value) || 0;
    var skontofristTage = parseFloat(sf.value) || 0;
    var zahlzielTage = parseFloat(zz.value) || 0;

    var refiEl = E('sko-refi');
    var alternativZins = refiEl ? (parseFloat(refiEl.value) || 0) : 0;

    var result = compute({ brutto: brutto, skontoProzent: skontoProzent, skontofristTage: skontofristTage, zahlzielTage: zahlzielTage, alternativZins: alternativZins });
    renderOutput(result);
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label for="sk-rechnungsbetrag">Rechnungsbetrag (brutto €)</label><input id="sk-rechnungsbetrag" type="number" value="1000" step="10"></div>' +
      '<div class="field"><label for="sk-skontosatz">Skontosatz (%)</label><input id="sk-skontosatz" type="number" value="2" step="0.1"></div>' +
      '<div class="field"><label for="sk-skontofrist">Skontofrist (Tage)</label><input id="sk-skontofrist" type="number" value="14" step="1"></div>' +
      '<div class="field"><label for="sk-zahlziel">Zahlungsziel (Tage)</label><input id="sk-zahlziel" type="number" value="30" step="1"></div>' +
      '<div class="field"><label for="sko-refi">Ihr Refinanzierungs- oder Alternativzins (% p.a., optional)</label><input id="sko-refi" type="number" value="" step="0.1" placeholder="z. B. 8"></div>' +
      '<div class="presets"><span class="preset-label">Übliche B2B-Konditionen:</span>' +
        '<button type="button" class="btn-preset" data-s="2" data-f="8" data-z="30">2 % / 8 T / 30 T</button>' +
        '<button type="button" class="btn-preset" data-s="2" data-f="10" data-z="30">2 % / 10 T / 30 T</button>' +
        '<button type="button" class="btn-preset" data-s="2" data-f="14" data-z="30">2 % / 14 T / 30 T</button>' +
        '<button type="button" class="btn-preset" data-s="3" data-f="10" data-z="30">3 % / 10 T / 30 T</button>' +
        '<button type="button" class="btn-preset" data-s="3" data-f="14" data-z="45">3 % / 14 T / 45 T</button>' +
      '</div>' +
      '<div class="row"><button type="button" class="btn-app">Berechnen</button></div>';

    var btn = inputs.querySelector('button.btn-app');
    btn.addEventListener('click', run);

    var all = inputs.querySelectorAll('input');
    inputs.querySelectorAll('button.btn-preset').forEach(function (b) {
      b.addEventListener('click', function () {
        if (all.length >= 4) {
          all[1].value = b.getAttribute('data-s');
          all[2].value = b.getAttribute('data-f');
          all[3].value = b.getAttribute('data-z');
          run();
        }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compute: compute, fmtEuro: fmtEuro };
  }
})();
