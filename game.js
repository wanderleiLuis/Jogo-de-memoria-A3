/* ═══════════════════════════════════════
   1. EMOJIS E CONFIGURAÇÕES
═══════════════════════════════════════ */

// Temas de emojis — um é sorteado a cada novo jogo
const EMOJIS = {
  space:   ['🚀','🪐','🌟','🛸','🌙','💫','🌈','⚡','🌌','🔭'],
  animals: ['🦁','🐯','🦊','🐺','🦅','🦋','🐬','🐘','🦒','🦓'],
  food:    ['🍕','🍔','🌮','🍜','🍣','🍩','🎂','🍎','🍇','🥑'],
};

// Configurações por dificuldade
const DIFF = {
  easy:   { cols: 4, rows: 3, pairs: 6,  hints: 3, timeLimit: 120 },
  medium: { cols: 4, rows: 4, pairs: 8,  hints: 3, timeLimit: 180 },
  hard:   { cols: 5, rows: 4, pairs: 10, hints: 2, timeLimit: 240 },
};


/* ═══════════════════════════════════════
   2. ESTADO DO JOGO
═══════════════════════════════════════ */

let difficulty   = 'easy';  // dificuldade atual
let cards        = [];      // todas as cartas do DOM
let flipped      = [];      // cartas viradas aguardando comparação
let matched      = [];      // emojis já encontrados
let attempts     = 0;       // total de tentativas
let score        = 0;       // pontuação atual
let bestScore    = 0;       // melhor pontuação da sessão
let hints        = 3;       // dicas restantes
let elapsed      = 0;       // segundos passados
let timerInterval = null;   // referência do setInterval
let gameRunning  = false;   // jogo em andamento?
let lockBoard    = false;   // trava para evitar cliques duplos
let soundOn      = true;    // som ligado?


/* ═══════════════════════════════════════
   3. SELETORES DO DOM
═══════════════════════════════════════ */

const grid             = document.getElementById('card-grid');
const scoreEl          = document.getElementById('score');
const bestScoreEl      = document.getElementById('bestScore');
const attemptsLeftEl   = document.getElementById('attemptsLeft');
const attemptsDisplay  = document.getElementById('attemptsDisplay');
const timerEl          = document.getElementById('timer');
const pairsEl          = document.getElementById('pairsDisplay');
const hintBtn          = document.getElementById('hintBtn');
const hintCount        = document.getElementById('hintCount');
const levelBadge       = document.getElementById('levelBadge');
const tipText          = document.getElementById('tipText');
const winModal         = document.getElementById('winModal');
const modalEmoji       = document.getElementById('modalEmoji');
const modalTitle       = document.getElementById('modalTitle');
const modalSubtitle    = document.getElementById('modalSubtitle');
const soundBtn         = document.getElementById('soundBtn');


/* ═══════════════════════════════════════
   4. INICIAR NOVO JOGO
═══════════════════════════════════════ */

// Função para carregar cartas de fonte externa respeitando tema escolhido
async function loadCardsByTheme(themeChoice) {
  try {
    const response = await fetch("cards.json");
    if (!response.ok) throw new Error("Erro ao carregar cards.json");
    const data = await response.json();

    // Se for aleatório, sorteia um tema
    if (themeChoice === "random") {
      const themes = [...new Set(data.map(c => c.theme))];
      themeChoice = themes[Math.floor(Math.random() * themes.length)];
    }

    // Filtra emojis do tema escolhido
    return data.filter(c => c.theme === themeChoice).map(c => c.emoji);
  } catch (e) {
    console.warn("⚠️ Falha ao carregar cards.json, usando fallback EMOJIS.");
    return EMOJIS[themeChoice] || EMOJIS.space;
  }
}

