/* ─────────────────────────────────────────────────────────────
   CDL Calculator — script.js
   ───────────────────────────────────────────────────────────── */


/* ═══════════════════════════════════════════════════════════════
   1.  MOBILE SCALE
   The calculator has fixed internal dimensions (340px wide,
   68px keys). On viewports narrower than 356px, we shrink the
   entire wrapper proportionally so nothing ever wraps or
   overflows — the layout stays pixel-perfect at every size.
   ═══════════════════════════════════════════════════════════════ */
(function initScale() {
  const CALC_W   = 340;
  const PADDING  = 24; // total horizontal breathing room

  function applyScale() {
    const available = window.innerWidth - PADDING;
    const scale     = available < CALC_W ? available / CALC_W : 1;
    document.querySelector('.wrapper').style.setProperty('--scale', scale);
  }

  applyScale();
  window.addEventListener('resize', applyScale);
})();


/* ═══════════════════════════════════════════════════════════════
   2.  AMBIENT BACKGROUND CANVAS
   ═══════════════════════════════════════════════════════════════ */
(function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles;

  const COUNT = 50;
  const BLUE  = [37, 99, 235];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x:     Math.random() * W,
      y:     Math.random() * H,
      r:     Math.random() * 1.3 + 0.3,
      vx:    (Math.random() - 0.5) * 0.16,
      vy:    (Math.random() - 0.5) * 0.16,
      alpha: Math.random() * 0.35 + 0.05,
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, makeParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Dot grid
    ctx.fillStyle = 'rgba(30,45,69,0.20)';
    for (let x = 20; x < W; x += 40)
      for (let y = 20; y < H; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 0.65, 0, Math.PI * 2);
        ctx.fill();
      }

    // Floating particles
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -4)  p.x = W + 4;
      if (p.x > W+4) p.x = -4;
      if (p.y < -4)  p.y = H + 4;
      if (p.y > H+4) p.y = -4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${BLUE[0]},${BLUE[1]},${BLUE[2]},${p.alpha})`;
      ctx.fill();
    });

    // Center radial glow
    const g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.min(W,H) * 0.5);
    g.addColorStop(0, 'rgba(37,99,235,0.04)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();
})();


/* ═══════════════════════════════════════════════════════════════
   3.  HEADER GLITCH / TYPEWRITER
   ═══════════════════════════════════════════════════════════════ */
(function initHeaderGlitch() {
  const el     = document.getElementById('header-text');
  const TARGET = 'CDL CALCULATOR';
  const CHARS  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@!%';

  let frame = 0, resolved = 0;
  const rnd = () => CHARS[Math.floor(Math.random() * CHARS.length)];

  // Wait a beat so the page is visible first
  setTimeout(() => {
    const iv = setInterval(() => {
      frame++;
      if (frame % 2 === 0 && resolved < TARGET.length) resolved++;
      if (resolved >= TARGET.length) { el.textContent = TARGET; clearInterval(iv); return; }

      let out = '';
      for (let i = 0; i < TARGET.length; i++) {
        if (TARGET[i] === ' ') { out += ' '; continue; }
        out += i < resolved ? TARGET[i] : rnd();
      }
      el.textContent = out;
    }, 45);
  }, 280);
})();


/* ═══════════════════════════════════════════════════════════════
   4.  CALCULATOR STATE
   ═══════════════════════════════════════════════════════════════ */
const state = {
  current:     '0',   // string shown in main display
  operand:     null,  // stored left-hand number (as string) or null
  operator:    null,  // pending operator symbol or null
  justEvaled:  false, // true right after = is pressed
  awaitInput:  false, // true after operator; next digit starts fresh
  error:       false,
};

const valueEl = document.getElementById('value');
const exprEl  = document.getElementById('expr');


/* ═══════════════════════════════════════════════════════════════
   5.  RENDER  — display is always populated, never blank/broken
   ═══════════════════════════════════════════════════════════════ */
function render() {
  if (state.error) {
    valueEl.textContent = 'Cannot ÷ by 0';
    valueEl.classList.add('is-error');
    valueEl.classList.remove('shrink-1', 'shrink-2');
    exprEl.innerHTML = '&nbsp;';
    return;
  }

  valueEl.classList.remove('is-error');

  // Guard: current must always be a renderable string
  if (!state.current || state.current === '' || state.current === '-') {
    state.current = '0';
  }

  const display = formatNumber(state.current);
  valueEl.textContent = display;

  // Shrink font for long numbers
  const digits = display.replace(/[^0-9.]/g, '').length;
  valueEl.classList.toggle('shrink-1', digits >= 10 && digits < 14);
  valueEl.classList.toggle('shrink-2', digits >= 14);

  // Expression line — always occupies its height
  if (state.operator !== null && state.operand !== null) {
    exprEl.textContent = `${formatNumber(String(state.operand))} ${state.operator}`;
  } else {
    exprEl.innerHTML = '&nbsp;'; // non-breaking space keeps height
  }
}

function formatNumber(val) {
  if (val === null || val === undefined || val === '') return '0';
  const str = String(val);
  // Preserve in-progress decimal input exactly as typed
  if (str.endsWith('.') || /\.\d*0$/.test(str)) return str;
  const n = parseFloat(str);
  if (isNaN(n) || !isFinite(n)) return '0';
  if (Math.abs(n) >= 1e15) return n.toExponential(5);
  // Add thousand separators to integer part only
  const parts = str.split('.');
  parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
  return parts.join('.');
}

function toNum(s) {
  return parseFloat(String(s).replace(/,/g, '')) || 0;
}

function clamp(val) {
  const str = String(val);
  if (str.includes('.') && (str.split('.')[1]?.length ?? 0) > 10) {
    return parseFloat(val.toFixed(10)).toString();
  }
  return str;
}


/* ═══════════════════════════════════════════════════════════════
   6.  ACTIONS — every path guarded against empty/bad state
   ═══════════════════════════════════════════════════════════════ */
const actions = {

  digit(d) {
    if (state.error) return;
    if (state.awaitInput) {
      state.current    = d;
      state.awaitInput = false;
    } else if (state.justEvaled) {
      state.current    = d;
      state.operand    = null;
      state.operator   = null;
      state.justEvaled = false;
    } else if (state.current === '0') {
      state.current = d;
    } else {
      if (state.current.replace(/[-,.]/g, '').length >= 15) return;
      state.current += d;
    }
    render();
  },

  decimal() {
    if (state.error) return;
    if (state.awaitInput || state.justEvaled) {
      state.current    = '0.';
      state.awaitInput = false;
      state.justEvaled = false;
      state.operand    = state.justEvaled ? null : state.operand;
      state.operator   = state.justEvaled ? null : state.operator;
      render();
      return;
    }
    if (!state.current.includes('.')) {
      if (!state.current) state.current = '0';
      state.current += '.';
      render();
    }
  },

  operator(op) {
    if (state.error) return;
    // Ignore operator if nothing has been entered yet and current is just '0'
    // BUT we DO allow it — just store 0 as operand (e.g. 0 + 5 = 5 is valid)
    if (
      state.operator !== null &&
      state.operand  !== null &&
      !state.awaitInput
    ) {
      // Chain: evaluate previous step first
      const result = compute(toNum(state.operand), state.operator, toNum(state.current));
      if (result === null) { state.error = true; render(); return; }
      state.operand = clamp(result);
      state.current = state.operand;
    } else {
      const safe    = (!state.current || state.current === '.') ? '0' : state.current;
      state.current = safe;
      state.operand = safe;
    }
    state.operator   = op;
    state.justEvaled = false;
    state.awaitInput = true;
    render();
  },

  equals() {
    if (state.error)             return;
    if (state.operator === null) return;
    if (state.operand  === null) return;
    if (state.justEvaled)        return;

    // If user pressed op then = without a second number, use operand as rhs
    const rhs = state.awaitInput ? toNum(state.operand) : toNum(state.current);
    const result = compute(toNum(state.operand), state.operator, rhs);

    if (result === null) { state.error = true; render(); return; }

    state.current    = clamp(result);
    state.operand    = null;
    state.operator   = null;
    state.justEvaled = true;
    state.awaitInput = false;
    render();

    // Pop + particles
    valueEl.classList.remove('pop');
    void valueEl.offsetWidth;
    valueEl.classList.add('pop');
    setTimeout(() => valueEl.classList.remove('pop'), 200);
    shootParticles();
  },

  clear() {
    state.current    = '0';
    state.operand    = null;
    state.operator   = null;
    state.justEvaled = false;
    state.awaitInput = false;
    state.error      = false;
    render();
  },

  backspace() {
    if (state.error || state.justEvaled) { actions.clear(); return; }
    if (state.awaitInput) { state.awaitInput = false; render(); return; }

    if (
      state.current.length <= 1 ||
      (state.current.length === 2 && state.current[0] === '-')
    ) {
      state.current = '0';
    } else {
      state.current = state.current.slice(0, -1);
      if (state.current === '-') state.current = '0';
    }
    render();
  },

  sign() {
    if (state.error) return;
    const n = toNum(state.current);
    if (n === 0) return;
    state.current = clamp(-n);
    render();
  },
};

function compute(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? null : a / b;
    case '%': return a % b;
    default:  return b;
  }
}


/* ═══════════════════════════════════════════════════════════════
   7.  PARTICLE BURST ON EQUALS
   ═══════════════════════════════════════════════════════════════ */
function shootParticles() {
  const btn = document.querySelector('[data-action="equals"]');
  if (!btn) return;
  const r  = btn.getBoundingClientRect();
  const cx = r.left + r.width  / 2;
  const cy = r.top  + r.height / 2;

  for (let i = 0; i < 16; i++) {
    const dot = document.createElement('span');
    dot.style.cssText = `
      position:fixed; pointer-events:none; z-index:9999; border-radius:50%;
      left:${cx}px; top:${cy}px;
      width:${3 + Math.random() * 3.5}px;
      height:${3 + Math.random() * 3.5}px;
      background:hsl(${210 + Math.random()*30},88%,${55 + Math.random()*25}%);
      transform:translate(-50%,-50%);
    `;
    document.body.appendChild(dot);
    const angle = (Math.PI * 2 / 16) * i + (Math.random() - 0.5) * 0.4;
    const dist  = 30 + Math.random() * 46;
    dot.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px)) scale(0)`, opacity: 0 },
    ], { duration: 400 + Math.random()*180, easing: 'cubic-bezier(0,0.9,0.57,1)', fill: 'forwards' })
      .onfinish = () => dot.remove();
  }
}


