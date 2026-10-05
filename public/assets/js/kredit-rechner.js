/* ══════════════════════════════════════════════════
   kredit-rechner.js | Kredit Rechner (Annuitätendarlehen)
   Two modes: compute the monthly rate from a term, or compute
   the term from a fixed monthly rate. Standard annuity formula.
   Includes a yearly amortization schedule. 100% client-side.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  var DE = (window.__siteLang !== 'en');

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var FMT = new Intl.NumberFormat((DE ? 'de-DE' : 'en-US'), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  var FMT2 = new Intl.NumberFormat((DE ? 'de-DE' : 'en-US'), { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var num = function(x) { return new Intl.NumberFormat(DE ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 }).format(x); };

  var T = {
    calc: DE ? 'Berechnen' : 'Calculate',
    hint: DE ? 'Betrag, Sollzins und entweder Laufzeit oder monatliche Rate eingeben.' : 'Enter the amount, interest rate and either the term or monthly payment.',
    refNote: DE ? 'Zur Orientierung, Stand September 2026: Ratenkredit-Sollzinsen liegen üblicherweise um 6 bis 9 %, der Bauzinssatz bei 10 Jahren Zinsbindung aktuell bei rund 4,2 % (Interhyp).' : 'For orientation, as of September 2026: installment-loan rates are typically around 6 to 9 %, the mortgage rate for a 10-year fixed term is currently about 4.2 % (Interhyp).',
    empty: DE ? 'Bitte einen gültigen Betrag und Zinssatz eingeben.' : 'Please enter a valid amount and interest rate.',
    invalid: DE ? 'Bitte Laufzeit oder Rate angeben.' : 'Please provide a term or a monthly payment.',
    amount: DE ? 'Darlehensbetrag' : 'Loan amount',
    rate: DE ? 'Sollzins p.a.' : 'Interest rate p.a.',
    termY: DE ? 'Laufzeit (Jahre)' : 'Term (years)',
    monthly: DE ? 'Monatliche Rate' : 'Monthly payment',
    monthlyOut: DE ? 'Monatliche Rate' : 'Monthly payment',
    totalInterest: DE ? 'Gesamtzinsen' : 'Total interest',
    totalPayment: DE ? 'Gesamtbelastung' : 'Total payment',
    duration: DE ? 'Laufzeit' : 'Term',
    years: DE ? 'Jahre' : 'yrs', months: DE ? 'Monate' : 'mo',
    schedule: DE ? 'Tilgungsplan (Jahresende)' : 'Amortization schedule (year-end)',
    year: DE ? 'Jahr' : 'Year', remaining: DE ? 'Restschuld' : 'Remaining balance', paidInterest: DE ? 'Zinsen kumuliert' : 'Cumulative interest',
    notFeasible: DE ? 'Die monatliche Rate ist zu niedrig, um die Zinsen zu decken. Eine Tilgung ist bei dieser Rate nicht möglich. Erhöhe die Rate.' : 'The monthly payment is too low to cover the interest. No repayment is possible at this rate. Increase the payment.'
  };

  function parseNum(v) {
    return parseFloat(String(v).replace(',', '.').replace(/[^0-9.]/g, ''));
  }

  function annuity(amount, annualRate, months) {
    var r = annualRate / 100 / 12;
    if (r === 0) return amount / months;
    return amount * r / (1 - Math.pow(1 + r, -months));
  }

  function termFromMonthly(amount, annualRate, monthly) {
    var r = annualRate / 100 / 12;
    if (r === 0) return { months: Math.ceil(amount / monthly), ok: true };
    if (amount * r >= monthly) return { ok: false };
    var n = -Math.log(1 - amount * r / monthly) / Math.log(1 + r);
    return { months: Math.ceil(n), ok: true };
  }

  function schedule(amount, annualRate, monthly) {
    var r = annualRate / 100 / 12;
    var debt = amount, year = 0, cumInt = 0, rows = [];
    while (debt > 0 && year < 100) {
      var yearStart = debt;
      for (var m = 0; m < 12; m++) {
        if (debt <= 0) break;
        var int = debt * r;
        cumInt += int;
        var prin = monthly - int;
        debt = Math.max(0, debt - prin);
      }
      year++;
      if (Number.isFinite(debt) && yearStart - debt > 0.005) {
        rows.push({ year: year, remaining: debt, cumInt: cumInt });
      } else if (debt <= 0) {
        rows.push({ year: year, remaining: 0, cumInt: cumInt });
      }
      if (rows.length > 60) break;
    }
    return rows;
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var amt = parseNum(E('kr-amount') ? E('kr-amount').value : '');
    var annual = parseNum(E('kr-rate') ? E('kr-rate').value : '');
    if (!amt || amt <= 0 || annual < 0) { output.innerHTML = '<p class="text-muted">' + esc(T.empty) + '</p>'; return; }
    var mode = E('kr-mode') ? E('kr-mode').value : 'term';

    var R, termMonths, fullMonths;
    if (mode === 'monthly') {
      var mp = parseNum(E('kr-monthly') ? E('kr-monthly').value : '');
      if (!mp || mp <= 0) { output.innerHTML = '<p class="text-muted">' + esc(T.invalid) + '</p>'; return; }
      var t = termFromMonthly(amt, annual, mp);
      if (!t.ok) { output.innerHTML = '<p class="text-muted">' + esc(T.notFeasible) + '</p>'; return; }
      termMonths = t.months; R = mp;
    } else {
      var yrs = parseNum(E('kr-term') ? E('kr-term').value : '');
      if (!yrs || yrs <= 0) { output.innerHTML = '<p class="text-muted">' + esc(T.invalid) + '</p>'; return; }
      termMonths = Math.round(yrs * 12);
      R = annuity(amt, annual, termMonths);
    }
    var total = R * termMonths;
    var interest = total - amt;

    var html = '<div class="result-display">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';
    html += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.monthlyOut) + '</div><div style="font-size:1.3rem;font-weight:800;color:var(--accent)">' + FMT2.format(R) + '</div></div>';
    html += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.duration) + '</div><div style="font-size:1.1rem;font-weight:800">' + Math.floor(termMonths / 12) + ' ' + esc(T.years) + (termMonths % 12 ? ' ' + (termMonths % 12) + ' ' + esc(T.months) : '') + '</div></div>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
    html += '<div class="card" style="padding:10px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.totalInterest) + '</div><div style="font-weight:700">' + FMT.format(interest) + '</div></div>';
    html += '<div class="card" style="padding:10px;text-align:center"><div style="font-size:0.75rem;color:var(--text-muted)">' + esc(T.totalPayment) + '</div><div style="font-weight:700">' + FMT.format(total) + '</div></div>';
    html += '</div>';

    // schedule
    var rows = schedule(amt, annual, R);
    html += '<div class="card" style="padding:12px;margin-bottom:6px">';
    html += '<div style="font-weight:700;margin-bottom:6px">' + esc(T.schedule) + '</div>';
    html += '<div style="max-height:220px;overflow:auto;font-size:0.82rem">';
    html += '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;opacity:.7"><th style="padding:2px 6px">' + esc(T.year) + '</th><th style="padding:2px 6px">' + esc(T.remaining) + '</th><th style="padding:2px 6px">' + esc(T.paidInterest) + '</th></tr></thead><tbody>';
    for (var i = 0; i < rows.length; i++) {
      html += '<tr><td style="padding:2px 6px">' + rows[i].year + '</td><td style="padding:2px 6px;font-variant-numeric:tabular-nums">' + num(rows[i].remaining) + ' €</td><td style="padding:2px 6px;font-variant-numeric:tabular-nums">' + num(rows[i].cumInt) + ' €</td></tr>';
    }
    html += '</tbody></table></div></div>';
    html += '</div>';
    output.innerHTML = html;

    // Playbook integration: report this finished step (client-side only).
    if (R > 0 && window.playbook) window.playbook.report({
      tool: 'kredit-rechner',
      summary: (window.__siteLang === 'en' ? 'Monthly installment: ' : 'Monatliche Rate: ') +
        FMT2.format(R)
    });
  }

  function onModeChange() {
    var mode = E('kr-mode') ? E('kr-mode').value : 'term';
    var g = function(id) { var el = E(id); return el && el.closest ? el.closest('.input-group') : null; };
    var gl = g('kr-term'), gm = g('kr-monthly');
    if (gl) gl.style.display = (mode === 'term') ? '' : 'none';
    if (gm) gm.style.display = (mode === 'monthly') ? '' : 'none';
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var mode = E('kr-mode');
    if (mode) mode.addEventListener('change', onModeChange);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-generate';
    btn.textContent = T.calc;
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    inputs.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.target && e.target.matches('input, select')) { e.preventDefault(); btn.click(); }
    });
    onModeChange();
    output.innerHTML = '<p class="text-muted">' + esc(T.hint) + '</p>' +
      '<p class="text-muted" style="font-size:0.82rem;margin-top:8px">' + esc(T.refNote) + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) module.exports = { annuity: annuity, termFromMonthly: termFromMonthly, schedule: schedule, run: run, setup: setup };
})();
