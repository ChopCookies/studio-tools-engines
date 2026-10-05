/* ══════════════════════════════════════════════════
   subnet-rechner.js — IPv4/CIDR-Subnetz-Rechner
   Netz, Broadcast, nutzbare Hosts, Wildcard-Maske,
   RFC1918/CGNAT-Einordnung, korrektes /31-/32-Verhalten.
   Reine Rechnung, 100% lokal im Browser.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- pure IPv4 engine (node-testable) -------- */

  function parseIPv4(s) {
    if (typeof s !== 'string') return null;
    s = s.trim();
    var slash = s.indexOf('/');
    if (slash !== -1) s = s.slice(0, slash);
    var parts = s.split('.');
    if (parts.length !== 4) return null;
    var out = [];
    for (var i = 0; i < 4; i++) {
      var p = parts[i].trim();
      if (!/^\d{1,3}$/.test(p)) return null;
      var n = parseInt(p, 10);
      if (n > 255) return null;
      out.push(n);
    }
    return out;
  }

  function ipv4Int(oct) {
    return (((oct[0] << 24) | (oct[1] << 16) | (oct[2] << 8) | oct[3])) >>> 0;
  }

  function intIpv4(n) {
    n = n >>> 0;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  function prefixToMask(p) {
    if (typeof p !== 'number' || isNaN(p) || p < 0 || p > 32) return null;
    if (p === 0) return 0;
    return (0xFFFFFFFF << (32 - p)) >>> 0;
  }

  function maskToPrefix(m) {
    m = m >>> 0;
    if (m === 0) return 0;
    var p = 0;
    for (var i = 31; i >= 0; i--) { if ((m & (1 << i)) !== 0) p++; else break; }
    return p;
  }

  function isContiguousMask(m) {
    m = m >>> 0;
    if (m === 0) return true;
    var p = maskToPrefix(m);
    return prefixToMask(p) === m;
  }

  /**
   * Parse a CIDR-or-mask input into a prefix (0-32).
   * Accepts "/24", "24", or a dotted mask "255.255.255.0".
   * Returns {prefix} or {error}.
   */
  function resolvePrefix(input) {
    if (typeof input !== 'string') return { error: 'Bitte Präfix oder Maske eingeben.' };
    var v = input.trim();
    if (v === '') return { error: 'Bitte Präfix oder Maske eingeben.' };
    if (/^\d{1,2}$/.test(v)) {
      var n = parseInt(v, 10);
      if (n < 0 || n > 32) return { error: 'Präfix muss zwischen /0 und /32 liegen.' };
      return { prefix: n };
    }
    if (/^\/\d{1,2}$/.test(v)) return resolvePrefix(v.slice(1));
    // dotted mask
    var oct = parseIPv4(v);
    if (!oct) return { error: 'Eingabe ist weder ein gültiger Präfix noch eine gültige Maske.' };
    var m = ipv4Int(oct);
    if (!isContiguousMask(m)) return { error: 'Die Maske ist nicht zusammenhängend (z. B. 255.255.255.0 oder 255.255.255.240).' };
    return { prefix: maskToPrefix(m) };
  }

  /**
   * Full subnet calculation. ip = [a,b,c,d] or string; prefix 0-32.
   * Returns a result object with all fields as strings/numbers.
   */
  function calcSubnet(ipInput, prefix) {
    var ip = typeof ipInput === 'string' ? parseIPv4(ipInput) : ipInput;
    if (!ip) return { error: 'Ungültige IP-Adresse.' };
    if (typeof prefix !== 'number' || isNaN(prefix) || prefix < 0 || prefix > 32) {
      return { error: 'Präfix muss zwischen /0 und /32 liegen.' };
    }
    var mask = prefixToMask(prefix);
    var ipInt = ipv4Int(ip);
    var net = ipInt & mask;
    var wildcard = (~mask) >>> 0;
    var bcast = (net | wildcard) >>> 0;
    var total = Math.pow(2, 32 - prefix);
    var usable, first, last;
    if (prefix <= 30) {
      usable = total - 2;
      first = intIpv4(net + 1);
      last = intIpv4(bcast - 1);
    } else if (prefix === 31) { // RFC 3021 point-to-point
      usable = 2;
      first = intIpv4(net);
      last = intIpv4(bcast);
    } else { // /32 single host
      usable = 1;
      first = intIpv4(net);
      last = intIpv4(bcast);
    }
    return {
      ip: intIpv4(ipInt),
      prefix: prefix,
      mask: intIpv4(mask),
      maskInt: mask,
      wildcard: intIpv4(wildcard),
      network: intIpv4(net),
      broadcast: intIpv4(bcast),
      firstHost: first,
      lastHost: last,
      usableHosts: usable,
      totalAddresses: total,
      is31: prefix === 31,
      is32: prefix === 32
    };
  }

  /**
   * RFC classification badge for an IPv4 address.
   */
  function classifyIPv4(ipInput) {
    var oct = typeof ipInput === 'string' ? parseIPv4(ipInput) : ipInput;
    if (!oct) return { label: '', isPrivate: false };
    var a = oct[0], b = oct[1], c = oct[2];
    if (a === 127) return { label: 'Loopback (127.0.0.0/8)', isPrivate: true };
    if (a === 10) return { label: 'Privat, RFC 1918 (10.0.0.0/8)', isPrivate: true };
    if (a === 172 && b >= 16 && b <= 31) return { label: 'Privat, RFC 1918 (172.16.0.0/12)', isPrivate: true };
    if (a === 192 && b === 168) return { label: 'Privat, RFC 1918 (192.168.0.0/16)', isPrivate: true };
    if (a === 100 && b >= 64 && b <= 127) return { label: 'CGNAT, RFC 6598 (100.64.0.0/10)', isPrivate: true };
    if (a === 169 && b === 254) return { label: 'Link-Local, RFC 3927 (169.254.0.0/16)', isPrivate: true };
    if (a === 192 && b === 0 && c === 2) return { label: 'Test/Beispiel, RFC 5737 (192.0.2.0/24)', isPrivate: false };
    if (a === 198 && b === 51 && c === 100) return { label: 'Test/Beispiel, RFC 5737 (198.51.100.0/24)', isPrivate: false };
    if (a === 203 && b === 0 && c === 113) return { label: 'Test/Beispiel, RFC 5737 (203.0.113.0/24)', isPrivate: false };
    if (a >= 224 && a <= 239) return { label: 'Multicast (224.0.0.0/4)', isPrivate: false };
    if (a >= 240) return { label: 'Reserviert (ab 240.0.0.0/4)', isPrivate: false };
    return { label: 'Öffentlich', isPrivate: false };
  }

  /* -------- UI -------- */

  function fmtNum(n) {
    return n.toLocaleString ? n.toLocaleString('de-DE') : String(n);
  }

  function renderOutput(r, ipStr, maskOrPrefix) {
    var el = E('tool-output');
    if (!el) return;
    if (r.error) {
      el.innerHTML = '<p style="color:var(--err);font-size:.9rem">' + esc(r.error) + '</p>';
      return;
    }
    var cls = classifyIPv4(r.network);
    var rows = [
      ['Netzadresse', r.network + '/' + r.prefix],
      ['Subnetzmaske', r.mask],
      ['Wildcard-Maske (Cisco)', r.wildcard],
      ['Broadcast-Adresse', r.broadcast],
      ['Erste nutzbare Adresse', r.firstHost],
      ['Letzte nutzbare Adresse', r.lastHost],
      ['Nutzbare Hosts', fmtNum(r.usableHosts) + (r.is31 || r.is32 ? ' (RFC 3021/' + r.prefix + ')' : '')],
      ['Gesamtadressen', fmtNum(r.totalAddresses)]
    ];
    var html = '<div class="result-display" style="display:grid;gap:8px">';
    for (var i = 0; i < rows.length; i++) {
      html += '<div style="display:flex;justify-content:space-between;gap:12px;background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:8px 12px">'
        + '<span style="color:var(--mut);font-size:.85rem">' + esc(rows[i][0]) + '</span>'
        + '<code style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9rem;color:var(--fg);text-align:right">' + esc(rows[i][1]) + '</code></div>';
    }
    html += '</div>';
    var conf = [
      'Cisco Wildcard:  ' + r.wildcard,
      'Linux-Prefix:    ' + r.network + '/' + r.prefix,
      'Hostbereich:     ' + r.firstHost + ' - ' + r.lastHost
    ];
    html += '<div class="field" style="margin-top:14px"><label>Kopierfertige Angaben</label>';
    html += '<code style="display:block;white-space:pre;background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:.8rem;color:var(--fg)">' + esc(conf.join('\n')) + '</code></div>';
    html += '<p style="font-size:.8rem;color:var(--mut);margin-top:8px">Einordnung: <b style="color:var(--fg)">' + esc(cls.label) + '</b></p>';
    el.innerHTML = html;
  }

  function run() {
    var ipEl = E('net-ip');
    var cidrEl = E('net-cidr');
    if (!ipEl || !cidrEl) return;
    var ip = parseIPv4(ipEl.value);
    var prefix = resolvePrefix(cidrEl.value);
    if (!ip) {
      renderOutput({ error: 'Ungültige IP-Adresse (Format: 192.168.1.0).' }, '', '');
      return;
    }
    if (prefix.error) {
      renderOutput({ error: prefix.error }, '', '');
      return;
    }
    renderOutput(calcSubnet(ip, prefix.prefix), '', '');
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label>IP-Adresse</label>' +
      '<input id="net-ip" type="text" placeholder="192.168.1.0" value="192.168.1.0" ' +
      'style="background:#0b1218;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:8px;font-size:.9rem;width:100%"></div>' +
      '<div class="field"><label>Präfix oder Maske</label>' +
      '<input id="net-cidr" type="text" placeholder="24  oder  255.255.255.0" value="24" ' +
      'style="background:#0b1218;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:8px;font-size:.9rem;width:100%"></div>' +
      '<div class="row"><button type="button" class="btn-app">Berechnen</button></div>';

    var btn = inputs.querySelector('button.btn-app');
    if (btn) btn.addEventListener('click', run);
    inputs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
    });
    run();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseIPv4: parseIPv4,
      ipv4Int: ipv4Int,
      intIpv4: intIpv4,
      prefixToMask: prefixToMask,
      maskToPrefix: maskToPrefix,
      isContiguousMask: isContiguousMask,
      resolvePrefix: resolvePrefix,
      calcSubnet: calcSubnet,
      classifyIPv4: classifyIPv4
    };
  }
})();
