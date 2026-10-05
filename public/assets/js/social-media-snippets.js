/* studio-tools.online - Social Media Snippets generator.
 * Builds ready-to-post captions for Facebook, X/Twitter, Instagram, Threads
 * and WhatsApp, tuned per network (character limits, hashtag style, CTA).
 * Pure engine (buildSnippet/makeHashtags) is node-testable via module.exports.
 */
(function () {
  'use strict';

  var DE = typeof window !== 'undefined' && window.__siteLang === 'en' ? false : true;

  function E(id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; }

  // HTML helpers (fall back to identity outside the browser).
  function escA(s) { if (window && window.esc) return window.esc(s); return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function escT(s) { if (window && window.escText) return window.escText(s); return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── Network config ────────────────────────────────────────────────
  var NETWORKS = [
    { key: 'fb',      label: 'Facebook',               limit: null, hashtagCount: 3  },
    { key: 'x',       label: 'X / Twitter',            limit: 280,  hashtagCount: 3  },
    { key: 'ig',      label: 'Instagram',              limit: 2200, hashtagCount: 20 },
    { key: 'threads', label: 'Threads',                limit: 500,  hashtagCount: 4  },
    { key: 'wa',      label: 'WhatsApp',               limit: null, hashtagCount: 0  }
  ];

  var GENERIC_TAGS = {
    de: ['OnlineTool', 'Kostenlos', 'WebTool', 'Online', 'Tool'],
    en: ['FreeTool', 'OnlineTool', 'WebTools', '101', 'Online']
  };

  var STOPWORDS = {
    de: ['der','die','das','und','oder','aber','mit','von','f\u00fcr','fuer','im','in','den','dem','des','ein','eine','einen','einem','einer','auf','zu','zum','zur','ist','sind','nicht','auch','bei','aus','nach','ueber','als','wie','wenn','dann','dein','deine','ihr','ihre','ihren','ihrem','wird','werden','kann','koennen','sich','ich','du','wir','sie','dieses','diese','dieser','noch','nur','sehr','alle','allem','wichtig','richtig','direkt','http','https'],
    en: ['the','and','or','with','from','for','not','you','your','this','that','these','those','are','was','were','have','has','will','can','into','than','then','when','what','which','who','whom','very','only','also','about','through','during','before','after','above','below','how','why','all','each','both','few','more','most','other','some','such','out','own','same','too','over','under','again','further','once','here','there','http','https']
  };

  function countChars(str) { return String(str).length; }

  // Pull meaningful keywords out of a text (de-deduped, language aware).
  function extractKeywords(text, lang) {
    var stop = STOPWORDS[lang === 'en' ? 'en' : 'de'] || [];
    var seen = {}, out = [];
    var parts = String(text).toLowerCase().replace(/[^a-z\u00e4\u00f6\u00fc\u00df0-9\s-]/gi, ' ').split(/[\s-]+/);
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i];
      if (!w || w.length < 4 || stop.indexOf(w) !== -1 || seen[w]) continue;
      seen[w] = 1;
      out.push(w);
    }
    return out;
  }

  function toTag(word) { return '#' + word.charAt(0).toUpperCase() + word.slice(1); }

  // Build a hashtag line; derives from topic text first, then pads with generic tags.
  function makeHashtags(opts) {
    opts = opts || {};
    var lang = opts.lang === 'en' ? 'en' : 'de';
    var count = opts.count;
    if (!count) return '';
    var text = (opts.headline || '') + ' ' + (opts.description || '');
    var kws = extractKeywords(text, lang);
    var tags = [], seen = {}, i, t;
    for (i = 0; i < kws.length && tags.length < count; i++) {
      t = toTag(kws[i]);
      if (!seen[t]) { seen[t] = 1; tags.push(t); }
    }
    var generic = GENERIC_TAGS[lang];
    for (i = 0; i < generic.length && tags.length < count; i++) {
      t = toTag(generic[i]);
      if (!seen[t]) { seen[t] = 1; tags.push(t); }
    }
    return tags.join(' ');
  }

  var L = {
    de: { cta: 'Probier es kostenlos direkt im Browser aus.', waCta: 'Einfach \u00f6ffnen und gratis nutzen:', noInput: 'Bitte \u00dcberschrift oder Beschreibung ausf\u00fcllen.' },
    en: { cta: 'Try it free, right in your browser.', waCta: 'Open it and use it for free:', noInput: 'Please fill in a headline or description.' }
  };

  function buildText(head, desc, tail) {
    var body = [];
    if (head) body.push(head);
    if (desc) body.push(desc);
    var t = body.join('\n\n');
    if (tail.length) t = t + (t ? '\n\n' : '') + tail.join('\n\n');
    return t;
  }

  // Longest desc prefix so head+prefix(…)+tail fits the limit.
  function shrinkDesc(head, desc, tail, limit) {
    var lo = 0, hi = desc.length, best = desc;
    // ensure a baseline that trivially fits or is already short
    if (countChars(buildText(head, desc, tail)) <= limit) return desc;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var cand = desc.slice(0, mid) + (mid < desc.length ? '\u2026' : '');
      if (countChars(buildText(head, cand, tail)) <= limit) { best = cand; lo = mid + 1; }
      else hi = mid - 1;
    }
    return best;
  }

  // Enforce a char limit by shrinking desc, then dropping tail parts.
  function fit(head, desc, tail, limit) {
    var t = buildText(head, desc, tail);
    if (countChars(t) <= limit) return { text: t, over: false, hitLimit: false };
    var curDesc = desc;
    if (desc) {
      curDesc = shrinkDesc(head, desc, tail, limit);
      t = buildText(head, curDesc, tail);
    }
    if (countChars(t) <= limit) return { text: t, over: false, hitLimit: true };
    var curTail = tail.slice();
    while (curTail.length && countChars(buildText(head, curDesc, curTail)) > limit) curTail.pop();
    t = buildText(head, curDesc, curTail);
    return { text: t, over: countChars(t) > limit, hitLimit: true };
  }

  // Compose the snippet for one network.
  function buildSnippet(o) {
    o = o || {};
    var lang = o.lang === 'en' ? 'en' : 'de';
    var headline = String(o.headline || '').trim();
    var desc = String(o.description || '').trim();
    var url = String(o.url || '').trim();
    var hasHashtags = o.hashtags !== false;
    var withCta = o.cta !== false;
    var net = null;
    for (var i = 0; i < NETWORKS.length; i++) if (NETWORKS[i].key === o.network) { net = NETWORKS[i]; break; }
    if (!net) return { text: '', limit: null, over: false };

    var tagsLine = hasHashtags ? makeHashtags({ headline: headline, description: desc, lang: lang, count: net.hashtagCount }) : '';

    var tail = [];
    if (o.network === 'wa') {
      if (url) tail.push((withCta ? L[lang].waCta + ' ' : '') + url);
    } else {
      if (url) tail.push((withCta ? L[lang].cta + ' ' : '') + url);
      else if (withCta && (headline || desc)) tail.push(L[lang].cta);
    }
    if (tagsLine) tail.push(tagsLine);

    // Backwards: tags should come after the URL line in the tail array; but since
    // tags are pushed last they are dropped last during fit, which is what we want
    // (keep the URL/CTA over the hashtags).

    var raw = buildText(headline, desc, tail);
    var r;
    if (net.limit && countChars(raw) > net.limit) {
      r = fit(headline, desc, tail, net.limit);
    } else {
      r = { text: raw, over: false, hitLimit: false };
    }
    return { text: r.text, limit: net.limit, over: r.over };
  }

  // ── UI ────────────────────────────────────────────────────────────
  function field(id, label, tag, placeholder) {
    var wrap = document.createElement('div');
    wrap.className = 'input-group';
    wrap.style.marginBottom = '12px';
    var lab = document.createElement('label');
    lab.setAttribute('for', id);
    lab.textContent = label;
    var input = document.createElement(tag === 'textarea' ? 'textarea' : 'input');
    input.id = id;
    if (tag === 'textarea') { input.className = 'input textarea'; input.rows = 3; }
    else { input.className = 'input'; input.type = 'text'; input.setAttribute('autocomplete', 'off'); }
    if (placeholder) input.setAttribute('placeholder', placeholder);
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  function checkBox(id, label, checked) {
    var lab = document.createElement('label');
    lab.style.display = 'inline-flex';
    lab.style.alignItems = 'center';
    lab.style.marginRight = '16px';
    lab.style.marginBottom = '6px';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = !!checked;
    var span = document.createElement('span');
    span.textContent = label;
    lab.appendChild(cb);
    lab.appendChild(span);
    return lab;
  }

  function netLabel(key) {
    for (var i = 0; i < NETWORKS.length; i++) if (NETWORKS[i].key === key) return NETWORKS[i].label;
    return key;
  }

  function shareUrl(network, text, url) {
    var t = encodeURIComponent(String(text || ''));
    var u = encodeURIComponent(String(url || ''));
    switch (network) {
      case 'x': return 'https://twitter.com/intent/tweet?text=' + t + (u ? '&url=' + u : '');
      case 'fb': return u ? 'https://www.facebook.com/sharer/sharer.php?u=' + u : '';
      case 'wa': return (t || u) ? 'https://wa.me/?text=' + t + (u ? ' ' + u : '') : '';
      default: return '';
    }
  }

  function buildUI(inputs) {
    var selWrap = document.createElement('div');
    selWrap.className = 'input-group';
    selWrap.style.marginBottom = '12px';
    var selLab = document.createElement('label');
    selLab.setAttribute('for', 'sms-tool');
    selLab.textContent = DE ? 'Tool ausw\u00e4hlen (optional)' : 'Choose a tool (optional)';
    var sel = document.createElement('select');
    sel.id = 'sms-tool';
    sel.className = 'input';
    var opt = document.createElement('option');
    opt.value = '';
    opt.textContent = DE ? 'Eigener Text' : 'Free text';
    sel.appendChild(opt);
    selWrap.appendChild(selLab);
    selWrap.appendChild(sel);
    inputs.appendChild(selWrap);

    inputs.appendChild(field('sms-headline', DE ? '\u00dcberschrift' : 'Headline', 'input', DE ? 'z.B. Passwort Generator' : 'e.g. Password Generator'));
    inputs.appendChild(field('sms-desc', DE ? 'Beschreibung' : 'Description', 'textarea', DE ? 'Was soll gepostet werden? 1-3 S\u00e4tze.' : 'What should the post say? 1-3 sentences.'));
    inputs.appendChild(field('sms-url', DE ? 'Link' : 'Link', 'input', 'https://studio-tools.online/'));

    var netLab = document.createElement('div');
    netLab.style.marginBottom = '6px';
    netLab.innerHTML = DE ? '<strong>Netzwerke</strong>' : '<strong>Networks</strong>';
    inputs.appendChild(netLab);
    var netRow = document.createElement('div');
    netRow.style.marginBottom = '6px';
    ['fb', 'x', 'ig', 'threads', 'wa'].forEach(function (k) {
      netRow.appendChild(checkBox('sms-net-' + k, netLabel(k), true));
    });
    inputs.appendChild(netRow);

    var optRow = document.createElement('div');
    optRow.style.marginBottom = '6px';
    optRow.appendChild(checkBox('sms-hashtags', DE ? 'Hashtags hinzuf\u00fcgen' : 'Add hashtags', true));
    optRow.appendChild(checkBox('sms-cta', DE ? 'Aufruf (CTA) hinzuf\u00fcgen' : 'Add call-to-action', true));
    inputs.appendChild(optRow);
  }

  function run() {
    var out = E('tool-output');
    if (!out) return;
    var headline = (E('sms-headline') ? E('sms-headline').value : '').trim();
    var desc = (E('sms-desc') ? E('sms-desc').value : '').trim();
    var url = (E('sms-url') ? E('sms-url').value : '').trim();
    if (!headline && !desc) {
      out.innerHTML = '<p class="text-muted">' + escT(L[DE ? 'de' : 'en'].noInput) + '</p>';
      return;
    }
    var hashtags = !(E('sms-hashtags') && !E('sms-hashtags').checked);
    var cta = !(E('sms-cta') && !E('sms-cta').checked);
    var selected = [];
    ['fb', 'x', 'ig', 'threads', 'wa'].forEach(function (k) {
      var cb = E('sms-net-' + k);
      if (cb && cb.checked) selected.push(k);
    });
    if (!selected.length) {
      out.innerHTML = '<p class="text-muted">' + escT(DE ? 'Bitte mindestens ein Netzwerk w\u00e4hlen.' : 'Please select at least one network.') + '</p>';
      return;
    }
    var lang = DE ? 'de' : 'en';
    var html = '';
    selected.forEach(function (k) {
      var res = buildSnippet({ network: k, headline: headline, description: desc, url: url, lang: lang, hashtags: hashtags, cta: cta });
      var label = netLabel(k);
      var color = res.over ? 'color:#c0392b;' : 'color:inherit;';
      var counter = '<span data-role="cnt" style="font-weight:normal;' + color + '">' + res.text.length + (res.limit ? ' / ' + res.limit : '') + ' ' + (DE ? 'Zeichen' : 'chars') + '</span>';
      var sh = shareUrl(k, res.text, url);
      var shareBtn = sh ? '<a class="btn btn-primary" target="_blank" rel="noopener" style="margin-left:auto" href="' + escA(sh) + '">' + escT(DE ? '\u00d6ffnen und posten' : 'Open &amp; post').replace(/&amp;/g,'') + '</a>' : '';
      html += '<div class="sms-block" style="margin-bottom:24px">' +
        '<div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px;flex-wrap:wrap">' +
          '<strong style="flex:1">' + escT(label) + '</strong>' + counter +
        '</div>' +
        '<textarea class="input textarea" readonly style="width:100%;min-height:120px;font-family:inherit;box-sizing:border-box">' + escT(res.text) + '</textarea>' +
        '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
          '<button class="btn btn-secondary" data-copy="' + escA(res.text) + '">' + escT(DE ? 'Kopieren' : 'Copy') + '</button>' +
          shareBtn +
        '</div>' +
      '</div>';
    });
    out.innerHTML = html;
  }

  function loadTools() {
    var sel = E('sms-tool');
    if (!sel) return;
    fetch('/api/tools-meta', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (tools) {
        if (!tools || !tools.length || !E('sms-tool')) return;
        var frag = document.createDocumentFragment();
        tools.forEach(function (t) {
          var o = document.createElement('option');
          o.value = t.slug;
          o.textContent = DE ? (t.title || t.slug) : (t.titleEn || t.title || t.slug);
          o.setAttribute('data-title', t.title || '');
          o.setAttribute('data-titleEn', t.titleEn || t.title || '');
          o.setAttribute('data-desc', t.description || '');
          o.setAttribute('data-descEn', t.descriptionEn || t.description || '');
          frag.appendChild(o);
        });
        sel.appendChild(frag);
      })
      .catch(function () { /* offline: keep free-text mode */ });
  }

  function setup() {
    if (typeof document === 'undefined' || !document.getElementById) return;
    var inputs = E('tool-inputs'), output = E('tool-output');
    if (!inputs || !output) return;
    buildUI(inputs);
    loadTools();

    var sel = E('sms-tool');
    if (sel) sel.addEventListener('change', function () {
      var o = sel.options[sel.selectedIndex];
      var head = E('sms-headline'), desc = E('sms-desc'), url = E('sms-url');
      if (!o || !o.value) {
        if (head) head.value = ''; if (desc) desc.value = ''; if (url) url.value = '';
        return;
      }
      if (head) head.value = DE ? (o.getAttribute('data-title') || '') : (o.getAttribute('data-titleEn') || o.getAttribute('data-title') || '');
      if (desc) desc.value = DE ? (o.getAttribute('data-desc') || '') : (o.getAttribute('data-descEn') || o.getAttribute('data-desc') || '');
      if (url) url.value = 'https://studio-tools.online/' + o.value;
    });

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-generate';
    btn.textContent = DE ? 'Snippets erstellen' : 'Generate snippets';
    inputs.appendChild(btn);
    btn.addEventListener('click', run);
    inputs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.tagName === 'TEXTAREA' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        btn.click();
      }
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      NETWORKS: NETWORKS,
      countChars: countChars,
      extractKeywords: extractKeywords,
      toTag: toTag,
      makeHashtags: makeHashtags,
      buildSnippet: buildSnippet,
      buildText: buildText,
      fit: fit,
      shrinkDesc: shrinkDesc
    };
  }
})();
