const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const scoreValue = document.querySelector("#score");
const bestScoreValue = document.querySelector("#best-score");
const gameState = document.querySelector("#game-state");
const startPanel = document.querySelector("#start-panel");
const resultPanel = document.querySelector("#result-panel");
const resultTitle = document.querySelector("#result-title");
const resultCopy = document.querySelector("#result-copy");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");

const bestScoreKey = "skyline-stack-best";
const colors = ["#55dbff", "#b6f35c", "#ffd166", "#ff6b9a", "#9d8cff", "#62f1c7"];
const state = {
  width: 0,
  height: 0,
  dpr: 1,
  blocks: [],
  chips: [],
  active: null,
  score: 0,
  best: Number(localStorage.getItem(bestScoreKey) || 0),
  running: false,
  over: false,
  cameraY: 0,
  targetCameraY: 0,
  lastTime: 0,
  pulse: 0
};

function resizeCanvas() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

function gameScale() {
  return Math.min(state.width, state.height) < 640 ? 0.78 : 1;
}

function blockHeight() {
  return 30 * gameScale();
}

function baseY() {
  return state.height - 118 * gameScale();
}

function makeBlock({ x, y, width, depth, direction, speed, color }) {
  return { x, y, width, depth, direction, speed, color, phase: 0 };
}

function startGame() {
  const scale = gameScale();
  const initialWidth = Math.min(260 * scale, state.width * 0.58);
  const initialDepth = Math.min(170 * scale, state.width * 0.42);
  const first = makeBlock({
    x: 0,
    y: 0,
    width: initialWidth,
    depth: initialDepth,
    direction: "x",
    speed: 0,
    color: colors[0]
  });

  state.blocks = [first];
  state.chips = [];
  state.active = null;
  state.score = 0;
  state.running = true;
  state.over = false;
  state.cameraY = 0;
  state.targetCameraY = 0;
  scoreValue.textContent = "0";
  gameState.textContent = "Tap to place";
  startPanel.classList.add("hidden");
  resultPanel.classList.add("hidden");
  spawnActiveBlock();
}

function spawnActiveBlock() {
  const previous = state.blocks[state.blocks.length - 1];
  const index = state.blocks.length;
  const direction = index % 2 === 0 ? "z" : "x";
  const travel = direction === "x" ? state.width * 0.62 : state.width * 0.48;
  const speed = (150 + index * 6) * gameScale();
  const color = colors[index % colors.length];

  state.active = makeBlock({
    x: direction === "x" ? -travel : previous.x,
    y: previous.y + blockHeight(),
    width: previous.width,
    depth: previous.depth,
    direction,
    speed,
    color
  });

  if (direction === "z") {
    state.active.depthOffset = -travel;
  }

  state.targetCameraY = Math.max(0, state.active.y - blockHeight() * 5);
}

function activePosition(block) {
  if (block.direction === "z") {
    return {
      x: block.x,
      z: block.depthOffset || 0
    };
  }

  return {
    x: block.x,
    z: 0
  };
}

function placeBlock() {
  if (!state.running) {
    startGame();
    return;
  }

  if (!state.active || state.over) {
    return;
  }

  const previous = state.blocks[state.blocks.length - 1];
  const active = state.active;
  const position = activePosition(active);
  const axis = active.direction === "x" ? "width" : "depth";
  const coordinate = active.direction === "x" ? "x" : "z";
  const previousStart = active.direction === "x" ? previous.x : 0;
  const activeStart = position[coordinate];
  const delta = activeStart - previousStart;
  const overlap = previous[axis] - Math.abs(delta);
  const perfectWindow = Math.max(6, 10 * gameScale());

  if (overlap <= 0) {
    createChip(active, activeStart, active[axis], delta);
    endGame();
    return;
  }

  if (Math.abs(delta) <= perfectWindow) {
    active.x = previous.x;
    active.depthOffset = 0;
    state.pulse = 1;
    gameState.textContent = "Perfect";
  } else {
    const cutSize = active[axis] - overlap;
    const cutStart = delta > 0 ? previousStart + overlap : activeStart;
    createChip(active, cutStart, cutSize, delta);
    active[axis] = overlap;

    if (active.direction === "x") {
      active.x = delta > 0 ? activeStart : previousStart;
    } else {
      active.depthOffset = delta > 0 ? activeStart : previousStart;
    }

    gameState.textContent = "Nice";
  }

  state.blocks.push({
    x: active.direction === "x" ? active.x : previous.x,
    y: active.y,
    width: active.width,
    depth: active.depth,
    direction: active.direction,
    speed: 0,
    color: active.color,
    depthOffset: active.direction === "z" ? active.depthOffset : 0
  });

  state.score += 1;
  scoreValue.textContent = String(state.score);
  state.active = null;
  spawnActiveBlock();
}

function createChip(block, start, size, delta) {
  const chip = {
    ...block,
    width: block.direction === "x" ? size : block.width,
    depth: block.direction === "z" ? size : block.depth,
    x: block.direction === "x" ? start : block.x,
    depthOffset: block.direction === "z" ? start : block.depthOffset || 0,
    velocityX: Math.sign(delta || 1) * 42,
    velocityY: -24,
    rotation: 0,
    opacity: 1
  };
  state.chips.push(chip);
}

function endGame() {
  state.running = false;
  state.over = true;
  state.active = null;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem(bestScoreKey, String(state.best));
  bestScoreValue.textContent = String(state.best);
  gameState.textContent = "Game over";
  resultTitle.textContent = state.score > 12 ? "Sharp hands" : "Good start";
  resultCopy.textContent = `You reached ${state.score} ${state.score === 1 ? "floor" : "floors"}.`;
  resultPanel.classList.remove("hidden");
}

