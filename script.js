// ============================================================
// Turing Machine Simulator — Core Engine
// ============================================================

const CELL_WIDTH = 64; // 60px cell + 4px gap
const TAPE_VISIBLE_SIZE = 41; // odd, so head sits on center
const BLANK_DEFAULT = '_';

// ---------- State ----------
const TM = {
  tape: [],
  head: 0,
  state: 'q0',
  steps: 0,
  rules: [],        // [{state, read, newState, write, move}]
  initialState: 'q0',
  acceptStates: new Set(['qA']),
  rejectStates: new Set(['qR']),
  blank: '_',
  status: 'idle',   // idle | running | accepted | rejected | halted
  inputString: '1011',
};

let runTimer = null;
let currentSpeed = 350;

// ---------- Preset Machines ----------
const PRESETS = {
  palindrome: {
    label: 'Palindrome Checker',
    input: '1011011',
    initialState: 'q0',
    acceptStates: 'qA',
    rejectStates: 'qR',
    blank: '_',
    rules: [
      // q0: read first symbol, mark and remember
      { state: 'q0', read: '0', newState: 'q1', write: '_', move: 'R' },
      { state: 'q0', read: '1', newState: 'q2', write: '_', move: 'R' },
      { state: 'q0', read: '_', newState: 'qA', write: '_', move: 'S' },
      // q1: scan right to end (saw 0)
      { state: 'q1', read: '0', newState: 'q1', write: '0', move: 'R' },
      { state: 'q1', read: '1', newState: 'q1', write: '1', move: 'R' },
      { state: 'q1', read: '_', newState: 'q3', write: '_', move: 'L' },
      // q2: scan right to end (saw 1)
      { state: 'q2', read: '0', newState: 'q2', write: '0', move: 'R' },
      { state: 'q2', read: '1', newState: 'q2', write: '1', move: 'R' },
      { state: 'q2', read: '_', newState: 'q4', write: '_', move: 'L' },
      // q3: check last symbol is 0
      { state: 'q3', read: '0', newState: 'q5', write: '_', move: 'L' },
      { state: 'q3', read: '1', newState: 'qR', write: '1', move: 'S' },
      { state: 'q3', read: '_', newState: 'qA', write: '_', move: 'S' },
      // q4: check last symbol is 1
      { state: 'q4', read: '1', newState: 'q5', write: '_', move: 'L' },
      { state: 'q4', read: '0', newState: 'qR', write: '0', move: 'S' },
      { state: 'q4', read: '_', newState: 'qA', write: '_', move: 'S' },
      // q5: rewind left
      { state: 'q5', read: '0', newState: 'q5', write: '0', move: 'L' },
      { state: 'q5', read: '1', newState: 'q5', write: '1', move: 'L' },
      { state: 'q5', read: '_', newState: 'q0', write: '_', move: 'R' },
    ],
  },

  binaryIncrement: {
    label: 'Binary Increment (+1)',
    input: '1011',
    initialState: 'q0',
    acceptStates: 'qA',
    rejectStates: 'qR',
    blank: '_',
    rules: [
      // Walk right to end
      { state: 'q0', read: '0', newState: 'q0', write: '0', move: 'R' },
      { state: 'q0', read: '1', newState: 'q0', write: '1', move: 'R' },
      { state: 'q0', read: '_', newState: 'q1', write: '_', move: 'L' },
      // Add 1 with carry
      { state: 'q1', read: '0', newState: 'qA', write: '1', move: 'S' },
      { state: 'q1', read: '1', newState: 'q1', write: '0', move: 'L' },
      { state: 'q1', read: '_', newState: 'qA', write: '1', move: 'S' },
    ],
  },

  binaryAdder: {
    // Input format: a+b (binary), e.g. "101+11" → 1000
    label: 'Binary Adder',
    input: '101+11',
    initialState: 'q0',
    acceptStates: 'qA',
    rejectStates: 'qR',
    blank: '_',
    rules: [
      // Walk to end to find last digit of b
      { state: 'q0', read: '0', newState: 'q0', write: '0', move: 'R' },
      { state: 'q0', read: '1', newState: 'q0', write: '1', move: 'R' },
      { state: 'q0', read: '+', newState: 'q0', write: '+', move: 'R' },
      { state: 'q0', read: '_', newState: 'q1', write: '_', move: 'L' },
      // q1: pick last digit of b
      { state: 'q1', read: '0', newState: 'q2_0', write: '_', move: 'L' },
      { state: 'q1', read: '1', newState: 'q2_1', write: '_', move: 'L' },
      { state: 'q1', read: '+', newState: 'q7', write: '_', move: 'L' },
      // q2_0: walk left across b to '+', then to last digit of a — add 0
      { state: 'q2_0', read: '0', newState: 'q2_0', write: '0', move: 'L' },
      { state: 'q2_0', read: '1', newState: 'q2_0', write: '1', move: 'L' },
      { state: 'q2_0', read: '+', newState: 'q3_0', write: '+', move: 'L' },
      // q3_0: on digit of a, find rightmost unmarked (uppercase = marked)
      { state: 'q3_0', read: '0', newState: 'q5', write: 'X', move: 'R' }, // 0+0=0
      { state: 'q3_0', read: '1', newState: 'q5', write: 'Y', move: 'R' }, // 1+0=1 (Y marks "writes 1")
      { state: 'q3_0', read: 'X', newState: 'q3_0', write: 'X', move: 'L' },
      { state: 'q3_0', read: 'Y', newState: 'q3_0', write: 'Y', move: 'L' },
      { state: 'q3_0', read: '_', newState: 'q5', write: 'X', move: 'R' }, // prepend 0 (X)
      // q2_1: walk left across b to '+', then to last digit of a — add 1
      { state: 'q2_1', read: '0', newState: 'q2_1', write: '0', move: 'L' },
      { state: 'q2_1', read: '1', newState: 'q2_1', write: '1', move: 'L' },
      { state: 'q2_1', read: '+', newState: 'q3_1', write: '+', move: 'L' },
      // q3_1: adding 1 — may carry
      { state: 'q3_1', read: '0', newState: 'q5', write: 'Y', move: 'R' }, // 0+1=1
      { state: 'q3_1', read: '1', newState: 'q4c', write: 'X', move: 'L' }, // 1+1=0 carry
      { state: 'q3_1', read: 'X', newState: 'q3_1', write: 'X', move: 'L' },
      { state: 'q3_1', read: 'Y', newState: 'q3_1', write: 'Y', move: 'L' },
      { state: 'q3_1', read: '_', newState: 'q5', write: 'Y', move: 'R' }, // prepend 1
      // q4c: carry propagate on a
      { state: 'q4c', read: '0', newState: 'q5', write: 'Y', move: 'R' },
      { state: 'q4c', read: '1', newState: 'q4c', write: 'X', move: 'L' },
      { state: 'q4c', read: '_', newState: 'q5', write: 'Y', move: 'R' },
      // q5: walk right back to end and resume with q1
      { state: 'q5', read: '0', newState: 'q5', write: '0', move: 'R' },
      { state: 'q5', read: '1', newState: 'q5', write: '1', move: 'R' },
      { state: 'q5', read: 'X', newState: 'q5', write: 'X', move: 'R' },
      { state: 'q5', read: 'Y', newState: 'q5', write: 'Y', move: 'R' },
      { state: 'q5', read: '+', newState: 'q5', write: '+', move: 'R' },
      { state: 'q5', read: '_', newState: 'q1', write: '_', move: 'L' },
      // q7: done consuming b — rewrite X/Y back to 0/1
      { state: 'q7', read: '0', newState: 'q7', write: '0', move: 'L' },
      { state: 'q7', read: '1', newState: 'q7', write: '1', move: 'L' },
      { state: 'q7', read: 'X', newState: 'q7', write: '0', move: 'L' },
      { state: 'q7', read: 'Y', newState: 'q7', write: '1', move: 'L' },
      { state: 'q7', read: '_', newState: 'qA', write: '_', move: 'R' },
    ],
  },

  unaryDouble: {
    // Convert n ones to 2n ones: "111" -> "111111"
    label: 'Unary Doubler',
    input: '111',
    initialState: 'q0',
    acceptStates: 'qA',
    rejectStates: 'qR',
    blank: '_',
    rules: [
      // Mark a 1 as X, go to end, add 1, return
      { state: 'q0', read: '1', newState: 'q1', write: 'X', move: 'R' },
      { state: 'q0', read: '_', newState: 'q4', write: '_', move: 'L' }, // all done
      { state: 'q0', read: '#', newState: 'q4', write: '#', move: 'L' },
      { state: 'q1', read: '1', newState: 'q1', write: '1', move: 'R' },
      { state: 'q1', read: '#', newState: 'q2', write: '#', move: 'R' },
      { state: 'q1', read: '_', newState: 'q2', write: '#', move: 'R' },
      { state: 'q2', read: '1', newState: 'q2', write: '1', move: 'R' },
      { state: 'q2', read: '_', newState: 'q3', write: '1', move: 'L' },
      // return left to next unmarked 1
      { state: 'q3', read: '1', newState: 'q3', write: '1', move: 'L' },
      { state: 'q3', read: '#', newState: 'q3', write: '#', move: 'L' },
      { state: 'q3', read: 'X', newState: 'q0', write: 'X', move: 'R' },
      { state: 'q3', read: '_', newState: 'q0', write: '_', move: 'R' },
      // q4: cleanup — turn X back to 1, remove #
      { state: 'q4', read: '1', newState: 'q4', write: '1', move: 'L' },
      { state: 'q4', read: 'X', newState: 'q4', write: '1', move: 'L' },
      { state: 'q4', read: '#', newState: 'q5', write: '_', move: 'R' },
      { state: 'q4', read: '_', newState: 'qA', write: '_', move: 'R' },
      { state: 'q5', read: '1', newState: 'q5', write: '1', move: 'R' },
      { state: 'q5', read: '_', newState: 'qA', write: '_', move: 'S' },
    ],
  },

  zerosEqualOnes: {
    // Accepts strings 0^n 1^n
    label: 'Equal 0s and 1s (aⁿbⁿ)',
    input: '000111',
    initialState: 'q0',
    acceptStates: 'qA',
    rejectStates: 'qR',
    blank: '_',
    rules: [
      { state: 'q0', read: '0', newState: 'q1', write: 'X', move: 'R' },
      { state: 'q0', read: 'Y', newState: 'q3', write: 'Y', move: 'R' },
      { state: 'q0', read: '_', newState: 'qA', write: '_', move: 'S' },
      { state: 'q0', read: '1', newState: 'qR', write: '1', move: 'S' },
      { state: 'q1', read: '0', newState: 'q1', write: '0', move: 'R' },
      { state: 'q1', read: 'Y', newState: 'q1', write: 'Y', move: 'R' },
      { state: 'q1', read: '1', newState: 'q2', write: 'Y', move: 'L' },
      { state: 'q1', read: '_', newState: 'qR', write: '_', move: 'S' },
      { state: 'q2', read: '0', newState: 'q2', write: '0', move: 'L' },
      { state: 'q2', read: 'Y', newState: 'q2', write: 'Y', move: 'L' },
      { state: 'q2', read: 'X', newState: 'q0', write: 'X', move: 'R' },
      { state: 'q3', read: 'Y', newState: 'q3', write: 'Y', move: 'R' },
      { state: 'q3', read: '_', newState: 'qA', write: '_', move: 'S' },
      { state: 'q3', read: '0', newState: 'qR', write: '0', move: 'S' },
      { state: 'q3', read: '1', newState: 'qR', write: '1', move: 'S' },
    ],
  },

  copy: {
    // Copy input w after a separator: "101" -> "101#101"
    label: 'String Copier',
    input: '101',
    initialState: 'q0',
    acceptStates: 'qA',
    rejectStates: 'qR',
    blank: '_',
    rules: [
      { state: 'q0', read: '0', newState: 'qC0', write: 'X', move: 'R' },
      { state: 'q0', read: '1', newState: 'qC1', write: 'Y', move: 'R' },
      { state: 'q0', read: '#', newState: 'qD', write: '#', move: 'L' },
      { state: 'q0', read: '_', newState: 'qE', write: '#', move: 'R' },
      // walk right past rest + '#' and any copied, then write 0
      { state: 'qC0', read: '0', newState: 'qC0', write: '0', move: 'R' },
      { state: 'qC0', read: '1', newState: 'qC0', write: '1', move: 'R' },
      { state: 'qC0', read: '#', newState: 'qW0', write: '#', move: 'R' },
      { state: 'qW0', read: '0', newState: 'qW0', write: '0', move: 'R' },
      { state: 'qW0', read: '1', newState: 'qW0', write: '1', move: 'R' },
      { state: 'qW0', read: '_', newState: 'qBack', write: '0', move: 'L' },
      // walk right past rest + '#' and any copied, then write 1
      { state: 'qC1', read: '0', newState: 'qC1', write: '0', move: 'R' },
      { state: 'qC1', read: '1', newState: 'qC1', write: '1', move: 'R' },
      { state: 'qC1', read: '#', newState: 'qW1', write: '#', move: 'R' },
      { state: 'qW1', read: '0', newState: 'qW1', write: '0', move: 'R' },
      { state: 'qW1', read: '1', newState: 'qW1', write: '1', move: 'R' },
      { state: 'qW1', read: '_', newState: 'qBack', write: '1', move: 'L' },
      // rewind back to next unmarked
      { state: 'qBack', read: '0', newState: 'qBack', write: '0', move: 'L' },
      { state: 'qBack', read: '1', newState: 'qBack', write: '1', move: 'L' },
      { state: 'qBack', read: '#', newState: 'qBack', write: '#', move: 'L' },
      { state: 'qBack', read: 'X', newState: 'q0', write: 'X', move: 'R' },
      { state: 'qBack', read: 'Y', newState: 'q0', write: 'Y', move: 'R' },
      // qE: no input — just accept
      { state: 'qE', read: '_', newState: 'qA', write: '_', move: 'S' },
      // qD: done copying, walk left and restore X->0, Y->1
      { state: 'qD', read: '0', newState: 'qD', write: '0', move: 'L' },
      { state: 'qD', read: '1', newState: 'qD', write: '1', move: 'L' },
      { state: 'qD', read: 'X', newState: 'qD', write: '0', move: 'L' },
      { state: 'qD', read: 'Y', newState: 'qD', write: '1', move: 'L' },
      { state: 'qD', read: '_', newState: 'qA', write: '_', move: 'R' },
    ],
  },

  reverse: {
    // Reverse input: "1100" -> "0011" (simplified using shuffle)
    // Strategy: put '#' at end, then move first char to after # repeatedly
    label: 'String Reverser',
    input: '1100',
    initialState: 'q0',
    acceptStates: 'qA',
    rejectStates: 'qR',
    blank: '_',
    rules: [
      // q0: find end, mark with '#'
      { state: 'q0', read: '0', newState: 'q0', write: '0', move: 'R' },
      { state: 'q0', read: '1', newState: 'q0', write: '1', move: 'R' },
      { state: 'q0', read: '_', newState: 'q1', write: '#', move: 'L' },
      // q1: walk left to beginning
      { state: 'q1', read: '0', newState: 'q1', write: '0', move: 'L' },
      { state: 'q1', read: '1', newState: 'q1', write: '1', move: 'L' },
      { state: 'q1', read: '_', newState: 'q2', write: '_', move: 'R' },
      // q2: pick first char, mark with blank, remember it
      { state: 'q2', read: '0', newState: 'qM0', write: '_', move: 'R' },
      { state: 'q2', read: '1', newState: 'qM1', write: '_', move: 'R' },
      { state: 'q2', read: '#', newState: 'qD', write: '_', move: 'L' },
      // qM0: walk to end (past '#' and any written), write 0
      { state: 'qM0', read: '0', newState: 'qM0', write: '0', move: 'R' },
      { state: 'qM0', read: '1', newState: 'qM0', write: '1', move: 'R' },
      { state: 'qM0', read: '#', newState: 'qM0', write: '#', move: 'R' },
      { state: 'qM0', read: '_', newState: 'q1', write: '0', move: 'L' },
      { state: 'qM1', read: '0', newState: 'qM1', write: '0', move: 'R' },
      { state: 'qM1', read: '1', newState: 'qM1', write: '1', move: 'R' },
      { state: 'qM1', read: '#', newState: 'qM1', write: '#', move: 'R' },
      { state: 'qM1', read: '_', newState: 'q1', write: '1', move: 'L' },
      // qD: cleanup — shift reversed part left over blanks
      { state: 'qD', read: '_', newState: 'qD', write: '_', move: 'L' },
      { state: 'qD', read: '0', newState: 'qA', write: '0', move: 'S' },
      { state: 'qD', read: '1', newState: 'qA', write: '1', move: 'S' },
    ],
  },

  parity: {
    // Accept strings with even number of 1s
    label: 'Even Number of 1s',
    input: '1011',
    initialState: 'qE',
    acceptStates: 'qA',
    rejectStates: 'qR',
    blank: '_',
    rules: [
      // qE = even seen so far
      { state: 'qE', read: '0', newState: 'qE', write: '0', move: 'R' },
      { state: 'qE', read: '1', newState: 'qO', write: '1', move: 'R' },
      { state: 'qE', read: '_', newState: 'qA', write: '_', move: 'S' },
      // qO = odd
      { state: 'qO', read: '0', newState: 'qO', write: '0', move: 'R' },
      { state: 'qO', read: '1', newState: 'qE', write: '1', move: 'R' },
      { state: 'qO', read: '_', newState: 'qR', write: '_', move: 'S' },
    ],
  },
};

