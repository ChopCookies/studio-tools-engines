// Node unit test for a4-bilder-zu-pdf layout() geometry + real pdf-lib A4 build.
// Run: node scripts/test-a4-bilder-zu-pdf.js  (from project root)
'use strict';
const path = require('path');
const assert = require('assert');
const fs = require('fs');
const os = require('os');

// Minimal DOM/URL/atob stubs so requiring the tool doesn't throw on buildUI()
global.window = { __siteLang: 'de' };
const fakeEl = () => ({
  files: [], appendChild(){}, addEventListener(){}, setAttribute(){},
  style:{}, value:'', className:'', textContent:'', type:'', id:'', accept:''
});
global.document = {
  readyState: 'complete',
  getElementById: () => fakeEl(),
  createElement: () => fakeEl(),
  addEventListener(){}
};
global.URL = { createObjectURL: () => 'blob:test' };
global.FileReader = function(){};
global.addEventListener = function(){};
const PDFLib = require('pdf-lib');

const mod = require(path.resolve('public/assets/js/a4-bilder-zu-pdf.js'));
const { layout } = mod;

const TOL = 0.01;
function near(a,b){ return Math.abs(a-b) < TOL; }

// 1) Portrait image -> A4 portrait page
let r = layout(1000, 1400, { orient:'auto', mode:'contain', margin:24 });
assert.strictEqual(r.pageWidth, 595.28, 'portrait page width');
assert.strictEqual(r.pageHeight, 841.89, 'portrait page height');
assert.ok(r.width <= 595.28-48 && r.height <= 841.89-48, 'contain within margins');
assert.ok(near(r.width/r.height, 1000/1400), 'aspect preserved (portrait)');
// centered
assert.ok(near(r.x + r.width/2, 595.28/2) && near(r.y + r.height/2, 841.89/2), 'centered portrait');

// 2) Landscape image -> A4 landscape page (auto)
r = layout(1600, 900, { orient:'auto', mode:'contain', margin:24 });
assert.strictEqual(r.pageWidth, 841.89, 'landscape auto = landscape A4');
assert.strictEqual(r.pageHeight, 595.28, 'landscape auto = landscape A4 h');
assert.ok(near(r.width/r.height, 1600/900), 'aspect preserved (landscape)');

// 3) Forced portrait keeps portrait page even for landscape image
r = layout(1600, 900, { orient:'portrait', mode:'contain', margin:24 });
assert.strictEqual(r.pageWidth, 595.28, 'forced portrait w');
assert.strictEqual(r.pageHeight, 841.89, 'forced portrait h');

// 4) Forced landscape
r = layout(1000, 1400, { orient:'landscape', mode:'contain', margin:24 });
assert.strictEqual(r.pageWidth, 841.89, 'forced landscape w');
assert.strictEqual(r.pageHeight, 595.28, 'forced landscape h');

// 5) fill mode covers full page
r = layout(1000, 1400, { orient:'auto', mode:'fill', margin:24 });
assert.ok(r.width >= 595.28-48 && r.height >= 841.89-48, 'fill covers content area');

// 6) no margin -> image fills to page edge in contain for matching ratio
r = layout(595.28, 841.89, { orient:'portrait', mode:'contain', margin:0 });
assert.ok(near(r.width, 595.28) && near(r.height, 841.89), 'margin 0 exact fill');

console.log('Layout tests passed.');

// Real pdf-lib build -> assert every page is A4
(async () => {
  // tiny 2x3 PNG (portrait) and 4x2 PNG (landscape)
  function png(w,h){
    // minimal 1x1-ish PNG; we only need decode dims from IHDR via pdf-lib
    // Build a real small RGBA PNG with zlib.
    const zlib = require('zlib');
    function crc32(buf){ let c=~0; for(let i=0;i<buf.length;i++){ c^=buf[i]; for(let k=0;k<8;k++) c=(c>>>1)^(0xEDB88320&-(c&1)); } return (c^~0)>>>0; }
    const sig=Buffer.from([137,80,78,71,13,10,26,10]);
    const ihdr=Buffer.alloc(13);
    ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
    ihdr[8]=8; ihdr[9]=6; // 8-bit RGBA
    function chunk(type,data){
      const t=Buffer.from(type,'ascii'); const len=Buffer.alloc(4); len.writeUInt32BE(data.length,0);
      const d=Buffer.concat([t,data]);
      const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(d),0);
      return Buffer.concat([len,d,crc]);
    }
    // raw scanlines with filter byte 0
    const raw=Buffer.alloc(h*(1+w*4));
    for(let y=0;y<h;y++){ raw[y*(1+w*4)]=0; for(let x=0;x<w;x++){ const i=y*(1+w*4)+1+x*4; raw[i]=255; raw[i+1]=255; raw[i+2]=255; raw[i+3]=255; } }
    const idat=zlib.deflateSync(raw);
    return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
  }

  const doc = await PDFLib.PDFDocument.create();
  const p1 = await doc.embedPng(png(200,300));   // portrait
  const p2 = await doc.embedPng(png(400,200));   // landscape
  for (const img of [p1, p2]) {
    const rect = layout(img.width, img.height, { orient:'auto', mode:'contain', margin:24 });
    const page = doc.addPage([rect.pageWidth, rect.pageHeight]);
    page.drawRectangle({ x:0,y:0,width:rect.pageWidth,height:rect.pageHeight,color:PDFLib.rgb(1,1,1) });
    page.drawImage(img, { x:rect.x,y:rect.y,width:rect.width,height:rect.height });
  }
  const bytes = await doc.save();
  assert.ok(bytes[0]===0x25 && bytes[1]===0x50 && bytes[2]===0x44 && bytes[3]===0x46, 'PDF head %PDF');
  assert.ok(bytes.length>0, 'non-empty PDF');

  // Verify page boxes are A4 by re-reading with pdf-lib
  const parsed = await PDFLib.PDFDocument.load(bytes);
  assert.strictEqual(parsed.getPageCount(), 2, '2 pages');
  const sizes = parsed.getPages().map(p => { const s=p.getSize(); return [s.width, s.height]; });
  const a4p=[595.28,841.89], a4l=[841.89,595.28];
  const isA4 = sizes.every(s => (Math.abs(s[0]-a4p[0])<1 && Math.abs(s[1]-a4p[1])<1) || (Math.abs(s[0]-a4l[0])<1 && Math.abs(s[1]-a4l[1])<1));
  assert.ok(isA4, 'all pages are A4 (portrait or landscape)');
  console.log('PDF build OK. Page sizes:', JSON.stringify(sizes));
  const outPdf = path.join(os.tmpdir(), 'a4-bilder-zu-pdf-test.pdf');
  fs.writeFileSync(outPdf, bytes);
  console.log('Wrote ' + outPdf);
})();
