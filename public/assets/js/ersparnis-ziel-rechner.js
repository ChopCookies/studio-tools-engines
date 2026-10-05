/* ══════════════════════════════════════════════════
   ersparnis-ziel-rechner.js | Dauer bis zum Sparziel
   100 % client-seitig, reine Mathematik.
   Optionaler Zinseszins (erwartete Rendite p.a.).
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; }
  function fmt(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 0, minimumFractionDigits: 0 }); }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  // Monate bis zum Ziel: exakte Annuitätenformel bei monatlicher Verzinsung.
  // Endwert nach n Monaten = saved*(1+r)^n + rate*((1+r)^n -1)/r  ->  nach n auflösen.
  function monthsWithInterest(target, rate, saved, retPct) {
    var rm = (retPct / 100) / 12;      // monatlicher Zinssatz
    var q = 1 + rm;
    // Für rate ~0 oder ret wie 0 fällt das auf die reine Division zurück (Schutz).
    if (!(rm > 0)) {
      var missing0 = Math.max(0, target - saved);
      return missing0 > 0 ? Math.ceil(missing0 / rate) : 0;
    }
    if (saved >= target) return 0;                     // Ziel bereits erreicht
    var numer = target + rate / rm;
    var denom = saved + rate / rm;
    if (!(denom > 0)) return Infinity;
    return Math.ceil(Math.log(numer / denom) / Math.log(1 + rm));
  }

  function buildResult() {
    var target = num(E('sz-target') ? E('sz-target').value : '');
    var rate = num(E('sz-rate') ? E('sz-rate').value : '');
    var saved = num(E('sz-saved') ? E('sz-saved').value : '') || 0;
    var retRaw = E('sz-ret') ? E('sz-ret').value : '';
    var ret = num(retRaw);
    var useInterest = isFinite(ret) && ret > 0;

    if (isNaN(target) || target <= 0) {
      return { error: DE ? 'Bitte gib dein Sparziel ein.' : 'Please enter your savings target.' };
    }
    if (isNaN(rate) || rate <= 0) {
      return { error: DE ? 'Bitte gib eine Sparrate größer als 0 ein.' : 'Please enter a savings rate greater than 0.' };
    }
    var missing = Math.max(0, target - saved);
    if (missing <= 0) {
      return { target: target, rate: rate, saved: saved, missing: missing, months: 0,
               useInterest: false, ret: useInterest ? ret : null };
    }
    var months = useInterest
      ? monthsWithInterest(target, rate, saved, ret)
      : Math.ceil(missing / rate);
    return { target: target, rate: rate, saved: saved, missing: missing, months: months,
             useInterest: useInterest, ret: useInterest ? ret : null };
  }

  function durText(months, DE) {
    var years = Math.floor(months / 12);
    var mo = months % 12;
    if (years > 0) {
      return DE
        ? years + ' Jahr' + (years > 1 ? 'e' : '') + (mo ? ' und ' + mo + ' Monat' + (mo > 1 ? 'e' : '') : '')
        : years + ' year' + (years > 1 ? 's' : '') + (mo ? ' and ' + mo + ' month' + (mo > 1 ? 's' : '') : '');
    }
    return DE
      ? mo + ' Monat' + (mo > 1 ? 'e' : '')
      : mo + ' month' + (mo > 1 ? 's' : '');
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var r = buildResult();
    if (r.error) {
      output.innerHTML = '<div class="result-display"><p class="text-muted">' + esc(r.error) + '</p></div>';
      return;
    }
    var html = '<div class="result-display">';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Sparziel' : 'Savings target') + '</span><strong>' + fmt(r.target) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Bereits gespart' : 'Already saved') + '</span><strong>' + fmt(r.saved) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Noch fehlend' : 'Still missing') + '</span><strong>' + fmt(r.missing) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Monatliche Sparrate' : 'Monthly savings rate') + '</span><strong>' + fmt(r.rate) + ' €</strong></div>';
    if (r.months === 0) {
      html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>' + (DE ? 'Dauer bis zum Ziel' : 'Time to reach target') + '</span><strong>' + (DE ? 'bereits erreicht' : 'already reached') + '</strong></div>';
    } else {
      html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>' + (DE ? 'Dauer bis zum Ziel' : 'Time to reach target') + '</span><strong>' + esc(durText(r.months, DE)) + '</strong></div>';
      var d = new Date();
      d.setMonth(d.getMonth() + r.months);
      var reachText = DE
        ? d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
        : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      html += '<div class="calc-result-row"><span>' + (DE ? 'Voraussichtlich erreicht' : 'Estimated reached') + '</span><strong>' + esc(reachText) + '</strong></div>';
    }
    if (r.useInterest) {
      html += '<div class="calc-result-row"><span>' + (DE ? 'Angenommene Rendite' : 'Assumed return') + '</span><strong>' + fmt(r.ret) + ' % p.a.</strong></div>';
    }
    html += '<p class="calculator-note" style="margin-top:12px;font-size:0.78rem;color:var(--text-muted)">' +
      (r.useInterest
        ? (DE ? 'Die monatliche Verzinsung ist eine Annahme, kein Garantiewert. Renditen schwanken und können auch Verluste bringen. Ohne Renditeangabe rechnet der Rechner konservativ ohne Zinsen.'
              : 'Monthly compounding is an assumption, not a guarantee. Returns fluctuate and can also mean losses. Without a return, the calculator works conservatively with no interest.')
        : (DE ? 'Die Berechnung ohne Zinsen ist eine bewusste, konservative Annahme. Eine renditestarke Anlage kann die Dauer verkürzen, birgt aber ein Verlustrisiko.'
              : 'Calculating without interest is a deliberate, conservative assumption. Higher-yield investing can shorten the time but carries a risk of loss.')) +
      '</p>';
    html += '</div>';
    output.innerHTML = html;

    if (window.playbook && typeof window.playbook.report === 'function' && !r.error) {
      window.playbook.report({
        tool: 'ersparnis-ziel-rechner',
        summary: DE
          ? (r.months === 0 ? 'Sparziel bereits erreicht' : 'Dauer bis zum Sparziel: ' + durText(r.months, DE))
          : (r.months === 0 ? 'Savings goal already reached' : 'Time to savings goal: ' + durText(r.months, DE))
      });
    }
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Dauer errechnen' : 'Calculate time';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    output.innerHTML = '<p class="text-muted">' + (DE ? 'Trage Sparziel, Sparrate und bereits angesparten Betrag ein. Optional ergänzt du eine erwartete Rendite, dann klicke auf „Dauer errechnen“.' : 'Enter your target, savings rate and already-saved amount. Optionally add an expected return, then click "Calculate time".') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildResult: buildResult, monthsWithInterest: monthsWithInterest, durText: durText };
  }
})();
