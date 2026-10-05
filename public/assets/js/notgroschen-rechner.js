/* ══════════════════════════════════════════════════
   notgroschen-rechner.js — Notgroschen / Notfallrücklage
   100 % client-seitig. Empfehlung: VZ "2 bis 3 Monatsausgaben".
   Ziel-Höhe (Monatsausgaben) vom Nutzer wählbar (2/3/4/6).
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; }
  function fmt(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 0, minimumFractionDigits: 0 }); }
  function fmt1(n) { return n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  /* Standardziel: 3 Monatsausgaben. Die Höhe holen wir aus dem ng-months
     Select, damit sie an die Lebenssituation angepasst werden kann. */
  var MONTHS_TARGET = 3;
  var MONTHS_OPTIONS = [2, 3, 4, 6];

  /* Liest die gewählte Zielhöhe aus dem Select und fällt auf MONTHS_TARGET
     zurück, wenn kein gültiger Wert da ist. */
  function parseMonths(val) {
    var n = parseInt(String(val), 10);
    if (isNaN(n) || n < 1) n = MONTHS_TARGET;
    return n;
  }

  function coveredMonths(saved, expenses) {
    return (expenses > 0) ? saved / expenses : 0;
  }

  function progressPct(saved, target) {
    if (target <= 0) return 0;
    return Math.max(0, Math.min(100, saved / target * 100));
  }

  function buildResult() {
    var expenses = num(E('ng-expenses') ? E('ng-expenses').value : '');
    var rate = num(E('ng-rate') ? E('ng-rate').value : '');
    var saved = num(E('ng-saved') ? E('ng-saved').value : '') || 0;
    if (isNaN(expenses) || expenses <= 0) {
      return { error: DE ? 'Bitte gib deine monatlichen Lebenshaltungskosten ein.' : 'Please enter your monthly living costs.' };
    }
    if (isNaN(rate) || rate < 0) {
      return { error: DE ? 'Bitte gib eine gültige Sparrate ein.' : 'Please enter a valid savings rate.' };
    }
    var months = parseMonths(E('ng-months') ? E('ng-months').value : '');
    var target = expenses * months;
    var missing = Math.max(0, target - saved);
    var monthsToTarget = rate > 0 ? Math.ceil(missing / rate) : Infinity;
    var reached = target > 0 && saved >= target;
    return {
      expenses: expenses, rate: rate, saved: saved, months: months,
      target: target, missing: missing, monthsToTarget: monthsToTarget,
      covered: coveredMonths(saved, expenses), progress: progressPct(saved, target), reached: reached
    };
  }

  /* Baut die Fortschritts-Leiste (CSS inline, benutzt Design-Variablen). */
  function progressHtml(r) {
    var pct = r.progress.toFixed(0);
    var label = DE ? ('Fortschritt: ' + pct + ' % des Ziels') : ('Progress: ' + pct + ' % of target');
    return '<div style="margin:14px 0 2px">'
      + '<div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-muted);margin-bottom:6px"><span>' + label + '</span></div>'
      + '<div style="height:10px;border-radius:999px;background:var(--bg-toolbar);overflow:hidden;border:1px solid var(--border)">'
      + '<div style="height:100%;width:' + pct + '%;border-radius:999px;background:var(--accent);transition:width .3s ease"></div>'
      + '</div></div>';
  }

  function durText(months) {
    var years = Math.floor(months / 12);
    var m = months % 12;
    if (years > 0) {
      return DE
        ? (years + ' Jahr' + (years > 1 ? 'e' : '') + (m ? ' und ' + m + ' Monat' + (m > 1 ? 'e' : '') : ''))
        : (years + ' year' + (years > 1 ? 's' : '') + (m ? ' and ' + m + ' month' + (m > 1 ? 's' : '') : ''));
    }
    return DE ? (m + ' Monat' + (m > 1 ? 'e' : '')) : (m + ' month' + (m > 1 ? 's' : ''));
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var r = buildResult();
    if (r.error) {
      output.innerHTML = '<div class="result-display"><p class="text-muted">' + esc(r.error) + '</p></div>';
      return;
    }
    var targetLabel = DE ? ('Ziel-Notgroschen (' + r.months + ' Monatsausgaben)') : ('Target emergency fund (' + r.months + ' months of expenses)');
    var html = '<div class="result-display" style="flex-direction:column;align-items:stretch">';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Monatliche Lebenshaltungskosten' : 'Monthly living costs') + '</span><strong>' + fmt(r.expenses) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + targetLabel + '</span><strong>' + fmt(r.target) + ' €</strong></div>';
    html += progressHtml(r);
    html += '<div class="calc-result-row"><span>' + (DE ? 'Bereits gespart' : 'Already saved') + '</span><strong>' + fmt(r.saved) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Davon abgedeckt' : 'Covered months') + '</span><strong>' + fmt1(r.covered) + ' ' + (DE ? 'Monate' : 'months') + '</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Noch fehlend' : 'Still missing') + '</span><strong>' + fmt(r.missing) + ' €</strong></div>';
    if (r.reached) {
      html += '<div class="calc-result-row"><span>' + (DE ? 'Status' : 'Status') + '</span><strong style="color:var(--ok,#2e9e5b)">' + (DE ? 'Ziel erreicht' : 'Target reached') + '</strong></div>';
    } else {
      html += '<div class="calc-result-row"><span>' + (DE ? 'Monats-Sparrate' : 'Monthly savings rate') + '</span><strong>' + fmt(r.rate) + ' €</strong></div>';
      if (r.monthsToTarget === Infinity) {
        html += '<p class="text-muted" style="margin-top:10px;font-size:0.78rem">' + (DE ? 'Setze eine monatliche Sparrate, um zu sehen, wie lange es dauert.' : 'Set a monthly savings rate to see how long it will take.') + '</p>';
      } else {
        html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>' + (DE ? 'Dauer bis zum Ziel' : 'Time to reach target') + '</span><strong>' + esc(durText(r.monthsToTarget)) + '</strong></div>';
      }
    }
    html += '<p class="text-muted" style="margin-top:14px;font-size:0.78rem">' + (DE ? 'Die Verbraucherzentrale empfiehlt 2 bis 3 Monatsausgaben als Notfallrücklage auf einem täglich verfügbaren Konto (Stand 10/2026). 3 Monate sind ein guter Standard, Selbstständige planen oft 6.' : 'The German consumer advice centre recommends 2 to 3 months of expenses as an emergency fund in a daily-accessible account (as of 10/2026). 3 months is a solid default; self-employed people often plan for 6.') + '</p>';
    html += '</div>';
    output.innerHTML = html;

    // Playbook integration: report this finished step (client-side only),
    // so the flow stores progress and offers the next step.
    if (r.target > 0 && window.playbook) window.playbook.report({
      tool: 'notgroschen-rechner',
      summary: (DE ? 'Ziel-Notgroschen: ' : 'Target emergency fund: ') + fmt(r.target) + ' €',
      value: r.target,
      fields: { notgroschenZiel: r.target }
    });
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Notgroschen errechnen' : 'Calculate emergency fund';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    output.innerHTML = '<p class="text-muted">' + (DE ? 'Trage deine monatlichen Lebenshaltungskosten und deine Sparrate ein, wähle die Zielhöhe und klicke auf „Notgroschen errechnen“.' : 'Enter your monthly living costs and savings rate, pick the target size, then click "Calculate emergency fund".') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      buildResult: buildResult,
      parseMonths: parseMonths,
      coveredMonths: coveredMonths,
      progressPct: progressPct,
      durText: durText,
      MONTHS_TARGET: MONTHS_TARGET,
      MONTHS_OPTIONS: MONTHS_OPTIONS
    };
  }
})();
