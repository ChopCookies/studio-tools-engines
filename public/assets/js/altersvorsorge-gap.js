/* ══════════════════════════════════════════════════
   altersvorsorge-gap.js | Altersvorsorge-Lücke (transparenter Schätzer)
   Review 07.09.2026: + Inflations-Eingabe berücksichtigt Kaufkraftverlust.
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';
  var DE = (window.__siteLang !== 'en');
  function E(id){ return document.getElementById(id); }
  function num(v){ var n=parseFloat(String(v).replace(',','.')); return isFinite(n)?n:0; }
  function c(x){ return x.toLocaleString('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}); }

  // Pure, testable calculation. Returns a result object; no DOM access.
  function compute(p) {
    var ziel = p.ziel, rente = p.rente, andere = p.andere;
    var jahre = p.jahre, ret = p.ret, dauer = p.dauer, infl = p.infl || 0;
    var gap = ziel - rente - andere;
    if (gap < 0) gap = 0;
    var kapital = gap * 12 * (dauer || 20);
    var rM = (ret / 100) / 12;
    var n = jahre * 12;
    var spar = (rM > 0) ? (kapital * rM) / (Math.pow(1 + rM, n) - 1) : kapital / n;
    var res = {
      valid: !!(ziel && jahre),
      gap: gap,
      kapital: kapital,
      spar: spar,
      infl: infl
    };
    // Kapitalbedarf nach der 4-%-Entnahme-Regel (Richtwert), alternative Sicht.
    res.kapital4 = gap * 12 / 0.04;
    // Reale (inflationsbereinigte) Sparrate: Realzins ((1+r)/(1+i)-1) auf Monatsbasis.
    if (infl > 0 && ret > 0) {
      var rRealAnnual = ((1 + ret / 100) / (1 + infl / 100) - 1); // dezimal
      var rRealM = rRealAnnual / 12;
      res.sparReal = (rRealM > 0) ? (kapital * rRealM) / (Math.pow(1 + rRealM, n) - 1) : kapital / n;
      res.rRealAnnualPct = rRealAnnual * 100;
    }
    // Kaufkraftverlust: heutiges Ziel und Kapitalbedarf in Euro zum Rentenbeginn
    // (gleiche Kaufkraft, bei angenommener Inflation).
    if (infl > 0) {
      var f = Math.pow(1 + infl / 100, jahre);
      res.inflZiel = ziel * f;
      res.inflKapital = kapital * f;
    }
    return res;
  }

  function calc() {
    var r = compute({
      ziel: num(E('av-ziel').value),
      rente: num(E('av-rente').value),
      andere: num(E('av-andere').value),
      jahre: num(E('av-jahre').value),
      ret: num(E('av-ret').value),
      dauer: num(E('av-dauer').value),
      infl: num(E('av-infl').value)
    });
    var out = E('tool-output');
    if (!r.valid) {
      out.innerHTML = '<p class="text-muted">' + (DE ? 'Bitte mindestens Zielbetrag und Jahre bis zur Rente angeben.' : 'Enter at least a target amount and years to retirement.') + '</p>';
      return;
    }

    var html =
      '<div class="result-box">' +
        '<div class="result-row"><span>'+ (DE?'Monatliche Lücke':'Monthly gap') +'</span><b>' + c(r.gap) + '</b></div>' +
        '<div class="result-row"><span>'+ (DE?'Nötiges Kapital (Richtwert)':'Required capital (guide)') +'</span><b>'+ c(r.kapital) +'</b></div>' +
        '<div class="result-row"><span>'+ (DE?'Nötige Sparrate pro Monat':'Required monthly savings') +'</span><b>'+ c(r.spar) +'</b></div>' +
        (r.sparReal !== null && r.sparReal !== undefined ?
          '<div class="result-row"><span>'+ (DE?'Sparrate real (nach '+r.infl+' % Inflation)':'Real savings rate (after '+r.infl+' % inflation)') +'</span><b>'+ c(r.sparReal) +'</b></div>'
        : '') +
        '<div class="result-row"><span>'+ (DE?'Kapitalbedarf nach 4-%-Regel (Richtwert)':'Capital need, 4 % rule (guide)') +'</span><b>'+ c(r.kapital4) +'</b></div>' +
        (r.infl > 0 ?
          '<div class="result-row"><span>'+ (DE?'Ziel bei Rentenbeginn (mit '+r.infl+' % Inflation)':'Target at retirement (at '+r.infl+' % inflation)') +'</span><b>'+ c(r.inflZiel) +'</b></div>' +
          '<div class="result-row"><span>'+ (DE?'Kapitalbedarf bei Rentenbeginn (mit Inflation)':'Capital need at retirement (with inflation)') +'</span><b>'+ c(r.inflKapital) +'</b></div>'
        : '') +
      '</div>' +
      (r.infl > 0 ? '<p class="text-muted" style="font-size:.85em;margin-top:8px">'+ (DE ? 'Die beiden unteren Werte rechnen dein heutiges Ziel und den Kapitalbedarf in Euro zum Rentenbeginn um, damit sie die Kaufkraft von heute erhalten. Der Betrag, den du dann wirklich brauchst, hängt von der künftigen Inflation ab.' : 'The two lower values convert your current target and capital need into euros at retirement to keep today\'s purchasing power. What you actually need then depends on future inflation.') +'</p>' : '') +
      '<p class="text-muted" style="font-size:.85em;margin-top:10px">'+ (DE ? 'Anhaltspunkt ohne Garantie. Der tatsächliche Bedarf hängt von Inflation, Zinsentwicklung, Steuern und persönlicher Lebenserwartung ab. Keine Anlageberatung.' : 'Guide value without guarantee. The real need depends on inflation, interest rates, taxes and life expectancy. Not investment advice.') +'</p>';

    // Playbook integration: report this finished step (client-side only).
    if (r.gap >= 0 && window.playbook) window.playbook.report({
      tool: 'altersvorsorge-gap',
      summary: (DE ? 'Monatliche Versorgungslücke: ' : 'Monthly retirement gap: ') + c(r.gap)
    });

    out.innerHTML = html;
  }

  function buildUI() {
    var ti = E('tool-inputs');
    if (!ti) return;
    // Playbook integration: prefill the expected monthly pension from the
    // previous step's handoff value, before any computation.
    if (window.playbook && typeof window.playbook.getPrefill === 'function') {
      var pf = window.playbook.getPrefill();
      if (pf && E('av-rente')) document.getElementById('av-rente').value = pf;
    }
    var btn = document.createElement('button');
    btn.type='button'; btn.className='btn btn-primary btn-generate';
    btn.textContent = DE ? 'Berechnen' : 'Calculate';
    ti.appendChild(btn);
    btn.addEventListener('click', calc);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();
  if (typeof module !== 'undefined' && module.exports) module.exports = { num: num, compute: compute, calc: calc };
})();
