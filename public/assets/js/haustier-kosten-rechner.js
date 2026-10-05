/* ══════════════════════════════════════════════════
   haustier-kosten-rechner.js — Kosten Hund/Katze nach Größe
   100 % client-seitig. Konstanten mit Stand (09/2026).
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function fmt(n) { return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }); }
  var DE = (typeof window.__siteLang === 'undefined') || window.__siteLang === 'de';

  /* ── Konstanten (Stand: 09/2026) ──────────────────────────
     Tierarzt-Kosten: aktuelle GOT (Gebührenordnung für Tierärzte),
     Grundfassung 2022, in Kraft seit 22.11.2022, zuletzt geändert 03/2023
     (bundestieraerztekammer.de). Die Werte sind typische Praxis-Rechnungen
     inkl. Narkose/Medikamente, keine reine Gebühren-Satzzahl.
     Futter/Versicherung: hund.info, pfoten-ratgeber, Allianz (12/2025),
     TASSO, Santévet. Alle sind typische Spannen, keine Garantiepreise.
     Midpoint-Werte als Default, editierbar. */
  var K = {
    chip: 40,                     // Chip 30–50 €, TASSO-Registrierung kostenlos
    vaccDogYear: 75,              // jährliche Impfung Hund 50–100 €
    vaccCatInit: 200,             // Grundimmunisierung Katze 160–240 €
    vaccCatYear: 45,              // jährliche Auffrischung Katze 40–50 €
    neuterDog: 180,               // Kastration Rüde 99–297 € (GOT 2022)
    neuterCatFemale: 180,         // Kätzin 120–250 €
    neuterCatMale: 90,            // Kater 60–120 €
    steuerDog: 100,               // Hundesteuer (einfacher Hund, Ø Gemeinde 40–250 €/Jahr, Stand 09/2026)
    lifeDog: 12,                  // typ. 10–13 Jahre
    lifeCat: 15                   // typ. 13–16 Jahre
  };
  // Einmalige Erstausstattung (€) nach Größe, Mittelwert
  var STATT_HUND = { klein: 350, mittel: 500, gross: 650 }; // 250–450 / 350–650 / 450–800
  var STATT_KATZE = 250;          // 100–400 €
  // Anschaffung (€) nach Quelle
  var ANSCH_HUND = { tierheim: 350, zuechter: 1500 };  // 250–450 / 1200–2000
  var ANSCH_KATZE = { tierheim: 150, zuechter: 1600 }; // 50–250 / 800–2500
  // Futter/Monat (€) nach Größe: Mittelklasse (Mittelwert der Spanne)
  var FODOG = { klein: 30, mittel: 48, gross: 70 };    // 20–40 / 35–60 / 50–90
  var FOCAT = 30;                 // 20–40 €/Monat
  // Versicherung (€/Monat) — Voll-/OP-Schutz realistisch (Stand 09/2026)
  var VER_HUND = { none: 0, op: 25, voll: 60 };        // OP 15–40, Voll 40–120
  var VER_KATZE = { none: 0, op: 15, voll: 35 };       // OP 4–25, Voll 17–50
  // Sonstige laufende (€/Monat): Spielzeug/Leckerli + Pflege + Parasitenschutz-Anteil
  var SONST_HUND = { klein: 20, mittel: 30, gross: 40 }; // 10–30 + 10–20 Zubehör
  var SONST_KATZE = 20;           // Spielzeug/Kratzbaum-Anteil 5–15 + Streu-Anteil

  function grKey(v) { return v === 'gross' ? 'gross' : (v === 'mittel' ? 'mittel' : 'klein'); }

  /* Reiner Rechenkern (ohne DOM) — auch für Node-Tests exportiert. */
  function compute(art, groesse, ansch, ver, futterRaw, sonstRaw, steuerRaw) {
    art = (art === 'katze') ? 'katze' : 'hund';
    var g = grKey(groesse);
    var anschCost = art === 'hund' ? ANSCH_HUND[ansch] : ANSCH_KATZE[ansch];
    var statt = art === 'hund' ? STATT_HUND[g] : STATT_KATZE;
    var vaccInit = art === 'hund' ? (ansch === 'tierheim' ? 0 : 100) : (ansch === 'tierheim' ? 0 : K.vaccCatInit);
    var neuter = art === 'hund' ? K.neuterDog : K.neuterCatFemale;
    var once = anschCost + statt + K.chip + vaccInit + neuter;

    var futterM = num(futterRaw) > 0 ? num(futterRaw) : (art === 'hund' ? FODOG[g] : FOCAT);
    var verM = art === 'hund' ? (VER_HUND[ver] == null ? 0 : VER_HUND[ver]) : (VER_KATZE[ver] == null ? 0 : VER_KATZE[ver]);
    var sonstM = num(sonstRaw) > 0 ? num(sonstRaw) : (art === 'hund' ? SONST_HUND[g] : SONST_KATZE);
    var monthly = futterM + verM + sonstM;

    var vaccYear = art === 'hund' ? K.vaccDogYear : K.vaccCatYear;
    // Hundesteuer: nur beim Hund, flat Richtwert; leer = Default, "0" = tatsächlich 0
    var steuer = 0;
    if (art === 'hund') {
      var s = String(steuerRaw == null ? '' : steuerRaw).trim();
      steuer = (s === '') ? K.steuerDog : num(s);
      if (steuer < 0) steuer = 0;
    }
    var yearly = monthly * 12 + vaccYear + steuer;

    var life = art === 'hund' ? K.lifeDog : K.lifeCat;
    var lifetime = once + yearly * life;

    return {
      art: art, groesse: g, ansch: ansch, ver: ver,
      once: once, monthly: monthly, yearly: yearly, lifetime: lifetime,
      vaccYear: vaccYear, steuer: steuer, life: life,
      futterM: futterM, verM: verM, sonstM: sonstM
    };
  }

  function run() {
    var out = E('tool-output');
    if (!out) return;
    var art = E('ht-art') ? E('ht-art').value : 'hund';
    var sxText = (art === 'katze') ? 'Katze' : 'Hund';
    var groesse = E('ht-groesse') ? E('ht-groesse').value : 'mittel';
    var ansch = E('ht-anschaffung') ? E('ht-anschaffung').value : 'tierheim';
    var ver = E('ht-versicherung') ? E('ht-versicherung').value : 'keine';
    var r = compute(art, groesse, ansch, ver,
      E('ht-futter') ? E('ht-futter').value : '',
      E('ht-sonst') ? E('ht-sonst').value : '',
      E('ht-steuer') ? E('ht-steuer').value : '');

    var html = '<div class="result-display" style="display:block">';
    html += '<div class="calcresult-title">' + sxText + ' (' + groesseLabel(r.groesse, DE) + ')</div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Einmalige Anschaffung & Ausstattung' : 'One-time purchase & setup') + '</span><strong>' + fmt(r.once) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Laufende Kosten pro Monat' : 'Recurring costs per month') + '</span><strong>' + fmt(r.monthly) + ' €</strong></div>';
    html += '<div class="calc-result-row"><span>' + (DE ? 'Laufende Kosten pro Jahr' : 'Recurring costs per year') + '</span><strong>' + fmt(r.yearly) + ' €</strong></div>';
    if (r.art === 'hund' && r.steuer > 0) {
      html += '<div class="calc-result-row"><span>' + (DE ? 'davon Hundesteuer (Richtwert)' : 'incl. dog tax (estimate)') + '</span><strong>' + fmt(r.steuer) + ' €</strong></div>';
    }
    html += '<div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:8px"><span>' + (DE ? 'Gesamt über die Lebensdauer (~' + r.life + ' Jahre)' : 'Total over lifetime (~' + r.life + ' years)') + '</span><strong>' + fmt(r.lifetime) + ' €</strong></div>';
    html += '<p style="margin-top:10px;font-size:0.85rem;color:var(--text-muted)">' + (DE ? 'Richtwerte (Stand: 09/2026) nach Größe, keine echte Offerte. Tierarztkosten nach GOT 2022, Futter, Einrichtung und Versicherung können stark abweichen.' : 'Reference values (as of 09/2026) by size, not a real quote. Vet costs follow the GOT 2022 schedule; food, setup and insurance can vary significantly.') + '</p>';
    html += '</div>';
    out.innerHTML = html;
  }

  function groesseLabel(v, de) {
    if (de) { return v === 'gross' ? 'groß' : (v === 'mittel' ? 'mittel' : 'klein'); }
    return v === 'gross' ? 'large' : (v === 'mittel' ? 'medium' : 'small');
  }

  function syncDefaults() {
    var art = E('ht-art') ? E('ht-art').value : 'hund';
    var g = grKey(E('ht-groesse') ? E('ht-groesse').value : 'mittel');
    if (E('ht-futter')) E('ht-futter').value = String((art === 'hund' ? FODOG[g] : FOCAT)).replace('.', ',');
    if (E('ht-sonst')) E('ht-sonst').value = String(art === 'hund' ? SONST_HUND[g] : SONST_KATZE).replace('.', ',');
    // Hundesteuer-Feld nur beim Hund zeigen
    var steuerField = E('ht-steuer');
    if (steuerField && steuerField.closest) {
      var wrap = steuerField.closest('.input-group');
      if (wrap) wrap.style.display = (art === 'katze') ? 'none' : '';
    }
  }

  function setup() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    var bind = function(id) { var el = E(id); if (el) el.addEventListener('change', syncDefaults); };
    bind('ht-art'); bind('ht-groesse');
    syncDefaults();
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Kosten berechnen' : 'Calculate costs';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    var out = E('tool-output');
    if (out) out.innerHTML = '<p class="text-muted">' + (DE ? 'Wähle Tierart und Größe. Die Standardwerte sind Richtwerte (Stand: 09/2026) und lassen sich anpassen. Beim Hund ist auch die Hundesteuer enthalten.' : 'Choose pet type and size. The defaults are reference values (as of 09/2026) and can be adjusted. For dogs, the dog tax is included.') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { run: run, compute: compute, K: K, FODOG: FODOG, VER_HUND: VER_HUND, VER_KATZE: VER_KATZE };
  }
})();
