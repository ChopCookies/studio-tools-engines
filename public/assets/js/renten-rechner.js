/* ══════════════════════════════════════════════════
   renten-rechner.js | Rentenrechner (gesetzliche Rente)
   Offizielle Rentenformel:
   Monatsrente = Entgeltpunkte × Zugangsfaktor × aktueller Rentenwert
   Bilingual (DE/EN) via window.__siteLang. Runs 100% in the browser.
   Rechengrößen (Stand 1.7.2026, Quelle DRV):
   aktueller Rentenwert 42,52 €; Durchschnittsentgelt 2026 = 51.944 €;
   Beitragsbemessungsgrenze 2026 = 101.400 € (8.450 €/Monat).
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DE = (window.__siteLang !== 'en');

  function E(id) { return document.getElementById(id); }
  function num(v) { return parseFloat(String(v).replace(',', '.')) || 0; }
  function int(v) { return Math.round(num(v)); }
  function fmt(n, d) {
    return n.toLocaleString('de-DE', {
      minimumFractionDigits: d == null ? 2 : d,
      maximumFractionDigits: d == null ? 2 : d
    });
  }
  function fmtMoney(n) { return fmt(n, 2) + ' €'; }
  function fmtMoney0(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var T = {
    headline: DE ? 'Geschätzte monatliche Rente in heutiger Kaufkraft' : 'Estimated monthly pension in today\u2019s purchasing power',
    copyBtn: DE ? 'Ergebnis kopieren' : 'Copy result',
    btn: DE ? 'Rente berechnen' : 'Calculate pension',
    hint: DE ? 'Gib Geburtsjahr, Gehalt und Beitragsjahre ein und klicke auf „Rente berechnen".' : 'Enter your birth year, salary and years of contributions, then click Calculate pension.',
    errBirth: DE ? 'Bitte ein gültiges Geburtsjahr eingeben (z. B. 1990).' : 'Please enter a valid birth year (e.g. 1990).',
    errSalary: DE ? 'Bitte ein gültiges Bruttojahresgehalt eingeben.' : 'Please enter a valid gross annual salary.',
    errYears: DE ? 'Die Beitragsjahre müssen zwischen 0 und 60 liegen.' : 'Years of contributions must be between 0 and 60.',
    errAge: DE ? 'Das Rentenalter sollte zwischen 50 und 75 Jahren liegen.' : 'The retirement age should be between 50 and 75 years.',
    errRw: DE ? 'Der aktuelle Rentenwert muss größer als 0 sein.' : 'The current pension value must be greater than 0.',
    errInfl: DE ? 'Die Inflationsannahme sollte zwischen 0 und 20 % liegen.' : 'The inflation assumption should be between 0 and 20%.',
    limit: DE ? 'Regelaltersgrenze für Jahrgang' : 'Standard retirement age for birth year',
    chosen: DE ? 'gewähltes Rentenalter' : 'selected retirement age',
    yearsShort: DE ? 'Jahre' : 'years',
    monthsShort: DE ? 'Monate' : 'months',
    epPerYear: DE ? 'Entgeltpunkte pro Jahr' : 'Earnings points per year',
    grossYear: DE ? 'Jahresbrutto' : 'annual gross',
    epEarned: DE ? 'Entgeltpunkte bereits erworben' : 'Earnings points already earned',
    epFuture: DE ? 'künftige' : 'future',
    epTotal: DE ? 'Entgeltpunkte gesamt' : 'Total earnings points',
    zf: DE ? 'Zugangsfaktor' : 'Access factor',
    rwLine: DE ? 'Aktueller Rentenwert' : 'Current pension value',
    growth: DE ? 'Steigerung' : 'growth',
    inflation: DE ? 'Inflation' : 'inflation',
    realLine: DE ? 'Monatliche Rente (heutige Kaufkraft)' : 'Monthly pension (today\u2019s purchasing power)',
    nominalLine: DE ? 'Monatliche Rente (nominal am Renteneintritt)' : 'Monthly pension (nominal at retirement)',
    est: DE ? 'Schätzung: unterstellt lückenlose Beitragszahlung bis zum Rentenalter und ein Gehalt in konstantem Verhältnis zum Durchschnittsentgelt. Keine verbindliche Prognose.' : 'Estimate: assumes uninterrupted contributions until retirement and a salary in a constant relation to the average income. Not a binding forecast.',
    source: DE ? 'Rechengrößen, Stand 1.7.2026 (Deutsche Rentenversicherung): Rentenwert 42,52 €, Durchschnittsentgelt 2026: 51.944 €.' : 'Reference values, as of 1 July 2026 (Deutsche Rentenversicherung): pension value 42.52 €, average income 2026: 51,944 €.',
    realCopy: DE ? 'Geschätzte monatliche gesetzliche Rente (heutige Kaufkraft)' : 'Estimated monthly statutory pension (today\u2019s purchasing power)',
    nominalCopy: DE ? 'Nominal am Renteneintritt' : 'Nominal at retirement'
  };

  // ── Rechengrößen (Stand 2026, bundeseinheitlich) ────────────────────
  var DW = 51944;    // Durchschnittsentgelt 2026 (vorläufig, DRV)
  var BBG = 101400;  // Beitragsbemessungsgrenze 2026

  function epPerYear(salary) {
    // Entgeltpunkte pro Jahr = Lohn / Durchschnittsentgelt, bis zur BBG gedeckelt.
    return Math.min(Math.max(salary, 0), BBG) / DW;
  }

  function regelaltersgrenze(birth) {
    // Regelaltersgrenze nach Geburtsjahrgang.
    if (birth <= 1946) return 65;
    if (birth <= 1958) return 65 + (birth - 1946) / 12;
    if (birth <= 1963) return 66 + (birth - 1958) * 2 / 12;
    return 67;
  }

  function zugangsfaktor(regel, chosen) {
    var months = Math.round((regel - chosen) * 12);
    if (months >= 0) {
      // Früher in Rente: Abschlag 0,3 % pro Monat, gedeckelt.
      return Math.max(1 - 0.003 * months, 0.45);
    }
    // Später in Rente: Zuschlag 0,5 % pro Monat (Jahrgänge nach 1946), gedeckelt.
    return Math.min(1 + 0.005 * (-months), 1.30);
  }

  function fmtRegel(age) {
    var y = Math.floor(age);
    var m = Math.round((age - y) * 12);
    if (m <= 0) return y + ' ' + T.yearsShort;
    return y + ' ' + T.yearsShort + ' ' + m + ' ' + T.monthsShort;
  }

  // Pure math for node tests. Returns a result object; format elsewhere.
  function compute(p) {
    var birth = p.birth, salary = p.salary, years = p.years,
        chosen = p.age, rw = p.rw, rwGrowth = p.rwGrowth, infl = p.infl;
    var curYear = new Date().getFullYear();
    var regel = regelaltersgrenze(birth);
    var currentAge = curYear - birth;
    var eppy = epPerYear(salary);
    var pastEP = eppy * years;
    var futureYears = Math.max(chosen - currentAge, 0);
    var futureEP = eppy * futureYears;
    var totalEP = pastEP + futureEP;
    var zf = zugangsfaktor(regel, chosen);
    var nominalMonthly = totalEP * zf * rw * Math.pow(1 + rwGrowth, futureYears);
    var realMonthly = totalEP * zf * rw * Math.pow((1 + rwGrowth) / (1 + infl), futureYears);
    return { regel: regel, currentAge: currentAge, eppy: eppy, pastEP: pastEP,
             futureYears: futureYears, futureEP: futureEP, totalEP: totalEP,
             zf: zf, nominalMonthly: nominalMonthly, realMonthly: realMonthly };
  }

  function run() {
    var output = E('tool-output');
    if (!output) return;

    var rwInput = num(E('rc-rw').value) || 42.52;
    var birth = int(E('rc-birth').value);
    var salary = num(E('rc-salary').value);
    var years = num(E('rc-years').value);
    var chosen = num(E('rc-age').value);
    var rwGrowth = num(E('rc-rwgrowth').value) / 100;
    var infl = num(E('rc-infl').value) / 100;

    var curYear = new Date().getFullYear();
    var errs = [];
    if (birth < 1920 || birth > (curYear + 4)) errs.push(T.errBirth);
    if (salary <= 0) errs.push(T.errSalary);
    if (years < 0 || years > 60) errs.push(T.errYears);
    if (chosen < 50 || chosen > 75) errs.push(T.errAge);
    if (rwInput <= 0) errs.push(T.errRw);
    if (infl < 0 || infl > 0.2) errs.push(T.errInfl);

    if (errs.length) {
      output.innerHTML = '<p class="text-muted">' + errs.join('<br>') + '</p>';
      return;
    }

    var r = compute({ birth: birth, salary: salary, years: years, age: chosen,
                      rw: rwInput, rwGrowth: rwGrowth, infl: infl });

    var lines = [];
    lines.push(T.limit + ' ' + birth + ': <strong>' + fmtRegel(r.regel) + '</strong> | ' + T.chosen + ': ' + Math.round(chosen) + ' ' + T.yearsShort);
    lines.push(T.epPerYear + ' (' + T.grossYear + ' ' + fmtMoney0(salary) + '): ' + fmt(r.eppy, 2));
    lines.push(T.epEarned + ': ' + fmt(r.pastEP, 2) + ' | ' + T.epFuture + ': ' + fmt(r.futureEP, 2));
    lines.push(T.epTotal + ': <strong>' + fmt(r.totalEP, 2) + '</strong>');
    lines.push(T.zf + ': ' + fmt(r.zf, 4));
    lines.push(T.rwLine + ': ' + fmtMoney(rwInput) + ' | ' + T.growth + ' ' + fmt(num(E('rc-rwgrowth').value), 2) + ' %/' + (DE ? 'Jahr' : 'yr') + ' | ' + T.inflation + ' ' + fmt(num(E('rc-infl').value), 2) + ' %');
    lines.push('<strong>' + T.realLine + ': ' + fmtMoney0(r.realMonthly) + '</strong>');
    lines.push(T.nominalLine + ': ' + fmtMoney0(r.nominalMonthly));
    lines.push('<em>' + T.est + '</em>');
    lines.push('<span style="font-size:0.75rem;color:var(--text-muted)">' + T.source + '</span>');

    var copyText = T.realCopy + ': ' + fmtMoney0(r.realMonthly)
      + ' | ' + T.nominalCopy + ': ' + fmtMoney0(r.nominalMonthly)
      + ' | ' + T.epTotal + ': ' + fmt(r.totalEP, 2)
      + ' | ' + T.zf + ': ' + fmt(r.zf, 4);

    // Playbook integration: report this finished step (client-side only) and
    // hand the estimated monthly pension forward as the step value.
    if (r.realMonthly > 0 && window.playbook) window.playbook.report({
      tool: 'renten-rechner',
      summary: (DE ? 'Geschätzte Rente: ' : 'Estimated pension: ') +
        fmtMoney0(r.realMonthly) + ' / ' + (DE ? 'Monat' : 'month'),
      value: Math.round(r.realMonthly)
    });

    output.innerHTML = render(copyText, fmtMoney0(r.realMonthly), lines);
  }

  function render(copyText, bigText, lines) {
    var html = '<div class="result-display">';
    html += '<div style="text-align:center;padding:18px;margin-bottom:12px">';
    html += '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">' + T.headline + '</div>';
    html += '<div style="font-size:2rem;font-weight:800;color:var(--accent)">' + bigText + '</div>';
    html += '</div>';
    if (lines && lines.length) {
      html += '<div class="card" style="padding:12px;margin-bottom:8px;font-size:0.85rem">';
      for (var i = 0; i < lines.length; i++) {
        html += '<div style="padding:3px 0">' + lines[i] + '</div>';
      }
      html += '</div>';
    }
    html += '<button class="btn btn-primary copy-btn" data-copy="' + esc(copyText) + '">' + T.copyBtn + '</button>';
    html += '</div>';
    return html;
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-generate';
    btn.textContent = T.btn;
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    inputs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.matches('input, select')) {
        e.preventDefault();
        btn.click();
      }
    });
    output.innerHTML = '<p class="text-muted">' + T.hint + '</p>';
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { epPerYear: epPerYear, regelaltersgrenze: regelaltersgrenze,
                       zugangsfaktor: zugangsfaktor, fmtRegel: fmtRegel, compute: compute };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
