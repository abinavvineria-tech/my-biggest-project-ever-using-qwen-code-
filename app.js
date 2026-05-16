// Utility: NTfy notification
function sendNTFY(title, message) {
  fetch('https://ntfy.sh/ai_ntfy', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: `${title} | ${message}`,
  }).catch(() => {});
}

// Navigation handling
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const target = link.dataset.target || link.getAttribute('href').substring(1);
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(target).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
  });
});

// Geometry Dash mini‑game
(() => {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let avatar = { x: 50, y: 150, w: 30, h: 30, dy: 0 };
  const gravity = 0.8;
  const jumpStrength = -12;
  let obstacles = [];
  let score = 0;
  let gameOver = false;
  const spawnObstacle = () => {
    const size = 20 + Math.random() * 30;
    obstacles.push({ x: canvas.width, y: canvas.height - size, w: size, h: size });
  };
  const resetGame = () => {
    avatar.y = 150; avatar.dy = 0; obstacles = []; score = 0; gameOver = false; document.getElementById('score').innerText = '0';
  };
  const loop = () => {
    if (gameOver) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Avatar physics
    avatar.dy += gravity;
    avatar.y += avatar.dy;
    if (avatar.y + avatar.h > canvas.height) { avatar.y = canvas.height - avatar.h; avatar.dy = 0; }
    // Draw avatar
    ctx.fillStyle = '#ff416c';
    ctx.fillRect(avatar.x, avatar.y, avatar.w, avatar.h);
    // Obstacles
    obstacles.forEach((obs, i) => {
      obs.x -= 4;
      ctx.fillStyle = '#00ffcc';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      // Collision
      if (
        avatar.x < obs.x + obs.w &&
        avatar.x + avatar.w > obs.x &&
        avatar.y < obs.y + obs.h &&
        avatar.y + avatar.h > obs.y
      ) {
        gameOver = true;
        sendNTFY('Game Over', `Your score: ${score}`);
      }
    });
    // Remove off‑screen obstacles
    obstacles = obstacles.filter(o => o.x + o.w > 0);
    // Score
    score++;
    document.getElementById('score').innerText = score;
    requestAnimationFrame(loop);
  };
  // Controls
  window.addEventListener('keydown', e => { if (e.code === 'Space') avatar.dy = jumpStrength; });
  document.getElementById('gameCanvas').addEventListener('click', () => { avatar.dy = jumpStrength; });
  document.getElementById('restartBtn').addEventListener('click', () => { resetGame(); loop(); });
  // Start game loop and obstacle spawning
  setInterval(spawnObstacle, 1800);
  loop();
})();

// CRK Tracker (login streak with multi‑user support)
(() => {
  const loginBtn = document.getElementById('loginBtn');
  const streakEl = document.getElementById('streak');
  const totalDaysEl = document.getElementById('totalDays');
  const userListEl = document.getElementById('userList');
  const usernameInput = document.getElementById('usernameInput');
  const STORAGE_KEY = 'crkStreaks'; // stores {username: {last, count}}

  const loadAll = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const saveAll = data => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  const updateUI = (user, data) => {
    streakEl.innerText = data.count;
    const all = loadAll();
    const total = Object.values(all).reduce((sum, u) => sum + (u.count || 0), 0);
    totalDaysEl.innerText = total;
    // Update last event display and notify
    const lastEventEl = document.getElementById('lastEvent');
    const eventMsg = `${user} logged in, streak ${data.count} days`;
    lastEventEl.innerText = eventMsg;
    sendNTFY('CRK Event', eventMsg);
    // Populate user list
    userListEl.innerHTML = '';
    Object.entries(all).forEach(([name, u]) => {
      const li = document.createElement('li');
      li.textContent = `${name}: ${u.count} days`;
      userListEl.appendChild(li);
    });
  };

  loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim() || 'guest';
    const today = new Date().toDateString();
    const all = loadAll();
    const userData = all[username] || { last: null, count: 0 };
    if (userData.last !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (userData.last === yesterday.toDateString()) {
        userData.count += 1;
      } else {
        userData.count = 1;
      }
      userData.last = today;
      all[username] = userData;
      saveAll(all);
      updateUI(username, userData);
      sendNTFY('CRK Login', `${username} streak increased to ${userData.count} days`);
    } else {
      // Already logged today – still notify about the attempt
      sendNTFY('CRK Login', `${username} already logged in today (streak ${userData.count} days)`);
    }
    // Auto‑show Gacha section after login
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.getElementById('gacha').classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const gachaNav = document.querySelector('.nav-link[href="#gacha"]');
    if (gachaNav) gachaNav.classList.add('active');
  });

  // Initial load for default guest
  const all = loadAll();
  const guest = all['guest'] || { last: null, count: 0 };
  updateUI('guest', guest);
})();

