/* ══════════════════════════════════════════════════
   vat-calculator.js | Mehrwertsteuer / USt-Rechner
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  var DE = (window.__siteLang === 'de');

  var T = DE ? {
    result: 'Ergebnis',
    copy: 'Ergebnis kopieren',
    invalidAmount: 'Bitte einen gültigen Betrag eingeben.',
    invalidRate: 'Der Steuersatz muss zwischen 0 und 100 % liegen.',
    calculate: 'Berechnen',
    hint: 'Wähle die Richtung, gib Betrag und Satz ein und klicke auf \u201eBerechnen\u201c.',
    grossAmount: 'Bruttobetrag:',
    vat: 'MwSt.',
    netAmount: 'Nettobetrag:',
    vatRate: 'Steuersatz'
  } : {
    result: 'Result',
    copy: 'Copy result',
    invalidAmount: 'Please enter a valid amount.',
    invalidRate: 'The tax rate must be between 0 and 100 %.',
    calculate: 'Calculate',
    hint: 'Choose the direction, enter the amount and rate, then click \u201cCalculate\u201d.',
    grossAmount: 'Gross amount:',
    vat: 'VAT',
    netAmount: 'Net amount:',
    vatRate: 'Tax rate'
  };

  function E(id) { return document.getElementById(id); }
  function num(v) { return parseFloat(String(v).replace(',', '.')) || 0; }
  function fmt(n) { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtMoney(n) { return fmt(n) + ' €'; }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  }

  // Pure math, node-testable. mode: 'net' (net to gross) | 'gross' (gross to net).
  function compute(mode, rate, amount) {
    if (!(amount > 0)) return null;
    if (!(rate >= 0 && rate <= 100)) return null;
    if (mode === 'gross') {
      var net = amount / (1 + rate / 100);
      return { rate: rate, net: net, tax: amount - net, gross: amount };
    }
    var tax = amount * rate / 100;
    return { rate: rate, net: amount, tax: tax, gross: amount + tax };
  }

  function pct(rate) {
    return rate.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %';
  }

  function render(copyText, bigText, lines) {
    var html = '<div class="result-display">';
    html += '<div style="text-align:center;padding:18px;margin-bottom:12px">';
    html += '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">' + T.result + '</div>';
    html += '<div style="font-size:2rem;font-weight:800;color:var(--accent)">' + bigText + '</div>';
    html += '</div>';
    if (lines) {
      html += '<div class="card" style="padding:12px;margin-bottom:8px;font-size:0.85rem">';
      for (var i = 0; i < lines.length; i++) {
        html += '<div style="padding:3px 0">' + lines[i] + '</div>';
      }
      html += '</div>';
    }
    html += '<button class="btn btn-primary copy-btn" data-copy="' + esc(copyText) + '">' + T.copy + '</button>';
    html += '</div>';
    return html;
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var mode = E('vt-mode').value; // 'net' | 'gross'
    var custom = num(E('vt-custom').value);
    // A custom rate of 0 is a valid 0 % case, so only ignore an empty/invalid field.
    var rate = E('vt-custom').value.trim() !== '' ? custom : num(E('vt-rate').value);
    var amount = num(E('vt-amount').value);

    var res = compute(mode, rate, amount);
    if (res === null) {
      if (amount <= 0) {
        output.innerHTML = '<p class="text-muted">' + T.invalidAmount + '</p>';
      } else {
        output.innerHTML = '<p class="text-muted">' + T.invalidRate + '</p>';
      }
      return;
    }

    if (mode === 'gross') {
      // Brutto → Netto
      output.innerHTML = render(
        fmtMoney(res.net),
        fmtMoney(res.net),
        [
          T.grossAmount + ' ' + fmtMoney(res.gross),
          T.vat + ' (' + pct(res.rate) + '): &minus;' + fmtMoney(res.tax),
          '<strong>' + T.netAmount + ' ' + fmtMoney(res.net) + '</strong>'
        ]
      );
      if (res.net > 0 && window.playbook) window.playbook.report({ tool: 'vat-calculator', summary: (DE ? 'MwSt. ' : 'VAT ') + pct(res.rate) });
    } else {
      // Netto → Brutto
      output.innerHTML = render(
        fmtMoney(res.gross),
        fmtMoney(res.gross),
        [
          T.netAmount + ' ' + fmtMoney(res.net),
          T.vat + ' (' + pct(res.rate) + '): +' + fmtMoney(res.tax),
          '<strong>' + T.grossAmount + ' ' + fmtMoney(res.gross) + '</strong>'
        ]
      );
      if (res.gross > 0 && window.playbook) window.playbook.report({ tool: 'vat-calculator', summary: (DE ? 'MwSt. ' : 'VAT ') + pct(res.rate) });
    }
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-generate';
    btn.textContent = T.calculate;
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    inputs.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.target && e.target.matches('input, select')) {
        e.preventDefault();
        btn.click();
      }
    });
    output.innerHTML = '<p class="text-muted">' + T.hint + '</p>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compute: compute, num: num, fmtMoney: fmtMoney };
  }
})();
