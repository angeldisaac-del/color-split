const THEMES = [
  { id: 'coral', name: 'Coral / Azul', c1: '#e11d48', g1: 'linear-gradient(135deg,#fb7185,#be123c)', c2: '#0284c7', g2: 'linear-gradient(135deg,#38bdf8,#0369a1)' },
  { id: 'emerald', name: 'Verde / Ámbar', c1: '#059669', g1: 'linear-gradient(135deg,#34d399,#047857)', c2: '#d97706', g2: 'linear-gradient(135deg,#fbbf24,#b45309)' },
  { id: 'violet', name: 'Violeta / Menta', c1: '#7c3aed', g1: 'linear-gradient(135deg,#a78bfa,#5b21b6)', c2: '#0d9488', g2: 'linear-gradient(135deg,#2dd4bf,#0f766e)' },
  { id: 'sunset', name: 'Naranja / Índigo', c1: '#ea580c', g1: 'linear-gradient(135deg,#fb923c,#c2410c)', c2: '#4f46e5', g2: 'linear-gradient(135deg,#818cf8,#3730a3)' }
];

const SHAPES = [
  { id: 'classic', s1: '●', s2: '◆' },
  { id: 'geo', s1: '▲', s2: '■' },
  { id: 'fun', s1: '♥', s2: '★' },
  { id: 'signs', s1: '✚', s2: '✖' }
];

const TXT = {
  es: { score: 'Puntos', best: 'Récord', sub: 'Toca la pantalla para intercambiar las barras. Atrapa cada gema según su color y forma.', play: '▶ JUGAR', settings: 'Personalizar', theme: 'Colores', shapes: 'Formas', lang: 'Idioma', done: 'Listo', pause: 'Pausa', pauseSub: 'Tómate un respiro y mantén tus reflejos listos.', resume: 'Continuar', restart: 'Reiniciar Partida', over: '¡Fin del Juego!', final: 'Puntuación Final: ', cont: '🎬 Continuar (Ver Anuncio)', again: 'Jugar de Nuevo' },
  en: { score: 'Score', best: 'Best', sub: 'Tap anywhere to swap the catcher pads. Match each gem by color and shape.', play: '▶ PLAY', settings: 'Customize', theme: 'Colors', shapes: 'Shapes', lang: 'Language', done: 'Done', pause: 'Paused', pauseSub: 'Take a breather and keep reflexes sharp.', resume: 'Resume', restart: 'Restart Game', over: 'Game Over!', final: 'Final Score: ', cont: '🎬 Continue (Watch Ad)', again: 'Play Again' }
};

let themeId = localStorage.getItem('cs_theme') || 'coral';
let shapeId = localStorage.getItem('cs_shape') || 'classic';
let lang = localStorage.getItem('cs_lang') || 'es';
let score = 0, best = parseInt(localStorage.getItem('cs_best') || '0');
let isMuted = localStorage.getItem('cs_muted') === 'true';
let isPaused = true, started = false, usedCont = false, swapped = false;
let gems = [], lastTime = 0, spawnTimer = 0, spawnCount = 0;
let audioCtx = null, musicTimer = null, noteIdx = 0;

const getTheme = () => THEMES.find(t => t.id === themeId) || THEMES;
const getShape = () => SHAPES.find(s => s.id === shapeId) || SHAPES;

function applyVisualStyle() {
  const th = getTheme(), sh = getShape();
  const pL = document.getElementById('padLeft'), pR = document.getElementById('padRight');
  pL.style.background = th.g1; pR.style.background = th.g2;
  document.getElementById('iconLeft').textContent = sh.s1;
  document.getElementById('iconRight').textContent = sh.s2;
  document.getElementById('logoLeft').textContent = sh.s1; document.getElementById('logoLeft').style.color = th.c1;
  document.getElementById('logoRight').textContent = sh.s2; document.getElementById('logoRight').style.color = th.c2;
  gems.forEach(g => {
    if (g.type === 'c1') { g.el.style.background = th.g1; g.el.textContent = sh.s1; }
    if (g.type === 'c2') { g.el.style.background = th.g2; g.el.textContent = sh.s2; }
  });
}

function renderSettings() {
  document.getElementById('themeGrid').innerHTML = THEMES.map(t => `<button class="opt-btn ${t.id === themeId ? 'selected' : ''}" onclick="setTheme('${t.id}')"><span class="dot-prev" style="background:${t.c1}"></span><span class="dot-prev" style="background:${t.c2}"></span>${t.name}</button>`).join('');
  document.getElementById('shapeGrid').innerHTML = SHAPES.map(s => `<button class="opt-btn ${s.id === shapeId ? 'selected' : ''}" onclick="setShape('${s.id}')">${s.s1}  /  ${s.s2}</button>`).join('');
  document.getElementById('btnEs').classList.toggle('selected', lang === 'es');
  document.getElementById('btnEn').classList.toggle('selected', lang === 'en');
}

