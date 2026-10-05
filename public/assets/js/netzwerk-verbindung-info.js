/* ══════════════════════════════════════════════════
   netzwerk-verbindung-info.js: Netzwerk-Verbindungs-Info
   Liest navigator.connection (Network Information API) und
   zeigt Verbindungstyp, effektive Stufe, Downlink, Downlink-
   Maximum, Round-Trip-Zeit und Datensparmodus.
   Reine Anzeige, 100% lokal im Browser, kein Netzwerkzugriff.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var NICHT = 'nicht verfügbar';

  var TYPEN = {
    bluetooth: 'Bluetooth',
    cellular: 'Mobilfunk',
    ethernet: 'Ethernet (Kabel)',
    none: 'keine Verbindung',
    wifi: 'WLAN',
    wimax: 'WiMAX',
    other: 'sonstiger Verbindungstyp',
    unknown: 'unbekannter Verbindungstyp'
  };

  var STUFEN = {
    'slow-2g': 'slow-2g (sehr langsam, ca. 50 kbit/s oder weniger)',
    '2g': '2g (langsam, ca. 50 bis 200 kbit/s)',
    '3g': '3g (mittel, ca. 200 kbit/s bis 1,5 Mbit/s)',
    '4g': '4g (schnell, etwa 1,5 Mbit/s und mehr)'
  };

  /* -------- pure engine (node-testbar) -------- */

  /**
   * Wandelt einen Zahlenwert in eine deutsche Dezimaldarstellung.
   * Falscher Typ oder NaN liefert null.
   */
  function deZahl(n) {
    if (typeof n !== 'number' || isNaN(n)) return null;
    if (n.toLocaleString) return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
    return String(n);
  }

  /**
   * Text für ein optionales Zahlenfeld mit Einheit.
   * conn, key, unit -> "10 Mbit/s" oder null, wenn das Feld fehlt.
   */
  function zahlMitEinheit(conn, key, unit) {
    if (!conn) return null;
    var v = deZahl(conn[key]);
    if (v === null) return null;
    return v + ' ' + unit;
  }

  /**
   * Text für ein optionales Boolean-Feld.
   * true -> "ja", false -> "nein", alles andere -> null.
   */
  function jaNein(conn, key) {
    if (!conn) return null;
    if (conn[key] === true) return 'ja';
    if (conn[key] === false) return 'nein';
    return null;
  }

  /**
   * Baut das Anzeige-Modell.
   * conn: connection-artiges Objekt oder null/undefined.
   * hasConnectionAPI: true, wenn navigator.connection beim Start existiert.
   * Rückgabe: {rows:[[label,wert]...], fallback:bool, explanation:string}
   */
  function engine(conn, hasConnectionAPI) {
    var vorhanden = !!hasConnectionAPI && !!conn;
    var typ = vorhanden && conn.type ? String(conn.type).toLowerCase() : '';
    var stufe = vorhanden && conn.effectiveType ? String(conn.effectiveType).toLowerCase() : '';

    var rows = [
      ['Verbindungstyp', vorhanden ? (TYPEN[typ] || (typ ? typ : NICHT)) : NICHT],
      ['Effektive Verbindungsstufe', vorhanden ? (STUFEN[stufe] || (stufe ? stufe : NICHT)) : NICHT],
      ['Downlink (Schätzung)', vorhanden ? (zahlMitEinheit(conn, 'downlink', 'Mbit/s') || NICHT) : NICHT],
      ['Downlink, theoretisches Maximum', vorhanden ? (zahlMitEinheit(conn, 'downlinkMax', 'Mbit/s') || NICHT) : NICHT],
      ['Round-Trip-Zeit (RTT)', vorhanden ? (zahlMitEinheit(conn, 'rtt', 'ms') || NICHT) : NICHT],
      ['Datensparmodus', vorhanden ? (jaNein(conn, 'saveData') || NICHT) : NICHT]
    ];

    var privacy = 'Browsers geben aus Datenschutzgründen keine WLAN-Kennung (SSID), keine Signalstärke (RSSI) und '
      + 'keine Liste sichtbarer Funkzellen an. Eine Netzwerksuche aus dem Browser heraus ist deshalb technisch '
      + 'nicht möglich, und wir erfinden keine Werte.';
    var explanation;

    if (vorhanden) {
      explanation = 'Diese Werte liest der Browser selbst über die Network Information API, die nur in Chromium-'
        + 'Browsern wie Chrome, Edge und Opera vorhanden ist. Sie sind Schätzwerte des '
        + 'Browsers, keine Messung: Downlink ist eine momentane Schätzung der Empfangskapazität, der Wert beim '
        + 'Maximum wird vom Betriebssystem gemeldet und liegt oft deutlich über dem tatsächlich erreichbaren Tempo. '
        + 'Die Round-Trip-Zeit ist eine grobe Messung, die sich bei ausgelasteter Leitung sprunghaft ändert. '
        + 'Ändert sich die Verbindung, aktualisiert sich die Anzeige automatisch. ' + privacy;
    } else {
      explanation = 'Dieser Browser stellt die Network Information API nicht bereit, sie gibt es nur in Chromium-'
        + 'Browsern wie Chrome, Edge und Opera. In Firefox und Safari fehlt sie, deshalb stehen hier keine Werte. '
        + 'Das ist keine Fehlfunktion des Werkzeugs und lässt sich nicht umgehen. ' + privacy;
    }

    return { rows: rows, fallback: !vorhanden, explanation: explanation };
  }

  /* -------- UI -------- */

  function renderOutput(model) {
    var el = E('tool-output');
    if (!el) return;
    if (!model) return;
    var html = '<div class="result-display" style="display:grid;gap:8px">';
    for (var i = 0; i < model.rows.length; i++) {
      html += '<div class="result-row" style="display:flex;justify-content:space-between;gap:12px;background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:8px 12px">'
        + '<span style="color:var(--mut);font-size:.85rem">' + esc(model.rows[i][0]) + '</span>'
        + '<code style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9rem;color:var(--fg);text-align:right">' + esc(model.rows[i][1]) + '</code></div>';
    }
    html += '</div>';
    if (model.fallback) {
      html += '<p style="color:#E0915F;font-size:.85rem;margin-top:12px">Hinweis: Die Browser-Schnittstelle für Verbindungsdaten fehlt hier. Es werden keine Werte geschätzt oder ergänzt.</p>';
    }
    html += '<p style="font-size:.8rem;color:var(--mut);margin-top:12px">' + esc(model.explanation) + '</p>';
    el.innerHTML = html;
  }

  function connection() {
    return (typeof navigator !== 'undefined' && navigator.connection) ? navigator.connection : null;
  }

  function run() {
    var conn = connection();
    renderOutput(engine(conn, conn !== null));
  }

  function bindChange() {
    var conn = connection();
    if (!conn) return;
    if (typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', run);
    } else if ('onchange' in conn) {
      conn.onchange = run;
    }
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label>Verbindungsdaten</label>' +
      '<p style="font-size:.85rem;color:var(--mut);margin:0 0 6px">Die Werte stammen direkt aus dem Browser, ' +
      'nicht aus einer Eingabe. Es wird nichts abgefragt und nichts gesendet.</p></div>' +
      '<div class="row"><button type="button" class="btn-app">Verbindung neu auslesen</button></div>';

    var btn = inputs.querySelector('button.btn-app');
    if (btn) btn.addEventListener('click', run);
    inputs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
    });
    bindChange();
    run();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      engine: engine,
      deZahl: deZahl,
      zahlMitEinheit: zahlMitEinheit,
      jaNein: jaNein,
      TYPEN: TYPEN,
      STUFEN: STUFEN
    };
  }
})();
