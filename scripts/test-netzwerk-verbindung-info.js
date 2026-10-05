/* Node unit tests for netzwerk-verbindung-info pure engine. */
'use strict';
const fs = require('fs');
const path = require('path');

const el = () => ({ innerHTML:'', textContent:'', value:'', style:{}, appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = { readyState:'complete', getElementById:()=>el(), createElement:()=>el(), addEventListener(){}, body:{appendChild(){}} };
global.window = {};

const src = fs.readFileSync(path.resolve(__dirname,'../public/assets/js/netzwerk-verbindung-info.js'),'utf8');
const mod = { exports:{} };
new Function('module','exports','document','window',src)(mod, mod.exports, global.document, global.window);
const api = mod.exports;
const { engine, deZahl, zahlMitEinheit, jaNein } = api;

let pass=0, fail=0;
function assert(name, cond){ if(cond){pass++;console.log('  ok '+name);} else {fail++;console.log('  FAIL '+name);} }
function label(m, l){ for (const r of m.rows) if (r[0]===l) return r[1]; return undefined; }

console.log('Exports');
['engine','deZahl','zahlMitEinheit','jaNein','TYPEN','STUFEN'].forEach(k =>
  assert('export ' + k, typeof api[k] !== 'undefined'));

// 1) full connection object
{
  const c = { type:'wifi', effectiveType:'4g', downlink:10.45, downlinkMax:300, rtt:50, saveData:false, onchange:null };
  const m = engine(c, true);
  console.log('Vollstaendige Verbindung');
  assert('6 Zeilen', m.rows.length===6);
  assert('fallback false', m.fallback===false);
  assert('Verbindungstyp WLAN', label(m,'Verbindungstyp')==='WLAN');
  assert('Stufe 4g mit deutschem Text', /^4g \(schnell/.test(label(m,'Effektive Verbindungsstufe')));
  assert('Downlink Mbit/s, deutsches Dezimalkomma', label(m,'Downlink (Schätzung)')==='10,45 Mbit/s');
  assert('Downlink-Maximum gerundet', label(m,'Downlink, theoretisches Maximum')==='300 Mbit/s');
  assert('RTT in ms', label(m,'Round-Trip-Zeit (RTT)')==='50 ms');
  assert('Save-Data nein', label(m,'Datensparmodus')==='nein');
  assert('explanation ist Text', typeof m.explanation==='string' && m.explanation.length>80);
  assert('explanation nennt SSID', m.explanation.indexOf('SSID')!==-1);
  assert('explanation nennt Chromium', m.explanation.indexOf('Chromium')!==-1);
  assert('explanation ohne Em-Dash', m.explanation.indexOf('—')===-1);
}

// 2) missing downlinkMax, saveData undefined
{
  const m = engine({ type:'cellular', effectiveType:'3g', downlink:1.6, rtt:280 }, true);
  console.log('Teilweise Angaben');
  assert('Mobilfunk', label(m,'Verbindungstyp')==='Mobilfunk');
  assert('Downlink 1,6 Mbit/s', label(m,'Downlink (Schätzung)')==='1,6 Mbit/s');
  assert('Max nicht verfügbar', label(m,'Downlink, theoretisches Maximum')==='nicht verfügbar');
  assert('RTT 280 ms', label(m,'Round-Trip-Zeit (RTT)')==='280 ms');
  assert('Save-Data nicht verfügbar', label(m,'Datensparmodus')==='nicht verfügbar');
  assert('fallback false', m.fallback===false);
}

// 3) connection undefined (Firefox/Safari) -> fallback true
{
  const m = engine(undefined, false);
  console.log('Ohne Network Information API');
  assert('fallback true', m.fallback===true);
  assert('alle Zeilen nicht verfuegbar', m.rows.every(r=>r[1]==='nicht verfügbar'));
  assert('6 Zeilen', m.rows.length===6);
  assert('erklaert API nur Chromium', /nur in Chromium/.test(m.explanation));
  assert('erklaert Firefox und Safari', /Firefox und Safari/.test(m.explanation));
  assert('erklaert SSID/RSSI', m.explanation.indexOf('SSID')!==-1 && m.explanation.indexOf('RSSI')!==-1);
  assert('explanation ohne Em-Dash', m.explanation.indexOf('—')===-1);
}

// 4) null conn but flag true, and saveData true / type unknown
{
  const m = engine(null, true);
  console.log('Widerspruechliche Angabe');
  assert('null conn => fallback true', m.fallback===true);
  const m2 = engine({ type:'quantum', effectiveType:'5g', saveData:true }, true);
  assert('unbekannter Typ roh', label(m2,'Verbindungstyp')==='quantum');
  assert('unbekannte Stufe roh', label(m2,'Effektive Verbindungsstufe')==='5g');
  assert('Save-Data ja', label(m2,'Datensparmodus')==='ja');
  assert('numeric type wird kleingeschrieben', label(engine({ type:'WiFi' }, true),'Verbindungstyp')==='WLAN');
}

// 5) pure helpers
{
  console.log('Hilfsfunktionen');
  assert('deZahl ganzzahl', deZahl(300)==='300');
  assert('deZahl komma', deZahl(1.55)==='1,55');
  assert('deZahl null bei Text', deZahl('10')===null);
  assert('deZahl null bei NaN', deZahl(NaN)===null);
  assert('zahlMitEinheit undefined', zahlMitEinheit({ downlink:undefined },'downlink','Mbit/s')===null);
  assert('jaNein undefined', jaNein({ saveData:undefined },'saveData')===null);
  assert('jaNein false', jaNein({ saveData:false },'saveData')==='nein');
  assert('jaNein true', jaNein({ saveData:true },'saveData')==='ja');
}

// 6) no em dash anywhere in visible engine text
{
  const all = engine({type:'ethernet',effectiveType:'4g',downlink:1,downlinkMax:1,rtt:1,saveData:false},true)
    .rows.map(r=>r.join(' ')).join(' ') + engine(null,false).explanation;
  assert('kein Em-Dash in Ausgabetexten', all.indexOf('—')===-1);
  assert('Umlaute vorhanden', /[äöüß]/.test(engine(null,false).explanation));
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
