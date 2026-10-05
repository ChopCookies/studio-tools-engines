/* ══════════════════════════════════════════════════
   qr-code-reader.js — QR-Code-Reader Tool
   Dekodiert einen QR-Code aus einem hochgeladenen Bild.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict'

  function E(id) { return document.getElementById(id) }
  function esc(s) {
    if (window.esc) return window.esc(s)
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  /* -------- pure decode engine (node-testable) -------- */

  function decodeImageData(imageData, width, height) {
    if (typeof globalThis.jsQR !== 'function') {
      return { text: null, error: 'no-jsqr' }
    }
    var result = jsQR(imageData.data, width, height, { inversionAttempts: 'dontInvert' })
    if (result === null) {
      return { text: null, error: 'not-found' }
    }
    return { text: result.data, error: null }
  }

  function runFromDataUrl(dataUrl) {
    var img = new Image()
    img.onload = function () {
      var canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      var ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      var decoded = decodeImageData(imageData, canvas.width, canvas.height)
      if (typeof window.__qrDecodeCallback === 'function') {
        window.__qrDecodeCallback(decoded)
      }
    }
    img.onerror = function () {
      if (typeof window.__qrDecodeCallback === 'function') {
        window.__qrDecodeCallback({ text: null, error: 'load-error' })
      }
    }
    img.src = dataUrl
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader()
      reader.onload = function (e) { resolve(e.target.result) }
      reader.onerror = function (e) { reject(e.target.error) }
      reader.readAsDataURL(file)
    })
  }

  /* -------- UI -------- */

  function renderResult(decoded) {
    var el = E('tool-output')
    if (!el) return
    if (decoded.error === 'no-jsqr') {
      el.innerHTML = '<p class="muted">Die jsQR-Bibliothek ist nicht verfügbar.</p>'
      return
    }
    if (decoded.error === 'not-found') {
      el.innerHTML = '<p class="muted">Kein QR-Code erkannt.</p>'
      return
    }
    if (decoded.error === 'load-error') {
      el.innerHTML = '<p class="muted">Bild konnte nicht geladen werden.</p>'
      return
    }
    var text = esc(decoded.text)
    el.innerHTML =
      '<div class="result-display">' +
        '<div style="margin-bottom:10px;font-size:.82rem;color:var(--mut)">QR-Code erfolgreich dekodiert</div>' +
        '<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85rem;background:#0b1218;border:1px solid var(--line);border-radius:8px;padding:12px;word-break:break-all;user-select:text;white-space:pre-wrap">' + text + '</div>' +
        '<div style="margin-top:12px"><button class="btn-app" type="button" id="qr-copy-btn">Ergebnis kopieren</button></div>' +
      '</div>'
    var copyBtn = E('qr-copy-btn')
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var txt = decoded.text
        if (window.copyToClipboard) window.copyToClipboard(txt)
        else if (navigator.clipboard) navigator.clipboard.writeText(txt)
      })
    }

    // Playbook integration: report this finished step (client-side only),
    // placed after the success render only, so a not-found, no-jsqr or
    // load-error run never marks the step done.
    if (decoded.text && window.playbook) window.playbook.report({ tool: 'qr-code-reader', summary: 'QR-Code gelesen' });
  }

  function handleFile(file) {
    if (!file) return
    readFileAsDataUrl(file).then(function (dataUrl) {
      window.__qrDecodeCallback = function (decoded) { renderResult(decoded) }
      runFromDataUrl(dataUrl)
    }).catch(function () {
      var el = E('tool-output')
      if (el) el.innerHTML = '<p class="muted">Fehler beim Lesen der Datei.</p>'
    })
  }

  function buildUI() {
    var inputs = E('tool-inputs')
    if (!inputs) return
    inputs.innerHTML =
      '<div class="field">' +
        '<label>Bild hochladen (QR-Code im Bild)</label>' +
        '<input type="file" id="qr-file-input" accept="image/*">' +
      '</div>' +
      '<p class="muted" style="margin-top:6px">Wähle ein Foto oder einen Screenshot, der einen QR-Code enthält. Der Code wird direkt im Browser dekodiert.</p>'
    var fileInput = E('qr-file-input')
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length > 0) {
          handleFile(e.target.files[0])
        }
      })
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI)
  else buildUI()

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { decodeImageData: decodeImageData, runFromDataUrl: runFromDataUrl, readFileAsDataUrl: readFileAsDataUrl }
  }
})()