async function newGame() {
  const cfg = DIFF[difficulty];

  // Reset estado
  attempts = 0;
  score = 0;
  flipped = [];
  matched = [];
  lockBoard = false;
  gameRunning = false;
  hints = cfg.hints;

  stopTimer();
  elapsed = 0;
  updateTimer();

  // Usa tema escolhido nas Configurações
  const pool = await loadCardsByTheme(settings.emojiTheme);
  const selected = pool.slice(0, cfg.pairs);

  // Duplica e embaralha
  const deck = [...selected, ...selected].sort(() => Math.random() - 0.5);

  // Monta grade no DOM
  grid.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
  grid.innerHTML = '';
  cards = [];

  deck.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.emoji = emoji;
    card.dataset.idx = i;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-back">
          <div class="card-back-pattern"></div>
        </div>
        <div class="card-face">${emoji}</div>
      </div>
    `;

    card.addEventListener('click', () => flipCard(card));
    grid.appendChild(card);
    cards.push(card);
  });

  // Atualiza interface
  updateUI();
  updateLevelBadge();
  updateHintBtn();
  updatePairs();
  setTip('Clique nas cartas para virá-las! Encontre todos os pares.');
}


/* ═══════════════════════════════════════
   5. LÓGICA DE VIRAR CARTAS
═══════════════════════════════════════ */

function flipCard(card) {
  // Ignora se: tabuleiro travado, carta já virada ou já encontrada
  if (lockBoard) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;

  // Inicia o timer no primeiro clique
  if (!gameRunning) {
    gameRunning = true;
    startTimer();
  }

  card.classList.add('flipped');
  playSound('flip');
  flipped.push(card);

  // Quando duas cartas estão viradas, compara
  if (flipped.length === 2) {
    lockBoard = true;
    attempts++;
    updateUI();
    checkMatch();
  }
}

function checkMatch() {
  const [cardA, cardB] = flipped;
  const isMatch = cardA.dataset.emoji === cardB.dataset.emoji;

  if (isMatch) {
    // ✅ Acertou!
    setTimeout(() => {
      cardA.classList.add('matched');
      cardB.classList.add('matched');
      matched.push(cardA.dataset.emoji);

      playSound('match');
      addScore();
      updatePairs();

      flipped   = [];
      lockBoard = false;

      // Verifica se completou o jogo
      if (matched.length === DIFF[difficulty].pairs) {
        gameWon();
      }
    }, 400);

  } else {
    // ❌ Errou — mostra em vermelho e esconde novamente
    setTimeout(() => {
      cardA.classList.add('wrong');
      cardB.classList.add('wrong');

      setTimeout(() => {
        cardA.classList.remove('flipped', 'wrong');
        cardB.classList.remove('flipped', 'wrong');
        flipped   = [];
        lockBoard = false;
      }, 400);
    }, 600);
  }
}


/* ═══════════════════════════════════════
   6. PONTUAÇÃO
═══════════════════════════════════════ */

function addScore() {
  const cfg = DIFF[difficulty];

  // Pontos base + bônus pelo tempo restante
  const timeBonus = Math.max(0, cfg.timeLimit - elapsed);
  const points    = 100 + Math.floor(timeBonus / 2);

  score += points;
  updateUI();
}


/* ═══════════════════════════════════════
   7. VITÓRIA E DERROTA
═══════════════════════════════════════ */

function gameWon() {
  stopTimer();
  saveResult(true); // partida vencida
  gameRunning = false;

  // Atualiza melhor pontuação
  if (score > bestScore) bestScore = score;

  playSound('win');
  spawnConfetti();

  // Avalia com estrelas
  const cfg    = DIFF[difficulty];
  const perfect = cfg.pairs;
  let stars;
  if (attempts <= perfect + 2)      stars = '⭐⭐⭐';
  else if (attempts <= perfect + 5) stars = '⭐⭐';
  else                              stars = '⭐';

  // Abre o modal após um pequeno delay
  setTimeout(() => {
    modalEmoji.textContent   = '🎉';
    modalTitle.textContent   = 'PARABÉNS!';
    modalSubtitle.textContent = `Você completou o jogo! ${stars}`;

    document.getElementById('wTime').textContent     = formatTime(elapsed);
    document.getElementById('wAttempts').textContent = attempts;
    document.getElementById('wScore').textContent    = score;

    winModal.classList.add('show');
  }, 600);
}

function gameOver() {
  stopTimer();
  saveResult(false); // partida perdida
  gameRunning = false;

  playSound('lose');

  modalEmoji.textContent    = '😔';
  modalTitle.textContent    = 'TEMPO ESGOTADO!';
  modalSubtitle.textContent = `Você encontrou ${matched.length} de ${DIFF[difficulty].pairs} pares.`;

  document.getElementById('wTime').textContent     = formatTime(elapsed);
  document.getElementById('wAttempts').textContent = attempts;
  document.getElementById('wScore').textContent    = score;

  winModal.classList.add('show');
}

function closeModal() {
  winModal.classList.remove('show');
}


/* ═══════════════════════════════════════
   8. DICA
═══════════════════════════════════════ */

function useHint() {
  if (hints <= 0 || lockBoard) return;

  hints--;
  updateHintBtn();
  playSound('hint');
  setTip('💡 Dica usada! Observe bem antes que as cartas virem novamente.');

  // Revela todas as cartas por 1.2 segundos
  const hidden = cards.filter(c =>
    !c.classList.contains('flipped') &&
    !c.classList.contains('matched')
  );

  lockBoard = true;
  hidden.forEach(c => {
    c.classList.add('flipped');
    c.style.pointerEvents = 'none';
  });

  setTimeout(() => {
    hidden.forEach(c => {
      c.classList.remove('flipped');
      c.style.pointerEvents = '';
    });
    lockBoard = false;
    flipped   = [];
  }, 1200);
}


/* ═══════════════════════════════════════
   9. TIMER
═══════════════════════════════════════ */

function startTimer() {
  timerInterval = setInterval(() => {
    elapsed++;
    updateTimer();

    // Esgotou o tempo?
    if (elapsed >= DIFF[difficulty].timeLimit) {
      stopTimer();
      gameOver();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  gameRunning   = false;
}

function updateTimer() {
  timerEl.textContent = formatTime(elapsed);
}

// Converte segundos em "MM:SS"
function formatTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const r = String(s % 60).padStart(2, '0');
  return `${m}:${r}`;
}


/* ═══════════════════════════════════════
   10. ATUALIZAR INTERFACE
═══════════════════════════════════════ */

function updateUI() {
  scoreEl.textContent         = score;
  bestScoreEl.textContent     = bestScore;
  attemptsLeftEl.textContent  = attempts;
  attemptsDisplay.textContent = attempts;
}

function updatePairs() {
  pairsEl.textContent = `${matched.length} / ${DIFF[difficulty].pairs}`;
}

function updateHintBtn() {
  hintCount.textContent  = `⚡ ${hints} restantes`;
  hintBtn.disabled       = hints <= 0;
}

function updateLevelBadge() {
  const labels = { easy: 'Nível 1', medium: 'Nível 2', hard: 'Nível 3' };
  levelBadge.textContent = labels[difficulty];
}

function setTip(text) {
  tipText.textContent = text;
}


/* ═══════════════════════════════════════
   11. SOM (Web Audio API)
═══════════════════════════════════════ */

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Toca um tom simples com frequência e duração definidos
function playTone(freq, duration, type = 'sine', volume = 0.15) {
  if (!soundOn) return;
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type            = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playSound(type) {
  if (type === 'flip') {
    playTone(440, 0.08, 'sine', 0.1);
  }
  if (type === 'match') {
    playTone(523, 0.1);
    setTimeout(() => playTone(659, 0.15), 100);
    setTimeout(() => playTone(784, 0.2),  220);
  }
  if (type === 'hint') {
    playTone(330, 0.3, 'triangle', 0.08);
  }
  if (type === 'win') {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.3), i * 120);
    });
  }
  if (type === 'lose') {
    [440, 330, 220].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.3, 'sawtooth', 0.08), i * 150);
    });
  }
}


/* ═══════════════════════════════════════
   12. CONFETES
═══════════════════════════════════════ */

function spawnConfetti() {
  const colors = ['#7c3aed','#a855f7','#f59e0b','#22c55e','#3b82f6','#ec4899'];

  for (let i = 0; i < 60; i++) {
    setTimeout(() => {
      const el    = document.createElement('div');
      el.className = 'confetti-piece';

      const size  = 6 + Math.random() * 8;
      const isCircle = Math.random() > 0.5;

      el.style.cssText = `
        left: ${Math.random() * 100}vw;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        width: ${size}px;
        height: ${size}px;
        border-radius: ${isCircle ? '50%' : '2px'};
        animation-duration: ${1.5 + Math.random() * 2}s;
      `;

      document.body.appendChild(el);

      // Remove do DOM após a animação
      setTimeout(() => el.remove(), 3500);
    }, i * 40);
  }
}


/* ═══════════════════════════════════════
   13. EVENTOS
═══════════════════════════════════════ */

// Botões de dificuldade
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
    newGame();
  });
});

// Botão de dica
hintBtn.addEventListener('click', useHint);

// Botão novo jogo (painel direito)
document.getElementById('newGameBtn').addEventListener('click', newGame);

// Botão novo jogo (modal)
document.getElementById('modalPlayAgain').addEventListener('click', () => {
  closeModal();
  newGame();
});

// Botão fechar modal
document.getElementById('modalClose').addEventListener('click', closeModal);

// Botão de som
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? '🔊' : '🔇';
});


/* ═══════════════════════════════════════
   14. INICIALIZAÇÃO
═══════════════════════════════════════ */

newGame();

/* ═══════════════════════════════════════
   CONFIGURAÇÕES
═══════════════════════════════════════ */

// Estado das configurações
const settings = {
  emojiTheme: 'random',
  visualTheme: 'purple',
  playerName: 'Jogador',
};

// Temas visuais — substitui as cores CSS
const THEMES = {
  purple: { accent: '#7c3aed', accent2: '#a855f7', border: 'rgba(124,58,237,0.25)' },
  blue:   { accent: '#1d4ed8', accent2: '#3b82f6', border: 'rgba(59,130,246,0.25)'  },
  green:  { accent: '#15803d', accent2: '#22c55e', border: 'rgba(34,197,94,0.25)'   },
  red:    { accent: '#b91c1c', accent2: '#ef4444', border: 'rgba(239,68,68,0.25)'   },
};

// Abre o modal de configurações
document.getElementById('settingsBtn').addEventListener('click', openSettings);

function openSettings() {
  // Preenche o input com o nome atual
  document.getElementById('playerNameInput').value = settings.playerName;

  // Marca o botão ativo de emoji
  document.querySelectorAll('[data-emoji]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.emoji === settings.emojiTheme);
  });

  // Marca o botão ativo de tema
  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === settings.visualTheme);
  });

  document.getElementById('settingsModal').classList.add('show');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('show');
}

// Clique nos botões de opção (emoji e tema)
document.querySelectorAll('[data-emoji]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-emoji]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.querySelectorAll('[data-theme]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Salva e aplica as configurações
document.getElementById('saveSettings').addEventListener('click', () => {
  // Lê o nome
  const name = document.getElementById('playerNameInput').value.trim();
  settings.playerName = name || 'Jogador';
  document.querySelector('.player-name').textContent = settings.playerName;

  // Lê o tema de emoji selecionado
  const emojiBtn = document.querySelector('[data-emoji].active');
  if (emojiBtn) settings.emojiTheme = emojiBtn.dataset.emoji;

  // Lê o tema visual selecionado
  const themeBtn = document.querySelector('[data-theme].active');
  if (themeBtn) {
    settings.visualTheme = themeBtn.dataset.theme;
    applyVisualTheme(settings.visualTheme);
  }

  closeSettingsModal();

  // Reinicia o jogo com as novas configurações
  newGame();
});

document.getElementById('closeSettings').addEventListener('click', closeSettingsModal);

// Aplica o tema visual trocando as variáveis CSS no :root
function applyVisualTheme(themeName) {
  const theme = THEMES[themeName];
  const root  = document.documentElement.style;
  root.setProperty('--accent',  theme.accent);
  root.setProperty('--accent2', theme.accent2);
  root.setProperty('--border',  theme.border);
}

/* ═══════════════════════════════════════
   RANKING E HISTÓRICO
═══════════════════════════════════════ */

// Chave usada no localStorage
const STORAGE_KEY = 'memoryGame_history';

// Carrega o histórico salvo (ou array vazio)
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// Salva o histórico no localStorage
function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

// Registra uma partida no histórico
function saveResult(won) {
  const history = loadHistory();

  const entry = {
    id:         Date.now(),
    playerName: settings.playerName,
    difficulty,
    score,
    attempts,
    time:       elapsed,
    pairs:      matched.length,
    totalPairs: DIFF[difficulty].pairs,
    won,
    date:       new Date().toLocaleDateString('pt-BR'),
    hour:       new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };

  history.unshift(entry); // adiciona no início (mais recente primeiro)

  // Mantém no máximo 50 partidas salvas
  if (history.length > 50) history.pop();

  saveHistory(history);
}

// Abre o modal e renderiza o ranking
function openRanking(filter = 'all') {
  const history = loadHistory();

  // Filtra por dificuldade se necessário
  const filtered = filter === 'all'
    ? history
    : history.filter(e => e.difficulty === filter);

  // Ordena por pontuação (maior primeiro)
  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  const list = document.getElementById('rankingList');

  if (sorted.length === 0) {
    list.innerHTML = `
      <div class="ranking-empty">
        <span>🎮</span>
        Nenhuma partida registrada ainda.<br>
        Jogue e volte para ver seu histórico!
      </div>
    `;
  } else {
    list.innerHTML = sorted.map((entry, index) => {
      const pos = index + 1;

      // Medalha para o top 3
      const medal =
        pos === 1 ? '🥇' :
        pos === 2 ? '🥈' :
        pos === 3 ? '🥉' :
        `#${pos}`;

      const rankClass =
        pos === 1 ? 'rank-1' :
        pos === 2 ? 'rank-2' :
        pos === 3 ? 'rank-3' : '';

      const diffLabel = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' }[entry.difficulty];
      const result    = entry.won ? '✅ Vitória' : '❌ Derrota';
      const time      = formatTime(entry.time);

      return `
        <div class="ranking-item ${rankClass}">
          <div class="ranking-position">${medal}</div>
          <div class="ranking-info">
            <div class="ranking-name">${entry.playerName}</div>
            <div class="ranking-meta">
              <span>${diffLabel}</span>
              <span>⏱ ${time}</span>
              <span>🔄 ${entry.attempts} tentativas</span>
              <span>${result}</span>
              <span>${entry.date} ${entry.hour}</span>
            </div>
          </div>
          <div class="ranking-score">⭐ ${entry.score}</div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('rankingModal').classList.add('show');
}

function closeRankingModal() {
  document.getElementById('rankingModal').classList.remove('show');
}

// Eventos do ranking
document.getElementById('rankingBtn').addEventListener('click', () => openRanking('all'));
document.getElementById('closeRanking').addEventListener('click', closeRankingModal);

document.getElementById('clearRanking').addEventListener('click', () => {
  if (confirm('Tem certeza que quer apagar todo o histórico?')) {
    localStorage.removeItem(STORAGE_KEY);
    openRanking('all'); // atualiza a lista vazia
  }
});

// Filtros de dificuldade dentro do ranking
document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    openRanking(btn.dataset.filter);
  });
});

/* ═══════════════════════════════════════
   BOTÃO SAIR
═══════════════════════════════════════ */
document.getElementById('exitBtn').addEventListener('click', () => {
  const mensagem = gameRunning
    ? 'Tem certeza que quer sair? O progresso da partida será perdido.'
    : 'Tem certeza que quer fechar o jogo?';

  if (confirm(mensagem)) {
    window.close(); // fecha a aba

    // Fallback: se o navegador bloquear o window.close(),
    // mostra uma mensagem orientando o usuário
    setTimeout(() => {
      setTip('⚠️ Seu navegador bloqueou o fechamento automático. Feche a aba manualmente.');
    }, 300);
  }
});