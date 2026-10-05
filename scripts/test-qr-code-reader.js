/* Node unit tests for qr-code-reader pure decode engine (DOM stubbed). */
'use strict'
const fs = require('fs')
const path = require('path')

// Minimal DOM stub so require() doesn't throw on buildUI()
const el = () => ({ innerHTML: '', value: '', appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } })
global.document = {
  readyState: 'complete',
  getElementById: () => el(),
  createElement: () => el(),
  addEventListener() {},
}
global.window = {}

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/qr-code-reader.js'), 'utf8')
const mod = { exports: {} }
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window)
const { decodeImageData } = mod.exports

let pass = 0, fail = 0
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name) }
  else { fail++; console.log('  FAIL ' + name) }
}

// (a) Stub jsQR that returns {data:'HALLO-WELT'}
global.jsQR = function () { return { data: 'HALLO-WELT' } }
{
  var dummyData = new Uint8ClampedArray([0, 0, 0, 255])
  var result = decodeImageData({ data: dummyData }, 1, 1)
  assert('jsQR returns data -> text is HALLO-WELT, error null', result.text === 'HALLO-WELT' && result.error === null)
}

// (b) jsQR returns null -> error='not-found'
global.jsQR = function () { return null }
{
  var dummyData = new Uint8ClampedArray([0, 0, 0, 255])
  var result = decodeImageData({ data: dummyData }, 1, 1)
  assert('jsQR returns null -> error is not-found', result.text === null && result.error === 'not-found')
}

// (c) jsQR undefined -> error='no-jsqr'
delete global.jsQR
{
  var dummyData = new Uint8ClampedArray([0, 0, 0, 255])
  var result = decodeImageData({ data: dummyData }, 1, 1)
  assert('jsQR undefined -> error is no-jsqr', result.text === null && result.error === 'no-jsqr')
}

console.log('\n' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
