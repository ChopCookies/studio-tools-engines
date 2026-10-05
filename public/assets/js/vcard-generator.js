/* ══════════════════════════════════════════════════
   vcard-generator.js - Elektronische Visitenkarte Generator
   Builds a vCard (.vcf) file from a few form fields, offers download
   and renders an optional scannable contact QR (qrcodejs). Everything
   runs locally in the browser; no data is transmitted to a server.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  var isEn = window.__siteLang === 'en';
  function txt(de, en) { return isEn ? en : de; }

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- UTF-8 helpers (no TextEncoder dependency) ---------- */
  function utf8Encode(s) {
    if (typeof TextEncoder !== 'undefined') {
      try { return Array.prototype.slice.call(new TextEncoder().encode(s)); } catch (e) { /* fall through */ }
    }
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var cp = s.codePointAt(i);
      if (cp > 0xFFFF) { i++; }
      if (cp <= 0x7f) { out.push(cp); }
      else if (cp <= 0x7ff) { out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63)); }
      else if (cp <= 0xffff) { out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)); }
      else { out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)); }
    }
    return out;
  }
  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      try { return new TextDecoder().decode(new Uint8Array(bytes)); } catch (e) { /* fall through */ }
    }
    function fromCp(cp) {
      if (cp <= 0xffff) { return String.fromCharCode(cp); }
      var hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800;
      var lo = ((cp - 0x10000) % 0x400) + 0xdc00;
      return String.fromCharCode(hi, lo);
    }
    var s = '', i = 0, b, cp;
    while (i < bytes.length) {
      b = bytes[i];
      if (b < 0x80) { s += String.fromCharCode(b); i++; }
      else if ((b & 0xe0) === 0xc0) { cp = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f); s += String.fromCharCode(cp); i += 2; }
      else if ((b & 0xf0) === 0xe0) { cp = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f); s += String.fromCharCode(cp); i += 3; }
      else if ((b & 0xf8) === 0xf0) { cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f); s += fromCp(cp); i += 4; }
      else { s += '?'; i++; }
    }
    return s;
  }

  /* Split a UTF-8 string into chunks of at most `max` bytes without
     splitting a multi-byte character. Returns arrays of byte lists. */
  function splitUtf8Chunks(s, max) {
    var bytes = utf8Encode(s);
    var chunks = [], start = 0;
    while (start < bytes.length) {
      var end = Math.min(start + max, bytes.length);
      while (end > start && (bytes[end] & 0xC0) === 0x80) { end--; }
      chunks.push(bytes.slice(start, end));
      start = end;
    }
    if (chunks.length === 0) { chunks.push([]); }
    return chunks;
  }

  /* RFC 2426 line folding: content lines are limited to 75 octets and
     folded by prefixing every continuation line with a single space. */
  function foldLine(line) {
    if (line == null) { line = ''; }
    var chunks = splitUtf8Chunks(line, 75);
    var parts = [];
    for (var i = 0; i < chunks.length; i++) { parts.push(utf8Decode(chunks[i])); }
    var out = parts[0];
    for (var j = 1; j < parts.length; j++) { out += '\r\n ' + parts[j]; }
    return out;
  }

  /* RFC 2426 value escaping: backslash, semicolon, comma, newlines. */
  function escapeVCard(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/\n/g, '\\n');
  }

  function str(s) { return String(s == null ? '' : s).trim(); }

  /* ---------- vCard builder ---------- */
  function buildVCard(data, version) {
    version = (version === '4.0') ? '4.0' : '3.0';
    data = data || {};
    var v3 = (version === '3.0');
    var esc = escapeVCard;

    var first = str(data.firstName);
    var last = str(data.lastName);
    var org = str(data.org);
    var title = str(data.title);
    var phone = str(data.phone);
    var mobile = str(data.mobile);
    var email = str(data.email);
    var website = str(data.website);
    var street = str(data.street);
    var zip = str(data.zip);
    var city = str(data.city);
    var country = str(data.country);
    var note = str(data.note);

    var lines = ['BEGIN:VCARD', 'VERSION:' + version];

    // FN is required; fall back to first+last or the organisation name.
    var fn = [first, last].filter(Boolean).join(' ') || org;
    lines.push('FN:' + esc(fn));
    // N: Last;First;;;
    lines.push('N:' + esc(last) + ';' + esc(first) + ';;;');

    if (org) { lines.push('ORG:' + esc(org)); }
    if (title) { lines.push('TITLE:' + esc(title)); }
    if (phone) { lines.push((v3 ? 'TEL;TYPE=WORK' : 'TEL;TYPE=work') + ':' + esc(phone)); }
    if (mobile) { lines.push((v3 ? 'TEL;TYPE=CELL' : 'TEL;TYPE=cell') + ':' + esc(mobile)); }
    if (email) { lines.push((v3 ? 'EMAIL;TYPE=INTERNET' : 'EMAIL;TYPE=work') + ':' + esc(email)); }
    if (website) { lines.push('URL:' + esc(website)); }
    if (street || city || zip || country) {
      lines.push((v3 ? 'ADR;TYPE=WORK' : 'ADR;TYPE=work') + ':;;' +
        [esc(street), esc(city), '', esc(zip), esc(country)].join(';'));
    }
    if (note) { lines.push('NOTE:' + esc(note)); }

    if (data.photo) {
      var b64 = String(data.photo).replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
      lines.push((v3 ? 'PHOTO;ENCODING=b;TYPE=JPEG:' : 'PHOTO;ENCODING=b;TYPE=image/jpeg:') + b64);
    }

    lines.push('END:VCARD');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }

  /* Compact vCard 3.0 with the essential contact fields only (no photo,
     no note) for a QR code. Always returns a non-empty string. */
  function qrText(data) {
    data = data || {};
    var copy = {};
    ['firstName', 'lastName', 'org', 'title', 'phone', 'mobile', 'email', 'website',
     'street', 'zip', 'city', 'country'].forEach(function (k) {
      copy[k] = data[k];
    });
    return buildVCard(copy, '3.0');
  }

  function collect() {
    function v(id) { var el = E(id); return el ? el.value : ''; }
    return {
      firstName: v('vc-first'),
      lastName: v('vc-last'),
      org: v('vc-org'),
      title: v('vc-title'),
      phone: v('vc-phone'),
      mobile: v('vc-mobile'),
      email: v('vc-email'),
      website: v('vc-website'),
      street: v('vc-street'),
      zip: v('vc-zip'),
      city: v('vc-city'),
      country: v('vc-country'),
      note: v('vc-note'),
      photo: v('vc-photo-raw')
    };
  }

  function build() {
    var output = E('tool-output');
    if (!output) return;
    var data = collect();
    var version = (E('vc-version') && E('vc-version').value) || '3.0';
    var vcf = buildVCard(data, version);

    var last = str(data.lastName) || 'kontakt';
    var first = str(data.firstName) || '';
    var fname = (last.toLowerCase() || 'kontakt') + (first ? '-' + first.toLowerCase() : '') + '.vcf';

    output.innerHTML =
      '<div class="result-display">' +
        '<label class="field-label">' + esc(txt('VCF-Vorschau', 'VCF preview')) + '</label>' +
        '<textarea readonly class="input textarea" id="vc-preview" rows="12" style="font-family:monospace;font-size:0.8rem;white-space:pre"></textarea>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
          '<button class="btn btn-primary" id="vc-download">' + esc(txt('VCF herunterladen', 'Download VCF')) + '</button>' +
        '</div>' +
      '</div>';
    E('vc-preview').value = vcf;
    E('vc-download').addEventListener('click', function () {
      var blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  function renderQr() {
    var output = E('tool-output');
    if (!output) return;
    var data = collect();
    var text = qrText(data);

    var qrNote = '<p class="text-muted" style="margin-top:8px">' +
      esc(txt('Hinweis: Das Foto wird im QR-Code weggelassen, damit der Code klein genug zum Scannen bleibt.', 'Note: the photo is omitted from the QR code so it stays small enough to scan.')) +
      '</p>';

    if (typeof window.QRCode !== 'function') {
      output.innerHTML = '<div class="result-display"><p class="text-muted">' +
        esc(txt('QR-Bibliothek konnte nicht geladen werden.', 'The QR library could not be loaded.')) + '</p></div>';
      return;
    }

    output.innerHTML =
      '<div class="result-display">' +
        '<div id="vc-qrbox" style="display:flex;justify-content:center;padding:8px 0"></div>' +
        qrNote +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;justify-content:center">' +
          '<button class="btn btn-secondary" id="vc-qr-download" data-canvas="vc-qr-canvas" data-download="kontakt-qr.png">' + esc(txt('QR-Code als PNG speichern', 'Save QR as PNG')) + '</button>' +
        '</div>' +
      '</div>';

    var host = E('vc-qrbox');
    try {
      new window.QRCode(host, {
        text: text,
        width: 260,
        height: 260,
        correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 1,
        colorDark: '#000000',
        colorLight: '#ffffff'
      });
      var node = host.querySelector('canvas') || host.querySelector('img');
      if (node) { node.id = 'vc-qr-canvas'; }
    } catch (e) {
      host.innerHTML = '<p class="text-muted">' + esc(txt('QR-Erzeugung fehlgeschlagen.', 'QR generation failed.')) + '</p>';
    }
  }

  /* ---------- UI setup ---------- */
  function field(label, inner) {
    return '<div class="input-group"><label>' + label + '</label>' + inner + '</div>';
  }
  function textInput(id, placeholder) {
    return '<input type="text" id="' + id + '" class="input" placeholder="' + esc(placeholder) + '">';
  }

  function setup() {
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;

    inputs.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">' +
        field(txt('Vorname', 'First name'), textInput('vc-first', '')) +
        field(txt('Nachname', 'Last name'), textInput('vc-last', '')) +
        field(txt('Firma/Organisation', 'Company'), textInput('vc-org', '')) +
        field(txt('Funktion', 'Job title'), textInput('vc-title', '')) +
        field(txt('Telefon (Geschäft)', 'Phone (work)'), textInput('vc-phone', '+49 ...')) +
        field(txt('Mobil', 'Mobile'), textInput('vc-mobile', '+49 ...')) +
        field(txt('E-Mail', 'Email'), textInput('vc-email', 'name@beispiel.de')) +
        field(txt('Webseite', 'Website'), textInput('vc-website', 'https://...')) +
        field(txt('Straße', 'Street'), textInput('vc-street', '')) +
        field(txt('PLZ', 'ZIP'), textInput('vc-zip', '')) +
        field(txt('Ort', 'City'), textInput('vc-city', '')) +
        field(txt('Land', 'Country'), textInput('vc-country', '')) +
      '</div>' +
      field(txt('Notiz', 'Note'),
        '<textarea id="vc-note" class="input textarea" rows="3"></textarea>') +
      field(txt('Foto (optional, bleibt auf deinem Gerät)', 'Photo (optional, stays on your device)'),
        '<input type="file" id="vc-photo" class="input" accept="image/*">' +
        '<input type="hidden" id="vc-photo-raw">') +
      field(txt('Format', 'Format'),
        '<select id="vc-version" class="input">' +
          '<option value="3.0">vCard 3.0</option>' +
          '<option value="4.0">vCard 4.0</option>' +
        '</select>') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">' +
        '<button type="button" class="btn btn-primary btn-generate" id="vc-build">' + esc(txt('vCard erstellen', 'Create vCard')) + '</button>' +
        '<button type="button" class="btn btn-secondary" id="vc-qr">' + esc(txt('Als QR-Code', 'As QR code')) + '</button>' +
      '</div>';

    // Read the chosen photo into a hidden field (base64 without prefix).
    var photoInput = E('vc-photo');
    if (photoInput) {
      photoInput.addEventListener('change', function () {
        var raw = E('vc-photo-raw');
        if (photoInput.files && photoInput.files[0]) {
          var reader = new FileReader();
          reader.onload = function () {
            if (raw && reader.result) {
              raw.value = String(reader.result).replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
            }
          };
          reader.readAsDataURL(photoInput.files[0]);
        } else if (raw) {
          raw.value = '';
        }
      });
    }

    E('vc-build').addEventListener('click', build);
    E('vc-qr').addEventListener('click', renderQr);

    output.innerHTML = '<p class="text-muted">' +
      esc(txt('Fülle die Felder aus und klicke auf „vCard erstellen", um eine .vcf-Datei zu erzeugen, oder auf „Als QR-Code".', 'Fill in the fields and click Create vCard to produce a .vcf file, or As QR code.')) +
      '</p>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildVCard: buildVCard, qrText: qrText, escapeVCard: escapeVCard, foldLine: foldLine };
  }
})();
