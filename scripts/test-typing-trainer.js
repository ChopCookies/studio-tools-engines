// Unit tests for typing-trainer pure core (run with node, no browser DOM).
const TT = require('../public/assets/js/typing-trainer.js');
let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, '\n   got ', g, '\n   want', w); }
}
function ok(name, cond) { cond ? (pass++, console.log('ok -', name)) : (fail++, console.log('FAIL -', name)); }

// buildQuote handles Unicode surrogate pairs + spaces
let q = TT.buildQuote("Hi!"); // 3 chars
eq("buildQuote length", q.length, 3);
eq("buildQuote states", q.map(c => c.state), ['p','p','p']);

// A realistic emoji-free quote with a space
q = TT.buildQuote("go now");
eq("chars incl space", q.map(c => c.ch), ['g','o',' ','n','o','w']);

// applyChar: correct advance, wrong stay
let st = { quote: "abc", chars: TT.buildQuote("abc"), pos: 0, correct: 0, errors: 0 };
eq("correct first -> advance", TT.applyChar(st, 'a'), 'advance');
eq("pos after correct", st.pos, 1);
eq("correct count", st.correct, 1);
eq("char state c", st.chars[0].state, 'c');
eq("wrong -> stay", TT.applyChar(st, 'x'), 'stay');
eq("pos stays", st.pos, 1);
eq("errors", st.errors, 1);
eq("char state e", st.chars[1].state, 'e');
eq("then correct -> advance", TT.applyChar(st, 'b'), 'advance');
eq("errors still 1", st.errors, 1);
eq("complete on last", TT.applyChar(st, 'c'), 'complete');
eq("correct count final", st.correct, 3);
eq("pos at end", st.pos, 3);
eq("ignore when done", TT.applyChar(st, 'z'), 'ignore');

// WPM math: 50 correct chars in 60s -> one word = 5 chars => 10 wpm
let s = TT.computeStats(50, 0, 60000);
eq("wpm 50/60s", s.wpm, 10);
eq("accuracy 100", Math.round(s.accuracy), 100);
let s2 = TT.computeStats(30, 10, 60000);
eq("wpm 30 correct/60s", s2.wpm, 6);
eq("accuracy 75", Math.round(s2.accuracy), 75);

// applyBackspace
st = { quote: "ab", chars: TT.buildQuote("ab"), pos: 1, correct: 1, errors: 0 };
ok("backspace moves back", TT.applyBackspace(st));
eq("backspace pos", st.pos, 0);
eq("backspace resets char", st.chars[0].state, 'p');
ok("backspace guarded at 0", !TT.applyBackspace(st));

// pickQuote rotation returns valid indices and differs from last
// (in Node the shared default difficulty is 'easy', so bounds are easy-bank sized)
const easyLen = TT.QUOTES.easy.length;
let last = -1;
const idxs = new Set();
for (let i = 0; i < 40; i++) {
  let p = TT.pickQuote(last);
  idxs.add(p.index);
  ok("pick differs from last", p.index !== last);
  ok("pick within easy bank bounds", p.index >= 0 && p.index < easyLen);
  last = p.index;
}
ok("pick covers multiple quotes", idxs.size > 1);

// Em-dash freedom: no quote contains an em dash (site rule), per bank
['easy', 'medium', 'hard'].forEach(function(diff) {
  ok("no em dashes in " + diff, !TT.QUOTES[diff].some(x => x.indexOf('\u2014') >= 0));
  ok(diff + " quotes non-empty", TT.QUOTES[diff].length >= 10);
});

// Difficulty tiers: hard quotes are strictly longer on average than easy
function avgLen(diff) {
  return TT.QUOTES[diff].reduce((a, q) => a + q.length, 0) / TT.QUOTES[diff].length;
}
ok("hard longer than medium", avgLen('hard') > avgLen('medium'));
ok("medium longer than easy", avgLen('medium') > avgLen('easy'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
