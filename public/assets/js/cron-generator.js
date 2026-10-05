/* ══════════════════════════════════════════════════
   cron-generator.js — Cron-Expression-Generator
   Erzeugt 5-Feld-Cron-Ausdrücke und deutsche
   menschliche Beschreibungen.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    if (window.esc) return window.esc(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* -------- pure cron engine (node-testable) -------- */

  var PARTS = ['minute', 'hour', 'dayOfMonth', 'month', 'weekday'];

  var presets = [
    { label: 'Jede Minute', cron: '* * * * *' },
    { label: 'Stündlich', cron: '0 * * * *' },
    { label: 'Täglich um Mitternacht', cron: '0 0 * * *' },
    { label: 'Wöchentlich (Mo 0 Uhr)', cron: '0 0 * * 1' },
    { label: 'Monatlich am 1. um 0 Uhr', cron: '0 0 1 * *' },
    { label: 'Wochentags um 9 Uhr', cron: '0 9 * * 1-5' }
  ];

  function parseField(val, min, max, name) {
    if (val === '*' || val === '') return '*';
    // Validate: allow digits, commas, hyphens, slashes
    if (!/^[\d,*\-/\s]+$/.test(val)) {
      throw new Error('Ungültiges ' + name + '-Feld: "' + val + '"');
    }
    // Handle ranges like 1-5 and steps like */15 and lists like 1,15
    // Validate individual values
    var parts = val.split(',');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p === '*') continue;
      var stepMatch = p.match(/^(\*|\d+)\/(\d+)$/);
      var rangeMatch = p.match(/^(\d+)-(\d+)$/);
      if (stepMatch) {
        var base = stepMatch[1] === '*' ? '*' : parseInt(stepMatch[1], 10);
        var step = parseInt(stepMatch[2], 10);
        if (stepMatch[1] !== '*' && (base < min || base > max)) {
          throw new Error(name + ' Wert ' + base + ' außerhalb Bereich ' + min + '-' + max);
        }
        if (isNaN(step) || step <= 0) {
          throw new Error(name + ' Schritt \\"' + stepMatch[2] + '\\" muss > 0 sein');
        }
        continue;
      }
      if (rangeMatch) {
        var from = parseInt(rangeMatch[1], 10);
        var to = parseInt(rangeMatch[2], 10);
        if (isNaN(from) || isNaN(to) || from < min || from > max || to < min || to > max) {
          throw new Error(name + ' Bereich "' + p + '" außerhalb Bereich ' + min + '-' + max);
        }
        continue;
      }
      var num = parseInt(p, 10);
      if (isNaN(num) || num < min || num > max) {
        throw new Error(name + ' Wert ' + p + ' außerhalb Bereich ' + min + '-' + max);
      }
    }
    return val;
  }

  function buildCron(fields) {
    var minute = parseField(fields.minute, 0, 59, 'Minute');
    var hour = parseField(fields.hour, 0, 23, 'Stunde');
    var dayOfMonth = parseField(fields.dayOfMonth, 1, 31, 'Tag');
    var month = parseField(fields.month, 1, 12, 'Monat');
    var weekday = parseField(fields.weekday, 0, 6, 'Wochentag');
    return [minute, hour, dayOfMonth, month, weekday].join(' ');
  }

  function describe(cronString) {
    if (typeof cronString !== 'string') return 'Kombination von Zeitregeln';
    var parts = cronString.trim().split(/\s+/);
    if (parts.length !== 5) return 'Kombination von Zeitregeln';

    var minute = parts[0], hour = parts[1], day = parts[2], month = parts[3], weekday = parts[4];

    function fmt(v) { return v; }

    // Every minute
    if (minute === '*' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
      return 'Jede Minute';
    }

    // Every hour (0 * * * *)
    if (minute === '0' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
      return 'Stündlich';
    }

    // Helper to describe time of day
    function timeOfDay(h) {
      return h + ':00 Uhr';
    }

    function describeWeekday(w) {
      if (w === '*') return '';
      if (w === '0') return 'sonntags';
      if (w === '1') return 'montags';
      if (w === '2') return 'dienstags';
      if (w === '3') return 'mittwochs';
      if (w === '4') return 'donnerstags';
      if (w === '5') return 'freitags';
      if (w === '6') return 'samstags';
      return '';
    }

    function describeWeekdayRange(w) {
      if (w === '*') return '';
      if (w.indexOf('-') !== -1) {
        var r = w.split('-');
        var names = ['sonntags', 'montags', 'dienstags', 'mittwochs', 'donnerstags', 'freitags', 'samstags'];
        var from = parseInt(r[0], 10);
        var to = parseInt(r[1], 10);
        if (!isNaN(from) && !isNaN(to) && from >= 0 && from <= 6 && to >= 0 && to <= 6) {
          return names[from] + ' bis ' + names[to];
        }
      }
      if (w.indexOf(',') !== -1) {
        var list = w.split(',');
        var parts2 = [];
        for (var i = 0; i < list.length; i++) {
          var n = describeWeekday(list[i].trim());
          if (n) parts2.push(n);
        }
        return parts2.join(' und ');
      }
      return describeWeekday(w);
    }

    // Fixed hour, any minute, all days, all months
    if (hour !== '*' && minute === '0' && day === '*' && month === '*' && weekday === '*') {
      return 'Täglich um ' + timeOfDay(hour);
    }

    // Fixed hour and weekday
    if (hour !== '*' && minute === '0' && day === '*' && month === '*' && weekday !== '*') {
      var wdDesc = describeWeekdayRange(weekday);
      if (wdDesc) {
        return 'Um ' + timeOfDay(hour) + ', ' + wdDesc;
      }
      return 'Um ' + timeOfDay(hour) + ' (Wochentag: ' + weekday + ')';
    }

    // Specific day of month, every month, hour=0, minute=0
    if (hour === '0' && minute === '0' && day !== '*' && month === '*' && weekday === '*') {
      return 'Monatlich am ' + day + '. um ' + timeOfDay(hour);
    }

    // Hour fixed, all minute, all day/month, specific weekday
    if (hour !== '*' && minute === '*' && day === '*' && month === '*' && weekday !== '*') {
      var wdDesc2 = describeWeekdayRange(weekday);
      if (wdDesc2) {
        return 'Stündlich, ' + wdDesc2;
      }
    }

    // Fixed minute, all hour, all day/month, specific weekday
    if (minute !== '0' && minute !== '*' && hour === '*' && day === '*' && month === '*' && weekday !== '*') {
      var wdDesc3 = describeWeekdayRange(weekday);
      if (wdDesc3) {
        return 'Jede ' + minute + ' Minute, ' + wdDesc3;
      }
    }

    // Fallback: build a reasonable description
    var desc = '';
    if (minute !== '*' && minute !== '') desc += minute + ' Minute, ';
    if (hour !== '*') desc += 'Stunde ' + hour + ', ';
    if (day !== '*') desc += 'Tag ' + day + ', ';
    if (month !== '*') desc += 'Monat ' + month + ', ';
    if (weekday !== '*') {
      var wd = describeWeekdayRange(weekday);
      if (wd) desc += wd + ', ';
    }
    desc = desc.replace(/, $/, '');
    if (desc === '') return 'Jede Minute';
    return desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  /* -------- UI -------- */

  function renderOutput(cronStr, desc) {
    var el = E('tool-output');
    if (!el) return;
    var html = '<div class="result-display">';
    html += '<div class="field"><label>Cron-Expression</label>';
    html += '<div style="display:flex;gap:8px;align-items:center">';
    html += '<code style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.95rem;background:#0b1218;padding:8px 14px;border-radius:8px;border:1px solid var(--line);flex:1">' + esc(cronStr) + '</code>';
    html += '<button type="button" class="btn-app" onclick="window.cronCopy&&cronCopy()">Kopieren</button>';
    html += '</div></div>';
    html += '<div class="field"><label>Beschreibung</label>';
    html += '<p style="font-size:.95rem;color:var(--fg);padding:8px 0">' + esc(desc) + '</p></div>';
    html += '</div>';
    el.innerHTML = html;
  }

  function run() {
    var minute = E('cron-minute');
    var hour = E('cron-hour');
    var day = E('cron-day');
    var month = E('cron-month');
    var weekday = E('cron-weekday');
    if (!minute || !hour || !day || !month || !weekday) return;

    try {
      var cronStr = buildCron({
        minute: minute.value || '*',
        hour: hour.value || '*',
        dayOfMonth: day.value || '*',
        month: month.value || '*',
        weekday: weekday.value || '*'
      });
      var desc = describe(cronStr);
      renderOutput(cronStr, desc);
    } catch (e) {
      var el = E('tool-output');
      if (el) el.innerHTML = '<p class="muted" style="color:var(--err)">' + esc(e.message) + '</p>';
    }
  }

  function loadPreset(presetCron) {
    var parts = presetCron.split(' ');
    if (parts.length !== 5) return;
    var minute = E('cron-minute');
    var hour = E('cron-hour');
    var day = E('cron-day');
    var month = E('cron-month');
    var weekday = E('cron-weekday');
    if (minute) minute.value = parts[0];
    if (hour) hour.value = parts[1];
    if (day) day.value = parts[2];
    if (month) month.value = parts[3];
    if (weekday) weekday.value = parts[4];
    run();
  }

  function buildUI() {
    var inputs = E('tool-inputs');
    if (!inputs) return;
    inputs.innerHTML =
      '<div class="field"><label>Präsentation</label>' +
      '<select id="cron-preset" style="background:#0b1218;border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:8px;font-size:.85rem">' +
      '<option value="">— Auswahl —</option>' +
      presets.map(function (p) { return '<option value="' + esc(p.cron) + '">' + esc(p.label) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="row">' +
      '<div class="field"><label>Minute</label><input id="cron-minute" type="text" placeholder="*" value="*"></div>' +
      '<div class="field"><label>Stunde</label><input id="cron-hour" type="text" placeholder="*" value="*"></div>' +
      '</div>' +
      '<div class="row">' +
      '<div class="field"><label>Tag</label><input id="cron-day" type="text" placeholder="*" value="*"></div>' +
      '<div class="field"><label>Monat</label><input id="cron-month" type="text" placeholder="*" value="*"></div>' +
      '<div class="field"><label>Wochentag</label><input id="cron-weekday" type="text" placeholder="*" value="*"></div>' +
      '</div>' +
      '<div class="row">' +
      '<button type="button" class="btn-app">Generieren</button>' +
      '<button type="button" class="ghost">Beispiel</button></div>';

    var preset = E('cron-preset');
    var minute = E('cron-minute');
    var hour = E('cron-hour');
    var day = E('cron-day');
    var month = E('cron-month');
    var weekday = E('cron-weekday');
    var generateBtn = inputs.querySelector('button.btn-app');
    var exampleBtn = inputs.querySelector('button.ghost');

    if (preset) {
      preset.addEventListener('change', function () {
        if (this.value) loadPreset(this.value);
      });
    }
    if (generateBtn) generateBtn.addEventListener('click', run);
    if (exampleBtn) exampleBtn.addEventListener('click', function () {
      loadPreset('0 9 * * 1-5');
    });

    inputs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
    });
  }

  window.cronCopy = function () {
    var cronStr = '';
    var m = E('cron-minute'), h = E('cron-hour'), d = E('cron-day'), mo = E('cron-month'), w = E('cron-weekday');
    if (m && h && d && mo && w) {
      try { cronStr = buildCron({ minute: m.value || '*', hour: h.value || '*', dayOfMonth: d.value || '*', month: mo.value || '*', weekday: w.value || '*' }); } catch (e) { cronStr = ''; }
    }
    if (window.copyToClipboard) window.copyToClipboard(cronStr);
    else navigator.clipboard && navigator.clipboard.writeText(cronStr);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PARTS: PARTS, presets: presets, buildCron: buildCron, describe: describe };
  }
})();
