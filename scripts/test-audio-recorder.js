// scripts/test-audio-recorder.js | node unit tests for the audio-recorder engine
// Run: node scripts/test-audio-recorder.js
'use strict';

global.window = { __siteLang: 'de' };
global.document = {
  readyState: 'complete',
  addEventListener: function () {},
  getElementById: function () { return null; }
};
Object.defineProperty(global, 'navigator', {
  value: { mediaDevices: { enumerateDevices: function(){ return Promise.resolve([]); } } },
  configurable: true
});
global.requestAnimationFrame = function () {};

const path = require('path');
const m = require(path.join(__dirname, '..', 'public', 'assets', 'js', 'audio-recorder.js'));

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function near(a, b, tol, name) { ok(Math.abs(a - b) <= (tol || 1e-9), name + ' (' + a + ' vs ' + b + ')'); }

// --- exports present ---
['dbToGain', 'rms', 'applyGate', 'encodeWav16', 'concatChannels', 'interleaveChannels', 'fmtDuration', 'fmtBytes'].forEach(function (k) {
  ok(typeof m[k] === 'function', 'exports.' + k + ' is a function');
});

// --- dbToGain ---
near(m.dbToGain(0), 1, 1e-9, 'dbToGain(0)=1');
near(m.dbToGain(6), Math.pow(10, 6 / 20), 1e-9, 'dbToGain(6) ~= 1.995');
near(m.dbToGain(-12), Math.pow(10, -12 / 20), 1e-9, 'dbToGain(-12) ~= 0.251');

// --- rms ---
near(m.rms([0, 0, 0]), 0, 1e-9, 'rms silence = 0');
near(m.rms([1, -1, 1, -1]), 1, 1e-6, 'rms square wave = 1');
near(m.rms([0.5, -0.5]), 0.5, 1e-6, 'rms 0.5');
near(m.rms([]), 0, 1e-9, 'rms empty = 0');

// --- applyGate ---
// gate OFF: passthrough (input unchanged)
const sig = [0.5, -0.3, 0.2, 0.0, 0.7, -0.7];
const off = m.applyGate(sig, { on: false });
near(off[0], 0.5, 1e-6, 'gate off passthrough [0]');
near(off[4], 0.7, 1e-6, 'gate off passthrough [4]');
ok(off.length === sig.length, 'gate off length preserved');

// gate ON, loud signal -> stays ~unchanged (envelope opens toward 1)
const loud = new Array(480).fill(0.5);
const gLoud = m.applyGate(loud, { thresholdDb: -60, floorDb: -80, attackS: 0.01, releaseS: 0.1, sampleRate: 48000, on: true });
near(gLoud[gLoud.length - 1], 0.5, 0.05, 'loud block ends near input (gate open)');

// gate ON, silence (0) -> stays 0
const sil = new Array(480).fill(0);
const gSil = m.applyGate(sil, { thresholdDb: -60, floorDb: -80, attackS: 0.01, releaseS: 0.1, sampleRate: 48000, on: true });
ok(gSil[gSil.length - 1] === 0, 'silence stays 0');

// gate ON, very quiet signal (below threshold) -> gate fully closes over a 2 s block
const quiet = new Array(2 * 48000).fill(0.0005); // ~ -66 dBFS, below -60 dB threshold
const gQuiet = m.applyGate(quiet, { thresholdDb: -60, floorDb: -80, attackS: 0.01, releaseS: 0.1, sampleRate: 48000, on: true });
ok(gQuiet[gQuiet.length - 1] < 1e-6, 'quiet signal fully gated after 2 s (tail ' + gQuiet[gQuiet.length - 1] + ')');

// input never mutated
const before = sig.slice();
m.applyGate(sig, { on: true });
let mut = false;
for (let i = 0; i < sig.length; i++) if (sig[i] !== before[i]) mut = true;
ok(!mut, 'applyGate does not mutate input');

// --- encodeWav16 ---
const sr = 48000;
const wav = m.encodeWav16([0, 0.5, -0.5, 1, -1, 0.25], sr);
ok(!!wav && wav.byteLength === 44 + 6 * 2, 'wav length = 44 + 12 bytes');
const dv = new DataView(wav);
const riff = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
ok(riff === 'RIFF', 'wav RIFF magic');
const wave = String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11));
ok(wave === 'WAVE', 'wav WAVE tag');
ok(dv.getUint32(24, true) === sr, 'wav sampleRate = 48000');
ok(dv.getUint16(22, true) === 1, 'wav mono (1 channel)');
ok(dv.getUint16(34, true) === 16, 'wav 16-bit');
ok(dv.getUint32(40, true) === 12, 'wav data size = 12');
ok(m.encodeWav16([], 48000) === null, 'wav empty -> null');

