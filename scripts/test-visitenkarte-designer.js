/* Node unit tests for visitenkarte-designer pure functions.
   Tests cardGrid, renderCardData, contactLines.
   Run: node scripts/test-visitenkarte-designer.js  (from project root)
*/
'use strict'
var path = require('path')
var fs = require('fs')

// Minimal DOM/URL/Window stubs so requiring the tool does not throw on buildUI()
global.window = { __siteLang: 'de', esc: function(s){ return s }, URL: { createObjectURL: function(){} } }
var fakeEl = function() {
  return {
    innerHTML: '', value: '', appendChild: function(){}, addEventListener: function(){},
    querySelector: function(){ return { addEventListener: function(){} }; },
    setAttribute: function(){}, style: {}, className: '', textContent: '',
    type: '', id: '', accept: '', files: [], tagName: '', options: [], parentNode: {},
    getElementsByTagName: function(){ return []; }, getContext: function(){ return { clearRect: function(){}, fillRect: function(){}, fillText: function(){}, beginPath: function(){}, stroke: function(){}, drawImage: function(){}, createPattern: function(){}, fill: function(){}, strokeStyle: '', fillStyle: '', font: '', lineWidth: '', textAlign: '', save: function(){}, restore: function(){} }},
    getElementById: function(){ return fakeEl() }, createElement: function(){ return fakeEl() }
  }
}
global.document = {
  readyState: 'complete',
  getElementById: function(){ return fakeEl() },
  createElement: function(){ return fakeEl() },
  addEventListener: function(){},
  body: { appendChild: function(){}, removeChild: function(){} }
}
global.URL = { createObjectURL: function(){}, revokeObjectURL: function(){} }

// Load the tool module via require - the IIFE exposes module.exports for node
var mod = require(path.resolve('public/assets/js/visitenkarte-designer.js'))
var cardGrid = mod.cardGrid
var renderCardData = mod.renderCardData
var contactLines = mod.contactLines

var pass = 0, fail = 0
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name) }
  else { fail++; console.log('  FAIL ' + name) }
}

// (a) cardGrid(10) -> array of 10 positions on A4, 2 cols x 5 rows
var grid = cardGrid(10)
assert('cardGrid(10) returns 10 positions', grid.length === 10)
assert('all positions have x, y, w, h', grid.every(function(p){ return p.x !== undefined && p.y !== undefined && p.w !== undefined && p.h !== undefined }))
assert('cards fit within A4 width (595.28pt)', grid.every(function(p){ return p.x + p.w <= 595.28 + 0.01 }))
assert('cards fit within A4 height (841.89pt)', grid.every(function(p){ return p.y + p.h <= 841.89 + 0.01 }))
assert('two columns: col 0 x < col 1 x', grid[0].x < grid[1].x)
assert('five rows: row 0 y < row 1 y', grid[0].y < grid[5].y)
assert('all cards same width', grid.every(function(p){ return Math.abs(p.w - grid[0].w) < 0.01 }))
assert('all cards same height', grid.every(function(p){ return Math.abs(p.h - grid[0].h) < 0.01 }))

// cardGrid(1) -> single centered card
var g1 = cardGrid(1)
assert('cardGrid(1) returns 1 position', g1.length === 1)
assert('single card centered horizontally', Math.abs(g1[0].x + g1[0].w/2 - 595.28/2) < 1)
assert('single card centered vertically', Math.abs(g1[0].y + g1[0].h/2 - 841.89/2) < 1)

// (b) renderCardData(state) -> normalized copy with defaults
var state = { company: 'Mueller GmbH', name: 'Hans Mueller', title: 'Geschftsfhrer', phone: '+49 89 1234' }
var data = renderCardData(state)
assert('renderCardData returns object', data !== null && typeof data === 'object')
assert('company preserved', data.company === 'Mueller GmbH')
assert('name preserved', data.name === 'Hans Mueller')
assert('title preserved', data.title === 'Geschftsfhrer')
assert('phone preserved', data.phone === '+49 89 1234')
assert('defaults: template is modern', data.template === 'modern')
assert('defaults: accentColor is #2c3e7a', data.accentColor === '#2c3e7a')
assert('defaults: fontFamily is sans', data.fontFamily === 'sans')
assert('defaults: logoDataUrl is null', data.logoDataUrl === null)
assert('returns a copy, not original', data !== state)

// trim and whitespace normalization
var state2 = { name: '  Max  ', company: '  ', email: '  max@test.de  ' }
var data2 = renderCardData(state2)
assert('name is trimmed', data2.name === 'Max')
assert('empty company becomes empty string', data2.company === '')
assert('email is trimmed', data2.email === 'max@test.de')

// (c) contactLines(state) -> array of non-empty contact display lines
var full = { phone: '+49 89 1234', mobile: '+49 171 555', email: 'h@test.de', web: 'https://test.de' }
var lines = contactLines(full)
assert('contactLines returns 4 lines', lines.length === 4)
assert('all lines have icon and text', lines.every(function(l){ return l.icon && l.text }))
assert('phone line present', lines.some(function(l){ return l.text === '+49 89 1234' }))
assert('all lines are non-empty', lines.every(function(l){ return l.text.trim().length > 0 }))

var empty = contactLines({})
assert('contactLines with empty state returns 0 lines', empty.length === 0)

var partial = contactLines({ phone: '+49 123' })
assert('contactLines with only phone returns 1 line', partial.length === 1)
assert('phone line has correct label', partial[0].label === 'Telefon')

console.log('\n' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
