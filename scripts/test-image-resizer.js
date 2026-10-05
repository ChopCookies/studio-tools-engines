// Node unit tests for image-resizer pure logic (computeOutput / injectSvgSize).
// Run: node scripts/test-image-resizer.js
'use strict';
var assert = require('assert');

// Stub DOM/window so the IIFE's setup() no-ops but module.exports is reachable.
global.window = { __siteLang: 'de', addEventListener: function(){} };
global.document = {
  readyState: 'complete',
  addEventListener: function(){},
  createElement: function(){ return { type:'', className:'', textContent:'', addEventListener:function(){} }; },
  getElementById: function(){ return null; }
};

var lib = require(require('path').join(__dirname, '..', 'public', 'assets', 'js', 'image-resizer.js'));

var computeOutput = lib.computeOutput;
var injectSvgSize = lib.injectSvgSize;

function eq(actual, expected, label) {
  assert.strictEqual(actual.w, expected.w, label + ' (w)');
  assert.strictEqual(actual.h, expected.h, label + ' (h)');
}

// 1) 0/0 → original
eq(computeOutput(1000, 500, 0, 0, 16384), { w: 1000, h: 500 }, 'original');

// 2) downscale by width
eq(computeOutput(1000, 500, 500, 0, 16384), { w: 500, h: 250 }, 'downscale width');

// 3) UPSCALE by width (previously rejected)
eq(computeOutput(1000, 500, 2000, 0, 16384), { w: 2000, h: 1000 }, 'upscale width');

// 4) height only → width auto
eq(computeOutput(1000, 500, 0, 250, 16384), { w: 500, h: 250 }, 'height only');

// 5) both width+height → contain (fit within both)
eq(computeOutput(1000, 500, 400, 400, 16384), { w: 400, h: 200 }, 'contain both');

// 6) both width+height, height limiting
eq(computeOutput(1000, 500, 4000, 300, 16384), { w: 600, h: 300 }, 'contain height-limited');

// 7) canvas cap
eq(computeOutput(10000, 10000, 50000, 0, 16384), { w: 16384, h: 16384 }, 'cap');

// 8) non-square upscale with height
eq(computeOutput(300, 150, 0, 600, 16384), { w: 1200, h: 600 }, 'upscale height only');

// injectSvgSize
var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M0 0h24v24H0z"/></svg>';
var mod = injectSvgSize(svg, 2400, 1800);
assert.ok(mod.indexOf('width="2400"') !== -1, 'svg width injected');
assert.ok(mod.indexOf('height="1800"') !== -1, 'svg height injected');
assert.ok(mod.indexOf('width="24"') === -1, 'old width removed');
assert.ok(mod.indexOf('viewBox="0 0 24 24"') !== -1, 'viewBox preserved');

// viewBox-only SVG (no intrinsic size)
var svg2 = '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>';
var mod2 = injectSvgSize(svg2, 500, 500);
assert.ok(mod2.indexOf('width="500"') !== -1 && mod2.indexOf('height="500"') !== -1, 'viewBox-only svg sized');
assert.ok(mod2.indexOf('viewBox="0 0 100 100"') !== -1, 'viewBox-only preserved');

// non-string → null
assert.strictEqual(injectSvgSize(null, 10, 10), null, 'null input');

console.log('All image-resizer tests passed');