// ---------- DOM Refs ----------
const $ = (id) => document.getElementById(id);
const tapeTrack = $('tapeTrack');
const currentStateEl = $('currentState');
const headPosEl = $('headPos');
const stepCountEl = $('stepCount');
const symbolReadEl = $('symbolRead');
const resultBadgeEl = $('resultBadge');
const logBox = $('logBox');
const rulesBody = $('rulesBody');
const statusBadge = $('statusBadge');
const inputTapeEl = $('inputTape');
const speedSlider = $('speedSlider');
const speedValEl = $('speedVal');
const initialStateEl = $('initialState');
const acceptStatesEl = $('acceptStates');
const rejectStatesEl = $('rejectStates');
const blankSymbolEl = $('blankSymbol');

// ---------- Tape Helpers ----------
function readTape(pos) {
  if (pos < 0 || pos >= TM.tape.length) return TM.blank;
  return TM.tape[pos];
}

function writeTape(pos, sym) {
  while (pos < 0) {
    TM.tape.unshift(TM.blank);
    pos++;
    TM.head++;
  }
  while (pos >= TM.tape.length) {
    TM.tape.push(TM.blank);
  }
  TM.tape[pos] = sym;
  return pos;
}

function renderTape(writtenPos = null) {
  // Build cells to the left and right of head for smooth centering
  const pad = Math.floor(TAPE_VISIBLE_SIZE / 2);
  const start = TM.head - pad;
  const end = TM.head + pad;

  tapeTrack.innerHTML = '';
  for (let i = start; i <= end; i++) {
    const cell = document.createElement('div');
    cell.className = 'tape-cell';
    const sym = readTape(i);
    if (sym === TM.blank) cell.classList.add('blank');
    cell.textContent = sym;

    const idx = document.createElement('span');
    idx.className = 'idx';
    idx.textContent = i;
    cell.appendChild(idx);

    if (i === TM.head) cell.classList.add('active');
    if (writtenPos !== null && i === writtenPos) cell.classList.add('written');

    tapeTrack.appendChild(cell);
  }
  // center track so head cell lines up with .tape-head (which is centered)
  // Because .tape-track uses padding: 0 50%, the content is already centered.
  // Each cell is 60px + 4px gap = 64px. We need the head's cell (index pad) to sit at center.
  // The padding already places the first cell at center; subsequent cells extend to the right.
  // We want cell #pad to be centered, so shift track left by pad * CELL_WIDTH.
  tapeTrack.style.transform = `translateX(-${pad * CELL_WIDTH}px)`;
}

