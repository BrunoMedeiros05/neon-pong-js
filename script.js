const canvas = document.getElementById("pongCanvas");
const ctx = canvas.getContext("2d");
const playerScoreEl = document.getElementById("playerScore");
const cpuScoreEl = document.getElementById("cpuScore");
const mainMenu = document.getElementById("mainMenu");
const pauseScreen = document.getElementById("pauseScreen");
const pauseBtn = document.getElementById("pauseBtn");
const btnPlay = document.getElementById("btnPlay");
const btnResume = document.getElementById("btnResume");
const btnQuit = document.getElementById("btnQuit");

// --- ÁUDIO ---
let audioCtx = null;
try {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext) audioCtx = new AudioContext();
} catch (e) {
  console.warn("Audio error");
}

function playSound(type) {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === "hit") {
    osc.type = "square";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === "wall") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === "score") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === "ui-hover") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === "ui-click") {
    osc.type = "square";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

// --- CONFIGURAÇÃO ---
const player = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  color: "#00ffff",
  score: 0,
  speed: 0,
};
const computer = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  color: "#ff0066",
  score: 0,
  speedMultiplier: 0.085,
};
const ball = {
  x: 0,
  y: 0,
  radius: 0,
  speed: 0,
  velocityX: 0,
  velocityY: 0,
  color: "#ffffff",
};

let gameRunning = false;
let isPaused = false;
let particles = [];
let stars = [];
let maxBallSpeed = 0;
let initialBallSpeed = 0;
const keys = { ArrowUp: false, ArrowDown: false, w: false, s: false };

let lastTime = 0;

// --- INTERFACE ---
function setupButton(btn, action) {
  btn.addEventListener("mouseenter", () => playSound("ui-hover"));
  btn.addEventListener("click", () => {
    playSound("ui-click");
    action();
    btn.blur();
  });
}

setupButton(btnPlay, startGame);
setupButton(btnResume, togglePause);
setupButton(btnQuit, quitToMenu);

function startGame() {
  if (gameRunning) return;
  gameRunning = true;
  mainMenu.classList.add("hidden");
  pauseBtn.classList.remove("hidden");
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();

  player.score = 0;
  computer.score = 0;
  playerScoreEl.innerText = "0";
  cpuScoreEl.innerText = "0";

  initStars();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function quitToMenu() {
  gameRunning = false;
  isPaused = false;
  pauseScreen.classList.add("hidden");
  mainMenu.classList.remove("hidden");
  pauseBtn.classList.add("hidden");
  resetBall();
}

function togglePause() {
  if (!gameRunning) return;
  isPaused = !isPaused;

  if (isPaused) {
    pauseBtn.innerHTML = "▶";
    pauseScreen.classList.remove("hidden");
  } else {
    pauseBtn.innerHTML = "❚❚";
    pauseScreen.classList.add("hidden");
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

pauseBtn.addEventListener("click", (e) => {
  togglePause();
  e.target.blur();
});

// --- REDIMENSIONAMENTO ---
function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const w = canvas.width;
  const h = canvas.height;

  player.width = w * 0.015;
  player.height = h * 0.18;
  player.x = 20;
  if (player.y === 0) player.y = h / 2 - player.height / 2;
  player.speed = h * 0.022;

  computer.width = player.width;
  computer.height = player.height;
  computer.x = w - 20 - player.width;
  if (computer.y === 0) computer.y = h / 2 - player.height / 2;

  ball.radius = w * 0.008;
  ball.initialBallSpeed = w * 0.009;
  maxBallSpeed = w * 0.035;

  initStars();
  if (!gameRunning) resetBall();
}

function resetBall() {
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.speed = ball.initialBallSpeed || canvas.width * 0.009;
  let directionX = Math.random() > 0.5 ? 1 : -1;
  ball.velocityX = directionX * ball.speed;
  ball.velocityY = Math.random() * ball.speed - ball.speed / 2;
}

// --- STARS VAPORWAVE ---
function initStars() {
  stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 3 + 1,
      speedBase: Math.random() * 0.8 + 0.2,
    });
  }
}

function updateStars(timeScale) {
  for (let star of stars) {
    let currentSpeed = star.speedBase * (star.size / 1.5);
    star.x -= currentSpeed * (canvas.width * 0.003) * timeScale;
    if (star.x < -star.size * 2) {
      star.x = canvas.width + star.size * 2;
      star.y = Math.random() * canvas.height;
    }
  }
}