// CRK mini-game (simple click‑counter that awards points)
(() => {
  const btn = document.getElementById('crkGameBtn');
  const scoreEl = document.getElementById('crkGameScore');
  let score = 0;
  const increment = () => {
    score++;
    scoreEl.innerText = score;
    sendNTFY('CRK Game', `Score ${score}`);
    if (score % 10 === 0) {
      sendNTFY('CRK Game Milestone', `Reached ${score} points!`);
    }
  };
  if (btn) btn.addEventListener('click', increment);
})();

// Gacha system
(() => {
  const rewards = ['Common', 'Rare', 'Beast', 'Ancient'];
  const weights = [0.6, 0.25, 0.1, 0.05];
  const historyKey = 'gachaHistory';
  const openBtn = document.getElementById('openGacha');
  const lastReward = document.getElementById('lastReward');
  const historyList = document.getElementById('gachaHistory');
  const loadHistory = () => JSON.parse(localStorage.getItem(historyKey) || '[]');
  const saveHistory = arr => localStorage.setItem(historyKey, JSON.stringify(arr));
  const draw = () => {
    const r = Math.random();
    let cum = 0;
    for (let i = 0; i < rewards.length; i++) {
      cum += weights[i];
      if (r <= cum) return rewards[i];
    }
    return rewards[0];
  };
  const render = () => {
    const hist = loadHistory();
    lastReward.innerText = hist[0] || 'None';
    historyList.innerHTML = '';
    hist.forEach((r, i) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `https://cookierunkingdom.fandom.com/wiki/Category:Cookie_Rarities#${encodeURIComponent(r)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = r;
      li.textContent = `${i + 1}. `;
      li.appendChild(link);
      historyList.appendChild(li);
    });
  };
  openBtn.addEventListener('click', () => {
    const reward = draw();
    const hist = loadHistory();
    hist.unshift(reward);
    saveHistory(hist);
    render();
    // Notify Gacha pull
    sendNTFY('Gacha Pull', `You received a ${reward} reward`);
    // Update CRK last event UI and send CRK Event notification for Gacha access
    const lastEventEl = document.getElementById('lastEvent');
    const eventMsg = `Gacha opened, reward ${reward}`;
    if (lastEventEl) lastEventEl.innerText = eventMsg;
    sendNTFY('CRK Event', eventMsg);
  });
  render();
})();

// Tools Hub
// Timer
(() => {
  const startBtn = document.getElementById('startTimer');
  const input = document.getElementById('timerInput');
  const display = document.getElementById('timerDisplay');
  let interval;
  startBtn.addEventListener('click', () => {
    clearInterval(interval);
    let secs = parseInt(input.value, 10);
    if (isNaN(secs) || secs <= 0) return;
    display.innerText = secs;
    interval = setInterval(() => {
      secs--;
      display.innerText = secs;
      if (secs <= 0) { clearInterval(interval); sendNTFY('Timer', 'Time is up!'); }
    }, 1000);
  });
})();
// Notes
(() => {
  const area = document.getElementById('notesArea');
  const key = 'notesContent';
  area.value = localStorage.getItem(key) || '';
  area.addEventListener('input', () => localStorage.setItem(key, area.value));
})();
// Click counter
(() => {
  const btn = document.getElementById('clickBtn');
  const countEl = document.getElementById('clickCount');
  let count = parseInt(localStorage.getItem('clickCount') || '0', 10);
  countEl.innerText = count;
  btn.addEventListener('click', () => {
    count++;
    countEl.innerText = count;
    localStorage.setItem('clickCount', count);
    sendNTFY('Click', `Count is now ${count}`);
  });
})();
// Calculator
(() => {
  const input = document.getElementById('calcInput');
  const evalBtn = document.getElementById('calcEval');
  const result = document.getElementById('calcResult');
  evalBtn.addEventListener('click', () => {
    try {
      // eslint-disable-next-line no-eval
      const val = eval(input.value);
      result.innerText = `= ${val}`;
    } catch (e) {
      result.innerText = 'Error';
    }
  });
})();
