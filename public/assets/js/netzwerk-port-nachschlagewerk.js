/* ══════════════════════════════════════════════════
   netzwerk-port-nachschlagewerk.js: Nachschlagewerk
   für bekannte TCP-/UDP-Ports. Portnummer oder
   Dienstnamen suchen, Protokoll filtern.
   Reine lokale Daten, 100% im Browser, kein Netzwerk-I/O.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- Datensatz: kuratierte, stabile IANA-Zuweisungen -------- */

  var PORTS = [
    { port: 7, name: 'echo', proto: 'tcp/udp', desc: 'Echo-Dienst, gibt Eingaben unverändert zurück. Alt und meist nur zu Diagnosezwecken aktiv.' },
    { port: 19, name: 'chargen', proto: 'tcp/udp', desc: 'Chargen-Dienst, liefert endlose Zufallszeichen. Historisch, heute praktisch nicht genutzt.' },
    { port: 20, name: 'ftp-data', proto: 'tcp', desc: 'FTP-Datenkanal für Dateiübertragung im Modus Active. Unverschlüsselt.' },
    { port: 21, name: 'ftp', proto: 'tcp', desc: 'FTP-Kontrollkanal für Anmeldung, Verzeichniswechsel und Befehle. Unverschlüsselt.' },
    { port: 22, name: 'ssh', proto: 'tcp', desc: 'Secure Shell: verschlüsselte Fernwartung, Dateikopie per SCP/SFTP, Tunnel.' },
    { port: 23, name: 'telnet', proto: 'tcp', desc: 'Telnet: unverschlüsselte Fernwartung über Textprotokoll. Nur noch in alten Netzen.' },
    { port: 25, name: 'smtp', proto: 'tcp', desc: 'SMTP: Mail-Transport zwischen Servern und vom Client zum Relay.' },
    { port: 37, name: 'time', proto: 'tcp/udp', desc: 'TIME-Dienst, liefert die Zeit in Sekunden seit 1970.' },
    { port: 53, name: 'dns', proto: 'tcp/udp', desc: 'Domain Name System: UDP für normale Anfragen, TCP für Zonenübertragung und große Antworten.' },
    { port: 67, name: 'dhcps', proto: 'udp', desc: 'DHCP-Server, vergibt IP-Adressen, Gateway und DNS an Clients im Netz.' },
    { port: 68, name: 'dhcpc', proto: 'udp', desc: 'DHCP-Client, fordert die Netzkonfiguration beim DHCP-Server an.' },
    { port: 69, name: 'tftp', proto: 'udp', desc: 'Trivial File Transfer Protocol: minimale, unverbindliche Dateiübertragung ohne Authentifizierung.' },
    { port: 80, name: 'http', proto: 'tcp', desc: 'HTTP: unverschlüsselter Webverkehr, Basis für Webseiten und REST-APIs.' },
    { port: 102, name: 's7comm', proto: 'tcp', desc: 'S7-Kommunikation (ISO-TSAP) für Siemens-SPS-Programmierung und Steuerung.' },
    { port: 110, name: 'pop3', proto: 'tcp', desc: 'POP3: Mailabruf auf den Server, meist zum Löschen nach dem Download. Unverschlüsselt.' },
    { port: 111, name: 'sunrpc', proto: 'tcp/udp', desc: 'Sun RPC Portmapper: meldet, auf welchem Port ein RPC-Dienst läuft.' },
    { port: 123, name: 'ntp', proto: 'udp', desc: 'Network Time Protocol: Synchronisation der Uhrzeit zwischen Hosts im Netz.' },
    { port: 137, name: 'netbios-ns', proto: 'udp', desc: 'NetBIOS-Name-Service: Namensauflösung in Windows-Netzwerken.' },
    { port: 138, name: 'netbios-dgm', proto: 'udp', desc: 'NetBIOS-Datagram-Dienst: Paketzustellung und Namensmeldungen.' },
    { port: 139, name: 'netbios-ssn', proto: 'tcp', desc: 'NetBIOS Session Service: Datei- und Druckerfreigaben im alten Windows-Netz.' },
    { port: 143, name: 'imap', proto: 'tcp', desc: 'IMAP: Mail bleibt auf dem Server, Ordnerstruktur wird synchron gehalten. Unverschlüsselt.' },
    { port: 161, name: 'snmp', proto: 'udp', desc: 'SNMP: Abfrage von Gerätestatus und Kennwerten für Monitoring.' },
    { port: 162, name: 'snmp-trap', proto: 'udp', desc: 'SNMP-Traps: ereignisgesteuerte Alarme von einem Gerät an die Überwachung.' },
    { port: 179, name: 'bgp', proto: 'tcp', desc: 'BGP: Routingprotokoll zwischen autonomen Systemen, Austausch von Routingtabellen.' },
    { port: 389, name: 'ldap', proto: 'tcp/udp', desc: 'LDAP: Verzeichniszugriff für Benutzer, Gruppen und Richtlinien.' },
    { port: 443, name: 'https', proto: 'tcp', desc: 'HTTP über TLS: verschlüsselter Webverkehr, auch Basis für REST-APIs und WebSockets.' },
    { port: 445, name: 'microsoft-ds', proto: 'tcp', desc: 'SMB/CIFS: Datei- und Druckerfreigabe in Windows-Netzwerken (Direktzugriff).' },
    { port: 464, name: 'kpasswd', proto: 'tcp/udp', desc: 'Kerberos-Passwortänderung.' },
    { port: 465, name: 'smtps', proto: 'tcp', desc: 'SMTP über TLS, implizit verschlüsselt (Submission).' },
    { port: 500, name: 'isakmp', proto: 'udp', desc: 'ISAKMP: Schlüsselaustausch und Aufbau von IPsec-VPN-Verbindungen.' },
    { port: 512, name: 'exec', proto: 'tcp', desc: 'BSD-Exec-Dienst, startet Befehle auf einem Host. Aus Sicherheitsgründen meist deaktiviert.' },
    { port: 513, name: 'login', proto: 'tcp', desc: 'BSD-Login-Dienst, protokolliert Anmeldungen von aussen.' },
    { port: 514, name: 'syslog', proto: 'udp', desc: 'Syslog: Übermittlung von Protokoll- und Ereignismeldungen an einen Logserver.' },
    { port: 515, name: 'printer-lpd', proto: 'tcp', desc: 'LPD: Druckaufträge an Netzdrucker senden.' },
    { port: 520, name: 'rip', proto: 'udp', desc: 'RIP: altes Distance-Vector-Routingprotokoll, überholt durch OSPF und BGP.' },
    { port: 546, name: 'dhcpv6-client', proto: 'udp', desc: 'DHCPv6-Client, fordert Adressen und weitere Parameter im IPv6-Netz an.' },
    { port: 547, name: 'dhcpv6-server', proto: 'udp', desc: 'DHCPv6-Server, vergibt Adressen und Konfiguration im IPv6-Netz.' },
    { port: 587, name: 'submission', proto: 'tcp', desc: 'SMTP-Submission: Mailversand vom Client, üblicherweise mit STARTTLS.' },
    { port: 623, name: 'ipmi-rmcp', proto: 'udp', desc: 'IPMI: Fernwartung und Überwachung von Server-Hardware.' },
    { port: 636, name: 'ldaps', proto: 'tcp', desc: 'LDAP über TLS: verschlüsselter Verzeichniszugriff.' },
    { port: 853, name: 'domain-s', proto: 'tcp', desc: 'DNS-over-TLS: DNS-Anfragen verschlüsselt über TLS.' },
    { port: 873, name: 'rsync', proto: 'tcp', desc: 'rsync: effiziente Spiegelung von Verzeichnissen und Dateien.' },
    { port: 993, name: 'imaps', proto: 'tcp', desc: 'IMAP über TLS, implizit verschlüsselter Mailabruf.' },
    { port: 995, name: 'pop3s', proto: 'tcp', desc: 'POP3 über TLS, implizit verschlüsselter Mailabruf.' },
    { port: 1080, name: 'socks', proto: 'tcp', desc: 'SOCKS-Proxy: leitet Verbindungen über einen Proxyserver weiter, oft in VPN-Kontexten genutzt.' },
    { port: 1194, name: 'openvpn', proto: 'udp', desc: 'OpenVPN: VPN-Verbindung mit eigener Zertifikatsverwaltung.' },
    { port: 1433, name: 'ms-sql-s', proto: 'tcp', desc: 'Microsoft SQL Server: Datenbankzugriff für Anwendungen und Clients.' },
    { port: 1521, name: 'oracle', proto: 'tcp', desc: 'Oracle-Datenbank: Netzwerkprotokoll für SQL-Zugriffe und Listener-Dienste.' },
    { port: 1701, name: 'l2tp', proto: 'udp', desc: 'L2TP: Tunnelprotokoll für VPN-Verbindungen, meist zusammen mit IPsec.' },
    { port: 1723, name: 'pptp', proto: 'tcp', desc: 'PPTP: altes VPN-Protokoll, in aktuellen Systemen als unsicher eingestuft.' },
    { port: 1812, name: 'radius', proto: 'tcp/udp', desc: 'RADIUS: zentrale Authentifizierung, Autorisierung und Abrechnung von Zugängen.' },
    { port: 1813, name: 'radacct', proto: 'tcp/udp', desc: 'RADIUS-Accounting: protokolliert Sitzungs- und Verbrauchsdaten.' },
    { port: 1883, name: 'mqtt', proto: 'tcp', desc: 'MQTT: leichtgewichtiges Publish/Subscribe-Messaging für IoT und Telemetrie.' },
    { port: 1900, name: 'ssdp', proto: 'udp', desc: 'SSDP: UPnP-Gerätesuche im lokalen Netz per Multicast-Anfragen.' },
    { port: 2049, name: 'nfs', proto: 'tcp/udp', desc: 'Network File System: exportierte Verzeichnisse für Dateizugriff aus dem Netz.' },
    { port: 2082, name: 'cpanel', proto: 'tcp', desc: 'cPanel-Weboberfläche für Webhosting-Verwaltung, unverschlüsselt.' },
    { port: 2083, name: 'cpanel-ssl', proto: 'tcp', desc: 'cPanel-Weboberfläche über TLS.' },
    { port: 2086, name: 'whm', proto: 'tcp', desc: 'WHM: Serververwaltung beim Webhosting-Provider, unverschlüsselt.' },
    { port: 2087, name: 'whm-ssl', proto: 'tcp', desc: 'WHM: Serververwaltung über TLS.' },
    { port: 2222, name: 'ssh-alt', proto: 'tcp', desc: 'Alternative SSH-Portnummer, häufig genutzt um Brute-Force auf Port 22 zu verteilen.' },
    { port: 2375, name: 'docker-api', proto: 'tcp', desc: 'Docker Remote API, unverschlüsselte Variante. Nur im abgesicherten Netz nutzen.' },
    { port: 3000, name: 'web-3000', proto: 'tcp', desc: 'Verbreitete Portnummer für Weboberflächen und Entwicklungsserver, kein fester Dienstdienst.' },
    { port: 3128, name: 'squid-proxy', proto: 'tcp', desc: 'Squid: Forward-Proxy für HTTP-Zugriffe im Unternehmensnetz.' },
    { port: 3306, name: 'mysql', proto: 'tcp', desc: 'MySQL: Datenbankzugriff von Anwendungen und Clients.' },
    { port: 3389, name: 'ms-wbt-server', proto: 'tcp', desc: 'RDP: Remote Desktop von Windows, auch die Basis für Terminaldienste.' },
    { port: 3478, name: 'stun', proto: 'tcp/udp', desc: 'STUN: ermittelt die öffentliche Adresse eines Endpunkts für VoIP und Videokonferenzen.' },
    { port: 4369, name: 'epmd', proto: 'tcp', desc: 'Erlang Port Mapper Daemon: meldet Ports verteilter Erlang-Knoten (OTP-Verteilung).' },
    { port: 4500, name: 'ipsec-nat-t', proto: 'udp', desc: 'IPsec-NAT-Traversal: IPsec-Verbindungen hinter Router und NAT.' },
    { port: 5000, name: 'web-5000', proto: 'tcp/udp', desc: 'Häufig genutzt für UPnP-Dienste, Entwicklungsserver und Registry-Schnittstellen.' },
    { port: 5060, name: 'sip', proto: 'tcp/udp', desc: 'SIP: Aufbau und Steuerung von VoIP- und Videotelefonie-Sitzungen.' },
    { port: 5061, name: 'sips', proto: 'tcp', desc: 'SIP über TLS, verschlüsselte VoIP-Signalisierung.' },
    { port: 5353, name: 'mdns', proto: 'udp', desc: 'Multicast-DNS: automatische Namensauflösung im lokalen Netz ohne DNS-Server.' },
    { port: 5432, name: 'postgresql', proto: 'tcp', desc: 'PostgreSQL: Datenbankzugriff von Anwendungen und Clients.' },
    { port: 5601, name: 'kibana', proto: 'tcp', desc: 'Kibana: Weboberfläche für Logsuche und Visualisierung im Elastic-Stack.' },
    { port: 5672, name: 'amqp', proto: 'tcp', desc: 'AMQP: Nachrichtenbroker-Protokoll, Basis von RabbitMQ und Queuesystemen.' },
    { port: 5900, name: 'vnc', proto: 'tcp/udp', desc: 'VNC: Fernzugriff auf den grafischen Bildschirm eines Rechners.' },
    { port: 5901, name: 'vnc-1', proto: 'tcp', desc: 'Erster VNC-Desktop in einer Serie, häufig 5900, 5901, 5902 für mehrere Sitzungen.' },
    { port: 5984, name: 'couchdb', proto: 'tcp', desc: 'CouchDB: dokumentenorientierte Datenbank mit HTTP-Schnittstelle.' },
    { port: 5985, name: 'wsman', proto: 'tcp', desc: 'WinRM: PowerShell-Fernverwaltung von Windows-Servern.' },
    { port: 5986, name: 'wsmans', proto: 'tcp', desc: 'WinRM über TLS, verschlüsselte Windows-Fernverwaltung.' },
    { port: 6379, name: 'redis', proto: 'tcp', desc: 'Redis: In-Memory-Datenbank für Cache, Sessions und Queues.' },
    { port: 6443, name: 'kubernetes-api', proto: 'tcp', desc: 'Kubernetes-API-Server: zentrale Steuerungsschnittstelle eines Clusters.' },
    { port: 8080, name: 'http-alt', proto: 'tcp', desc: 'Alternative Portnummer für HTTP, häufig für Proxys, Testdienste und Containers.' },
    { port: 8443, name: 'https-alt', proto: 'tcp', desc: 'Alternative Portnummer für HTTPS, oft für Testzertifikate und interne Dienste.' },
    { port: 8883, name: 'secure-mqtt', proto: 'tcp', desc: 'MQTT über TLS, verschlüsseltes Messaging für IoT.' },
    { port: 8888, name: 'web-8888', proto: 'tcp', desc: 'Häufig Jupyter Notebook, einfache Webserver und Administrationsoberflächen.' },
    { port: 9000, name: 'web-9000', proto: 'tcp', desc: 'Genutzt unter anderem für Audiostreaming, PHP-FPM und interne Dienste.' },
    { port: 9001, name: 'tor-orport', proto: 'tcp', desc: 'Tor: Client-Zugangsport für das Onion-Routing-Netz.' },
    { port: 9090, name: 'web-9090', proto: 'tcp', desc: 'Verbreitet für Prometheus-Server und weitere Monitoring-Oberflächen.' },
    { port: 9092, name: 'kafka', proto: 'tcp', desc: 'Apache Kafka: Nachrichtenbroker, Clients nehmen Daten über diesen Port entgegen.' },
    { port: 9100, name: 'jetdirect', proto: 'tcp', desc: 'RAW-Printing an Netzwerkdrucker (JetDirect/Port 9100).' },
    { port: 9200, name: 'elasticsearch', proto: 'tcp', desc: 'Elasticsearch: HTTP-Schnittstelle für Suche, Indexierung und Clusterverwaltung.' },
    { port: 9418, name: 'git', proto: 'tcp', desc: 'Git-Daemon: anonymes Klonen und Pushen von Repositorys.' },
    { port: 11211, name: 'memcached', proto: 'tcp/udp', desc: 'Memcached: verteilter Zwischenspeicher im Arbeitsspeicher.' },
    { port: 15672, name: 'rabbitmq-management', proto: 'tcp', desc: 'RabbitMQ: Weboberfläche für Verwaltung, Queues und Verbindungen.' },
    { port: 27017, name: 'mongodb', proto: 'tcp', desc: 'MongoDB: dokumentenorientierte NoSQL-Datenbank.' },
    { port: 33060, name: 'mysqlx', proto: 'tcp', desc: 'MySQL X Protocol: binäres Protokoll für Connectoren und Orchestrierung.' },
    { port: 51820, name: 'wireguard', proto: 'udp', desc: 'WireGuard: schlankes, schnelles VPN-Protokoll mit moderner Kryptografie.' },
    { port: 61616, name: 'activemq', proto: 'tcp', desc: 'ActiveMQ: Java-Message-Broker, Transportport für Broker- und Broker-Cluster-Verbindungen.' }
  ];

  /* -------- pure engine (node-testable) -------- */

  /**
   * Sucht im Portdatensatz.
   * query: Portnummer als String oder Teilstring eines Dienstnamens (Gross-/Kleinschreibung egal).
   * protoFilter: 'all' | 'tcp' | 'udp'
   * Rückgabe: Array der Treffer. Ist das Array leer, trägt es ein Feld `hint`
   * mit einem deutschen Hinweistext.
   */
  function searchPorts(query, protoFilter) {
    var res = [];
    var filter = (protoFilter === 'tcp' || protoFilter === 'udp') ? protoFilter : 'all';
    var q = (query === null || query === undefined) ? '' : String(query).trim();
    var lower = q.toLowerCase();

    function protoOk(p) {
      if (filter === 'all') return true;
      if (p === 'tcp/udp') return true;
      return p === filter;
    }

    if (lower === '') {
      res.hint = 'Bitte eine Portnummer oder einen Dienstnamen eingeben.';
      return res;
    }

    if (/^\d{1,5}$/.test(lower)) {
      var num = parseInt(lower, 10);
      for (var i = 0; i < PORTS.length; i++) {
        if (PORTS[i].port === num && protoOk(PORTS[i].proto)) res.push(PORTS[i]);
      }
      if (res.length === 0) {
        if (num < 0 || num > 65535) {
          res.hint = 'Port muss zwischen 0 und 65535 liegen.';
        } else {
          res.hint = 'kein bekannter Standardport';
        }
      }
      return res;
    }

    for (var j = 0; j < PORTS.length; j++) {
      if (PORTS[j].name.toLowerCase().indexOf(lower) !== -1 && protoOk(PORTS[j].proto)) {
        res.push(PORTS[j]);
      }
    }
    if (res.length === 0) {
      res.hint = 'Kein Dienstname mit diesem Teiltext gefunden. Suche nach einem englischen Dienstnamen wie http, smtp oder mysql.';
    }
    return res;
  }

  /** Portnummer zu einem Eintrag, oder null. */
  function portInfo(port) {
    var n = parseInt(port, 10);
    if (isNaN(n)) return null;
    for (var i = 0; i < PORTS.length; i++) {
      if (PORTS[i].port === n) return PORTS[i];
    }
    return null;
  }

  /* -------- UI -------- */

  function protoLabel(p) {
    if (p === 'tcp/udp') return 'TCP/UDP';
    return p === 'tcp' ? 'TCP' : 'UDP';
  }

  function renderResults(rows, hint, query) {
    var el = E('tool-output');
    if (!el) return;
    if (rows.length === 0) {
      el.innerHTML = '<div class="result-display" style="display:grid;gap:8px">'
        + '<div style="background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:10px 12px">'
        + '<span style="color:var(--mut);font-size:.85rem">Treffer</span>'
        + '<code style="display:block;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9rem;color:var(--fg)">0</code></div>'
        + '<p style="color:var(--err);font-size:.9rem;margin:0">' + esc(hint || 'Kein Treffer.') + '</p>'
        + (query ? '<p style="color:var(--mut);font-size:.8rem;margin:0">Suche nach: <b style="color:var(--fg)">' + esc(query) + '</b></p>' : '')
        + '</div>';
      return;
    }

    var html = '<div class="result-display" style="display:grid;gap:8px">'
      + '<div style="background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;gap:12px">'
      + '<span style="color:var(--mut);font-size:.85rem">Treffer</span>'
      + '<code style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9rem;color:var(--fg)">' + rows.length + '</code></div>';

    for (var i = 0; i < rows.length; i++) {
      html += '<div class="result-row" style="background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:8px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:start">'
        + '<span style="color:var(--fg);font-size:.9rem;overflow-wrap:anywhere">' + esc(rows[i].name) + '</span>'
        + '<code style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9rem;color:var(--fg);text-align:right">' + esc(rows[i].port) + '</code>'
        + '<span style="grid-column:1;color:var(--mut);font-size:.8rem">' + esc(protoLabel(rows[i].proto)) + '</span>'
        + '<span style="grid-column:2;color:var(--mut);font-size:.8rem;text-align:right">' + esc(rows[i].desc) + '</span>'
        + '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function run() {
    var qEl = E('nport-query');
    var pEl = E('nport-proto');
    if (!qEl || !pEl) return;
    var query = qEl.value;
    var rows = searchPorts(query, pEl.value);
    renderResults(rows, rows.hint, String(query).trim());
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label for="nport-query">Portnummer oder Dienstname</label>' +
      '<input id="nport-query" type="text" placeholder="443  oder  http" value="443" ' +
      'style="background:#0b1218;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:8px;font-size:.9rem;width:100%"></div>' +
      '<div class="field"><label for="nport-proto">Protokoll</label>' +
      '<select id="nport-proto" ' +
      'style="background:#0b1218;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:8px;font-size:.9rem;width:100%">' +
      '<option value="all">alle</option>' +
      '<option value="tcp">TCP</option>' +
      '<option value="udp">UDP</option>' +
      '</select></div>' +
      '<div class="row"><button type="button" class="btn-app">Suchen</button></div>';

    var btn = inputs.querySelector('button.btn-app');
    if (btn) btn.addEventListener('click', run);
    var pSel = E('nport-proto');
    if (pSel) pSel.addEventListener('change', run);
    inputs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
    });
    run();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PORTS: PORTS,
      searchPorts: searchPorts,
      portInfo: portInfo
    };
  }
})();
