/* ══════════════════════════════════════════════════════
   word-formatierung-entfernen.js | Word-Formatierung entfernen
   Entfernt ALLE Formatierungen aus einer .docx (Fett, Kursiv, Schrift,
   Größe, Farbe, Ausrichtung, Einzüge, Zeilenabstand, Listen, Stile).
   Übrig bleibt der reine Text mit Absatz- und Zeilenumbrüchen, frei
   formatierbar. Lokal im Browser via JSZip (NEEDS_JSZIP_LIB).
   Tabellen werden zu Fließtext-Absätzen vereinfacht.
   ══════════════════════════════════════════════════════ */
(function() {
  'use strict';
  var DE = (typeof window.__siteLang === 'undefined' || window.__siteLang !== 'en');
  function E(id){ return document.getElementById(id); }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── Pure, node-testbar ── */

  // XML-Zeichen escapen (Text + Attribute)
  function escapeXml(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // Dokument in Absätze zerlegen (Top-Level <w:p>…</w:p>, auch verschachtelt in Tabellen).
  function splitParagraphs(xml){
    var paras = [], start = null, depth = 0;
    var re = /<w:p\b[^>]*>|<\/w:p>/g, m;
    while ((m = re.exec(xml)) !== null) {
      if (m[0].charAt(1) === '/') { // </w:p>
        depth--;
        if (depth === 0 && start !== null) { paras.push(xml.slice(start, m.index + m[0].length)); start = null; }
      } else {
        if (depth === 0) start = m.index;
        depth++;
      }
    }
    return paras;
  }

  // Aus einem Absatz den reinen Text extrahieren: nur <w:t> Inhalte,
  // <w:br>/<w:cr> → Zeilenumbruch, <w:tab> → Tab. Alles andere (Formatierung)
  // wird verworfen. Gelöschter Text (w:delText) und Feldcodes (w:instrText) werden übersprungen.
  function paraToText(pXml){
    var out = '', i = 0, n = pXml.length;
    while (i < n) {
      var lt = pXml.indexOf('<', i);
      if (lt === -1) break;
      var gt = pXml.indexOf('>', lt);
      if (gt === -1) break;
      var tag = pXml.slice(lt, gt + 1);
      var mt = tag.match(/^<\/?w:([a-zA-Z]+)\b/);
      var name = mt ? mt[1] : '';
      var isSelfClose = /\/>$/.test(tag);
      if (name === 't' && !isSelfClose) {
        var close = pXml.indexOf('</w:t', gt);
        if (close === -1) { out += pXml.slice(gt + 1); break; }
        out += pXml.slice(gt + 1, close);
        var closeEnd = pXml.indexOf('>', close);
        i = closeEnd === -1 ? n : closeEnd + 1;
      } else if (name === 'delText' || name === 'instrText') {
        var c2 = pXml.indexOf('</w:' + name, gt);
        if (c2 === -1) { i = n; }
        else { var c2e = pXml.indexOf('>', c2); i = c2e === -1 ? n : c2e + 1; }
      } else if (name === 'br' || name === 'cr') {
        if (!/w:type=("|')?page("|')?/.test(tag)) out += '\n';
        i = gt + 1;
      } else if (name === 'tab') {
        out += '\t';
        i = gt + 1;
      } else {
        i = gt + 1;
      }
    }
    return out;
  }

  // Sauberen Absatz bauen: Text ohne jede Formatierung, Zeilen als Runs mit <w:br/>.
  function buildCleanParagraph(text){
    if (text === '') return '<w:p/>';
    var lines = String(text).split('\n');
    var xml = '<w:p>';
    for (var k = 0; k < lines.length; k++) {
      if (k > 0) xml += '<w:r><w:br/></w:r>';
      if (lines[k] !== '') xml += '<w:r><w:t xml:space="preserve">' + escapeXml(lines[k]) + '</w:t></w:r>';
    }
    xml += '</w:p>';
    return xml;
  }

  // Letzte <w:sectPr>…</w:sectPr> (Seitenformat) aus dem Teil extrahieren, um die
  // Seitengröße/Ränder zu erhalten. Nur dokumentebene sectPr am Ende nehmen.
  function extractSectPr(xml){
    var matches = [];
    var re = /<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, m;
    while ((m = re.exec(xml)) !== null) matches.push(m[0]);
    return matches.length ? matches[matches.length - 1] : '';
  }

  // Einen Hauptteil (document/hdr/ftr) säubern. Dokumentebene in w:body + sectPr,
  // Header/Footer direkt. Unbekannte Root-Knoten werden unverändert gelassen.
  function stripDocPart(rawXml){
    var rootM = rawXml.match(/<w:(document|hdr|ftr)\b[^>]*>/);
    if (!rootM) return rawXml;
    var rootName = rootM[1], rootOpen = rootM[0];
    var paras = splitParagraphs(rawXml);
    var inner = '';
    for (var i = 0; i < paras.length; i++) inner += buildCleanParagraph(paraToText(paras[i]));
    var head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    if (rootName === 'document') {
      return head + rootOpen + '<w:body>' + inner + extractSectPr(rawXml) + '</w:body></w:document>';
    }
    return head + rootOpen + inner + '</w:' + rootName + '>';
  }

  // Häufig genutzte Image-Mime-Type-Helfer
  function downloadBlob(name, blob){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  // ── DOM / Datei handling ──
  function run(){
    var file = E('wfe-file');
    var output = E('tool-output');
    if (!file || !output) return;
    if (!file.files || !file.files.length) { output.innerHTML = '<p class="text-muted">' + (DE ? 'Bitte eine Word-Datei (.docx) wählen.' : 'Please select a Word (.docx) file.') + '</p>'; return; }
    if (typeof JSZip === 'undefined') { output.innerHTML = '<p class="text-muted">' + (DE ? 'Word-Bibliothek konnte nicht geladen werden.' : 'Word library could not be loaded.') + '</p>'; return; }
    var f = file.files[0];
    output.innerHTML = '<p class="text-muted">' + (DE ? 'Formatierung wird entfernt…' : 'Removing formatting…') + '</p>';

    var reader = new FileReader();
    reader.onload = function(e){
      JSZip.loadAsync(e.target.result).then(function(zip){
        var partNames = Object.keys(zip.files);
        var mainParts = partNames.filter(function(p){
          return /^word\/(document|header\d*|footer\d*)\.xml$/.test(p);
        });
        // Tabellen-Inhalt zählt als Text, keine eigenen Parts nötig.
        var jobs = mainParts.map(function(p){
          return zip.file(p).async('string').then(function(xml){ return { path: p, xml: stripDocPart(xml) }; });
        });
        return Promise.all(jobs).then(function(clean){
          var outZip = new JSZip();
          // Alles kopieren, veränderte Hauptteile durch saubere Versionen ersetzen
          var jobs2 = [];
          partNames.forEach(function(path){
            var entry = zip.files[path];
            if (entry.dir) return;
            jobs2.push(entry.async('uint8array').then(function(raw){ outZip.file(path, raw); }));
          });
          return Promise.all(jobs2).then(function(){
            clean.forEach(function(c){ outZip.file(c.path, c.xml); });
            return outZip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          });
        }).then(function(blob){
          var name = f.name.replace(/\.docx$/i, '') + '-ohne-formatierung.docx';
          output.innerHTML =
            '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">' +
              (DE ? 'Alle Formatierungen wurden entfernt. Der Text bleibt mit Absatz- und Zeilenumbrüchen erhalten.' : 'All formatting was removed. The text keeps its paragraphs and line breaks.') +
            '</div>' +
            '<div><a class="btn btn-primary" id="wfe-dl" href="#">' + (DE ? 'Sauberes Word-Dokument herunterladen' : 'Download clean Word document') + '</a></div>' +
            '<div style="margin-top:10px;padding:10px 12px;border:1px solid var(--warn-border,rgba(224,145,95,.4));border-radius:8px;background:var(--warn-bg,rgba(224,145,95,.08));color:var(--text-muted);font-size:0.82rem">' +
              '<strong>' + (DE ? 'Hinweis:' : 'Note:') + '</strong> ' +
              (DE ? 'Tabellen werden zu einfachen Absätzen vereinfacht, damit keine Formatierungsreste erhalten bleiben. Prüfe das Ergebnis bei wichtigen Dokumenten selbst.' : 'Tables are simplified into plain paragraphs so no formatting remnants survive. Please review the result yourself for important documents.') +
            '</div>';
          var dl = E('wfe-dl');
          dl.href = URL.createObjectURL(blob);
          dl.download = name;
        });
      });
    };
    reader.onerror = function(){ output.innerHTML = '<p class="text-muted">' + (DE ? 'Die Datei konnte nicht gelesen werden.' : 'The file could not be read.') + '</p>'; };
    reader.readAsArrayBuffer(f);
  }

  function buildUI(){
    var inputs = E('tool-inputs');
    var output = E('tool-output');
    if (!inputs || !output) return;

    var lbl = document.createElement('label'); lbl.className = 'file-label';
    lbl.textContent = DE ? 'Word-Datei (.docx) wählen' : 'Select Word file (.docx)';
    inputs.appendChild(lbl);
    var fi = document.createElement('input'); fi.type = 'file'; fi.id = 'wfe-file';
    fi.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'; fi.className = 'form-control';
    inputs.appendChild(fi);

    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Alle Formatierungen entfernen' : 'Remove all formatting';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);

    output.innerHTML = '<p class="text-muted">' + (DE ? 'Wähle eine Word-Datei (.docx). Alle Formatierungen wie Fett, Kursiv, Schrift, Farbe, Ausrichtung und Abstände werden lokal in deinem Browser entfernt. Übrig bleibt der reine Text, den du frei neu formatieren kannst. Es wird nichts hochgeladen.' : 'Select a Word (.docx) file. All formatting like bold, italic, fonts, colors, alignment and spacing is removed locally in your browser. What remains is the plain text you can freely reformat. Nothing is uploaded.') + '</p>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeXml: escapeXml, splitParagraphs: splitParagraphs, paraToText: paraToText, buildCleanParagraph: buildCleanParagraph, extractSectPr: extractSectPr, stripDocPart: stripDocPart };
  }
})();