// ---------- UI Updates ----------
function updateUI(writtenPos = null) {
  renderTape(writtenPos);
  currentStateEl.textContent = TM.state;
  headPosEl.textContent = TM.head;
  stepCountEl.textContent = TM.steps;
  symbolReadEl.textContent = readTape(TM.head);

  // Update state badge colors
  statusBadge.className = 'status-badge';
  resultBadgeEl.className = '';
  switch (TM.status) {
    case 'running':
      statusBadge.classList.add('running');
      statusBadge.textContent = 'RUNNING';
      resultBadgeEl.textContent = '…';
      break;
    case 'accepted':
      statusBadge.classList.add('accepted');
      statusBadge.textContent = 'ACCEPTED';
      resultBadgeEl.textContent = 'ACCEPT';
      resultBadgeEl.classList.add('accept');
      break;
    case 'rejected':
      statusBadge.classList.add('rejected');
      statusBadge.textContent = 'REJECTED';
      resultBadgeEl.textContent = 'REJECT';
      resultBadgeEl.classList.add('reject');
      break;
    case 'halted':
      statusBadge.classList.add('halted');
      statusBadge.textContent = 'HALTED';
      resultBadgeEl.textContent = 'HALT';
      resultBadgeEl.classList.add('halt');
      break;
    default:
      statusBadge.textContent = 'IDLE';
      resultBadgeEl.textContent = '—';
  }
}