function setTheme(id) { themeId = id; localStorage.setItem('cs_theme', id); applyVisualStyle(); renderSettings(); }
function setShape(id) { shapeId = id; localStorage.setItem('cs_shape', id); applyVisualStyle(); renderSettings(); }
function setLang(l) { lang = l; localStorage.setItem('cs_lang', l); applyLang(); renderSettings(); }
function openSettings() { isPaused = true; renderSettings(); document.getElementById('settingsOverlay').classList.add('active'); }
function closeSettings() { isPaused = !started; lastTime = 0; document.getElementById('settingsOverlay').classList.remove('active'); }

function playTone(f, type, d, vol) {
  if (isMuted || document.hidden) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, audioCtx.currentTime);
  g.gain.setValueAtTime(vol || 0.12, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + d);
}

function scheduleMusic() {
  if (musicTimer) clearTimeout(musicTimer);
  const notes = [261.6, 329.6, 392.0, 493.9, 523.3, 493.9, 392.0, 329.6];
  const tempoMs = Math.max(250, 460 - Math.floor(score / 15) * 28);
  if (!isMuted && !isPaused && started && !document.hidden) {
    const f = notes[noteIdx % notes.length];
    playTone(f, 'sine', 0.35, 0.14);
    if (noteIdx % 2 === 0) playTone(f / 2, 'triangle', 0.4, 0.1);
    noteIdx++;
  }
  musicTimer = setTimeout(scheduleMusic, tempoMs);
}

document.addEventListener('visibilitychange', () => { if (document.hidden && audioCtx) audioCtx.suspend(); });

function applyLang() {
  const t = TXT[lang];
  document.getElementById('lblScore').textContent = t.score; document.getElementById('lblBest').textContent = t.best;
  document.getElementById('lblStartSub').textContent = t.sub; document.getElementById('lblPlayBtn').textContent = t.play;
  document.getElementById('lblSettings').textContent = t.settings; document.getElementById('lblTheme').textContent = t.theme;
  document.getElementById('lblShapes').textContent = t.shapes; document.getElementById('lblLang').textContent = t.lang;
  document.getElementById('lblDone').textContent = t.done; document.getElementById('lblPauseTitle').textContent = t.pause;
  document.getElementById('lblPauseSub').textContent = t.pauseSub; document.getElementById('lblResume').textContent = t.resume;
  document.getElementById('lblRestartPause').textContent = t.restart; document.getElementById('lblGameOver').textContent = t.over;
  document.getElementById('continueAdBtn').textContent = t.cont; document.getElementById('lblPlayAgain').textContent = t.again;
}

function toggleMute() { isMuted = !isMuted; localStorage.setItem('cs_muted', isMuted); document.getElementById('muteBtn').textContent = isMuted ? '🔇' : '🔊'; }

function updatePads() {
  document.getElementById('padLeft').style.left = swapped ? '72%' : '28%';
  document.getElementById('padRight').style.left = swapped ? '28%' : '72%';
}

function handleBoardTap() { if (!isPaused && started) { swapped = !swapped; updatePads(); } }

function spawnGem() {
  spawnCount++;
  const isGold = (spawnCount % 18 === 0);
  const lane = Math.random() < 0.5 ? 0 : 1;
  const type = isGold ? 'gold' : (Math.random() < 0.5 ? 'c1' : 'c2');
  const th = getTheme(), sh = getShape();
  const el = document.createElement('div');
  el.className = 'gem' + (isGold ? ' gem-gold' : '');
  if (isGold) { el.textContent = '★'; }
  else { el.style.background = type === 'c1' ? th.g1 : th.g2; el.textContent = type === 'c1' ? sh.s1 : sh.s2; }
  el.style.left = lane === 0 ? '28%' : '72%';
  el.style.top = '-22px';
  document.getElementById('gemsLayer').appendChild(el);
  gems.push({ el: el, lane: lane, type: type, y: -22 });
}

