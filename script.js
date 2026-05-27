/* ─────────────────────────────────────────────────────────────
   CDL Calculator — script.js
   ───────────────────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════
   1.  AMBIENT BACKGROUND CANVAS
   Floating particles that drift slowly; brighter ones cluster
   near the calculator's glow zone.
   ═══════════════════════════════════════════════════════════════ */
(function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');

  let W, H, particles;

  const PARTICLE_COUNT  = 55;
  const BLUE            = [37, 99, 235];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x:     Math.random() * W,
      y:     Math.random() * H,
      r:     Math.random() * 1.4 + 0.3,
      vx:    (Math.random() - 0.5) * 0.18,
      vy:    (Math.random() - 0.5) * 0.18,
      alpha: Math.random() * 0.4 + 0.05,
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Subtle dot grid
    ctx.fillStyle = 'rgba(30, 45, 69, 0.22)';
    const spacing = 40;
    for (let x = spacing / 2; x < W; x += spacing) {
      for (let y = spacing / 2; y < H; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -4)  p.x = W + 4;
      if (p.x > W+4) p.x = -4;
      if (p.y < -4)  p.y = H + 4;
      if (p.y > H+4) p.y = -4;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${BLUE[0]},${BLUE[1]},${BLUE[2]},${p.alpha})`;
      ctx.fill();
    });

    // Faint radial glow in the center to match the calculator's bloom
    const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.min(W, H) * 0.55);
    grad.addColorStop(0,   'rgba(37,99,235,0.045)');
    grad.addColorStop(1,   'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); });
  init();
  draw();
})();


/* ═══════════════════════════════════════════════════════════════
   2.  HEADER TYPEWRITER / GLITCH EFFECT
   Scrambles letters then resolves to "CDL CALCULATOR"
   ═══════════════════════════════════════════════════════════════ */
(function initHeaderGlitch() {
  const el     = document.getElementById('header-text');
  const TARGET = 'CDL CALCULATOR';
  const CHARS  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';

  let frame     = 0;
  let resolved  = 0;          // how many chars are locked in
  const SPEED   = 2;          // frames per character advance
  const SCRAMBLE_ROUNDS = 14; // total scramble frames before locking

  function randomChar() {
    return CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  // Wait for page to be visible, then run
  setTimeout(() => {
    const interval = setInterval(() => {
      frame++;

      if (frame % SPEED === 0 && resolved < TARGET.length) {
        resolved++;
      }

      if (resolved >= TARGET.length) {
        el.textContent = TARGET;
        clearInterval(interval);
        return;
      }

      let display = '';
      for (let i = 0; i < TARGET.length; i++) {
        if (TARGET[i] === ' ') { display += ' '; continue; }
        if (i < resolved) {
          display += TARGET[i];
        } else {
          display += randomChar();
        }
      }
      el.textContent = display;
    }, 45);
  }, 200);
})();


/* ═══════════════════════════════════════════════════════════════
   3.  CALCULATOR STATE & LOGIC
   ═══════════════════════════════════════════════════════════════ */
const state = {
  current:     '0',
  operand:     null,
  operator:    null,
  justEvaled:  false,
  error:       false,
  _awaitInput: false,
};

const valueEl = document.getElementById('value');
const exprEl  = document.getElementById('expr');

// ── Render ──────────────────────────────────────────────────────
function render() {
  valueEl.textContent = state.error
    ? 'Cannot divide by 0'
    : formatNumber(state.current);

  valueEl.classList.toggle('is-error', state.error);

  if (state.operator && state.operand !== null && !state.justEvaled) {
    exprEl.textContent = `${formatNumber(state.operand)} ${state.operator}`;
  } else {
    exprEl.textContent = '';
  }
}

function formatNumber(val) {
  if (val === null || val === undefined) return '0';
  const str = String(val);
  if (str.includes('.')) return str;
  const n = parseFloat(str);
  if (isNaN(n)) return str;
  if (Math.abs(n) >= 1e15) return n.toExponential(6);
  return n.toLocaleString('en-US', { maximumFractionDigits: 10 });
}

// ── Math ─────────────────────────────────────────────────────────
function toNum(s) {
  return parseFloat(String(s).replace(/,/g, ''));
}

function calculate(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? null : a / b;
    case '%': return a % b;
    default:  return b;
  }
}

function clampDisplay(val) {
  const str = String(val);
  if (str.includes('.') && str.split('.')[1].length > 10) {
    return parseFloat(val.toFixed(10)).toString();
  }
  return str;
}

// ── Actions ───────────────────────────────────────────────────────
const actions = {
  digit(d) {
    if (state.error) return;
    if (state._awaitInput) {
      state.current    = d;
      state._awaitInput = false;
      render(); return;
    }
    if (state.justEvaled) {
      state.current    = d;
      state.operand    = null;
      state.operator   = null;
      state.justEvaled = false;
    } else if (state.current === '0' && d !== '.') {
      state.current = d;
    } else {
      if (state.current.replace('-', '').length >= 15) return;
      state.current += d;
    }
    render();
  },

  decimal() {
    if (state.error) return;
    if (state._awaitInput) {
      state.current     = '0.';
      state._awaitInput = false;
      render(); return;
    }
    if (state.justEvaled) {
      state.current    = '0.';
      state.justEvaled = false;
      render(); return;
    }
    if (!state.current.includes('.')) {
      state.current += '.';
      render();
    }
  },

  operator(op) {
    if (state.error) return;
    if (state.operator && state.operand !== null && !state.justEvaled && !state._awaitInput) {
      const result = calculate(toNum(state.operand), state.operator, toNum(state.current));
      if (result === null) { state.error = true; render(); return; }
      state.operand = clampDisplay(result);
      state.current = state.operand;
    } else {
      state.operand = state.current;
    }
    state.operator    = op;
    state.justEvaled  = false;
    state._awaitInput = true;
    render();
  },

  equals() {
    if (state.error)                           return;
    if (state.operator === null
     || state.operand  === null)               return;
    if (state.justEvaled)                      return;

    const result = calculate(toNum(state.operand), state.operator, toNum(state.current));

    if (result === null) {
      state.error = true; render(); return;
    }

    state.current    = clampDisplay(result);
    state.operand    = null;
    state.operator   = null;
    state.justEvaled = true;
    render();

    // "Pop" animation on result
    valueEl.classList.remove('pop');
    void valueEl.offsetWidth; // reflow trick
    valueEl.classList.add('pop');
    setTimeout(() => valueEl.classList.remove('pop'), 200);

    // Shoot particles on equals
    shootParticles();
  },

  clear() {
    state.current    = '0';
    state.operand    = null;
    state.operator   = null;
    state.justEvaled = false;
    state.error      = false;
    state._awaitInput = false;
    render();
  },

  backspace() {
    if (state.error)      { actions.clear(); return; }
    if (state.justEvaled) { actions.clear(); return; }
    if (state.current.length <= 1
     || (state.current.length === 2 && state.current[0] === '-')) {
      state.current = '0';
    } else {
      state.current = state.current.slice(0, -1);
    }
    render();
  },

  sign() {
    if (state.error) return;
    const n = toNum(state.current);
    if (n === 0) return;
    state.current = clampDisplay(-n);
    render();
  },
};


/* ═══════════════════════════════════════════════════════════════
   4.  PARTICLE BURST ON EQUALS
   Small blue sparks fly from the = key when you get a result.
   ═══════════════════════════════════════════════════════════════ */
function shootParticles() {
  const eqBtn = document.querySelector('[data-action="equals"]');
  if (!eqBtn) return;
  const rect   = eqBtn.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.top  + rect.height / 2;
  const COUNT  = 14;

  for (let i = 0; i < COUNT; i++) {
    const dot = document.createElement('span');
    dot.style.cssText = `
      position: fixed;
      left: ${cx}px;
      top: ${cy}px;
      width: ${3 + Math.random() * 3}px;
      height: ${3 + Math.random() * 3}px;
      border-radius: 50%;
      background: hsl(${210 + Math.random() * 30}, 90%, ${55 + Math.random()*25}%);
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
    `;
    document.body.appendChild(dot);

    const angle = (Math.PI * 2 / COUNT) * i + (Math.random() - 0.5) * 0.5;
    const dist  = 28 + Math.random() * 40;
    const tx    = Math.cos(angle) * dist;
    const ty    = Math.sin(angle) * dist;
    const dur   = 380 + Math.random() * 200;

    dot.animate([
      { transform: 'translate(-50%, -50%) scale(1)',  opacity: 1 },
      { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(0,0.9,0.57,1)', fill: 'forwards' })
      .onfinish = () => dot.remove();
  }
}


/* ═══════════════════════════════════════════════════════════════
   5.  RIPPLE EFFECT ON BUTTON PRESS
   ═══════════════════════════════════════════════════════════════ */
function addRipple(btn, clientX, clientY) {
  const rect   = btn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  const x      = (clientX ?? rect.left + rect.width  / 2) - rect.left - size / 2;
  const y      = (clientY ?? rect.top  + rect.height / 2) - rect.top  - size / 2;
  const ripple = document.createElement('span');
  ripple.classList.add('ripple');
  ripple.style.width  = ripple.style.height = `${size}px`;
  ripple.style.left   = `${x}px`;
  ripple.style.top    = `${y}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

function flashKey(btn, x, y) {
  addRipple(btn, x, y);
  btn.classList.add('is-pressed');
  setTimeout(() => btn.classList.remove('is-pressed'), 120);
}


/* ═══════════════════════════════════════════════════════════════
   6.  EVENT WIRING — mouse/touch + keyboard
   ═══════════════════════════════════════════════════════════════ */
document.getElementById('keypad').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  if      (action === 'digit')    actions.digit(btn.dataset.digit);
  else if (action === 'operator') actions.operator(btn.dataset.op);
  else if (actions[action])       actions[action]();

  flashKey(btn, e.clientX, e.clientY);
});

const keyMap = {
  '0':'digit:0','1':'digit:1','2':'digit:2','3':'digit:3','4':'digit:4',
  '5':'digit:5','6':'digit:6','7':'digit:7','8':'digit:8','9':'digit:9',
  '.':'decimal', ',':'decimal',
  '+':'operator:+', '-':'operator:−', '*':'operator:×', '/':'operator:÷',
  'Enter':'equals', '=':'equals',
  'Backspace':'backspace', 'Delete':'clear', 'Escape':'clear',
};

document.addEventListener('keydown', e => {
  const mapped = keyMap[e.key];
  if (!mapped) return;
  e.preventDefault();

  const [act, val] = mapped.split(':');
  if      (act === 'digit')    actions.digit(val);
  else if (act === 'operator') actions.operator(val);
  else if (actions[act])       actions[act]();

  const btn = document.querySelector(
    act === 'digit'    ? `[data-digit="${val}"]`  :
    act === 'operator' ? `[data-op="${val}"]`      :
    `[data-action="${act}"]`
  );
  if (btn) flashKey(btn);
});


/* ═══════════════════════════════════════════════════════════════
   7.  INIT
   ═══════════════════════════════════════════════════════════════ */
render();