function log(msg, cls = '') {
  const div = document.createElement('div');
  div.className = `log-entry ${cls}`;
  div.innerHTML = msg;
  logBox.appendChild(div);
  logBox.scrollTop = logBox.scrollHeight;
}

function highlightRule(index) {
  rulesBody.querySelectorAll('tr').forEach(r => r.classList.remove('highlight'));
  const row = rulesBody.children[index];
  if (row) row.classList.add('highlight');
}

// ---------- Rule Lookup ----------
function findRule() {
  const sym = readTape(TM.head);
  for (let i = 0; i < TM.rules.length; i++) {
    const r = TM.rules[i];
    if (r.state === TM.state && r.read === sym) return { rule: r, index: i };
  }
  return null;
}

// ---------- Step Execution ----------
function step() {
  if (TM.status === 'accepted' || TM.status === 'rejected' || TM.status === 'halted') {
    return false;
  }

  // Check accept/reject on current state before trying to transition
  if (TM.acceptStates.has(TM.state)) {
    TM.status = 'accepted';
    log(`<span class="step-no">#${TM.steps}</span>Entered accept state <span class="s">${TM.state}</span> — input ACCEPTED`, 'accept');
    updateUI();
    stopAutoRun();
    return false;
  }
  if (TM.rejectStates.has(TM.state)) {
    TM.status = 'rejected';
    log(`<span class="step-no">#${TM.steps}</span>Entered reject state <span class="s">${TM.state}</span> — input REJECTED`, 'reject');
    updateUI();
    stopAutoRun();
    return false;
  }

  const match = findRule();
  if (!match) {
    TM.status = 'halted';
    log(`<span class="step-no">#${TM.steps}</span>No rule for <span class="s">(${TM.state}, ${readTape(TM.head)})</span> — HALT`, 'halt');
    updateUI();
    stopAutoRun();
    return false;
  }

  const { rule, index } = match;
  const readSym = readTape(TM.head);

  // apply
  const writtenPos = writeTape(TM.head, rule.write);
  TM.state = rule.newState;
  if (rule.move === 'L') TM.head--;
  else if (rule.move === 'R') TM.head++;
  // 'S' = stay
  TM.steps++;

  log(
    `<span class="step-no">#${TM.steps}</span>` +
    `<span class="s">${rule.state}</span>, ` +
    `<span class="r">${readSym}</span> → ` +
    `<span class="s">${rule.newState}</span>, ` +
    `<span class="w">${rule.write}</span>, ` +
    `<span class="m">${rule.move}</span>`
  );

  highlightRule(index);
  updateUI(writtenPos);

  // Check immediate accept/reject after transition
  if (TM.acceptStates.has(TM.state)) {
    TM.status = 'accepted';
    log(`→ Entered accept state <span class="s">${TM.state}</span> — input ACCEPTED`, 'accept');
    updateUI();
    stopAutoRun();
    return false;
  }
  if (TM.rejectStates.has(TM.state)) {
    TM.status = 'rejected';
    log(`→ Entered reject state <span class="s">${TM.state}</span> — input REJECTED`, 'reject');
    updateUI();
    stopAutoRun();
    return false;
  }

  return true;
}