function project(point) {
  const scale = gameScale();
  const isoX = (point.x - point.z) * 0.72;
  const isoY = (point.x + point.z) * 0.31 - point.y;
  return {
    x: state.width / 2 + isoX,
    y: baseY() + isoY + state.cameraY,
    scale
  };
}

function shadeColor(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawPolygon(points, fillStyle) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
}

function drawBlock(block, options = {}) {
  const h = blockHeight();
  const z = block.depthOffset || 0;
  const x = block.x;
  const y = block.y;
  const w = block.width;
  const d = block.depth;
  const color = block.color;
  const top = [
    project({ x, z, y: y + h }),
    project({ x: x + w, z, y: y + h }),
    project({ x: x + w, z: z + d, y: y + h }),
    project({ x, z: z + d, y: y + h })
  ];
  const right = [
    project({ x: x + w, z, y: y + h }),
    project({ x: x + w, z: z + d, y: y + h }),
    project({ x: x + w, z: z + d, y }),
    project({ x: x + w, z, y })
  ];
  const front = [
    project({ x, z: z + d, y: y + h }),
    project({ x: x + w, z: z + d, y: y + h }),
    project({ x: x + w, z: z + d, y }),
    project({ x, z: z + d, y })
  ];

  context.save();
  context.globalAlpha = options.opacity ?? 1;
  drawPolygon(right, shadeColor(color, -54));
  drawPolygon(front, shadeColor(color, -34));
  drawPolygon(top, color);
  context.strokeStyle = "rgba(255, 255, 255, 0.2)";
  context.lineWidth = 1;
  context.stroke();
  context.restore();
}

function drawBackdrop(time) {
  const gradient = context.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#23314f");
  gradient.addColorStop(0.48, "#121a2b");
  gradient.addColorStop(1, "#080b11");
  context.fillStyle = gradient;
  context.fillRect(0, 0, state.width, state.height);

  const sunX = state.width * 0.72 + Math.sin(time * 0.0002) * 20;
  const sunY = state.height * 0.22;
  const glow = context.createRadialGradient(sunX, sunY, 10, sunX, sunY, state.width * 0.36);
  glow.addColorStop(0, "rgba(255, 209, 102, 0.5)");
  glow.addColorStop(0.26, "rgba(255, 107, 154, 0.18)");
  glow.addColorStop(1, "rgba(255, 107, 154, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, state.width, state.height);

  drawSkyline(0.66, "#111827", 18);
  drawSkyline(0.76, "#0d131f", 30);
  drawGridFloor();
}

function drawSkyline(yFactor, color, seed) {
  const horizon = state.height * yFactor;
  context.fillStyle = color;
  for (let x = -40; x < state.width + 60; x += 44) {
    const height = 42 + ((x + seed) % 5) * 19;
    context.fillRect(x, horizon - height, 34, height);
  }
}

function drawGridFloor() {
  const floorY = state.height - 86 * gameScale();
  context.strokeStyle = "rgba(85, 219, 255, 0.14)";
  context.lineWidth = 1;
  for (let x = -state.width; x < state.width * 2; x += 46) {
    context.beginPath();
    context.moveTo(x, floorY);
    context.lineTo(x + state.width * 0.34, state.height);
    context.stroke();
  }
  for (let y = floorY; y < state.height; y += 30) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(state.width, y);
    context.stroke();
  }
}

function update(delta) {
  state.cameraY += (state.targetCameraY - state.cameraY) * 0.08;
  state.pulse = Math.max(0, state.pulse - delta * 0.003);

  if (state.active) {
    state.active.phase += delta * 0.001;
    const travel = state.active.direction === "x" ? state.width * 0.62 : state.width * 0.48;
    const position = Math.sin(state.active.phase * state.active.speed * 0.018) * travel;

    if (state.active.direction === "x") {
      state.active.x = position;
    } else {
      state.active.depthOffset = position;
    }
  }

  state.chips = state.chips
    .map((chip) => ({
      ...chip,
      x: chip.x + chip.velocityX * delta * 0.001,
      y: chip.y + chip.velocityY * delta * 0.001,
      velocityY: chip.velocityY - 180 * delta * 0.001,
      opacity: chip.opacity - delta * 0.0007
    }))
    .filter((chip) => chip.opacity > 0);
}

function draw(time) {
  drawBackdrop(time);
  context.save();
  if (state.pulse > 0) {
    context.shadowColor = "rgba(182, 243, 92, 0.34)";
    context.shadowBlur = state.pulse * 28;
  }

  [...state.blocks, ...state.chips, state.active]
    .filter(Boolean)
    .sort((a, b) => a.y - b.y)
    .forEach((block) => drawBlock(block, { opacity: block.opacity }));

  context.restore();
}

function loop(time) {
  const delta = Math.min(32, time - state.lastTime || 16);
  state.lastTime = time;
  update(delta);
  draw(time);
  requestAnimationFrame(loop);
}

function handleInput(event) {
  event.preventDefault();
  placeBlock();
}

function handleKeydown(event) {
  if (event.code === "Space" || event.code === "Enter") {
    handleInput(event);
  }
}

resizeCanvas();
bestScoreValue.textContent = String(state.best);
window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("pointerdown", handleInput);
startButton.addEventListener("click", handleInput);
restartButton.addEventListener("click", handleInput);
window.addEventListener("keydown", handleKeydown);
requestAnimationFrame(loop);
