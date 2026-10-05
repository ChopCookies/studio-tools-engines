/* ══════════════════════════════════════════════════
   ipv6-rechner.js — IPv6-Adressen expandieren, verkürzen
   und validieren (RFC 5952), mit Präfix-Unterteilung.
   Reine Rechnung, 100% lokal im Browser.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- pure IPv6 engine (node-testable) -------- */

  function isHexGroup(g) {
    return /^[0-9a-fA-F]{1,4}$/.test(g);
  }

  /** Local IPv4 parser (used for the ::ffff:a.b.c.d tail). */
  function parseIPv4(s) {
    if (typeof s !== 'string') return null;
    var parts = s.trim().split('.');
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

  /**
   * Parse an IPv6 string into an array of 8 16-bit groups.
   * Handles ::, [] brackets, %zone, IPv4-mapped tail, RFC 5952.
   * Returns array, or null if invalid. For a named German error use
   * ipv6Error().
   */
  function parseIPv6(str) {
    if (typeof str !== 'string') return null;
    var s = str.trim();
    if (!s) return null;
    if (s[0] === '[' && s[s.length - 1] === ']') s = s.slice(1, -1);
    var zi = s.indexOf('%');
    if (zi !== -1) s = s.slice(0, zi);

    // IPv4-mapped tail (::ffff:a.b.c.d)
    var ip4 = null;
    var lastColon = s.lastIndexOf(':');
    if (lastColon !== -1) {
      var possibleIp = s.slice(lastColon + 1);
      if (possibleIp.indexOf('.') !== -1) {
        ip4 = parseIPv4(possibleIp);
        if (!ip4) return null;
        s = s.slice(0, lastColon);
      }
    }

    var d = s.indexOf('::');
    if (d !== -1 && s.indexOf('::', d + 1) !== -1) return null; // more than one ::
    var left = (d === -1) ? s : s.slice(0, d);
    var right = (d === -1) ? '' : s.slice(d + 2);

    function groups(part) { return part === '' ? [] : part.split(':'); }
    var gLeft = groups(left);
    var gRight = groups(right);
    var all = gLeft.concat(gRight);
    for (var i = 0; i < all.length; i++) {
      if (!isHexGroup(all[i])) return null;
    }
    var ip4Groups = ip4 ? 2 : 0;
    var explicit = gLeft.length + gRight.length + ip4Groups;
    if (explicit > 8) return null;
    if (d === -1 && explicit !== 8) return null; // no :: needs full 8
    var missing = 8 - explicit;
    if (missing < 0) return null;

    var arr = [];
    for (var j = 0; j < gLeft.length; j++) arr.push(parseInt(gLeft[j], 16));
    for (var k = 0; k < missing; k++) arr.push(0);
    for (var l = 0; l < gRight.length; l++) arr.push(parseInt(gRight[l], 16));
    if (ip4) {
      arr.push((ip4[0] << 8) | ip4[1]);
      arr.push((ip4[2] << 8) | ip4[3]);
    }
    if (arr.length !== 8) return null;
    return arr;
  }

  /**
   * German validation with a named reason. Returns {valid, reason?, arr?}.
   */
  function validateIPv6(str) {
    if (typeof str !== 'string' || str.trim() === '') {
      return { valid: false, reason: 'Keine Adresse eingegeben.' };
    }
    var s = str.trim();
    if (s.indexOf('::') !== -1 && s.indexOf('::', s.indexOf('::') + 1) !== -1) {
      return { valid: false, reason: 'Mehr als ein "::" ist nicht erlaubt.' };
    }
    if (s.indexOf(' ') !== -1) {
      return { valid: false, reason: 'Die Adresse darf keine Leerzeichen enthalten.' };
    }
    var arr = parseIPv6(s);
    if (!arr) {
      // characterize for a useful message (also when :: is present)
      var bare = s.replace(/\[|\]/g, '').split('%')[0];
      var hasDot = bare.indexOf('.') !== -1;
      if (!hasDot) {
        var tokens = bare.split(':').filter(function (t) { return t !== ''; });
        for (var i = 0; i < tokens.length; i++) {
          var t = tokens[i];
          if (t.length > 4) return { valid: false, reason: 'Gruppe "' + t + '" hat mehr als 4 Hex-Ziffern.' };
          if (!/^[0-9a-fA-F]+$/.test(t)) return { valid: false, reason: 'Unzulässiges Zeichen in Gruppe "' + t + '".' };
        }
      }
      return { valid: false, reason: 'Adresse ist keine gültige IPv6-Adresse.' };
    }
    return { valid: true, arr: arr };
  }

  /** Expand to full 8x4 lowercase hex, colon-separated. */
  function expandIPv6(arr) {
    return arr.map(function (g) { return g.toString(16).padStart(4, '0'); }).join(':');
  }

  /**
   * Compress to RFC 5952 canonical form (lowercase, drop leading zeros,
   * longest-then-leftmost zero run >= 2 -> ::, never a single group).
   */
  function compressIPv6(arr) {
    var segs = arr.map(function (g) { return g.toString(16); });
    var bestStart = -1, bestLen = 0;
    var i = 0;
    while (i < 8) {
      if (segs[i] === '0') {
        var j = i;
        while (j < 8 && segs[j] === '0') j++;
        var len = j - i;
        if (len > bestLen) { bestLen = len; bestStart = i; }
        i = j;
      } else {
        i++;
      }
    }
    if (bestLen < 2) return segs.join(':');
    var head = segs.slice(0, bestStart).join(':');
    var tail = segs.slice(bestStart + bestLen).join(':');
    return head + '::' + tail;
  }

  /** Semantic classification of an IPv6 address. */
  function classifyIPv6(arr) {
    var all0 = arr.every(function (g) { return g === 0; });
    if (all0) return 'Nicht spezifiziert (::)';
    if (arr[0] === 0 && arr[1] === 0 && arr[2] === 0 && arr[3] === 0 &&
        arr[4] === 0 && arr[5] === 0 && arr[6] === 0 && arr[7] === 1) {
      return 'Loopback (::1)';
    }
    if (arr[0] === 0 && arr[1] === 0 && arr[2] === 0 && arr[3] === 0 &&
        arr[4] === 0 && arr[5] === 0xffff) {
      return 'IPv4-eingebettet (::ffff:a.b.c.d -> ' + ipv4FromMapped(arr) + ')';
    }
    if ((arr[0] & 0xfe00) === 0xfc00) return 'Unique-Local (ULA, fc00::/7)';
    if ((arr[0] & 0xffc0) === 0xfe80) return 'Link-Local (fe80::/10)';
    if ((arr[0] & 0xff00) === 0xff00) return 'Multicast (ff00::/8)';
    return 'Global (Global Unicast)';
  }

  function ipv4FromMapped(arr) {
    var hi = (arr[6] >> 8) & 255, h2 = arr[6] & 255, l1 = (arr[7] >> 8) & 255, l2 = arr[7] & 255;
    return [hi, h2, l1, l2].join('.');
  }

  /**
   * Prefix math: how many /toPrefix subnets fit in a /fromPrefix, and
   * addresses per prefix. Uses BigInt for exact large counts.
   */
  function prefixMath(fromPrefix, toPrefix) {
    if (typeof fromPrefix !== 'number' || typeof toPrefix !== 'number' ||
        fromPrefix < 0 || fromPrefix > 128 || toPrefix < 0 || toPrefix > 128 ||
        toPrefix < fromPrefix) {
      return null;
    }
    var subnets = BigInt(1) << BigInt(toPrefix - fromPrefix);
    return {
      subnets: subnets,
      addressesPerPrefix: BigInt(1) << BigInt(128 - toPrefix)
    };
  }

  function bigToLocale(b) {
    return b.toLocaleString ? b.toLocaleString('de-DE') : b.toString();
  }

  /* -------- UI -------- */

  function renderOutput(r) {
    var el = E('tool-output');
    if (!el) return;
    if (!r.valid) {
      el.innerHTML = '<p style="color:var(--err);font-size:.9rem">' + esc(r.reason) + '</p>';
      return;
    }
    var html = '<div class="result-display" style="display:grid;gap:8px">';
    html += row('Volle Form (expandiert)', expandIPv6(r.arr));
    html += row('Kurzform (RFC 5952)', compressIPv6(r.arr));
    html += row('Einordnung', classifyIPv6(r.arr));
    html += '</div>';
    el.innerHTML = html;
  }

  function row(label, val) {
    return '<div style="display:flex;justify-content:space-between;gap:12px;background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:8px 12px;flex-wrap:wrap">'
      + '<span style="color:var(--mut);font-size:.85rem">' + esc(label) + '</span>'
      + '<code style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85rem;color:var(--fg);text-align:right;word-break:break-all">' + esc(val) + '</code></div>';
  }

  function run() {
    var addrEl = E('v6-addr');
    if (!addrEl) return;
    var v = validateIPv6(addrEl.value);
    renderOutput(v);
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label>IPv6-Adresse</label>' +
      '<input id="v6-addr" type="text" placeholder="2001:db8:0:1::1" value="2001:db8:0:1::1" ' +
      'style="background:#0b1218;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:8px;font-size:.9rem;width:100%">' +
      '<p style="color:var(--mut);font-size:.75rem;margin:6px 0 0">Klammern [ ] und Zone-ID (z. B. %eth0) und IPv4-Ende (::ffff:a.b.c.d) werden toleriert. "::" darf nur einmal vorkommen.</p></div>' +
      '<div class="row"><button type="button" class="btn-app">Umwandeln &amp; prüfen</button></div>';

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
      parseIPv6: parseIPv6,
      validateIPv6: validateIPv6,
      expandIPv6: expandIPv6,
      compressIPv6: compressIPv6,
      classifyIPv6: classifyIPv6,
      prefixMath: prefixMath
    };
  }
})();