// ---------- Auto Run ----------
function startAutoRun() {
  if (TM.status === 'accepted' || TM.status === 'rejected' || TM.status === 'halted') {
    resetTape(true);
  }
  TM.status = 'running';
  $('runBtn').disabled = true;
  $('pauseBtn').disabled = false;
  $('stepBtn').disabled = true;
  updateUI();
  runTimer = setInterval(() => {
    const ok = step();
    if (!ok) stopAutoRun();
  }, currentSpeed);
}

function stopAutoRun() {
  if (runTimer) {
    clearInterval(runTimer);
    runTimer = null;
  }
  $('runBtn').disabled = false;
  $('pauseBtn').disabled = true;
  $('stepBtn').disabled = false;
  if (TM.status === 'running') TM.status = 'idle';
  updateUI();
}

// ---------- Reset / Load Input ----------
function parseStateList(str) {
  return new Set(str.split(',').map(s => s.trim()).filter(Boolean));
}

function resetTape(keepInput = false) {
  stopAutoRun();
  TM.blank = (blankSymbolEl.value || BLANK_DEFAULT).charAt(0) || BLANK_DEFAULT;
  TM.initialState = initialStateEl.value.trim() || 'q0';
  TM.acceptStates = parseStateList(acceptStatesEl.value);
  TM.rejectStates = parseStateList(rejectStatesEl.value);

  TM.inputString = inputTapeEl.value;
  const input = TM.inputString.length > 0 ? TM.inputString : TM.blank;
  // pad with blanks
  const padding = 20;
  TM.tape = [];
  for (let i = 0; i < padding; i++) TM.tape.push(TM.blank);
  for (const ch of input) TM.tape.push(ch);
  for (let i = 0; i < padding; i++) TM.tape.push(TM.blank);
  TM.head = padding;
  TM.state = TM.initialState;
  TM.steps = 0;
  TM.status = 'idle';

  if (!keepInput) {
    logBox.innerHTML = '';
    log(`<span class="step-no">#0</span>Loaded input <span class="r">"${TM.inputString}"</span>, start state <span class="s">${TM.state}</span>`);
  }
  updateUI();
}