function drawStars() {
  ctx.fillStyle = "rgba(220, 240, 255, 0.8)";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(100, 200, 255, 0.7)";

  for (let star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// --- PARTICLES ---
function triggerExplosion(x, y, color) {
  for (let i = 0; i < 25; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * (canvas.width * 0.03),
      vy: (Math.random() - 0.5) * (canvas.width * 0.03),
      life: 1.0,
      color: color,
      size: Math.random() * 4 + 2,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= 0.03;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (let p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1.0;
}

// --- INPUTS ---
window.addEventListener("keydown", (e) => {
  if (keys.hasOwnProperty(e.key)) {
    keys[e.key] = true;
    if (
      ["ArrowUp", "ArrowDown", " ", "Space"].includes(e.key) ||
      e.code === "Space"
    )
      e.preventDefault();
  }
  if ((e.code === "Space" || e.key === " ") && gameRunning) togglePause();
  if (e.key.toLowerCase() === "p" || e.code === "Escape") togglePause();
});

window.addEventListener("keyup", (e) => {
  if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});
window.addEventListener("resize", () => {
  resizeCanvas();
});

function triggerScoreAnimation(element) {
  element.classList.add("score-pop");
  setTimeout(() => element.classList.remove("score-pop"), 200);
}

// --- UPDATE ---
function update(timeScale) {
  updateStars(timeScale);
  updateParticles();

  if (keys.ArrowUp || keys.w) player.y -= player.speed * timeScale;
  if (keys.ArrowDown || keys.s) player.y += player.speed * timeScale;
  if (player.y < 0) player.y = 0;
  if (player.y + player.height > canvas.height)
    player.y = canvas.height - player.height;

  let targetPos = ball.y - computer.height / 2;
  if (Math.abs(targetPos - computer.y) > canvas.height * 0.005)
    computer.y +=
      (targetPos - computer.y) * (computer.speedMultiplier * timeScale);
  if (computer.y < 0) computer.y = 0;
  if (computer.y + computer.height > canvas.height)
    computer.y = canvas.height - computer.height;

  ball.x += ball.velocityX * timeScale;
  ball.y += ball.velocityY * timeScale;

  // Colisão Paredes (Teto/Chão)
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.velocityY = Math.abs(ball.velocityY);
    playSound("wall");
  } else if (ball.y + ball.radius > canvas.height) {
    ball.y = canvas.height - ball.radius;
    ball.velocityY = -Math.abs(ball.velocityY);
    playSound("wall");
  }

  let playerOrComputer = ball.x < canvas.width / 2 ? player : computer;

  if (
    ball.x + ball.radius > playerOrComputer.x &&
    ball.x - ball.radius < playerOrComputer.x + playerOrComputer.width &&
    ball.y + ball.radius > playerOrComputer.y &&
    ball.y - ball.radius < playerOrComputer.y + playerOrComputer.height
  ) {
    let collidePoint =
      ball.y - (playerOrComputer.y + playerOrComputer.height / 2);
    collidePoint = collidePoint / (playerOrComputer.height / 2);
    let angleRad = (Math.PI / 4) * collidePoint;
    let direction = ball.x < canvas.width / 2 ? 1 : -1;

    if (direction === 1) ball.x = player.x + player.width + ball.radius;
    else ball.x = computer.x - ball.radius;

    let acceleration = canvas.width * 0.0003;
    ball.speed += acceleration;
    if (ball.speed > maxBallSpeed) ball.speed = maxBallSpeed;

    ball.velocityX = direction * ball.speed * Math.cos(angleRad);
    ball.velocityY = ball.speed * Math.sin(angleRad);

    playSound("hit");
  }

  if (ball.x - ball.radius < 0) {
    computer.score++;
    cpuScoreEl.innerText = computer.score;
    triggerScoreAnimation(cpuScoreEl);
    triggerExplosion(0, ball.y, player.color);
    playSound("score");
    resetBall();
  } else if (ball.x + ball.radius > canvas.width) {
    player.score++;
    playerScoreEl.innerText = player.score;
    triggerScoreAnimation(playerScoreEl);
    triggerExplosion(canvas.width, ball.y, computer.color);
    playSound("score");
    resetBall();
  }
}

// --- RENDER ---
function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.shadowBlur = 20;
  ctx.shadowColor = color;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
}

function render() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars();

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  let dash = canvas.height * 0.05;
  for (let i = 0; i < canvas.height; i += dash * 2) {
    ctx.fillRect(canvas.width / 2 - 1, i, 2, dash);
  }

  drawParticles();

  drawRect(player.x, player.y, player.width, player.height, player.color);
  drawRect(
    computer.x,
    computer.y,
    computer.width,
    computer.height,
    computer.color,
  );

  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = 15;
  ctx.shadowColor = ball.color;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function gameLoop(timestamp) {
  if (isPaused) {
  } else if (gameRunning) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    let timeScale = deltaTime / (1000 / 60);
    if (timeScale > 4) timeScale = 4;

    update(timeScale);
    render();
  }
  if (gameRunning) requestAnimationFrame(gameLoop);
}

resizeCanvas();
