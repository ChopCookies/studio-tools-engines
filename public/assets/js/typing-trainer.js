/* Typing Trainer (tipp-trainer) for studio-tools.online
 * Round mode rotates movie quotes; timed mode is a benchmark.
 * Colored per-character feedback, autocorrect/spellcheck fully neutralized
 * by intercepting keystrokes and never committing to the input value.
 */
(function() {
  'use strict';

  // ------------------------------------------------------------------
  // Quote banks, one per difficulty tier. Harder tiers are longer.
  // No em dashes anywhere (site rule). Straight apostrophes only.
  // ------------------------------------------------------------------
  var QUOTES = {
    easy: [
      "May the Force be with you.",
      "I'll be back.",
      "There's no place like home.",
      "You talking to me?",
      "Houston, we have a problem.",
      "I am your father.",
      "I see dead people.",
      "To infinity and beyond!",
      "Just keep swimming.",
      "Hasta la vista, baby.",
      "Carpe diem. Seize the day.",
      "Here's looking at you, kid.",
      "Why so serious?",
      "Ich bin dein Vater.",
      "Bis später, Baby."
    ],
    medium: [
      "Frankly, my dear, I don't give a damn.",
      "After all, tomorrow is another day.",
      "Keep your friends close, but your enemies closer.",
      "With great power comes great responsibility.",
      "You can't handle the truth!",
      "Nobody puts Baby in a corner.",
      "A martini. Shaken, not stirred.",
      "To be or not to be, that is the question.",
      "The stuff that dreams are made of.",
      "Roads? Where we're going, we don't need roads.",
      "I'm going to make him an offer he can't refuse.",
      "It's not the years, honey, it's the mileage.",
      "May the Force be with you. Always.",
      "Der Name ist Bond. James Bond.",
      "Das Leben ist wie eine Schachtel Pralinen."
    ],
    hard: [
      "My mama always said life was like a box of chocolates. You never know what you're gonna get.",
      "You can't handle the truth! We live in a world that has walls, and those walls have to be guarded by men with guns.",
      "The greatest trick the devil ever pulled was convincing the world he didn't exist.",
      "A census taker once tried to test me. I ate his liver with some fava beans and a nice Chianti.",
      "You know how to whistle, don't you, Steve? You just put your lips together and blow.",
      "Of all the gin joints in all the towns in all the world, she walks into mine.",
      "I love the smell of napalm in the morning. It smells like victory.",
      "The first rule of Fight Club is: you do not talk about Fight Club.",
      "Fear is the path to the dark side. Fear leads to anger, anger leads to hate, hate leads to suffering.",
      "They may take our lives, but they'll never take our freedom!",
      "All we have to decide is what to do with the time that is given us.",
      "It's not who I am underneath, but what I do that defines me.",
      "Yesterday is history, tomorrow is a mystery, but today is a gift. That is why it is called the present.",
      "The future is not set. There is no fate but what we make for ourselves."
    ]
  };

  function getBank() {
    return QUOTES[state.difficulty] || QUOTES.easy;
  }

  // ------------------------------------------------------------------
  // Testable pure core (no DOM). state = { quote, chars, pos, correct, errors }
  // ------------------------------------------------------------------
  function buildQuote(text) {
    var arr = [];
    var i, chars = Array.from(text); // handles surrogate pairs
    for (i = 0; i < chars.length; i += 1) {
      arr.push({ ch: chars[i], state: 'p' }); // p pending, c correct, e error
    }
    return arr;
  }

  // Feed one typed character. Returns 'advance' | 'stay' | 'complete' | 'ignore'.
  function applyChar(state, ch) {
    if (state.pos >= state.chars.length) return 'ignore';
    var expected = state.chars[state.pos].ch;
    if (ch === expected) {
      state.chars[state.pos].state = 'c';
      state.correct += 1;
      state.pos += 1;
      if (state.pos >= state.chars.length) return 'complete';
      return 'advance';
    }
    state.chars[state.pos].state = 'e';
    state.errors += 1;
    return 'stay';
  }

  // Move back one char, resetting its marking. Returns true if moved.
  function applyBackspace(state) {
    if (state.pos <= 0) return false;
    state.pos -= 1;
    state.chars[state.pos].state = 'p';
    return true;
  }

  // WPM standard: 1 word = 5 characters. minutes = elapsedMs / 60000.
  function computeStats(correct, errors, elapsedMs) {
    var minutes = elapsedMs > 0 ? elapsedMs / 60000 : 0;
    var wpm = minutes > 0 ? Math.round((correct / 5) / minutes) : 0;
    var total = correct + errors;
    var accuracy = total > 0 ? (correct / total) * 100 : 0;
    return { wpm: wpm, accuracy: accuracy, correct: correct, errors: errors, total: total };
  }

  // Pick a quote different from the last one, preferring less-recent use.
  var _lastIndex = -1;
  function pickQuote(excludeIndex) {
    var el = typeof excludeIndex === 'number' && excludeIndex >= 0 ? excludeIndex : _lastIndex;
    var bank = getBank();
    var n = bank.length;
    if (n <= 1) return { index: 0 };
    // Simple deterministic rotation: step by a coprime offset to cycle all,
    // then add jitter to avoid a predictable order.
    var offset = 1 + Math.floor(Math.random() * (n - 1));
    var idx = (el + offset) % n;
    // Guard against landing on the same index (only possible when n small).
    if (idx === el) idx = (idx + 1) % n;
    _lastIndex = idx;
    return { index: idx };
  }

  // ------------------------------------------------------------------
  // Bilingual strings
  // ------------------------------------------------------------------
  function isEn() {
    return typeof document !== 'undefined' && document.documentElement
      && document.documentElement.lang === 'en';
  }
  function T(de, en) { return isEn() ? en : de; }
  function fmtNum(v, frac) {
    try {
      var loc = isEn() ? 'en-US' : 'de-DE';
      return new Intl.NumberFormat(loc, {
        maximumFractionDigits: frac, minimumFractionDigits: frac
      }).format(v);
    } catch (e) { return (v).toFixed(frac); }
  }
  function now() {
    return window.performance && typeof window.performance.now === 'function'
      ? window.performance.now() : Date.now();
  }

  // ------------------------------------------------------------------
  // DOM
  // ------------------------------------------------------------------
  function getEl(id) { return document.getElementById(id); }

  var els = {};
  var state = {
    mode: 'round',
    difficulty: 'easy',
    running: false,
    duration: 30,
    quote: '',
    chars: [],
    pos: 0,
    correct: 0,
    errors: 0,
    startMs: 0,
    elapsedMs: 0,
    quoteIndex: -1,
    timerId: null,
    roundNo: 1,
    started: false
  };

  function resetCounters() {
    state.pos = 0;
    state.correct = 0;
    state.errors = 0;
    state.elapsedMs = 0;
  }

  function loadQuote() {
    var picked = pickQuote(state.quoteIndex);
    var bank = getBank();
    state.quoteIndex = picked.index;
    state.quote = bank[picked.index];
    state.chars = buildQuote(state.quote);
    resetCounters();
    renderQuote();
  }

  function stateClass(s) {
    return s === 'c' ? 'correct' : (s === 'e' ? 'error' : 'pending');
  }

  function renderQuote() {
    if (!els.quote) return;
    var frag = document.createDocumentFragment();
    var i;
    for (i = 0; i < state.chars.length; i += 1) {
      var sp = document.createElement('span');
      sp.className = 'tt-char tt-' + stateClass(state.chars[i].state);
      sp.setAttribute('data-i', i);
      sp.textContent = state.chars[i].ch === ' ' ? '\u00A0' : state.chars[i].ch;
      if (i === state.pos) sp.classList.add('tt-current');
      frag.appendChild(sp);
    }
    els.quote.innerHTML = '';
    els.quote.appendChild(frag);
    updateStatusBar();
  }

  function refreshCharStates() {
    if (!els.quote) return;
    var spans = els.quote.children;
    var i;
    for (i = 0; i < state.chars.length; i += 1) {
      var sp = spans[i];
      sp.className = 'tt-char tt-' + stateClass(state.chars[i].state);
      if (i === state.pos) sp.classList.add('tt-current');
    }
  }

  function updateStatusBar() {
    if (!els.status) return;
    var done = state.correct + state.errors;
    var pct = state.chars.length ? Math.round(done / state.chars.length * 100) : 0;
    els.status.textContent = state.running || state.started
      ? T('Fertig: ' + done + ' / ' + state.chars.length + ' (' + pct + ' %)',
          'Done: ' + done + ' / ' + state.chars.length + ' (' + pct + ' %)')
      : T('Tippe das Zitat ab. Richtige Zeichen grün, Fehler rot.',
          'Type the quote. Correct characters turn green, mistakes turn red.');
  }

  function handleChar(ch) {
    var res = applyChar(state, ch);
    refreshCharStates();
    updateStatusBar();
    if (res === 'complete') {
      if (state.mode === 'timed' && state.running) {
        loadQuote(); // timed: keep going into the next quote
      } else {
        finishRound();
      }
    }
  }

  function goBack() {
    if (applyBackspace(state)) {
      refreshCharStates();
      updateStatusBar();
    }
  }

  function focusInput() {
    try {
      if (els.input) {
        els.input.focus({ preventScroll: true });
        // blur any previously focused button so Enter/Space never re-triggers it
        if (document.activeElement && document.activeElement !== els.input && document.activeElement.blur) {
          document.activeElement.blur();
        }
      }
    } catch (e) { /* noop */ }
  }

  function beginTiming() {
    state.startMs = now();
    state.started = true;
    state.running = true;
    els.startBtn.textContent = T('Läuft ...', 'Running ...');
    els.startBtn.disabled = true;
    focusInput();
    if (state.mode === 'timed') {
      state.timerId = setInterval(tick, 100);
      updateTimer();
    }
  }

  function tick() {
    if (!state.running) return;
    var remaining = state.duration - (now() - state.startMs) / 1000;
    if (remaining <= 0) {
      state.elapsedMs = state.duration * 1000;
      finishTimed();
      return;
    }
    updateTimer(remaining);
  }

  function updateTimer(remaining) {
    if (!els.status) return;
    var secs = typeof remaining === 'number' && remaining >= 0 ? remaining : state.duration;
    var done = state.correct + state.errors;
    var minutes = ((state.duration) - secs) / 60;
    var liveWpm = minutes > 0 ? Math.round((state.correct / 5) / minutes) : 0;
    els.status.textContent = T(
      'Zeit: ' + fmtNum(Math.max(0, secs), 1) + ' s | Zeichen: ' + done + ' | ca. ' + liveWpm + ' WPM',
      'Time: ' + fmtNum(Math.max(0, secs), 1) + ' s | Chars: ' + done + ' | ~' + liveWpm + ' WPM'
    );
  }

  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }

  function isEnName() { return isEn(); }

  function finishRound() {
    stopTimer();
    state.running = false;
    state.elapsedMs = now() - state.startMs;
    var st = computeStats(state.correct, state.errors, state.elapsedMs);
    els.startBtn.textContent = T('Neue Runde', 'New round');
    els.startBtn.disabled = false;
    renderRoundResult(st);
  }

  function finishTimed() {
    stopTimer();
    state.running = false;
    var st = computeStats(state.correct, state.errors, Math.max(1, state.duration * 1000));
    els.startBtn.textContent = T('Nochmal', 'Retry');
    els.startBtn.disabled = false;
    renderTimedResult(st);
  }

  function resultTitle() {
    if (state.mode === 'timed') {
      return T('Zeittest abgeschlossen', 'Timed test complete');
    }
    return T('Runde ' + state.roundNo + ' abgeschlossen', 'Round ' + state.roundNo + ' complete');
  }

  function buildResultHtml(st) {
    var accStr = fmtNum(st.accuracy, 1) + ' %';
    var timeStr;
    if (state.mode === 'timed') {
      timeStr = fmtNum(state.duration, 0) + ' s';
    } else {
      timeStr = fmtNum(state.elapsedMs / 1000, 1) + ' s';
    }
    var rows = [
      { l: T('Zeichen korrekt', 'Correct characters'), v: fmtNum(st.correct, 0) },
      { l: T('Fehler', 'Errors'), v: fmtNum(st.errors, 0) },
      { l: T('Genauigkeit', 'Accuracy'), v: accStr },
      { l: T('Zeit', 'Time'), v: timeStr },
      { l: T('Geschwindigkeit', 'Speed'), v: fmtNum(st.wpm, 0) + ' WPM' }
    ];
    var html = '<div class="tt-result-card">'
      + '<h3 class="tt-result-title">' + resultTitle() + '</h3>'
      + '<div class="tt-stats">';
    for (var i = 0; i < rows.length; i += 1) {
      html += '<div class="tt-stat"><span class="tt-stat-label">' + rows[i].l + '</span>'
        + '<span class="tt-stat-value">' + rows[i].v + '</span></div>';
    }
    html += '</div>'
      + '<div class="tt-btn-row">'
      + '<button type="button" class="btn btn-primary tt-next">'
      + (state.mode === 'timed' ? T('Nochmal', 'Retry') : T('Nächste Runde', 'Next quote')) + '</button>';
    if (state.mode === 'round') {
      html += '<button type="button" class="btn btn-secondary tt-again">' + T('Nochmal (gleiche Runde)', 'Retry same quote') + '</button>';
    }
    html += '</div></div>';
    return html;
  }

  function appendResultActions() {
    var nxt = els.output.querySelector('.tt-next');
    if (nxt) nxt.addEventListener('click', function() {
      if (state.mode === 'timed') { startTimed(); } else { startRound(true); }
    });
    var again = els.output.querySelector('.tt-again');
    if (again) again.addEventListener('click', function() { startRound(false); });
  }

  function renderRoundResult(st) {
    els.output.innerHTML = buildResultHtml(st);
    appendResultActions();
    if (window.trackAction) window.trackAction('typing_round');
  }

  function renderTimedResult(st) {
    els.output.innerHTML = buildResultHtml(st);
    appendResultActions();
    if (window.trackAction) window.trackAction('typing_timed');
  }

  function setMode(mode) {
    state.mode = mode;
    state.started = false;
    state.running = false;
    stopTimer();
    if (els.tabRound) els.tabRound.classList.toggle('tt-tab-active', mode === 'round');
    if (els.tabTimed) els.tabTimed.classList.toggle('tt-tab-active', mode === 'timed');
    if (els.durationWrap) els.durationWrap.style.display = mode === 'timed' ? '' : 'none';
    els.startBtn.textContent = T('Start', 'Start');
    els.startBtn.disabled = false;
    els.output.innerHTML = '';
    loadQuote(); // show a preview quote so the field is never empty
    els.status.textContent = mode === 'round'
      ? T('Klicke Start und tippe das Zitat ab.', 'Click Start and type the quote.')
      : T('Klicke Start. Tippe so viel wie möglich in ' + fmtNum(state.duration, 0) + ' s.',
          'Click Start. Type as much as you can in ' + fmtNum(state.duration, 0) + ' s.');
  }

  // Switch difficulty tier: new bank, fresh preview, never mid-run.
  function setDifficulty(diff) {
    if (!QUOTES[diff]) diff = 'easy';
    state.difficulty = diff;
    _lastIndex = -1;
    state.started = false;
    state.running = false;
    stopTimer();
    var btns = els.diffRow ? els.diffRow.querySelectorAll('.tt-diff') : [];
    var i;
    for (i = 0; i < btns.length; i += 1) {
      btns[i].classList.toggle('tt-tab-active', btns[i].getAttribute('data-diff') === diff);
    }
    els.startBtn.textContent = T('Start', 'Start');
    els.startBtn.disabled = false;
    els.output.innerHTML = '';
    loadQuote();
  }

  // Reset counters and mark every char pending so a fresh/re-run quote starts blank.
  function resetRound() {
    resetCounters();
    for (var i = 0; i < state.chars.length; i += 1) {
      state.chars[i].state = 'p';
    }
  }

  // fresh=true loads a new quote; fresh=false retypes the displayed one.
  function startRound(fresh) {
    if (fresh) { loadQuote(); }
    state.mode = 'round';
    els.output.innerHTML = '';
    els.quoteWrap.style.display = '';
    resetRound();
    renderQuote();
    beginTiming();
  }

  function startTimed() {
    state.mode = 'timed';
    state.roundNo = 1;
    loadQuote();
    els.output.innerHTML = '';
    els.quoteWrap.style.display = '';
    beginTiming();
  }

  // ------------------------------------------------------------------
  // Input capture & autocorrect/spellcheck mitigation.
  // Keystrokes are intercepted and preventDefault()'d, so the browser
  // never commits text and autocorrect/spellcheck cannot alter content.
  // A transparent input stays focused so mobile keyboards open.
  // ------------------------------------------------------------------
  function bindInput() {
    var inp = els.input;
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('autocorrect', 'off');
    inp.setAttribute('autocapitalize', 'off');
    inp.setAttribute('spellcheck', 'false');
    inp.setAttribute('enterkeyhint', 'done');
    inp.setAttribute('aria-label', T('Tippbereich', 'Typing area'));
    inp.setAttribute('maxlength', '1');

    inp.addEventListener('keydown', function(e) {
      if (!state.running) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        goBack();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1) {
        e.preventDefault(); // block autocorrect from ever materializing
        handlerFeed(e.key);
      }
    });

    // Mobile IME / soft keyboards sometimes skip keydown.
    inp.addEventListener('beforeinput', function(e) {
      if (!state.running) return;
      var d = e.data;
      if (d && d.length && e.inputType && e.inputType.indexOf('insert') === 0) {
        e.preventDefault();
        var chars = Array.from(d);
        for (var i = 0; i < chars.length; i += 1) handlerFeed(chars[i]);
      }
    });

    // Aggressive cleanup if the value ever contains anything.
    inp.addEventListener('input', function(e) {
      if (this.value) { this.value = ''; }
    });

    // Re-focus on click anywhere in the shell.
    els.shell.addEventListener('click', function() { focusInput(); });
  }

  function handlerFeed(ch) {
    if (ch === '' || typeof ch === 'undefined') return;
    // Space is key.length===1 and handled by keydown; IME space handled here too.
    handleChar(ch);
  }

  // ------------------------------------------------------------------
  // Build UI
  // ------------------------------------------------------------------
  function buildUI() {
    var container = getEl('tool-inputs');
    if (!container) return;

    var shell = document.createElement('div');
    shell.className = 'tt-shell';
    shell.id = 'tt-shell';
    els.shell = shell;

    // Mode tabs
    var tabs = document.createElement('div');
    tabs.className = 'tt-tabs';
    tabs.innerHTML = '<button type="button" class="tt-tab tt-tab-active" data-mode="round">'
      + T('Runde', 'Round') + '</button>'
      + '<button type="button" class="tt-tab" data-mode="timed">'
      + T('Zeit-Test', 'Timed test') + '</button>';
    els.tabRound = tabs.querySelector('[data-mode="round"]');
    els.tabTimed = tabs.querySelector('[data-mode="timed"]');
    tabs.addEventListener('click', function(ev) {
      var b = ev.target.closest && ev.target.closest('.tt-tab');
      if (b) setMode(b.getAttribute('data-mode'));
    });
    shell.appendChild(tabs);

    // Difficulty selector (Leicht / Mittel / Schwer)
    var diffRow = document.createElement('div');
    diffRow.className = 'tt-tabs tt-diff-row';
    diffRow.id = 'tt-diff-row';
    diffRow.innerHTML =
      '<span class="tt-diff-label">' + T('Schwierigkeit', 'Difficulty') + '</span>'
      + '<button type="button" class="tt-tab tt-diff tt-tab-active" data-diff="easy">'
      + T('Leicht', 'Easy') + '</button>'
      + '<button type="button" class="tt-tab tt-diff" data-diff="medium">'
      + T('Mittel', 'Medium') + '</button>'
      + '<button type="button" class="tt-tab tt-diff" data-diff="hard">'
      + T('Schwer', 'Hard') + '</button>';
    els.diffRow = diffRow;
    diffRow.addEventListener('click', function(ev) {
      var b = ev.target.closest && ev.target.closest('.tt-diff');
      if (b) setDifficulty(b.getAttribute('data-diff'));
    });
    shell.appendChild(diffRow);

    // Duration select (timed mode)
    var durWrap = document.createElement('div');
    durWrap.className = 'tt-duration';
    durWrap.id = 'tt-duration';
    durWrap.style.display = 'none';
    durWrap.innerHTML = '<label for="tt-duration-select">' + T('Dauer', 'Duration') + '</label>'
      + '<select id="tt-duration-select" class="tt-duration-select">'
      + '<option value="15">15 s</option>'
      + '<option value="30" selected>30 s</option>'
      + '<option value="60">60 s</option>'
      + '<option value="120">120 s</option>'
      + '</select>';
    els.durationWrap = durWrap;
    var durSel = durWrap.querySelector('select');
    durSel.addEventListener('change', function() {
      state.duration = parseInt(durSel.value, 10) || 30;
      els.status.textContent = T('Klicke Start. Tippe so viel wie möglich in ' + fmtNum(state.duration, 0) + ' s.',
        'Click Start. Type as much as you can in ' + fmtNum(state.duration, 0) + ' s.');
    });
    shell.appendChild(durWrap);

    // Start button
    var startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'btn btn-primary btn-generate tt-start';
    startBtn.textContent = T('Start', 'Start');
    startBtn.id = 'tt-start';
    els.startBtn = startBtn;
    startBtn.addEventListener('click', function() {
      if (state.mode === 'timed') { startTimed(); }
      else { startRound(true); } // main Start / "Neue Runde" always loads a fresh quote
    });
    shell.appendChild(startBtn);

    // Status bar
    var status = document.createElement('div');
    status.className = 'tt-status';
    status.id = 'tt-status';
    els.status = status;
    shell.appendChild(status);

    // Quote display + transparent capture input
    var quoteWrap = document.createElement('div');
    quoteWrap.className = 'tt-quote-wrap';
    quoteWrap.id = 'tt-quote-wrap';
    var quoteSpan = document.createElement('span');
    quoteSpan.className = 'tt-quote';
    quoteSpan.id = 'tt-quote';
    els.quote = quoteSpan;
    els.quoteWrap = quoteWrap;
    quoteWrap.appendChild(quoteSpan);

    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'tt-capture';
    inp.id = 'tt-capture';
    inp.tabIndex = 0;
    els.input = inp;
    quoteWrap.appendChild(inp);

    var hint = document.createElement('div');
    hint.className = 'tt-hint';
    hint.id = 'tt-hint';
    hint.textContent = T('Klicke hier und fang an zu tippen. Auto-Korrektur im Browser wird umgangen.',
      'Click here and start typing. Autocorrect in the browser is bypassed.');
    els.hint = hint;
    quoteWrap.appendChild(hint);

    shell.appendChild(quoteWrap);

    container.appendChild(shell);
    els.output = getEl('tool-output');

    bindInput();
    setMode('round');
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  function init() {
    buildUI();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Test hooks
  var testApi = {
    QUOTES: QUOTES,
    getBank: getBank,
    buildQuote: buildQuote,
    applyChar: applyChar,
    applyBackspace: applyBackspace,
    computeStats: computeStats,
    pickQuote: pickQuote
  };
  if (typeof window !== 'undefined') {
    window.__TT_TEST__ = testApi;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = testApi;
  }
})();