function gameLoop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min(0.05, (ts - lastTime) / 1000);
  lastTime = ts;

  if (started && !isPaused) {
    const boardH = document.getElementById('gameArea').clientHeight;
    const catchY = boardH - 86;
    const speed = Math.min(760, 320 + score * 3.2 + Math.floor(score / 15) * 24);
    const interval = Math.max(0.46, 1.15 - score * 0.007);

    spawnTimer += dt;
    if (spawnTimer >= interval) { spawnTimer = 0; spawnGem(); }

    const leftType = swapped ? 'c2' : 'c1';
    const rightType = swapped ? 'c1' : 'c2';

    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      g.y += speed * dt;
      g.el.style.top = g.y + 'px';

      if (g.y >= catchY - 18 && g.y <= catchY + 22) {
        const padType = g.lane === 0 ? leftType : rightType;
        if (g.type === 'gold' || g.type === padType) {
          score += g.type === 'gold' ? 5 : 1;
          if (score > best) { best = score; localStorage.setItem('cs_best', best); }
          document.getElementById('scoreVal').textContent = score;
          document.getElementById('bestVal').textContent = best;
          const padEl = document.getElementById(g.lane === 0 ? 'padLeft' : 'padRight');
          padEl.classList.add('pad-pop');
          setTimeout(() => padEl.classList.remove('pad-pop'), 110);
          g.el.remove(); gems.splice(i, 1);
          continue;
        } else {
          triggerGameOver();
          break;
        }
      }
      if (g.y > boardH + 30) { g.el.remove(); gems.splice(i, 1); }
    }
  }
  requestAnimationFrame(gameLoop);
}

function triggerGameOver() {
  isPaused = true;
  playTone(160, 'sawtooth', 0.32, 0.16);
  document.getElementById('finalScoreText').textContent = TXT[lang].final + score;
  document.getElementById('continueAdBtn').style.display = usedCont ? 'none' : 'block';
  document.getElementById('gameOverOverlay').classList.add('active');
}

function useSecondChance() {
  usedCont = true; isPaused = false; lastTime = 0;
  gems.forEach(g => g.el.remove()); gems = [];
  document.getElementById('gameOverOverlay').classList.remove('active');
}

function togglePause(p) { if (started) { isPaused = p; lastTime = 0; document.getElementById('pauseOverlay').classList.toggle('active', isPaused); } }

function startGame() {
  started = true;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const buf = audioCtx.createBuffer(1, 1, 22050), src = audioCtx.createBufferSource();
  src.buffer = buf; src.connect(audioCtx.destination); src.start(0);
  scheduleMusic();
  restartGame();
  document.getElementById('startOverlay').classList.remove('active');
}

function restartGame() {
  score = 0; usedCont = false; swapped = false; spawnTimer = 0; spawnCount = 0; lastTime = 0;
  isPaused = !started;
  gems.forEach(g => g.el.remove()); gems = [];
  updatePads();
  document.getElementById('scoreVal').textContent = 0;
  document.getElementById('bestVal').textContent = best;
  document.getElementById('pauseOverlay').classList.remove('active');
  document.getElementById('gameOverOverlay').classList.remove('active');
}

applyLang();
applyVisualStyle();
document.getElementById('muteBtn').textContent = isMuted ? '🔇' : '🔊';
restartGame();
requestAnimationFrame(gameLoop);
const origApplyLang = applyLang;
applyLang = function() {
  origApplyLang();
  const btn = document.getElementById('lblStartSettings');
  if (btn) btn.textContent = lang === 'es' ? '⚙️ Personalizar' : '⚙️ Customize';
};
applyLang();

gameLoop = function(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min(0.05, (ts - lastTime) / 1000);
  lastTime = ts;

  if (started && !isPaused) {
    const boardH = document.getElementById('gameArea').clientHeight;
    const catchY = boardH - 86;
    const speed = Math.min(760, 320 + score * 3.2 + Math.floor(score / 15) * 24);
    const interval = Math.max(0.46, 1.15 - score * 0.007);

    spawnTimer += dt;
    if (spawnTimer >= interval) { spawnTimer = 0; spawnGem(); }

    const leftType = swapped ? 'c2' : 'c1';
    const rightType = swapped ? 'c1' : 'c2';

    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      g.y += speed * dt;
      g.el.style.top = g.y + 'px';

      if (g.y >= catchY - 18 && g.y <= catchY + 22) {
        const padType = g.lane === 0 ? leftType : rightType;
        if (g.type === 'gold' || g.type === padType) {
          score += g.type === 'gold' ? 5 : 1;
          if (score > best) { best = score; localStorage.setItem('cs_best', best); }
          document.getElementById('scoreVal').textContent = score;
          document.getElementById('bestVal').textContent = best;
          const activePadId = (g.lane === 0) ? (swapped ? 'padRight' : 'padLeft') : (swapped ? 'padLeft' : 'padRight');
          const padEl = document.getElementById(activePadId);
          padEl.classList.add('pad-pop');
          setTimeout(() => padEl.classList.remove('pad-pop'), 110);
          g.el.remove(); gems.splice(i, 1);
          continue;
        } else {
          triggerGameOver();
          break;
        }
      }
      if (g.y > boardH + 30) { g.el.remove(); gems.splice(i, 1); }
    }
  }
  requestAnimationFrame(gameLoop);
};
