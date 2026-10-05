/* ══════════════════════════════════════════════════
   fahrkosten-rechner.js | Entfernungspauschale (Pendlerpauschale)
   100 % client-seitig. Steuerliche Konstanten mit Stand.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function fmt(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }); }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  /* Stand: 01/2026 | Entfernungspauschale (Steueränderungsgesetz 2025):
     Seit 01.01.2026 gilt 0,38 €/km für JEDEN Entfernungskilometer (ab dem 1. km).
     Zuvor (2021 bis 2025): 0,30 € für die ersten 20 km, 0,38 € ab dem 21. km.
     Höchstgrenze je Jahr: 4.500 € (EStG § 9 Abs. 2). Ein höherer Betrag ist nur
     ansetzbar, wenn der Steuerpflichtige ein Kfz nutzt.
     Es zählt die EINFACHE Strecke (nur Hin ODER Rück), volle Kilometer,
     kürzeste Straßenverbindung, unabhängig vom Verkehrsmittel.
     Rechtsgrundlage: EStG § 9. */
  var RATE = 0.38;
  var CAP = 4500;
  var WORKDAYS = 230; // typische Arbeitstage pro Jahr (Richtwert)

  function run() {
    var output = E('tool-output');
    if (!output) return;
    var km = Math.floor(num(E('fk-km').value)); // nur volle Kilometer
    if (!(km > 0)) {
      output.innerHTML = '<div class="result-display"><p class="text-muted">' + (DE ? 'Bitte gib eine Entfernung größer 0 an.' : 'Please enter a distance greater than 0.') + '</p></div>';
      return;
    }
    var workdays = num(E('fk-days').value) || WORKDAYS;
    var pkwEl = E('fk-pkw');
    var pkw = pkwEl ? pkwEl.checked : true; // Standard: Kfz-Nutzung
    var einfacher = km;
    var perDay = einfacher * RATE;
    var grossYear = perDay * workdays;
    var ansatzrabatt = num(E('fk-rabatt').value);

    var capped = false;
    var deductBase = grossYear;
    if (grossYear > CAP && !pkw) {
      deductBase = CAP;
      capped = true;
    }
    var deduct = deductBase - ansatzrabatt;
    if (deduct < 0) deduct = 0;

    var html = '<div class="result-display" style="display:block">';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Einfache Entfernung' : 'One-way distance') + '</span><strong>' + km + ' km</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Pauschale je Arbeitstag' : 'Allowance per workday') + ' (0,38 €/km)</span><strong>' + fmt(perDay) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Für ' + workdays + ' Arbeitstage / Jahr' : 'For ' + workdays + ' workdays / year') + '</span><strong>' + fmt(grossYear) + ' €</strong></div>';
    if (capped) {
      html += '<div class="calc-result-row"><span>' + (DE ? 'Begrenzter Abzug (4.500-€-Höchstgrenze, ohne Kfz)' : 'Capped deduction (€4,500 ceiling, no car)') + '</span><strong>4.500 €</strong></div>';
    } else if (grossYear > CAP && pkw) {
      html += '<div class="calc-result-row" style="color:var(--text-muted)"><span>' + (DE ? 'Hinweis: du nutzt ein Kfz, daher greift die 4.500-€-Höchstgrenze nicht' : 'Note: you use a car, so the €4,500 ceiling does not apply') + '</span></div>';
    }
    if (ansatzrabatt > 0) html += '<div class="calc-result-row"><span>' + (DE ? 'Abzüglich Arbeitgeber-Zuschüsse' : 'Less employer contribution') + '</span><strong>− ' + fmt(ansatzrabatt) + ' €</strong></div>';
    html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>' + (DE ? 'Abzugsfähiger Betrag / Jahr' : 'Deductible amount / year') + '</span><strong>' + fmt(deduct) + ' €</strong></div>';
    if (capped) {
      html += '<p style="margin-top:10px;font-size:0.85rem;color:var(--text-muted)">' + (DE ? 'Da du kein Kraftfahrzeug nutzt, ist der Abzug auf 4.500 € im Jahr begrenzt (EStG § 9 Abs. 2).' : 'Because you do not use a car, the deduction is capped at €4,500 per year (EStG § 9 sec. 2).') + '</p>';
    }
    html += '<p style="margin-top:8px;font-size:0.8rem;color:var(--text-muted)">' + (DE ? 'Das ist der steuerliche Werbungskosten-Abzug (EStG § 9), keine Erstattung. Er mindert dein zu versteuerndes Einkommen.' : 'This is the tax deduction (EStG § 9), not a refund. It reduces your taxable income.') + '</p>';
    html += '</div>';
    output.innerHTML = html;
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Berechnen' : 'Calculate';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    output.innerHTML = '<p class="text-muted">' + (DE ? 'Trage deine einfache Entfernung (km) ein, um die abzugsfähige Entfernungspauschale pro Jahr zu berechnen.' : 'Enter your one-way distance (km) to calculate the deductible commuter allowance per year.') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { run: run, RATE: RATE, CAP: CAP, WORKDAYS: WORKDAYS };
  }
})();