// ---------- Rule Rendering ----------
function renderRules() {
  rulesBody.innerHTML = '';
  TM.rules.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" data-field="state" data-i="${i}" value="${escape(r.state)}" /></td>
      <td><input type="text" data-field="read" data-i="${i}" value="${escape(r.read)}" maxlength="3" /></td>
      <td><input type="text" data-field="newState" data-i="${i}" value="${escape(r.newState)}" /></td>
      <td><input type="text" data-field="write" data-i="${i}" value="${escape(r.write)}" maxlength="3" /></td>
      <td>
        <select data-field="move" data-i="${i}">
          <option value="L" ${r.move==='L'?'selected':''}>L</option>
          <option value="R" ${r.move==='R'?'selected':''}>R</option>
          <option value="S" ${r.move==='S'?'selected':''}>S</option>
        </select>
      </td>
      <td><button class="del-btn" data-del="${i}" title="Delete rule">×</button></td>
    `;
    rulesBody.appendChild(tr);
  });
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

rulesBody.addEventListener('input', (e) => {
  const t = e.target;
  const i = +t.dataset.i;
  const field = t.dataset.field;
  if (!field || isNaN(i) || !TM.rules[i]) return;
  TM.rules[i][field] = t.value;
});

rulesBody.addEventListener('click', (e) => {
  const del = e.target.dataset.del;
  if (del !== undefined) {
    TM.rules.splice(+del, 1);
    renderRules();
  }
});

$('addRuleBtn').addEventListener('click', () => {
  TM.rules.push({ state: 'q0', read: '0', newState: 'q0', write: '0', move: 'R' });
  renderRules();
});

// ---------- Preset Loader ----------
function loadPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  TM.rules = p.rules.map(r => ({ ...r }));
  inputTapeEl.value = p.input;
  initialStateEl.value = p.initialState;
  acceptStatesEl.value = p.acceptStates;
  rejectStatesEl.value = p.rejectStates;
  blankSymbolEl.value = p.blank;
  renderRules();
  resetTape();
  log(`<span class="step-no">★</span>Loaded preset: <span class="s">${p.label}</span>`);
}

$('presetSelect').addEventListener('change', (e) => {
  const v = e.target.value;
  if (v) loadPreset(v);
});

// ---------- Controls ----------
$('stepBtn').addEventListener('click', () => {
  if (TM.status === 'accepted' || TM.status === 'rejected' || TM.status === 'halted') {
    resetTape(true);
  }
  step();
});
$('runBtn').addEventListener('click', startAutoRun);
$('pauseBtn').addEventListener('click', stopAutoRun);
$('resetBtn').addEventListener('click', () => resetTape());
$('loadInputBtn').addEventListener('click', () => resetTape());
$('clearLogBtn').addEventListener('click', () => { logBox.innerHTML = ''; });

inputTapeEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') resetTape();
});

speedSlider.addEventListener('input', (e) => {
  // Invert: left = slow, right = fast → we want ms; slider max=1000 means slowest
  // To make "right = faster", invert: speed = (max + min) - val
  const v = +e.target.value;
  currentSpeed = 1050 - v;
  speedValEl.textContent = `${currentSpeed}ms`;
  if (runTimer) {
    clearInterval(runTimer);
    runTimer = setInterval(() => {
      const ok = step();
      if (!ok) stopAutoRun();
    }, currentSpeed);
  }
});
// initial
currentSpeed = 1050 - (+speedSlider.value);
speedValEl.textContent = `${currentSpeed}ms`;

// ---------- Boot ----------
loadPreset('palindrome');
$('presetSelect').value = 'palindrome';