/* ═══════════════════════════════════════════════════════════════
   8.  RIPPLE EFFECT
   ═══════════════════════════════════════════════════════════════ */
function addRipple(btn, cx, cy) {
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x    = (cx ?? rect.left + rect.width  / 2) - rect.left - size / 2;
  const y    = (cy ?? rect.top  + rect.height / 2) - rect.top  - size / 2;
  const el   = document.createElement('span');
  el.className  = 'ripple';
  el.style.width = el.style.height = `${size}px`;
  el.style.left  = `${x}px`;
  el.style.top   = `${y}px`;
  btn.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function flashKey(btn, x, y) {
  addRipple(btn, x, y);
  btn.classList.add('is-pressed');
  setTimeout(() => btn.classList.remove('is-pressed'), 120);
}


/* ═══════════════════════════════════════════════════════════════
   9.  EVENT WIRING
   ═══════════════════════════════════════════════════════════════ */

// Track touch so we don't double-fire on mobile (touchstart fires before click)
let lastTouch = 0;

document.getElementById('keypad').addEventListener('touchstart', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  lastTouch = Date.now();
  dispatch(btn.dataset.action, btn.dataset.digit, btn.dataset.op);
  flashKey(btn, e.touches[0]?.clientX, e.touches[0]?.clientY);
}, { passive: true });

document.getElementById('keypad').addEventListener('click', e => {
  // Suppress click if it was triggered by a touch within the last 500ms
  if (Date.now() - lastTouch < 500) return;
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  dispatch(btn.dataset.action, btn.dataset.digit, btn.dataset.op);
  flashKey(btn, e.clientX, e.clientY);
});

function dispatch(action, digit, op) {
  if      (action === 'digit')    actions.digit(digit);
  else if (action === 'operator') actions.operator(op);
  else if (actions[action])       actions[action]();
}

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
  dispatch(act, act === 'digit' ? val : undefined, act === 'operator' ? val : undefined);
  const btn = document.querySelector(
    act === 'digit'    ? `[data-digit="${val}"]` :
    act === 'operator' ? `[data-op="${val}"]`    :
    `[data-action="${act}"]`
  );
  if (btn) flashKey(btn);
});


/* ═══════════════════════════════════════════════════════════════
   10.  INIT
   ═══════════════════════════════════════════════════════════════ */
render();
