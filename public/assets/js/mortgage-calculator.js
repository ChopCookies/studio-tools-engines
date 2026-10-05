/* ══════════════════════════════════════════════════
   mortgage-calculator.js | Baufinanzierungsrechner
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function getEl(id) { return document.getElementById(id); }

  // ── German number formatting ──
  function fmt(n) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtEuro(n) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function fmtInt(n) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // ── Calculation ──
  function calculateAmortization(loan, annualRate, fixedYears, initialRepayPct, extraPayment) {
    var monthlyRate = annualRate / 100 / 12;
    var monthlyPayment = loan * (monthlyRate + (initialRepayPct / 100 / 12));
    var balance = loan;
    var schedule = [];
    var totalInterest = 0;
    var totalPrincipal = 0;
    var fixedPeriodMonths = fixedYears * 12;
    var remainingBalanceAfterFixed = loan;
    var yearsFullyPaid = null;

    for (var year = 1; year <= 40; year++) {
      if (balance <= 0) break;

      var yearInterest = 0;
      var yearPrincipal = 0;
      var yearStartBalance = balance;

      for (var m = 0; m < 12; m++) {
        if (balance <= 0) break;
        var monthsElapsed = (year - 1) * 12 + m;

        var interest = balance * monthlyRate;
        var repayment = monthlyPayment - interest;

        // If repayment exceeds balance, pay off remaining
        if (repayment >= balance) {
          yearInterest += interest;
          yearPrincipal += balance;
          totalInterest += interest;
          totalPrincipal += balance;
          balance = 0;
          if (yearsFullyPaid === null) yearsFullyPaid = year - 1 + (m / 12);
          break;
        }

        balance -= repayment;
        yearInterest += interest;
        yearPrincipal += repayment;
        totalInterest += interest;
        totalPrincipal += repayment;

        // Extra payment (applied once per year in the last month, if still in fixed period)
        if (m === 11 && extraPayment > 0 && monthsElapsed < fixedPeriodMonths) {
          if (extraPayment >= balance) {
            yearPrincipal += balance;
            totalPrincipal += balance;
            balance = 0;
            if (yearsFullyPaid === null) yearsFullyPaid = year - 1 + (m / 12);
            break;
          }
          balance -= extraPayment;
          yearPrincipal += extraPayment;
          totalPrincipal += extraPayment;
        }
      }

      schedule.push({
        year: year,
        startBalance: yearStartBalance,
        endBalance: balance,
        payment: yearInterest + yearPrincipal,
        interest: yearInterest,
        principal: yearPrincipal,
        isFixed: year <= fixedYears
      });

      // Track remaining balance at end of fixed period
      if (year === fixedYears) {
        remainingBalanceAfterFixed = balance;
      }

      // If paid off, stop
      if (balance <= 0) break;
    }

    return {
      monthlyPayment: monthlyPayment,
      totalInterest: totalInterest,
      totalPrincipal: totalPrincipal,
      totalPaid: totalInterest + totalPrincipal,
      schedule: schedule,
      remainingAfterFixed: remainingBalanceAfterFixed,
      yearsToPayoff: yearsFullyPaid,
      fixedYears: fixedYears
    };
  }

  // ── Chart drawing ──
  function drawChart(canvas, schedule, fixedYears) {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.parentElement.getBoundingClientRect();
    var w = rect.width;
    var h = 300;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var pad = { top: 24, right: 16, bottom: 36, left: 60 };
    var chartW = w - pad.left - pad.right;
    var chartH = h - pad.top - pad.bottom;

    // Find max value
    var maxVal = 0;
    for (var i = 0; i < schedule.length; i++) {
      var total = schedule[i].interest + schedule[i].principal;
      if (total > maxVal) maxVal = total;
    }
    // Round up to nice number
    var mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
    maxVal = Math.ceil(maxVal / mag) * mag;
    if (maxVal < 1) maxVal = 10000;

    var barW = Math.min(40, (chartW / schedule.length) - 4);
    var gap = (chartW - barW * schedule.length) / (schedule.length + 1);

    ctx.clearRect(0, 0, w, h);

    // --- Background grid ---
    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 1;
    var gridLines = 5;
    for (var g = 0; g <= gridLines; g++) {
      var y = pad.top + (chartH / gridLines) * g;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      // Y-axis labels
      var val = maxVal - (maxVal / gridLines) * g;
      ctx.fillStyle = 'var(--text-muted, #888)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtInt(val) + ' €', pad.left - 8, y);
    }

    // --- Y-axis label ---
    ctx.save();
    ctx.translate(12, pad.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'var(--text-muted, #888)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Jährliche Rate (€)', 0, 0);
    ctx.restore();

    // --- X-axis label ---
    ctx.fillStyle = 'var(--text-muted, #888)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Jahr', w / 2, h - 4);

    // --- Bars ---
    var isDark = document.documentElement.classList.contains('dark');
    var colorInterest = isDark ? 'rgba(239, 68, 68, 0.7)' : 'rgba(220, 38, 38, 0.6)';
    var colorPrincipal = isDark ? 'rgba(52, 211, 153, 0.7)' : 'rgba(22, 163, 74, 0.6)';
    var colorInterestBorder = isDark ? 'rgb(239, 68, 68)' : 'rgb(185, 28, 28)';
    var colorPrincipalBorder = isDark ? 'rgb(52, 211, 153)' : 'rgb(21, 128, 61)';

    for (var i = 0; i < schedule.length; i++) {
      var s = schedule[i];
      var interestH = (s.interest / maxVal) * chartH;
      var principalH = (s.principal / maxVal) * chartH;
      var x = pad.left + gap + i * (barW + gap);
      var yBase = pad.top + chartH;

      // Interest portion (top)
      if (interestH > 0) {
        ctx.fillStyle = colorInterest;
        ctx.fillRect(x, yBase - interestH - principalH, barW, interestH);
      }

      // Principal portion (bottom)
      if (principalH > 0) {
        ctx.fillStyle = colorPrincipal;
        ctx.fillRect(x, yBase - principalH, barW, principalH);
      }

      // Bar separator line
      if (interestH > 0 && principalH > 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, yBase - principalH);
        ctx.lineTo(x + barW, yBase - principalH);
        ctx.stroke();
      }

      // X-axis label (every 5 years, or all if <= 15 years)
      if (schedule.length <= 15 || (i % 5 === 0) || i === schedule.length - 1) {
        ctx.fillStyle = 'var(--text-muted, #888)';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(s.year, x + barW / 2, pad.top + chartH + 6);
      }

      // Fixed period marker line
      if (s.isFixed && i + 1 === fixedYears) {
        var lineX = x + barW + gap / 2;
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(lineX, pad.top);
        ctx.lineTo(lineX, pad.top + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'var(--text-muted, #888)';
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Zinsbindung', lineX, pad.top - 2);
      }
    }

    // --- Legend ---
    var legendY = h - 16;
    var legendX = pad.left;
    var legItems = [
      { color: colorPrincipal, label: 'Tilgung' },
      { color: colorInterest, label: 'Zinsen' }
    ];
    for (var li = 0; li < legItems.length; li++) {
      var lx = legendX + li * 120;
      ctx.fillStyle = legItems[li].color;
      ctx.fillRect(lx, legendY - 8, 12, 12);
      ctx.fillStyle = 'var(--text-secondary, #666)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(legItems[li].label, lx + 18, legendY - 2);
    }
  }

  // ── Main calculation and rendering ──
  var LOADING_MSGS = [
    'Berechne Tilgungsplan …',
    'Analysiere Zinsentwicklung …',
    'Prüfe Darlehensstruktur …',
    'Erstelle Zinsprognose …',
    'Optimiere Tilgungsstrategie …',
    'Berechne monatliche Rate …'
  ];

  function runQuick() {
    var output = getEl('tool-output');

    // Read inputs
    var loan = parseFloat(getEl('mc-loan').value) || 0;
    var annualRate = parseFloat(getEl('mc-rate').value.replace(',', '.')) || 0;
    var fixedYears = parseInt(getEl('mc-term').value, 10) || 10;
    var initialRepayPct = parseFloat(getEl('mc-repay').value) || 2;
    var extraStr = getEl('mc-extra').value.trim().replace(/\./g, '');
    var extraPayment = parseFloat(extraStr) || 0;

    // Validate
    if (loan < 1000) {
      output.innerHTML = '<p class="text-muted">❌ Bitte gib einen gültigen Darlehensbetrag ein.</p>';
      return;
    }
    if (annualRate <= 0 || annualRate > 30) {
      output.innerHTML = '<p class="text-muted">❌ Bitte gib einen gültigen Zinssatz ein (0–30 %).</p>';
      return;
    }

    // Capture inputs at click time
    var snapshot = {
      loan: loan,
      annualRate: annualRate,
      fixedYears: fixedYears,
      initialRepayPct: initialRepayPct,
      extraPayment: extraPayment
    };

    // Show loading
    var msg = LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)];
    output.innerHTML =
      '<div class="img-loading"><div class="wu-spinner"></div><span>' + msg + '</span></div>';

    // Artificial delay (1.5–2s)
    var delay = 1500 + Math.random() * 500;

    setTimeout(function() {
      // Calculate
      var result = calculateAmortization(
        snapshot.loan, snapshot.annualRate, snapshot.fixedYears,
        snapshot.initialRepayPct, snapshot.extraPayment
      );

      // Build output
    var html = '';

    // 1. Summary cards
    html += '<div class="mc-summary">';

    html += '<div class="mc-card mc-card-primary">';
    html += '<div class="mc-card-label">Monatliche Rate</div>';
    html += '<div class="mc-card-value">' + fmtEuro(result.monthlyPayment) + '</div>';
    html += '</div>';

    html += '<div class="mc-card">';
    html += '<div class="mc-card-label">Gesamtzahlung</div>';
    html += '<div class="mc-card-value">' + fmtEuro(result.totalPaid) + '</div>';
    html += '</div>';

    html += '<div class="mc-card">';
    html += '<div class="mc-card-label">Davon Zinsen</div>';
    html += '<div class="mc-card-value mc-value-red">' + fmtEuro(result.totalInterest) + '</div>';
    html += '</div>';

    html += '<div class="mc-card">';
    html += '<div class="mc-card-label">Davon Tilgung</div>';
    html += '<div class="mc-card-value mc-value-green">' + fmtEuro(result.totalPrincipal) + '</div>';
    html += '</div>';

    html += '</div>';

    // 2. Fixed period info + remaining balance
    html += '<div class="mc-highlight">';
    html += '<strong>Nach Ablauf der Zinsbindung (' + fixedYears + ' Jahre):</strong> ';
    html += 'Restschuld von <strong>' + fmtEuro(result.remainingAfterFixed) + '</strong>';
    if (result.remainingAfterFixed > 0 && result.yearsToPayoff !== null) {
      html += ' &middot; Voraussichtlich abbezahlt nach <strong>' + result.yearsToPayoff.toFixed(1) + ' Jahren</strong>';
    } else if (result.remainingAfterFixed <= 0) {
      html += ' &middot; ✅ Bereits vollständig getilgt';
    }
    html += '</div>';

    // 3. Chart
    if (result.schedule.length > 0) {
      html += '<div class="mc-chart-wrap">';
      html += '<h3 class="mc-section-title">Jährliche Entwicklung: Zinsen vs. Tilgung</h3>';
      html += '<canvas id="mc-chart"></canvas>';
      html += '<p class="text-muted mc-chart-note">Rote Balken = Zinsanteil, Grüne Balken = Tilgungsanteil. Gestrichelte Linie = Ende der Zinsbindung.</p>';
      html += '</div>';
    }

    // 4. Amortization table
    html += '<div class="mc-table-wrap">';
    html += '<h3 class="mc-section-title">Tilgungsplan (jährlich)</h3>';
    html += '<div class="mc-table-scroll">';
    html += '<table class="mc-table">';
    html += '<thead><tr>' +
      '<th>Jahr</th>' +
      '<th>Restschuld (Jahresbeginn)</th>' +
      '<th>Jahresrate</th>' +
      '<th>Zinsanteil</th>' +
      '<th>Tilgungsanteil</th>' +
      '<th>Restschuld (Jahresende)</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < result.schedule.length; i++) {
      var s = result.schedule[i];
      var rowClass = s.isFixed ? '' : ' mc-row-post-fixed';
      html += '<tr class="' + rowClass + '">' +
        '<td>' + s.year + '</td>' +
        '<td>' + fmtEuro(s.startBalance) + '</td>' +
        '<td>' + fmtEuro(s.payment) + '</td>' +
        '<td class="mc-cell-red">' + fmtEuro(s.interest) + '</td>' +
        '<td class="mc-cell-green">' + fmtEuro(s.principal) + '</td>' +
        '<td>' + fmtEuro(s.endBalance) + '</td>' +
        '</tr>';
    }

    html += '</tbody></table>';
    html += '</div></div>';

    // 5. Key insight
    var interestRatio = (result.totalInterest / result.totalPaid * 100);
    html += '<div class="mc-insight">';
    html += '<p>Von der Gesamtzahlung (' + fmtEuro(result.totalPaid) + ') entfallen <strong>' + interestRatio.toFixed(1) + '%</strong> auf Zinsen. ';
    if (interestRatio > 50) {
      html += 'Das ist relativ hoch – eine höhere anfängliche Tilgung oder Sondertilgungen könnten hier stark helfen.</p>';
    } else if (interestRatio > 30) {
      html += 'Ein typischer Wert für aktuelle Zinssätze. Mit Sondertilgungen lässt sich die Zinslast weiter senken.</p>';
    } else {
      html += 'Ein gutes Verhältnis – die Zinsbelastung bleibt überschaubar.</p>';
    }
    html += '</div>';

    // 6. Monatsrate pro 10.000 € Darlehen (Branchenvergleich)
    var ratePer10k = loan > 0 ? result.monthlyPayment / loan * 10000 : 0;
    html += '<div class="mc-highlight"><strong>Monatsrate pro 10.000 € Darlehen:</strong> ' + fmtEuro(ratePer10k) + '</div>';

    // 7. Szenario-Vergleich (Zinssatz ± 0,5 PP)
    var deltas = [-0.5, -0.25, 0, 0.25, 0.5];
    html += '<div class="mc-scenario">';
    html += '<h3 class="mc-section-title">Szenario-Vergleich (Zinssatz)</h3>';
    html += '<div class="mc-table-scroll"><table class="mc-table">';
    html += '<thead><tr><th>Szenario</th><th>Zinssatz</th><th>Monatsrate</th><th>Zinsen gesamt</th></tr></thead><tbody>';
    for (var di = 0; di < deltas.length; di++) {
      var sr = annualRate + deltas[di];
      var sres = calculateAmortization(loan, sr, fixedYears, initialRepayPct, extraPayment);
      var scLabel = (deltas[di] === 0) ? 'Ihr Zinssatz' : (deltas[di] > 0 ? '+' + deltas[di].toLocaleString('de-DE') + ' %-Punkte' : deltas[di].toLocaleString('de-DE') + ' %-Punkte');
      html += '<tr' + (deltas[di] === 0 ? ' class="mc-row-current"' : '') + '>' +
        '<td>' + scLabel + '</td><td>' + fmt(sr) + ' %</td>' +
        '<td>' + fmtEuro(sres.monthlyPayment) + '</td><td>' + fmtEuro(sres.totalInterest) + '</td></tr>';
    }
    html += '</tbody></table></div>';
    html += '<p class="text-muted mc-chart-note">Prozentpunkte um den gewählten Sollzins. Schon kleine Zinsdifferenzen verändern die Zinslast über die Laufzeit erheblich.</p>';
    html += '</div>';

    // 8. Sondertilgungs-Gesamtauswirkung
    if (extraPayment > 0) {
      var baseRes = calculateAmortization(loan, annualRate, fixedYears, initialRepayPct, 0);
      var savedInterest = baseRes.totalInterest - result.totalInterest;
      var savedYears = (baseRes.yearsToPayoff !== null && result.yearsToPayoff !== null)
        ? baseRes.yearsToPayoff - result.yearsToPayoff : 0;
      html += '<div class="mc-insight" style="border-color:var(--accent,#2E5F80)">' +
        '<p><strong>Sondertilgung von ' + fmtEuro(extraPayment) + ' pro Jahr:</strong> spart gegenüber einer Tilgung ohne Sondertilgung rund <strong>' + fmtEuro(savedInterest) + ' Zinsen</strong>' +
        (savedYears > 0 ? ' und verkürzt die Laufzeit um ca. <strong>' + savedYears.toFixed(1) + ' Jahre</strong>.' : '.') + '</p></div>';
    }

    // 9. CSV-Download (Tilgungsplan)
    html += '<div class="mc-table-wrap" style="margin-top:12px"><a id="mc-csv-btn" href="#" download="tilgungsplan.csv" style="font-size:.85em;color:var(--accent,#2E5F80);text-decoration:underline">Tilgungsplan als CSV herunterladen</a></div>';

    output.innerHTML = html;

    // Playbook integration: report this finished step (client-side only).
    if (result.monthlyPayment > 0 && window.playbook) window.playbook.report({
      tool: 'mortgage-calculator',
      summary: (window.__siteLang === 'en' ? 'Monthly mortgage rate: ' : 'Monatliche Hypothekenrate: ') +
        fmtEuro(result.monthlyPayment)
    });

    // Draw chart after DOM is updated
    setTimeout(function() {
      var canvas = getEl('mc-chart');
      if (canvas) drawChart(canvas, result.schedule, fixedYears);
      var csvBtn = getEl('mc-csv-btn');
      if (csvBtn && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
        var rows = [['Jahr', 'Restschuld Jahresbeginn', 'Jahresrate', 'Zinsanteil', 'Tilgungsanteil', 'Restschuld Jahresende']];
        for (var ci = 0; ci < result.schedule.length; ci++) {
          var cs = result.schedule[ci];
          rows.push([cs.year, fmt(cs.startBalance), fmt(cs.payment), fmt(cs.interest), fmt(cs.principal), fmt(cs.endBalance)]);
        }
        var csv = rows.map(function(r) { return r.join(';'); }).join('\n');
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        csvBtn.setAttribute('href', URL.createObjectURL(blob));
      }
    }, 50);
  }, delay);
  }

  // ══════════════════════════════════════════════════
  // PRO-MODUS: Hausfinanzierung (Finanzierungsaufbau)
  // Annuitätskern (calculateAmortization) bleibt unverändert.
  // Modell: N = K·q/100 · Total = K + N + M · EK_net = EK − Liquidität
  //   Nebenkosten NICHT mitfinanziert → EK muss N vorab decken
  //   Nebenkosten mitfinanziert     → D = Total − EK_net
  // ══════════════════════════════════════════════════

  function runPro() {
    var output = getEl('tool-output');

    // ── Finanzierungsaufbau ──
    var K = parseFloat(getEl('hf-price').value) || 0;                    // Kaufpreis
    var q = parseFloat(String(getEl('hf-sidecost').value).replace(',', '.')) || 0; // NK-Quote %
    var M = parseFloat(getEl('hf-modern').value) || 0;                   // Modernisierung
    var EK = parseFloat(getEl('hf-equity').value) || 0;                  // Eigenkapital
    var Liquid = parseFloat(getEl('hf-reserve').value) || 0;             // Behaltene Liquidität
    var sideEl = getEl('hf-finance-sidecost');
    var financeSide = sideEl ? sideEl.checked : false;

    // ── Darlehen & Konditionen ──
    var i = parseFloat(String(getEl('hf-rate').value).replace(',', '.')) || 0;
    var t = parseFloat(String(getEl('hf-repay').value).replace(',', '.')) || 0;
    var F = parseInt(getEl('hf-term').value, 10) || 10;
    var extraStr = getEl('hf-extra').value.trim().replace(/\./g, '');
    var extra = parseFloat(String(extraStr).replace(',', '.')) || 0;
    var folge = parseFloat(String(getEl('hf-folge').value).replace(',', '.')) || 0;

    // ── Einkommen & laufende Kosten ──
    var income = parseFloat(getEl('hf-income').value) || 0;
    var running = parseFloat(getEl('hf-running').value) || 0;

    // Validation
    if (K < 1000) {
      output.innerHTML = '<p class="text-muted">❌ Bitte gib einen gültigen Kaufpreis ein.</p>';
      return;
    }
    if (i <= 0 || i > 30) {
      output.innerHTML = '<p class="text-muted">❌ Bitte gib einen gültigen Sollzins ein (0–30 %).</p>';
      return;
    }

    var N = K * q / 100;                                    // Kaufnebenkosten
    var Total = K + N + M;                                  // Gesamtbedarf
    var EK_net = Math.max(0, EK - Liquid);                  // einsetzbares Eigenkapital
    var D = 0;
    var warn = null;

    if (financeSide) {
      D = Total - EK_net;                                   // Nebenkosten werden mitfinanziert
    } else {
      var EK_purchase = EK_net - N;                         // NK zuerst aus EK zahlen
      if (EK_purchase < 0) {
        warn = 'Dein verfügbares Eigenkapital (nach zurückbehaltener Liquidität) deckt die Kaufnebenkosten von ' +
          fmtEuro(N) + ' nicht vollständig. In der Berechnung wird die Lücke mitfinanziert.';
        EK_purchase = 0;
      }
      D = (K + M) - EK_purchase;
    }
    if (D < 0) D = 0;
    D = Math.round(D);

    var snap = { D: D, i: i, t: t, F: F, extra: extra, folge: folge, income: income, running: running };

    var msg = LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)];
    output.innerHTML = '<div class="img-loading"><div class="wu-spinner"></div><span>' + msg + '</span></div>';
    var delay = 1500 + Math.random() * 500;

    setTimeout(function() {
      if (D <= 0) {
        output.innerHTML =
          '<div class="mc-highlight">✅ Dein Eigenkapital deckt den kompletten Finanzierungsbedarf (' +
          fmtEuro(Total) + '). Es ist kein Darlehen nötig.</div>' +
          '<p class="text-muted">Finanzierungsaufbau: Kaufpreis ' + fmtEuro(K) + ' · Nebenkosten ' +
          fmtEuro(N) + ' · Modernisierung ' + fmtEuro(M) + ' · Eigenkapital ' + fmtEuro(EK_net) + '.</p>';
        return;
      }

      var result = calculateAmortization(snap.D, snap.i, snap.F, snap.t, snap.extra);
      var Rm = result.monthlyPayment;
      var rest = result.remainingAfterFixed;
      var ansch = (rest > 0) ? rest * ((snap.folge + snap.t) / 100 / 12) : 0;
      var wq = snap.income > 0 ? (Rm + snap.running) / snap.income : 99;
      var reserve = snap.income - Rm - snap.running;
      var ein = classify(wq, reserve);
      var art = classifyArt(snap.D, K);

      // ── Build output ──
      var html = '';

      // 1. Finanzierungsaufbau
      html += '<h3 class="mc-section-title hf-section-title">Finanzierungsaufbau</h3>';
      html += '<ul class="hf-build-list">' +
        '<li>Kaufpreis: <strong>' + fmtEuro(K) + '</strong></li>' +
        '<li>Kaufnebenkosten (' + fmtDec(q) + ' %): <strong>' + fmtEuro(N) + '</strong></li>' +
        '<li>Modernisierung &amp; Reserve: <strong>' + fmtEuro(M) + '</strong></li>' +
        '<li>Eingesetztes Eigenkapital (nach Reserve): <strong>' + fmtEuro(EK_net) + '</strong></li>' +
        '<li class="hf-build-total">Gesamtbedarf: <strong>' + fmtEuro(Total) + '</strong></li>' +
        '<li class="hf-build-loan">Darlehen: <strong>' + fmtEuro(snap.D) + '</strong></li>' +
        '</ul>';

      // 2. Kennzahlen-Karten
      html += '<div class="mc-summary">';
      html += card('Monatliche Rate', fmtEuro(Rm), true);
      html += card('Darlehen', fmtEuro(snap.D), false);
      html += card('Restschuld (Zinsbindung)', fmtEuro(rest), false);
      html += card('Anschlussrate', fmtEuro(ansch), false);
      html += card('Budgetreserve / Monat', fmtEuro(reserve), false, reserve < 0 ? ' mc-value-red' : (reserve > 0 ? ' mc-value-green' : ''));
      html += card('Gesamtbedarf', fmtEuro(Total), false);
      html += '</div>';

      // 3. Quoten-Zeile
      html += '<div class="hf-quota">';
      html += quota('EK-Quote', fmtPct(EK_net / Total));
      html += quota('Beleihung Kaufpreis', fmtPct(snap.D / K));
      html += quota('Restschuldquote', fmtPct(rest / K));
      html += quota('Wohnkostenquote', fmtPct(wq));
      html += quota('Getilgt nach', result.yearsToPayoff !== null ? 'Jahr ' + Math.ceil(result.yearsToPayoff) : 'über 40 J.');
      html += quota('Sondertilgung', snap.extra > 0 ? 'ja' : 'keine');
      html += quota('Freier Cashflow / Jahr', fmtEuro(reserve * 12));
      html += '</div>';

      // 4. Einordnung + Finanzierungsart
      html += '<div class="hf-badges">' +
        '<span class="hf-badge hf-badge-' + ein.key + '">Einordnung: ' + ein.label + '</span>' +
        '<span class="hf-badge hf-badge-art-' + art.key + '">Finanzierungsart: ' + art.label + '</span>' +
        '</div>';

      // 5. Chart
      if (result.schedule.length > 0) {
        html += '<div class="mc-chart-wrap">' +
          '<h3 class="mc-section-title">Jährliche Entwicklung: Zinsen vs. Tilgung</h3>' +
          '<canvas id="mc-chart"></canvas>' +
          '<p class="text-muted mc-chart-note">Rote Balken = Zinsanteil, Grüne Balken = Tilgungsanteil. Gestrichelte Linie = Ende der Zinsbindung.</p>' +
          '</div>';
      }

      // 6. Tilgungsplan
      html += scheduleTable(result);

      // 7. Anschlussbetrachtung
      html += '<div class="mc-highlight">' +
        '<strong>Nach Ablauf der Zinsbindung (' + snap.F + ' Jahre):</strong> Restschuld von <strong>' +
        fmtEuro(rest) + '</strong>' +
        (rest > 0
          ? '. Bei einem Anschlusszins von <strong>' + fmtDec(snap.folge) + ' %</strong> läge die neue Monatsrate bei <strong>' +
            fmtEuro(ansch) + '</strong> (bei gleicher anfänglicher Tilgung).'
          : ' &middot; ✅ Bereits vollständig getilgt') +
        (snap.extra > 0 ? ' Sondertilgung von ' + fmtEuro(snap.extra) + ' pro Jahr ist eingerechnet.' : '') +
        '</div>';

      // 8. Warnung + Disclaimer
      if (warn) {
        html += '<div class="hf-warn">⚠️ ' + warn + '</div>';
      }
      html += '<p class="text-muted hf-disclaimer">Bankangebote können abweichen (Bereitstellungszins, Auszahlungstermin, Objekt, Bonität). Alle Berechnungen laufen lokal im Browser.</p>';

      output.innerHTML = html;

      // Playbook integration: report this finished step (client-side only).
      if (Rm > 0 && window.playbook) window.playbook.report({
        tool: 'mortgage-calculator',
        summary: (window.__siteLang === 'en' ? 'Monthly mortgage rate: ' : 'Monatliche Hypothekenrate: ') +
          fmtEuro(Rm)
      });

      setTimeout(function() {
        var canvas = getEl('mc-chart');
        if (canvas) drawChart(canvas, result.schedule, snap.F);
      }, 50);
    }, delay);
  }

  // ── Pro-Helpers ──
  function card(label, value, primary, extraClass) {
    return '<div class="mc-card' + (primary ? ' mc-card-primary' : '') + '">' +
      '<div class="mc-card-label">' + label + '</div>' +
      '<div class="mc-card-value' + (extraClass || '') + '">' + value + '</div></div>';
  }
  function quota(label, value) {
    return '<div class="hf-quota-item"><div class="hf-quota-label">' + label + '</div>' +
      '<div class="hf-quota-value">' + value + '</div></div>';
  }
  function scheduleTable(result) {
    var html = '<div class="mc-table-wrap">' +
      '<h3 class="mc-section-title">Tilgungsplan (jährlich)</h3><div class="mc-table-scroll"><table class="mc-table">' +
      '<thead><tr><th>Jahr</th><th>Restschuld (Jahresbeginn)</th><th>Jahresrate</th><th>Zinsanteil</th>' +
      '<th>Tilgungsanteil</th><th>Restschuld (Jahresende)</th></tr></thead><tbody>';
    for (var i = 0; i < result.schedule.length; i++) {
      var s = result.schedule[i];
      var rowClass = s.isFixed ? '' : ' mc-row-post-fixed';
      html += '<tr class="' + rowClass + '"><td>' + s.year + '</td>' +
        '<td>' + fmtEuro(s.startBalance) + '</td><td>' + fmtEuro(s.payment) + '</td>' +
        '<td class="mc-cell-red">' + fmtEuro(s.interest) + '</td>' +
        '<td class="mc-cell-green">' + fmtEuro(s.principal) + '</td>' +
        '<td>' + fmtEuro(s.endBalance) + '</td></tr>';
    }
    return html + '</tbody></table></div></div>';
  }
  var WQ_CRIT = 0.40, WQ_TIGHT = 0.30, WQ_NORMAL = 0.20;
  function classify(wq, reserve) {
    if (wq > WQ_CRIT || reserve < 0) return { key: 'kritisch', label: 'kritisch' };
    if (wq >= WQ_TIGHT) return { key: 'angespannt', label: 'angespannt' };
    if (wq >= WQ_NORMAL) return { key: 'normal', label: 'normal' };
    return { key: 'komfortabel', label: 'komfortabel' };
  }
  function classifyArt(D, K) {
    var b = K > 0 ? D / K : 1;
    if (b > 0.90) return { key: 'hoch', label: 'hoch' };
    if (b >= 0.80) return { key: 'mittel', label: 'mittel' };
    return { key: 'niedrig', label: 'niedrig' };
  }
  function fmtPct(x) { return (x * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' %'; }
  function fmtDec(x) { return x.toLocaleString('de-DE', { maximumFractionDigits: 2 }); }

  // ── Mode-Dispatcher ──
  function run() {
    var modeEl = getEl('mc-mode');
    var mode = modeEl ? modeEl.value : 'quick';
    if (mode === 'pro') { runPro(); } else { runQuick(); }
  }

  function wrapInto(id, wrapper) {
    var el = getEl(id);
    if (!el) return;
    var parent = (el.classList && el.classList.contains('checkbox-label')) ? el : (el.closest ? el.closest('.input-group') : null) || el.parentNode;
    if (parent && wrapper) wrapper.appendChild(parent);
  }

  function heading(text) {
    var h = document.createElement('h3');
    h.className = 'mc-section-title hf-section-title';
    h.textContent = text;
    return h;
  }

  function insertHeadingBefore(proWrap, firstId, text) {
    var el = getEl(firstId);
    if (!el) return;
    var parent = (el.classList && el.classList.contains('checkbox-label')) ? el : (el.closest ? el.closest('.input-group') : null) || el.parentNode;
    if (parent && proWrap) proWrap.insertBefore(heading(text), parent);
  }

  function setup() {
    var inputs = getEl('tool-inputs');
    var output = getEl('tool-output');
    if (!inputs || !output) return;

    var modeEl = getEl('mc-mode');

    // ── Split quick vs. pro field groups into two blocks ──
    var quickBlock = document.createElement('div');
    quickBlock.id = 'mc-quick-block';
    var proBlock = document.createElement('div');
    proBlock.id = 'hf-pro-block';

    var quickIds = ['mc-loan', 'mc-rate', 'mc-term', 'mc-repay', 'mc-extra'];
    var proIds = ['hf-price', 'hf-sidecost', 'hf-modern', 'hf-equity', 'hf-reserve',
      'hf-finance-sidecost', 'hf-rate', 'hf-repay', 'hf-term', 'hf-extra', 'hf-folge',
      'hf-income', 'hf-running'];

    quickIds.forEach(function(id) { wrapInto(id, quickBlock); });
    proIds.forEach(function(id) { wrapInto(id, proBlock); });

    // Ensure the mode select stays at the very top
    if (modeEl && modeEl.closest) {
      var mg = modeEl.closest('.input-group');
      if (mg && mg.parentNode === inputs) inputs.insertBefore(mg, inputs.firstChild);
    }

    // Section headings inside the pro block
    insertHeadingBefore(proBlock, 'hf-price', 'Finanzierungsaufbau');
    insertHeadingBefore(proBlock, 'hf-rate', 'Darlehen &amp; Konditionen');
    insertHeadingBefore(proBlock, 'hf-income', 'Einkommen &amp; laufende Kosten');

    inputs.appendChild(quickBlock);
    inputs.appendChild(proBlock);

    // ── Mode toggle (quick default, pro opt-in) ──
    function applyMode(mode) {
      quickBlock.style.display = (mode === 'quick') ? '' : 'none';
      proBlock.style.display = (mode === 'pro') ? '' : 'none';
      output.innerHTML = '<p class="text-muted">Stelle deine Parameter ein und klicke auf "Berechnen".</p>';
    }
    if (modeEl) modeEl.addEventListener('change', function() { applyMode(modeEl.value); });
    applyMode(modeEl ? modeEl.value : 'quick');

    // ── Berechnen button ──
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'mc-run-btn';
    btn.className = 'btn btn-primary btn-generate';
    btn.textContent = 'Berechnen';
    inputs.appendChild(btn);
    btn.addEventListener('click', function() {
      run();
    });

    // Enter key on text inputs triggers calculation
    inputs.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var target = e.target;
        if (target && (target.id === 'mc-rate' || target.id === 'mc-extra' ||
            target.id === 'hf-rate' || target.id === 'hf-extra' || target.id === 'hf-folge')) {
          e.preventDefault();
          btn.click();
        }
      }
    });

    // Set placeholder text
    output.innerHTML = '<p class="text-muted">Stelle deine Parameter ein und klicke auf "Berechnen".</p>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { calculateAmortization: calculateAmortization, fmt: fmt, fmtEuro: fmtEuro, fmtInt: fmtInt };
})();