// peak values saturate rather than overflow (int16 range)
const peakWav = m.encodeWav16([2, -2], sr);
const pk0 = new DataView(peakWav).getInt16(44, true);
ok(Math.abs(pk0) <= 32767 && pk0 >= 0, 'gain peak saturates to int16 max (' + pk0 + ')');

// --- concatChannels (pause-gated chunk joining) ---
ok(m.concatChannels([]) === null, 'concatChannels empty -> null');
ok(m.concatChannels(null) === null, 'concatChannels null -> null');
// two mono chunks -> one 2+3-length channel
const cMono = m.concatChannels([[new Float32Array([0.1, 0.2])], [new Float32Array([0.3, 0.4, 0.5])]]);
ok(!!cMono && cMono.length === 1 && cMono[0].length === 5, 'concat mono => 1 channel of 5');
near(cMono[0][2], 0.3, 1e-6, 'concat mono seq preserved at idx2');
// stereo chunks -> 2 channels each merged across the pause boundary
const cStereo = m.concatChannels([
  [new Float32Array([1, 2]), new Float32Array([10, 20])],
  [new Float32Array([3, 4, 5]), new Float32Array([30, 40, 50])]
]);
ok(!!cStereo && cStereo.length === 2 && cStereo[0].length === 5 && cStereo[1].length === 5, 'concat stereo => 2 channels of 5');
near(cStereo[0][4], 5, 1e-9, 'concat stereo L tail');
near(cStereo[1][2], 30, 1e-9, 'concat stereo R seq preserved');

// --- interleaveChannels (stereo WAV + ffmpeg f32le path) ---
ok(m.interleaveChannels(null) === null, 'interleave null -> null');
const monoI = m.interleaveChannels([new Float32Array([0.1, 0.2, 0.3])]);
ok(monoI.length === 3 && Math.abs(monoI[0] - 0.1) < 1e-6 && Math.abs(monoI[2] - 0.3) < 1e-6, 'interleave mono identity');
const stI = m.interleaveChannels([new Float32Array([1, 2]), new Float32Array([10, 20])]);
ok(stI.length === 4 && stI[0] === 1 && stI[1] === 10 && stI[2] === 2 && stI[3] === 20, 'interleave stereo L0 R0 L1 R1');

// --- encodeWav16 multi-channel ---
// back-compat: flat mono array still yields mono WAV
const flatWav = m.encodeWav16([0, 0.5, -0.5, 1, -1, 0.25], sr);
ok(new DataView(flatWav).getUint16(22, true) === 1, 'flat input stays mono (1 channel)');
ok(flatWav.byteLength === 44 + 6 * 2, 'flat mono wav length');
// stereo list -> 2-channel interleaved WAV
const stWav = m.encodeWav16([new Float32Array([1, -1]), new Float32Array([0, 0])], sr);
const sdv = new DataView(stWav);
ok(!!stWav, 'stereo wav non-null');
ok(sdv.getUint16(22, true) === 2, 'stereo wav 2 channels');
ok(sdv.getUint32(24, true) === sr, 'stereo wav sampleRate');
ok(stWav.byteLength === 44 + 2 * 2 * 2, 'stereo wav length = 44 + (2 samples x 2ch x 2B)');
ok(sdv.getInt16(44, true) > 0 && sdv.getInt16(46, true) === 0, 'stereo L0 sampled, R0=0 interleaved');
ok(sdv.getInt16(48, true) < 0, 'stereo L1 negative sample interleaved at frame 2');

// --- fmtDuration / fmtBytes ---
ok(m.fmtDuration(0) === '0:00', 'fmtDuration 0');
ok(m.fmtDuration(65) === '1:05', 'fmtDuration 65 = 1:05');
ok(m.fmtDuration(3605) === '60:05', 'fmtDuration 3605 = 60:05');
ok(m.fmtBytes(500) === '500 B', 'fmtBytes 500 B');
ok(m.fmtBytes(2048) === '2.0 KB', 'fmtBytes 2048 = 2.0 KB');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
