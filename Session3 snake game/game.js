(function() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const gridSize = 32;
  const tileCount = canvas.width / gridSize;
  const S = gridSize / 20;
  const OBSTACLE_TYPES = ['bottle', 'bag', 'can'];
  const DIFFICULTIES = {
    easy: { apples: 2, harmful: 1, hint: '۲ سیب · ۱ مضر' },
    medium: { apples: 1, harmful: 3, hint: '۱ سیب · ۳ مضر' },
    hard: { apples: 1, harmful: 5, hint: '۱ سیب · ۵ مضر' }
  };
  const SNAKE_THEMES = {
    classic: {
      headLight: '#7CF29C',
      headDark: '#22b555',
      tongue: '#e14b6a',
      speckle: 'rgba(255,255,255,0.15)',
      glow: null,
      bodyLight: (shade) => `rgba(${110 + shade * 40}, ${230 * shade}, ${140 * shade}, 1)`,
      bodyDark: (shade) => `rgba(20, ${140 * shade}, ${70 * shade}, 1)`
    },
    ice: {
      headLight: '#E0F2FE',
      headDark: '#0284C7',
      tongue: '#7DD3FC',
      speckle: 'rgba(255,255,255,0.35)',
      glow: 'rgba(56, 189, 248, 0.7)',
      bodyLight: (shade) => `rgba(${90 + shade * 80}, ${200 * shade}, ${255 * shade}, 1)`,
      bodyDark: (shade) => `rgba(15, ${90 * shade}, ${170 * shade}, 1)`
    },
    fire: {
      headLight: '#FED7AA',
      headDark: '#EA580C',
      tongue: '#FBBF24',
      speckle: 'rgba(255, 220, 120, 0.4)',
      glow: 'rgba(249, 115, 22, 0.75)',
      bodyLight: (shade) => `rgba(${255 * shade}, ${140 + shade * 50}, ${30 * shade}, 1)`,
      bodyDark: (shade) => `rgba(${170 * shade}, ${45 * shade}, 8, 1)`
    }
  };
  const INITIAL_SNAKE = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 }
  ];

  function createInitialSnake() {
    return INITIAL_SNAKE.map(seg => ({ x: seg.x, y: seg.y }));
  }

  let snake, dir, nextDir, foods, obstacles, score, highScore, gameRunning, gameStarted;
  let gameLoopId = null;
  let speed = 130;
  let tongueTimer = 0;
  let tongueOut = false;
  let particles = [];
  let animFrame = 0;
  let applesEaten = 0;
  let harmfulCounts = { bottle: 0, bag: 0, can: 0 };
  let aliveStartedAt = 0;
  let aliveElapsedMs = 0;
  let difficulty = 'medium';
  let snakeTheme = 'classic';
  let groundTrail = [];
  let emitParticles = [];

  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const overlay = document.getElementById('overlay');
  const finalScoreEl = document.getElementById('finalScore');
  const hintText = document.getElementById('hintText');
  const aliveTimeEl = document.getElementById('aliveTime');
  const appleCountEl = document.getElementById('appleCount');
  const harmfulCountEl = document.getElementById('harmfulCount');
  const bottleCountEl = document.getElementById('bottleCount');
  const bagCountEl = document.getElementById('bagCount');
  const canCountEl = document.getElementById('canCount');
  const diffHintEl = document.getElementById('diffHint');

  function formatAliveTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function updateStatsBox() {
    const harmfulTotal = harmfulCounts.bottle + harmfulCounts.bag + harmfulCounts.can;
    appleCountEl.textContent = applesEaten;
    harmfulCountEl.textContent = harmfulTotal;
    bottleCountEl.textContent = harmfulCounts.bottle;
    bagCountEl.textContent = harmfulCounts.bag;
    canCountEl.textContent = harmfulCounts.can;
    aliveTimeEl.textContent = formatAliveTime(aliveElapsedMs);
  }

  let highScoreMemory = 0;
  highScore = highScoreMemory;
  highScoreEl.textContent = highScore;

  function cellFree(x, y, extraExclude) {
    if (snake.some(s => s.x === x && s.y === y)) return false;
    if (foods && foods.some(f => f !== extraExclude && f.x === x && f.y === y)) return false;
    if (obstacles && obstacles.some(o => o !== extraExclude && o.x === x && o.y === y)) return false;
    return true;
  }

  function randomFreeCell(extraExclude) {
    let attempts = 0;
    while (attempts < 500) {
      attempts++;
      const x = Math.floor(Math.random() * tileCount);
      const y = Math.floor(Math.random() * tileCount);
      if (cellFree(x, y, extraExclude)) return { x, y };
    }
    return null;
  }

  function resetGame() {
    clearInterval(gameLoopId);
    gameLoopId = null;
    snake = createInitialSnake();
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    particles = [];
    groundTrail = [];
    emitParticles = [];
    obstacles = [];
    foods = [];
    applesEaten = 0;
    harmfulCounts = { bottle: 0, bag: 0, can: 0 };
    aliveStartedAt = 0;
    aliveElapsedMs = 0;
    scoreEl.textContent = score;
    updateStatsBox();
    placeAllFoods();
    placeAllObstacles();
    gameRunning = true;
    gameStarted = false;
    overlay.style.display = 'none';
    hintText.style.display = 'block';
    startRenderLoop();
  }

  function placeFood(existing) {
    const pos = randomFreeCell(existing);
    if (!pos) return;
    if (existing) {
      existing.x = pos.x;
      existing.y = pos.y;
    } else {
      foods.push({ x: pos.x, y: pos.y });
    }
  }

  function placeAllFoods() {
    foods = [];
    const count = DIFFICULTIES[difficulty].apples;
    for (let i = 0; i < count; i++) placeFood();
  }

  function placeObstacle(existingOrType) {
    const isObj = typeof existingOrType === 'object';
    const existing = isObj ? existingOrType : null;
    const type = isObj ? existingOrType.type : existingOrType;
    const pos = randomFreeCell(existing);
    if (!pos) return;
    if (existing) {
      existing.x = pos.x;
      existing.y = pos.y;
    } else {
      obstacles.push({ type, x: pos.x, y: pos.y });
    }
  }

  function placeAllObstacles() {
    obstacles = [];
    const count = DIFFICULTIES[difficulty].harmful;
    for (let i = 0; i < count; i++) {
      placeObstacle(OBSTACLE_TYPES[i % OBSTACLE_TYPES.length]);
    }
  }

  function spawnParticles(cx, cy, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * (1.5 + Math.random() * 2) * S,
        vy: Math.sin(angle) * (1.5 + Math.random() * 2) * S,
        life: 1,
        color
      });
    }
  }

  function spawnGroundTrail() {
    if (snakeTheme !== 'ice') return;
    const segIndex = Math.min(1, snake.length - 1);
    const seg = snake[segIndex];
    if (!seg) return;
    groundTrail.push({
      x: seg.x * gridSize + gridSize / 2 + (Math.random() - 0.5) * gridSize * 0.3,
      y: seg.y * gridSize + gridSize / 2 + (Math.random() - 0.5) * gridSize * 0.3,
      life: 1,
      size: (0.3 + Math.random() * 0.25) * gridSize
    });
  }

  function updateGroundTrail() {
    if (groundTrail.length === 0) return;
    groundTrail = groundTrail.filter(t => t.life > 0);
    groundTrail.forEach(t => { t.life -= 0.015; });
  }

  function drawGroundTrail() {
    groundTrail.forEach(t => {
      const alpha = Math.max(t.life, 0);
      ctx.save();
      ctx.globalAlpha = alpha * 0.55;
      const g = ctx.createRadialGradient(t.x, t.y, 1, t.x, t.y, t.size * 0.65);
      g.addColorStop(0, 'rgba(224,242,254,0.9)');
      g.addColorStop(0.6, 'rgba(125,211,252,0.5)');
      g.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, t.size * 0.55, t.size * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function spawnEmitParticles() {
    if (!snake || snake.length < 1 || !gameStarted || !gameRunning) return;
    if (snakeTheme !== 'ice' && snakeTheme !== 'fire') return;
    const head = snake[0];
    const hx = head.x * gridSize + gridSize / 2;
    const hy = head.y * gridSize + gridSize / 2;
    const angle = Math.atan2(dir.y, dir.x);
    const backX = -Math.cos(angle);
    const backY = -Math.sin(angle);

    if (snakeTheme === 'ice' && animFrame % 3 === 0) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const perpX = -Math.sin(angle) * side;
      const perpY = Math.cos(angle) * side;
      emitParticles.push({
        x: hx + backX * gridSize * 0.3 + perpX * gridSize * 0.35,
        y: hy + backY * gridSize * 0.3 + perpY * gridSize * 0.35,
        vx: perpX * (0.6 + Math.random() * 0.8) * S,
        vy: -1.1 * S - Math.random() * 0.7 * S,
        gravity: 0.14 * S,
        life: 1,
        size: (0.13 + Math.random() * 0.1) * gridSize,
        theme: 'ice'
      });
    } else if (snakeTheme === 'fire' && animFrame % 2 === 0) {
      for (let i = 0; i < 2; i++) {
        const spread = (Math.random() - 0.5) * 0.7;
        emitParticles.push({
          x: hx + backX * gridSize * 0.35 + (Math.random() - 0.5) * gridSize * 0.25,
          y: hy + backY * gridSize * 0.35 + (Math.random() - 0.5) * gridSize * 0.25,
          vx: (backX + spread) * (0.5 + Math.random() * 0.6) * S,
          vy: (backY * 0.6 - 0.35) * (0.7 + Math.random() * 0.6) * S,
          gravity: -0.02 * S,
          life: 1,
          size: (0.17 + Math.random() * 0.17) * gridSize,
          theme: 'fire'
        });
      }
    }
  }

  function updateEmitParticles() {
    if (emitParticles.length === 0) return;
    emitParticles = emitParticles.filter(p => p.life > 0);
    emitParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += (p.gravity || 0);
      p.vx *= 0.98;
      p.life -= p.theme === 'fire' ? 0.045 : 0.03;
    });
  }

  function drawEmitParticles() {
    emitParticles.forEach(p => {
      const alpha = Math.max(p.life, 0);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.theme === 'ice') {
        const g = ctx.createRadialGradient(p.x - p.size * 0.15, p.y - p.size * 0.2, 1, p.x, p.y, p.size);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.45, 'rgba(186,230,253,0.9)');
        g.addColorStop(1, 'rgba(56,189,248,0.4)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.55, p.size * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.theme === 'fire') {
        const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.size);
        g.addColorStop(0, 'rgba(255,241,180,0.95)');
        g.addColorStop(0.35, 'rgba(255,150,40,0.85)');
        g.addColorStop(0.7, 'rgba(230,60,20,0.5)');
        g.addColorStop(1, 'rgba(120,20,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function gameTick() {
    if (!gameRunning || !snake || snake.length < 1) return;

    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
      return endGame();
    }
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      return endGame();
    }

    snake.unshift(head);

    const hitObstacle = obstacles.find(o => o.x === head.x && o.y === head.y);
    const hitFood = foods.find(f => f.x === head.x && f.y === head.y);

    if (hitFood) {
      score += 10;
      applesEaten += 1;
      scoreEl.textContent = score;
      updateStatsBox();
      spawnParticles(
        hitFood.x * gridSize + gridSize / 2,
        hitFood.y * gridSize + gridSize / 2,
        '#f87171', 14
      );
      placeFood(hitFood);
    } else if (hitObstacle) {
      harmfulCounts[hitObstacle.type] += 1;
      updateStatsBox();
      spawnParticles(
        hitObstacle.x * gridSize + gridSize / 2,
        hitObstacle.y * gridSize + gridSize / 2,
        '#94a3b8', 12
      );
      placeObstacle(hitObstacle);
      // unshift already added a head; net shrink of 2 means 3 pops.
      // If that would leave no segments, end the game without emptying the array
      // so the render loop cannot crash on snake[0].
      if (snake.length - 3 < 1) {
        return endGame();
      }
      snake.pop();
      snake.pop();
      snake.pop();
    } else {
      snake.pop();
    }

    spawnGroundTrail();
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#101a30');
    g.addColorStop(1, '#0a0f1e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < tileCount; y++) {
      for (let x = 0; x < tileCount; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.015)';
          ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
        }
      }
    }
  }

  function drawAppleAt(food) {
    const cx = food.x * gridSize + gridSize / 2;
    const cy = food.y * gridSize + gridSize / 2;
    const r = gridSize / 2 - 2 * S;

    const bob = Math.sin(animFrame / 12) * 1.5 * S;
    const cy2 = cy + bob;

    ctx.beginPath();
    ctx.ellipse(cx, cy + r + 2 * S, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    const appleGrad = ctx.createRadialGradient(cx - r * 0.4, cy2 - r * 0.4, r * 0.2, cx, cy2, r * 1.1);
    appleGrad.addColorStop(0, '#ff6b6b');
    appleGrad.addColorStop(0.5, '#f43f3f');
    appleGrad.addColorStop(1, '#c81e2c');

    ctx.beginPath();
    ctx.moveTo(cx, cy2 - r * 0.9);
    ctx.bezierCurveTo(cx - r * 1.15, cy2 - r * 1.15, cx - r * 1.2, cy2 + r * 0.6, cx, cy2 + r * 1.05);
    ctx.bezierCurveTo(cx + r * 1.2, cy2 + r * 0.6, cx + r * 1.15, cy2 - r * 1.15, cx, cy2 - r * 0.9);
    ctx.closePath();
    ctx.fillStyle = appleGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx - r * 0.4, cy2 - r * 0.25, r * 0.3, r * 0.45, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy2 - r * 0.85);
    ctx.quadraticCurveTo(cx + r * 0.15, cy2 - r * 1.5, cx + r * 0.05, cy2 - r * 1.7);
    ctx.strokeStyle = '#7a4a26';
    ctx.lineWidth = 2 * S;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx + r * 0.45, cy2 - r * 1.25, r * 0.45, r * 0.22, -0.5, 0, Math.PI * 2);
    const leafGrad = ctx.createLinearGradient(cx, cy2 - r * 1.4, cx + r * 0.8, cy2 - r * 1.1);
    leafGrad.addColorStop(0, '#6fd66f');
    leafGrad.addColorStop(1, '#3fae4a');
    ctx.fillStyle = leafGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,80,0,0.3)';
    ctx.lineWidth = 0.7 * S;
    ctx.stroke();
  }

  function drawApples() {
    if (!foods) return;
    foods.forEach(drawAppleAt);
  }

  function drawBottle(cx, cy) {
    const w = gridSize * 0.5;
    const h = gridSize * 0.9;
    const wobble = Math.sin(animFrame / 20 + cx) * S;

    ctx.save();
    ctx.translate(cx, cy + wobble * 0.3);

    // shadow
    ctx.beginPath();
    ctx.ellipse(0, h / 2 + S, w * 0.55, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // body
    const bodyGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    bodyGrad.addColorStop(0, 'rgba(150,220,235,0.55)');
    bodyGrad.addColorStop(0.5, 'rgba(210,245,250,0.85)');
    bodyGrad.addColorStop(1, 'rgba(150,220,235,0.55)');
    roundRectPath(-w / 2, -h * 0.28, w, h * 0.78, w * 0.28);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,190,210,0.9)';
    ctx.lineWidth = 0.8 * S;
    ctx.stroke();

    // shoulder (neck taper)
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -h * 0.28);
    ctx.lineTo(-w * 0.16, -h * 0.48);
    ctx.lineTo(w * 0.16, -h * 0.48);
    ctx.lineTo(w * 0.32, -h * 0.28);
    ctx.closePath();
    ctx.fillStyle = 'rgba(190,235,245,0.7)';
    ctx.fill();
    ctx.stroke();

    // neck + cap
    ctx.fillStyle = '#3b82c4';
    ctx.fillRect(-w * 0.14, -h * 0.62, w * 0.28, h * 0.16);
    ctx.fillStyle = '#2563a5';
    roundRectPath(-w * 0.18, -h * 0.68, w * 0.36, h * 0.12, 2 * S);
    ctx.fill();

    // label
    ctx.fillStyle = 'rgba(0, 40, 77, 0.85)';
    ctx.fillRect(-w * 0.5, -h * 0.02, w, h * 0.32);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${w * 0.42}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('آب', 0, h * 0.14);

    // shine
    ctx.beginPath();
    ctx.ellipse(-w * 0.22, h * 0.05, w * 0.09, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();

    ctx.restore();
  }

  function drawBag(cx, cy) {
    const s = gridSize;
    const flutter = Math.sin(animFrame / 10 + cy) * 2 * S;

    ctx.save();
    ctx.translate(cx, cy);

    // shadow
    ctx.beginPath();
    ctx.ellipse(0, s * 0.42, s * 0.4, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    // crumpled bag body - lumpy polygon
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.1 + flutter * 0.2);
    ctx.quadraticCurveTo(-s * 0.48, s * 0.15, -s * 0.28, s * 0.35);
    ctx.quadraticCurveTo(-s * 0.05, s * 0.48, s * 0.2, s * 0.36);
    ctx.quadraticCurveTo(s * 0.46, s * 0.22, s * 0.4, -s * 0.05 - flutter * 0.2);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.28, s * 0.1, -s * 0.22);
    ctx.quadraticCurveTo(s * 0.02, -s * 0.4, -s * 0.15, -s * 0.3);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.28, -s * 0.4, -s * 0.1 + flutter * 0.2);
    ctx.closePath();
    const bagGrad = ctx.createLinearGradient(-s * 0.4, -s * 0.3, s * 0.4, s * 0.4);
    bagGrad.addColorStop(0, 'rgba(255,255,255,0.75)');
    bagGrad.addColorStop(0.5, 'rgba(220,225,230,0.55)');
    bagGrad.addColorStop(1, 'rgba(255,255,255,0.7)');
    ctx.fillStyle = bagGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,155,165,0.6)';
    ctx.lineWidth = 0.8 * S;
    ctx.stroke();

    // wrinkle lines
    ctx.strokeStyle = 'rgba(140,145,155,0.5)';
    ctx.lineWidth = 0.6 * S;
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.05);
    ctx.quadraticCurveTo(0, s * 0.1, s * 0.15, s * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s * 0.15);
    ctx.quadraticCurveTo(s * 0.05, s * 0.25, s * 0.22, s * 0.18);
    ctx.stroke();

    // handles
    ctx.strokeStyle = 'rgba(200,205,212,0.85)';
    ctx.lineWidth = 1.3 * S;
    ctx.beginPath();
    ctx.arc(-s * 0.12, -s * 0.32, s * 0.1, Math.PI * 0.15, Math.PI * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.1, -s * 0.34, s * 0.1, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();

    ctx.restore();
  }

  function drawCan(cx, cy) {
    const w = gridSize * 0.62;
    const h = gridSize * 0.8;

    ctx.save();
    ctx.translate(cx, cy);

    // shadow
    ctx.beginPath();
    ctx.ellipse(0, h / 2 + S, w * 0.55, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // body cylinder
    const metalGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    metalGrad.addColorStop(0, '#9aa4ad');
    metalGrad.addColorStop(0.15, '#e2e8ef');
    metalGrad.addColorStop(0.4, '#b6bfc7');
    metalGrad.addColorStop(0.6, '#8b949c');
    metalGrad.addColorStop(1, '#6b747c');
    roundRectPath(-w / 2, -h / 2, w, h, 3 * S);
    ctx.fillStyle = metalGrad;
    ctx.fill();

    // top rim ellipse
    ctx.beginPath();
    ctx.ellipse(0, -h / 2, w / 2, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c3cbd1';
    ctx.fill();
    ctx.strokeStyle = '#7c8590';
    ctx.lineWidth = 0.7 * S;
    ctx.stroke();
    // pull tab
    ctx.beginPath();
    ctx.ellipse(w*0.05, -h/2, w*0.14, h*0.03, 0, 0, Math.PI*2);
    ctx.fillStyle = '#5a6169';
    ctx.fill();

    // bottom rim ellipse
    ctx.beginPath();
    ctx.ellipse(0, h / 2, w / 2, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5f676e';
    ctx.fill();

    // label band
    ctx.fillStyle = '#e0403f';
    ctx.fillRect(-w / 2, -h * 0.18, w, h * 0.42);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${w * 0.34}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('کنسرو', 0, h * 0.02);

    // vertical shine
    ctx.beginPath();
    ctx.rect(-w * 0.3, -h * 0.48, w * 0.08, h * 0.96);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();

    ctx.restore();
  }

  function drawObstacles() {
    obstacles.forEach(o => {
      const cx = o.x * gridSize + gridSize / 2;
      const cy = o.y * gridSize + gridSize / 2;
      if (o.type === 'bottle') drawBottle(cx, cy);
      else if (o.type === 'bag') drawBag(cx, cy);
      else if (o.type === 'can') drawCan(cx, cy);
    });
  }

  function drawFireHeadFlames(hSize) {
    ctx.save();
    [1, -1].forEach(side => {
      const baseX = -hSize * 0.3;
      const baseY = side * hSize * 0.42;
      for (let i = 0; i < 3; i++) {
        const flick = Math.sin(animFrame / 5 + i * 1.7 + side * 2) * hSize * 0.12;
        const len = hSize * (0.55 + i * 0.24);
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(
          baseX - len * 0.5 + flick, baseY + side * len * 0.35,
          baseX - len, baseY + side * len * 0.1 + flick * 0.5
        );
        ctx.quadraticCurveTo(
          baseX - len * 0.5, baseY - side * len * 0.08,
          baseX, baseY
        );
        ctx.closePath();
        const g = ctx.createLinearGradient(baseX, baseY, baseX - len, baseY);
        g.addColorStop(0, 'rgba(255,241,180,0.95)');
        g.addColorStop(0.5, 'rgba(255,140,40,0.8)');
        g.addColorStop(1, 'rgba(220,40,10,0)');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.85 - i * 0.2;
        ctx.fill();
      }
    });
    ctx.restore();
  }

  function drawIceHeadFins(hSize) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    [1, -1].forEach(side => {
      const fx = -hSize * 0.38;
      const fy = side * hSize * 0.4;
      const wag = Math.sin(animFrame / 9 + side) * hSize * 0.05;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(fx - hSize * 0.35, fy + side * hSize * 0.25 + wag, fx - hSize * 0.55, fy + side * hSize * 0.05);
      ctx.quadraticCurveTo(fx - hSize * 0.3, fy - side * hSize * 0.02, fx, fy);
      ctx.closePath();
      const g = ctx.createLinearGradient(fx, fy, fx - hSize * 0.55, fy);
      g.addColorStop(0, 'rgba(224,242,254,0.9)');
      g.addColorStop(1, 'rgba(56,189,248,0.15)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(224,242,254,0.6)';
      ctx.lineWidth = 0.5 * S;
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawSnake() {
    if (!snake || snake.length < 1) return;
    const len = snake.length;
    const theme = SNAKE_THEMES[snakeTheme] || SNAKE_THEMES.classic;

    snake.forEach((seg) => {
      ctx.beginPath();
      ctx.ellipse(
        seg.x * gridSize + gridSize / 2,
        seg.y * gridSize + gridSize / 2 + gridSize * 0.32,
        gridSize * 0.38, gridSize * 0.15, 0, 0, Math.PI * 2
      );
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
    });

    for (let i = len - 1; i >= 1; i--) {
      const seg = snake[i];
      const t = i / len;
      const cx = seg.x * gridSize + gridSize / 2;
      const cy = seg.y * gridSize + gridSize / 2;
      const size = gridSize - 3 * S - t * 2 * S;

      const bodyGrad = ctx.createRadialGradient(
        cx - size * 0.2, cy - size * 0.2, size * 0.1,
        cx, cy, size * 0.8
      );
      const shade = 1 - t * 0.35;
      bodyGrad.addColorStop(0, theme.bodyLight(shade));
      bodyGrad.addColorStop(1, theme.bodyDark(shade));

      roundRectPath(cx - size / 2, cy - size / 2, size, size, size * 0.4);
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      if (i % 2 === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = theme.speckle;
        ctx.fill();
      }

      if (snakeTheme === 'ice') {
        const shimmer = (Math.sin(animFrame / 14 - i * 0.6) + 1) / 2;
        ctx.save();
        ctx.globalAlpha = shimmer * 0.5;
        ctx.beginPath();
        ctx.ellipse(cx - size * 0.15, cy - size * 0.18, size * 0.3, size * 0.12, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
        ctx.restore();
      } else if (snakeTheme === 'fire') {
        const flicker = (Math.sin(animFrame / 6 + i) + 1) / 2;
        ctx.save();
        ctx.shadowColor = 'rgba(255,120,30,0.9)';
        ctx.shadowBlur = (4 + flicker * 6) * S;
        ctx.fillStyle = `rgba(255,${170 + flicker * 60}, ${60 + flicker * 40}, ${0.35 + flicker * 0.3})`;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const head = snake[0];
    const hx = head.x * gridSize + gridSize / 2;
    const hy = head.y * gridSize + gridSize / 2;
    const hSize = gridSize + 2 * S;

    ctx.save();
    ctx.translate(hx, hy);
    const angle = Math.atan2(dir.y, dir.x);
    ctx.rotate(angle);

    if (tongueOut) {
      const tLen = hSize * 0.55;
      ctx.beginPath();
      ctx.moveTo(hSize / 2 - 2 * S, 0);
      ctx.lineTo(hSize / 2 - 2 * S + tLen * 0.7, 0);
      ctx.lineTo(hSize / 2 - 2 * S + tLen, -3 * S);
      ctx.moveTo(hSize / 2 - 2 * S + tLen * 0.7, 0);
      ctx.lineTo(hSize / 2 - 2 * S + tLen, 3 * S);
      ctx.strokeStyle = theme.tongue;
      ctx.lineWidth = 1.6 * S;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    if (snakeTheme === 'fire') {
      drawFireHeadFlames(hSize);
    }

    if (theme.glow) {
      const pulse = 10 + Math.sin(animFrame / 8) * 4;
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = pulse * S;
    }

    const headGrad = ctx.createRadialGradient(-hSize*0.15, -hSize*0.15, 2 * S, 0, 0, hSize*0.75);
    headGrad.addColorStop(0, theme.headLight);
    headGrad.addColorStop(1, theme.headDark);
    roundRectPath(-hSize / 2, -hSize / 2, hSize, hSize, hSize * 0.42);
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    if (snakeTheme === 'ice') {
      drawIceHeadFins(hSize);
    }

    const eyeOffsetX = hSize * 0.18;
    const eyeOffsetY = hSize * 0.22;
    const eyeR = hSize * 0.16;

    [1, -1].forEach((side) => {
      const ex = eyeOffsetX;
      const ey = side * eyeOffsetY;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.5 * S;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex + eyeR * 0.35, ey, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#101418';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + eyeR * 0.5, ey - eyeR * 0.3, eyeR * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
    });

    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5 * S, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= 0.04;
    });
  }

  function draw() {
    drawBackground();
    drawGroundTrail();
    drawApples();
    drawObstacles();
    drawSnake();
    drawEmitParticles();
    drawParticles();
  }

  function render() {
    animFrame++;
    tongueTimer++;
    if (tongueTimer > 55) {
      tongueOut = !tongueOut;
      tongueTimer = 0;
    }
    try {
      updateParticles();
      updateGroundTrail();
      spawnEmitParticles();
      updateEmitParticles();
      if (gameStarted && gameRunning && aliveStartedAt) {
        aliveElapsedMs = Date.now() - aliveStartedAt;
        aliveTimeEl.textContent = formatAliveTime(aliveElapsedMs);
      }
      draw();
    } finally {
      requestAnimationFrame(render);
    }
  }

  let renderStarted = false;
  function startRenderLoop() {
    if (!renderStarted) {
      renderStarted = true;
      requestAnimationFrame(render);
    }
  }

  function endGame() {
    gameRunning = false;
    clearInterval(gameLoopId);
    if (aliveStartedAt) {
      aliveElapsedMs = Date.now() - aliveStartedAt;
      aliveTimeEl.textContent = formatAliveTime(aliveElapsedMs);
    }
    if (score > highScore) {
      highScore = score;
      highScoreEl.textContent = highScore;
    }
    finalScoreEl.textContent = 'امتیاز نهایی: ' + score;
    overlay.style.display = 'flex';
  }

  function restartLoop() {
    clearInterval(gameLoopId);
    gameLoopId = setInterval(gameTick, speed);
  }

  function setDirection(x, y) {
    if (!gameStarted) {
      gameStarted = true;
      aliveStartedAt = Date.now();
      hintText.style.display = 'none';
      restartLoop();
    }
    if (dir.x === -x && dir.y === -y && snake.length > 1) return;
    nextDir = { x, y };
  }

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
        e.preventDefault(); setDirection(0, -1); break;
      case 'ArrowDown': case 's': case 'S':
        e.preventDefault(); setDirection(0, 1); break;
      case 'ArrowLeft': case 'a': case 'A':
        e.preventDefault(); setDirection(-1, 0); break;
      case 'ArrowRight': case 'd': case 'D':
        e.preventDefault(); setDirection(1, 0); break;
    }
  });

  document.getElementById('up').addEventListener('click', () => setDirection(0, -1));
  document.getElementById('down').addEventListener('click', () => setDirection(0, 1));
  document.getElementById('left').addEventListener('click', () => setDirection(-1, 0));
  document.getElementById('right').addEventListener('click', () => setDirection(1, 0));

  document.getElementById('restartBtn').addEventListener('click', () => {
    speed = 130;
    resetGame();
  });

  document.getElementById('difficultyChoices').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-diff]');
    if (!btn) return;
    const next = btn.getAttribute('data-diff');
    if (!DIFFICULTIES[next] || next === difficulty) return;
    difficulty = next;
    document.querySelectorAll('#difficultyChoices .choice-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-diff') === difficulty);
    });
    diffHintEl.textContent = DIFFICULTIES[difficulty].hint;
    speed = 130;
    resetGame();
  });

  document.getElementById('themeChoices').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme]');
    if (!btn) return;
    const next = btn.getAttribute('data-theme');
    if (!SNAKE_THEMES[next]) return;
    snakeTheme = next;
    document.querySelectorAll('#themeChoices .theme-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-theme') === snakeTheme);
    });
  });

  if (window.matchMedia('(pointer: coarse)').matches) {
    document.getElementById('controls').style.display = 'grid';
  }

  let touchStartX = 0, touchStartY = 0;
  canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 20) setDirection(dx > 0 ? 1 : -1, 0);
    } else {
      if (Math.abs(dy) > 20) setDirection(0, dy > 0 ? 1 : -1);
    }
  }, { passive: true });

  resetGame();
})();
