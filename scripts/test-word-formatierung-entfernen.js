// Node unit test for word-formatierung-entfernen strip logic.
// Run: node scripts/test-word-formatierung-entfernen.js
'use strict';
const path = require('path');
const assert = require('assert');

// DOM stubs so requiring the tool doesn't throw on buildUI()
global.window = { __siteLang: 'de' };
const fakeEl = () => ({ files:[], appendChild(){}, addEventListener(){}, setAttribute(){}, style:{}, value:'', className:'', textContent:'', type:'', id:'', accept:'' });
global.document = { readyState:'complete', getElementById:()=>fakeEl(), createElement:()=>fakeEl(), addEventListener(){} };
global.URL = { createObjectURL:()=>'', revokeObjectURL:()=>{} };
global.FileReader = function(){};
global.addEventListener = function(){};

const mod = require(path.resolve('public/assets/js/word-formatierung-entfernen.js'));
const { escapeXml, splitParagraphs, paraToText, buildCleanParagraph, extractSectPr, stripDocPart } = mod;

// 1) escapeXml
assert.strictEqual(escapeXml('a<b>&c"d'), 'a&lt;b&gt;&amp;c&quot;d', 'escapeXml');

// 2) splitParagraphs — nested paragraph in a table cell plus top-level
const xml = '<w:body>' +
  '<w:p><w:r><w:t>Hello</w:t></w:r></w:p>' +
  '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell1</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
  '<w:p><w:r><w:t>World</w:t></w:r></w:p>' +
  '</w:body>';
const paras = splitParagraphs(xml);
assert.strictEqual(paras.length, 3, '3 paragraphs (incl. nested in table)');
assert.ok(paras[1].indexOf('Cell1') !== -1, 'nested table paragraph captured');

// 3) paraToText — strips formatting, keeps text/line/tab, drops delText/instrText
const richPara = '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>' +
  '<w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>Bold red</w:t></w:r>' +
  '<w:r><w:br/></w:r>' +
  '<w:r><w:rPr><w:i/></w:rPr><w:t>after break</w:t></w:r>' +
  '<w:r><w:tab/><w:t>tabbed</w:t></w:r>' +
  '<w:del><w:delText>deleted</w:delText></w:del>' +
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r>' +
  '</w:p>';
assert.strictEqual(paraToText(richPara), 'Bold red\nafter break\ttabbed', 'paraToText strips runs, keeps br/tab, drops del/instr');
// page break should NOT produce a newline
assert.strictEqual(paraToText('<w:p><w:r><w:t>A</w:t></w:r><w:r><w:br w:type="page"/></w:r><w:r><w:t>B</w:t></w:r></w:p>'), 'AB', 'manual page break dropped (no range feature)');

// 4) buildCleanParagraph — clean output, escaped, empty->selfclosing
const clean = buildCleanParagraph('Line1\nLine&2');
assert.strictEqual(clean, '<w:p><w:r><w:t xml:space="preserve">Line1</w:t></w:r><w:r><w:br/></w:r><w:r><w:t xml:space="preserve">Line&amp;2</w:t></w:r></w:p>', 'clean paragraph with line break + escaping');
assert.strictEqual(buildCleanParagraph(''), '<w:p/>', 'empty paragraph self-closing');
assert.strictEqual(buildCleanParagraph('x'), '<w:p><w:r><w:t xml:space="preserve">x</w:t></w:r></w:p>', 'single line');

// 5) extractSectPr — grabs trailing section props
const withSect = '<w:body><w:p><w:r><w:t>x</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body>';
assert.strictEqual(extractSectPr(withSect), '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>', 'extracts sectPr');

// 6) stripDocPart — full document: keeps namespaces, no formatting tags, sectPr preserved
const docXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:body>' +
  '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Title </w:t></w:r><w:r><w:rPr><w:i/><w:color w:val="00FF00"/></w:rPr><w:t>sub</w:t></w:r></w:p>' +
  '<w:p><w:r><w:rPr><w:sz w:val="48"/></w:rPr><w:t>Body text</w:t></w:r></w:p>' +
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>' +
  '</w:body></w:document>';
const out = stripDocPart(docXml);
assert.ok(out.indexOf('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"') !== -1, 'namespaces kept');
assert.ok(out.indexOf('<w:pPr>') === -1 && out.indexOf('<w:rPr>') === -1, 'no pPr/rPr formatting');
assert.ok(out.indexOf('<w:b/>') === -1 && out.indexOf('<w:i/>') === -1 && out.indexOf('w:color') === -1 && out.indexOf('<w:sz ') === -1 && out.indexOf('w:jc ') === -1, 'no formatting attrs');
assert.ok(out.indexOf('Title sub') !== -1, 'run text concatenated');
assert.ok(out.indexOf('Body text') !== -1, 'body text kept');
assert.ok(out.indexOf('<w:sectPr>') !== -1, 'sectPr preserved');
assert.ok(out.indexOf('<w:body>') !== -1 && out.indexOf('</w:document>') !== -1, 'document shell intact');

// 7) stripDocPart on header part (no body wrapper)
const hdrXml = '<w:hdr xmlns:w="w"><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>MyHeader</w:t></w:r></w:p></w:hdr>';
const hdrOut = stripDocPart(hdrXml);
assert.ok(hdrOut.indexOf('<w:rPr>') === -1 && hdrOut.indexOf('MyHeader') !== -1 && hdrOut.indexOf('</w:hdr>') !== -1, 'header stripped');

// 8) non-document part (e.g. settings.xml) untouched
const settings = '<w:settings><w:foo/></w:settings>';
assert.strictEqual(stripDocPart(settings), settings, 'non doc/hdr/ftr untouched');

console.log('ALL word-formatierung tests passed.');
