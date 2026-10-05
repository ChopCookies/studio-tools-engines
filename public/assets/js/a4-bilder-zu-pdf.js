/* ══════════════════════════════════════════════════
   a4-bilder-zu-pdf.js | Mehrere Bilder zu einer einheitlichen A4-PDF
   Bilder (Fotos von Dokumenten/Seiten) zu einem PDF zusammenfügen.
   Jede Seite ist exakt A4 (einheitliche Seitengröße), Bild wird
   zentriert und proportional platziert. PDFLib (NEEDS_PDF_LIB).
   ══════════════════════════════════════════════════ */
(function() {
  'use strict';
  var DE = (typeof window.__siteLang === 'undefined' || window.__siteLang !== 'en');
  function E(id){ return document.getElementById(id); }

  var PDFLib_ = (typeof PDFLib !== 'undefined') ? PDFLib : null;
  var A4_W = 595.28, A4_H = 841.89; // A4 portrait in pts (iso)

  function fmtBytes(b){
    if (b < 1024) return b.toLocaleString('de-DE') + ' B';
    if (b < 1048576) return (b/1024).toLocaleString('de-DE',{maximumFractionDigits:1}) + ' KB';
    return (b/1048576).toLocaleString('de-DE',{maximumFractionDigits:1}) + ' MB';
  }

  /* Reine Geometrie (node-testbar).
     Gibt Seitenmaße + Bildrechteck zurück, damit jede Seite exakt A4 ist. */
  function layout(imgW, imgH, opt) {
    opt = opt || {};
    var orient = opt.orient || 'auto';      // auto|portrait|landscape
    var mode   = opt.mode   || 'contain';   // contain|fill
    var margin = typeof opt.margin === 'number' ? opt.margin : 24;
    var isLand = imgW > imgH;

    var pw, ph;
    if (orient === 'landscape') { pw = A4_H; ph = A4_W; }
    else if (orient === 'portrait') { pw = A4_W; ph = A4_H; }
    else if (isLand) { pw = A4_H; ph = A4_W; }
    else { pw = A4_W; ph = A4_H; }

    var maxW = pw - 2 * margin, maxH = ph - 2 * margin;
    var scale;
    if (mode === 'fill') {
      scale = Math.max(maxW / imgW, maxH / imgH);
    } else {
      scale = Math.min(maxW / imgW, maxH / imgH);
    }
    var w = imgW * scale, h = imgH * scale;
    return {
      pageWidth: pw, pageHeight: ph,
      x: (pw - w) / 2, y: (ph - h) / 2,
      width: w, height: h, scale: scale
    };
  }

  function readFile(file) {
    return new Promise(function(res, rej) {
      var fr = new FileReader();
      fr.onload = function(){ res(fr.result); };
      fr.onerror = rej;
      fr.readAsArrayBuffer(file);
    });
  }

  function run() {
    var files = E('a4b-files').files || [];
    var out = E('tool-output');
    if (!files.length) {
      out.innerHTML = '<p class="text-muted">' + (DE ? 'Bitte mindestens ein Bild wählen.' : 'Please select at least one image.') + '</p>';
      return;
    }
    if (!PDFLib_) { out.innerHTML = '<p class="text-muted">PDF-Bibliothek konnte nicht geladen werden.</p>'; return; }

    var orient = E('a4b-orient') ? E('a4b-orient').value : 'auto';
    var mode   = E('a4b-mode')   ? E('a4b-mode').value   : 'contain';
    var margin = parseInt(E('a4b-margin') ? E('a4b-margin').value : '24', 10) || 24;

    var opt = { orient: orient, mode: mode, margin: margin };
    var filesArr = Array.prototype.slice.call(files);
    var isJpg = function(n){ return /\.jpe?g$/i.test(n); };

    out.innerHTML = '<p class="text-muted">' + (DE ? 'A4-PDF wird erstellt...' : 'Creating A4 PDF...') + '</p>';

    PDFLib_.PDFDocument.create().then(function(doc) {
      var chain = Promise.resolve();
      filesArr.forEach(function(file) {
        chain = chain.then(function() {
          return readFile(file).then(function(buf) {
            var embed = isJpg(file.name) ? doc.embedJpg(buf) : doc.embedPng(buf);
            return embed.then(function(img) {
              var rect = layout(img.width, img.height, opt);
              var page = doc.addPage([rect.pageWidth, rect.pageHeight]);
              page.drawRectangle({
                x: 0, y: 0, width: rect.pageWidth, height: rect.pageHeight,
                color: PDFLib_.rgb(1, 1, 1)
              });
              page.drawImage(img, {
                x: rect.x, y: rect.y, width: rect.width, height: rect.height
              });
            });
          });
        });
      });
      return chain.then(function() { return doc.save({ useObjectStreams: true }); });
    }).then(function(bytes) {
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      out.innerHTML =
        '<div class="result-box">' +
          '<div class="result-row"><span>' + (DE ? 'Seiten (A4)' : 'Pages (A4)') + '</span><b>' + filesArr.length + '</b></div>' +
          '<div class="result-row"><span>' + (DE ? 'Größe' : 'Size') + '</span><b>' + fmtBytes(blob.size) + '</b></div>' +
          '<div class="result-row"><span>' + (DE ? 'Format' : 'Format') + '</span><b>A4</b></div>' +
        '</div>' +
        '<a class="btn btn-primary" href="' + url + '" download="a4-bilder.pdf">' + (DE ? 'A4-PDF herunterladen' : 'Download A4 PDF') + '</a>';
      if (window.playbook) {
        window.playbook.report({ tool: 'a4-bilder-zu-pdf', summary: (DE ? 'A4-PDF aus ' : 'A4 PDF from ') + filesArr.length + (DE ? ' Bildern' : ' images') });
      }
    }).catch(function(err) {
      out.innerHTML = '<p class="text-muted">❌ ' + (DE ? 'PDF-Fehler: ' : 'PDF error: ') + (err && err.message ? err.message : err) + '</p>';
    });
  }

  function buildUI() {
    var box = E('tool-inputs');

    var fi = document.createElement('input');
    fi.type = 'file'; fi.id = 'a4b-files'; fi.accept = 'image/*'; fi.multiple = true;
    fi.className = 'form-control'; fi.setAttribute('aria-label', DE ? 'Bilder auswählen (mehrere)' : 'Select images (multiple)');
    var lbl = document.createElement('label'); lbl.className = 'file-label';
    lbl.textContent = DE ? 'Bilder auswählen (mehrere Seiten)' : 'Select images (multiple pages)';
    box.appendChild(lbl); box.appendChild(fi);

    // Ausrichtung
    var orLbl = document.createElement('label'); orLbl.className = 'file-label';
    orLbl.textContent = DE ? 'Ausrichtung' : 'Orientation';
    box.appendChild(orLbl);
    var orientSel = document.createElement('select');
    orientSel.id = 'a4b-orient'; orientSel.className = 'form-control';
    [['auto', DE ? 'Automatisch (je Bild)' : 'Auto (per image)'],
     ['portrait', DE ? 'Hochformat' : 'Portrait'],
     ['landscape', DE ? 'Querformat' : 'Landscape']].forEach(function(o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
      orientSel.appendChild(op);
    });
    box.appendChild(orientSel);

    // Anpassen-Modus
    var mdLbl = document.createElement('label'); mdLbl.className = 'file-label';
    mdLbl.textContent = DE ? 'Anpassen' : 'Fit mode';
    box.appendChild(mdLbl);
    var modeSel = document.createElement('select');
    modeSel.id = 'a4b-mode'; modeSel.className = 'form-control';
    [['contain', DE ? 'Anpassen (ganzes Bild)' : 'Fit (whole image)'],
     ['fill', DE ? 'Seite füllen (Bild füllt A4)' : 'Fill (cover A4)']].forEach(function(o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
      modeSel.appendChild(op);
    });
    box.appendChild(modeSel);

    // Rand
    var mgLbl = document.createElement('label'); mgLbl.className = 'file-label';
    mgLbl.textContent = DE ? 'Rand' : 'Margin';
    box.appendChild(mgLbl);
    var marginSel = document.createElement('select');
    marginSel.id = 'a4b-margin'; marginSel.className = 'form-control';
    [['0', DE ? 'Kein Rand' : 'None'],
     ['24', DE ? 'Klein' : 'Small'],
     ['48', DE ? 'Mittel' : 'Medium']].forEach(function(o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
      marginSel.appendChild(op);
    });
    marginSel.value = '24';
    box.appendChild(marginSel);

    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'A4-PDF erstellen' : 'Create A4 PDF';
    box.appendChild(btn);
    btn.addEventListener('click', run);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { layout: layout, A4_W: A4_W, A4_H: A4_H };
  }
})();
