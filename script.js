const candidateForm = document.querySelector("#candidate-form");
const candidateInput = document.querySelector("#candidate-input");
const candidateCount = document.querySelector("#candidate-count");
const undoButton = document.querySelector("#undo-button");
const message = document.querySelector("#message");
const drawButton = document.querySelector("#draw-button");
const capsuleBed = document.querySelector("#capsule-bed");
const machine = document.querySelector(".gacha-machine");
const machineScene = document.querySelector("#machine-scene");
const machineOverlay = document.querySelector("#machine-overlay");
const machineStatus = document.querySelector("#machine-status");
const openCapsuleButton = document.querySelector("#open-capsule");
const overlayHint = document.querySelector("#overlay-hint");
const overlayResult = document.querySelector("#overlay-result");
const capsuleReveal = document.querySelector("#capsule-reveal");
const resultText = document.querySelector("#result-text");
const returnButton = document.querySelector("#return-button");
const storageKey = "what-to-eat-candidates";
const capsuleColors = [
  ["#f4b9b7", "#df9297"],
  ["#d4c3ee", "#ad94d2"],
  ["#b9dfd2", "#88bdaa"],
  ["#f5dfa0", "#e5c36e"],
  ["#b9d9ed", "#87b9d7"],
  ["#f2c4a7", "#dd9d76"],
];

let candidates = [];
let state = "idle";
let selectedCandidate = "";
let selectedCapsuleId = "";
const capsuleElements = new Map();
const baseCapsuleSize = 46;

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const timing = () => motionPreference.matches
  ? { mixing: 200, dispensing: 180, opening: 180, reveal: 65 }
  : { mixing: 2500, dispensing: 650, opening: 800, reveal: 350 };

function createId() {
  return window.crypto?.randomUUID?.()
    || `capsule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCandidate(candidate) {
  const legacy = typeof candidate === "string";
  const name = (legacy ? candidate : candidate?.name)?.trim();
  if (!name) return null;

  const colorIndex = Number.isInteger(candidate?.colorIndex)
    ? ((candidate.colorIndex % capsuleColors.length) + capsuleColors.length) % capsuleColors.length
    : Math.floor(Math.random() * capsuleColors.length);
  return {
    id: typeof candidate?.id === "string" && candidate.id ? candidate.id : createId(),
    name,
    colorIndex,
    size: Number.isFinite(candidate?.size) && candidate.size > 0 ? candidate.size : baseCapsuleSize,
    rotation: Number.isFinite(candidate?.rotation)
      ? candidate.rotation
      : Math.round(Math.random() * 20 - 10),
    x: Number.isFinite(candidate?.x) && candidate.x >= 0 && candidate.x <= 1 ? candidate.x : null,
    y: Number.isFinite(candidate?.y) && candidate.y >= 0 && candidate.y <= 1 ? candidate.y : null,
    depth: Number.isInteger(candidate?.depth) ? Math.max(0, Math.min(2, candidate.depth)) : Math.floor(Math.random() * 3),
  };
}

try {
  const savedCandidates = JSON.parse(localStorage.getItem(storageKey) || "[]");
  if (Array.isArray(savedCandidates)) {
    candidates = savedCandidates.map(normalizeCandidate).filter(Boolean);
    if (JSON.stringify(savedCandidates) !== JSON.stringify(candidates)) saveCandidates();
  }
} catch {
  candidates = [];
}

function saveCandidates() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(candidates));
  } catch {
    // Keep the current page usable if browser storage is unavailable.
  }
}

function createCapsule(candidate) {
  const capsule = document.createElement("span");
  const topHalf = document.createElement("span");
  const bottomHalf = document.createElement("span");
  const [light, dark] = capsuleColors[candidate.colorIndex];

  capsule.className = "machine-capsule";
  capsule.dataset.capsuleId = candidate.id;
  capsule.setAttribute("aria-hidden", "true");
  capsule.style.setProperty("--cap-light", light);
  capsule.style.setProperty("--cap-dark", dark);
  capsule.style.setProperty("--rotation", `${candidate.rotation}deg`);
  topHalf.className = "capsule-shell capsule-top";
  bottomHalf.className = "capsule-shell capsule-bottom";
  capsule.append(topHalf, bottomHalf);
  capsuleElements.set(candidate.id, capsule);
  return capsule;
}

function capsuleSize() {
  return baseCapsuleSize;
}

function seededRandom(seedText) {
  let seed = 2166136261;
  for (const character of seedText) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function domeHalfWidth(y, width, height, size) {
  const vertical = Math.max(0, Math.min(1, (y - size / 2) / (height - size)));
  const contour = 0.58 + 0.42 * Math.sqrt(vertical);
  return Math.max(0, width * contour / 2 - size / 2 - 7);
}

function floorAt(x, width, height, size) {
  const normalizedX = Math.abs(x - width / 2) / (width / 2);
  return height - size / 2 - 8 - normalizedX ** 2 * 30;
}

function minimumVisibleDistance(depthA, depthB, size, count) {
  const depthDifference = Math.min(2, Math.abs((depthA ?? 1) - (depthB ?? 1)));
  const depthFactor = [0.58, 0.48, 0.4][depthDifference];
  return size * Math.max(0.34, depthFactor - Math.max(0, count - 12) * 0.003);
}

function isAllowedPosition(x, y, others, width, height, size, depth = 1, count = others.length + 1, distanceScale = 1) {
  if (y < size / 2 + 7 || y > floorAt(x, width, height, size) + 0.5) return false;
  if (Math.abs(x - width / 2) > domeHalfWidth(y, width, height, size)) return false;
  return others.every((other) => {
    const dx = x - other.x * width;
    const dy = y - other.y * height;
    const requiredDistance = Math.max(
      size * (distanceScale < 1 ? 0.28 : 0.34),
      minimumVisibleDistance(depth, other.depth, size, count) * distanceScale,
    );
    return dx * dx + dy * dy >= requiredDistance * requiredDistance;
  });
}

function findDensePosition(candidate, others, width, height, size) {
  const random = seededRandom(`${candidate.id}-dense`);
  const count = others.length + 1;
  const topY = size / 2 + 7;
  let best = null;

  // Try for a low, supported spot first. Depth separation allows a natural amount of overlap.
  for (let attempt = 0; attempt < 3200; attempt += 1) {
    const yFraction = 1 - random() ** 0.56;
    const y = topY + (height - size / 2 - topY - 8) * yFraction;
    const halfWidth = domeHalfWidth(y, width, height, size);
    if (halfWidth <= 0) continue;
    const x = width / 2 + (random() * 2 - 1) * halfWidth;
    if (!isAllowedPosition(x, y, others, width, height, size, candidate.depth, count, 1)) continue;

    let support = 0;
    let nearest = Infinity;
    let overlapPenalty = 0;
    for (const other of others) {
      const distance = Math.hypot(x - other.x * width, y - other.y * height);
      const required = minimumVisibleDistance(candidate.depth, other.depth, size, count);
      nearest = Math.min(nearest, distance);
      if (distance < size * 1.18) support += 1;
      overlapPenalty += Math.max(0, required * 1.55 - distance);
    }

    // Prefer bottom contact and loose support by existing capsules without forming rows.
    const floorGap = Math.max(0, floorAt(x, width, height, size) - y);
    const score = y + support * size * 0.035 - floorGap * 0.07 - overlapPenalty * 0.08 + random() * 1.2;
    if (!best || score > best.score) best = { x, y, score, nearest };
  }
  if (best) return { x: best.x / width, y: best.y / height };

  // Dense fallback relaxes overlap constraints, but still forbids near-identical positions.
  for (let attempt = 0; attempt < 30000; attempt += 1) {
    const y = topY + random() * Math.max(1, height - size - topY - 8);
    const halfWidth = domeHalfWidth(y, width, height, size);
    if (halfWidth <= 0) continue;
    const x = width / 2 + (random() * 2 - 1) * halfWidth;
    if (isAllowedPosition(x, y, others, width, height, size, candidate.depth, count, 0.3)) {
      return { x: x / width, y: y / height };
    }
  }

  // Last resort always returns the best distinct point found, even if the dome is crowded.
  // This avoids both a rejected candidate and a shared fixed fallback location.
  let leastCrowded = null;
  for (let attempt = 0; attempt < 12000; attempt += 1) {
    const y = topY + random() * Math.max(1, height - size - topY - 8);
    const halfWidth = domeHalfWidth(y, width, height, size);
    if (halfWidth <= 0) continue;
    const x = width / 2 + (random() * 2 - 1) * halfWidth;
    let nearest = Infinity;
    for (const other of others) {
      nearest = Math.min(nearest, Math.hypot(x - other.x * width, y - other.y * height));
    }
    const score = nearest + y * 0.012 + random() * 0.2;
    if (!leastCrowded || score > leastCrowded.score) leastCrowded = { x, y, score };
  }
  if (leastCrowded) return { x: leastCrowded.x / width, y: leastCrowded.y / height };

  // An empty machine uses its floor center; the next candidate is evaluated against this saved point.
  const x = width / 2;
  return { x: x / width, y: floorAt(x, width, height, size) / height };
}

function simulateDrop(candidate, others, width, height, size) {
  return findDensePosition(candidate, others, width, height, size);
}

function ensureCapsulePositions(forceRepack = false) {
  const width = capsuleBed.clientWidth || 292;
  const height = capsuleBed.clientHeight || 216;
  const size = capsuleSize();
  let changed = false;

  for (const candidate of candidates) {
    if (candidate.size !== size) {
      candidate.size = size;
      changed = true;
    }
  }

  candidates.forEach((candidate, index) => {
    const earlier = candidates.slice(0, index);
    const validPosition = !forceRepack && candidate.x !== null && candidate.y !== null
      && isAllowedPosition(candidate.x * width, candidate.y * height, earlier, width, height, size, candidate.depth);
    if (validPosition) return;
    const position = simulateDrop(candidate, earlier, width, height, size);
    candidate.x = position.x;
    candidate.y = position.y;
    changed = true;
  });
  if (changed) saveCandidates();
}

function renderCapsules() {
  const activeIds = new Set(candidates.map((candidate) => candidate.id));
  for (const [id, capsule] of capsuleElements) {
    if (!activeIds.has(id)) {
      capsule.remove();
      capsuleElements.delete(id);
    }
  }

  const width = capsuleBed.clientWidth || 292;
  const height = capsuleBed.clientHeight || 216;
  const size = capsuleSize();
  candidates.forEach((candidate) => {
    let capsule = capsuleElements.get(candidate.id);
    if (!capsule) capsule = createCapsule(candidate);
    if (capsule.parentElement !== capsuleBed) capsuleBed.append(capsule);
    capsule.style.transform = "";
    capsule.style.transitionDuration = "";
    const x = candidate.x * width;
    const y = candidate.y * height;
    const isCovered = candidates.some((other) => {
      if (other.id === candidate.id || other.y <= candidate.y) return false;
      const dx = (other.x - candidate.x) * width;
      const dy = (other.y - candidate.y) * height;
      return Math.hypot(dx, dy) < size * 1.18;
    });
    capsule.style.setProperty("--x", `${x}px`);
    capsule.style.setProperty("--y", `${y}px`);
    capsule.style.setProperty("--cap-size", `${size}px`);
    capsule.style.setProperty("--depth-brightness", isCovered ? "0.92" : candidate.depth === 0 ? "0.96" : "1");
    capsule.style.setProperty("--depth-saturation", isCovered ? "0.92" : candidate.depth === 0 ? "0.95" : "1");
    capsule.style.setProperty("--depth-blur", isCovered ? "0.25px" : "0px");
    capsule.style.setProperty("--depth-y", `${(candidate.depth - 1) * 6}px`);
    capsule.style.zIndex = String((candidate.depth ?? 1) * 10000 + Math.round(candidate.y * 1000));
    capsule.style.setProperty("--rotation", `${candidate.rotation}deg`);
  });
  if (state === "idle") validateCapsulePacking();
}

function validateCapsulePacking() {
  const size = capsuleSize();
  let samePositionCount = 0;
  let nearDuplicateCount = 0;
  for (let first = 0; first < candidates.length; first += 1) {
    for (let second = first + 1; second < candidates.length; second += 1) {
      const a = candidates[first];
      const b = candidates[second];
      const dx = (a.x - b.x) * (capsuleBed.clientWidth || 292);
      const dy = (a.y - b.y) * (capsuleBed.clientHeight || 216);
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) samePositionCount += 1;
      if (Math.hypot(dx, dy) < size * 0.2) nearDuplicateCount += 1;
    }
  }

  const check = {
    candidateCount: candidates.length,
    capsuleDomCount: capsuleBed.children.length,
    samePositionCount,
    nearDuplicateCount,
  };
  if (check.candidateCount !== check.capsuleDomCount || samePositionCount || nearDuplicateCount) {
    console.error("가챠 캡슐 적재 검증에 실패했습니다.", check);
  }
  return check;
}

function updateControls() {
  const isIdle = state === "idle";
  candidateInput.disabled = !isIdle;
  candidateForm.querySelector("button").disabled = !isIdle;
  undoButton.disabled = !isIdle || candidates.length === 0;
  drawButton.disabled = !isIdle || candidates.length === 0;
}

function updateCount() {
  candidateCount.textContent = `${candidates.length}개`;
}

function setState(nextState, status = "") {
  state = nextState;
  machineStatus.textContent = status;
  updateControls();
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function makeDerangement(length) {
  const order = Array.from({ length }, (_item, index) => index);
  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * index);
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}

async function mixCapsules() {
  const capsules = [...capsuleBed.children];
  const totalDuration = timing().mixing;

  if (capsules.length < 2) {
    if (capsules[0]) {
      capsules[0].style.transitionDuration = `${totalDuration}ms`;
      capsules[0].style.transform = "translate(-50%, -50%) rotate(360deg) scale(1.12)";
    }
    await wait(totalDuration);
    return;
  }

  const steps = [0.15, 0.17, 0.19, 0.22, 0.27];
  for (const fraction of steps) {
    if (state !== "mixing") return;
    const positions = capsules.map((capsule) => ({
      x: capsule.style.getPropertyValue("--x"),
      y: capsule.style.getPropertyValue("--y"),
    }));
    const destinations = makeDerangement(capsules.length);
    const stepDuration = Math.round(totalDuration * fraction);

    capsules.forEach((capsule, index) => {
      const destination = positions[destinations[index]];
      capsule.style.transitionDuration = `${stepDuration}ms`;
      capsule.style.setProperty("--x", destination.x);
      capsule.style.setProperty("--y", destination.y);
      capsule.style.setProperty("--rotation", `${Math.round(Math.random() * 300 - 150)}deg`);
    });
    await wait(stepDuration);
  }
}

function centerSelectedCapsule(capsule) {
  const capsuleRect = capsule.getBoundingClientRect();
  const sceneRect = machineScene.getBoundingClientRect();
  const originX = capsuleRect.left + capsuleRect.width / 2 - sceneRect.left;
  const originY = capsuleRect.top + capsuleRect.height / 2 - sceneRect.top;
  const light = capsule.style.getPropertyValue("--cap-light");
  const dark = capsule.style.getPropertyValue("--cap-dark");
  const size = capsule.style.getPropertyValue("--cap-size");

  capsule.remove();
  openCapsuleButton.style.setProperty("--cap-light", light);
  openCapsuleButton.style.setProperty("--cap-dark", dark);
  openCapsuleButton.style.setProperty("--cap-size", size);
  openCapsuleButton.style.setProperty("--origin-x", `${originX}px`);
  openCapsuleButton.style.setProperty("--origin-y", `${originY}px`);
  openCapsuleButton.hidden = false;
  openCapsuleButton.disabled = false;
  openCapsuleButton.classList.remove("is-opening");
  capsuleReveal.textContent = "";
  overlayHint.hidden = false;
  overlayHint.textContent = "캡슐을 눌러 열어보세요!";
  overlayResult.hidden = true;
  machineOverlay.classList.remove("is-visible");
  machineOverlay.hidden = false;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => machineOverlay.classList.add("is-visible"));
  });
}

async function startDraw() {
  if (state !== "idle" || candidates.length === 0) return;

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  selectedCapsuleId = selected.id;
  selectedCandidate = selected.name;
  machine.classList.add("is-mixing");
  setState("mixing", "캡슐을 섞고 있어요...");
  await mixCapsules();

  if (state !== "mixing") return;
  machine.classList.remove("is-mixing");
  setState("dispensing", "캡슐을 고르고 있어요...");
  const selectedCapsule = capsuleElements.get(selectedCapsuleId);
  if (!selectedCapsule) {
    machineOverlay.hidden = true;
    renderCapsules();
    setState("idle", "캡슐을 고르지 못했어요. 다시 시도해주세요.");
    return;
  }

  centerSelectedCapsule(selectedCapsule);
  await wait(timing().dispensing);
  if (state !== "dispensing") return;
  setState("waitingToOpen", "캡슐을 눌러 열어보세요.");
}

async function openCapsule() {
  if (state !== "waitingToOpen") return;
  setState("opening", "캡슐을 열고 있어요...");
  openCapsuleButton.disabled = true;
  openCapsuleButton.classList.add("is-opening");
  overlayHint.hidden = true;

  const revealDelay = motionPreference.matches ? 50 : 350;
  await wait(revealDelay);
  if (state !== "opening") return;
  capsuleReveal.textContent = selectedCandidate;
  await wait(timing().opening - revealDelay);
  if (state !== "opening") return;

  resultText.textContent = selectedCandidate;
  openCapsuleButton.hidden = true;
  overlayResult.hidden = false;
  setState("result", "추첨 결과입니다.");
}

function returnToMachine() {
  if (state !== "result") return;
  machineOverlay.hidden = true;
  machineOverlay.classList.remove("is-visible");
  overlayResult.hidden = true;
  openCapsuleButton.hidden = false;
  openCapsuleButton.disabled = false;
  openCapsuleButton.classList.remove("is-opening");
  capsuleReveal.textContent = "";
  selectedCandidate = "";
  selectedCapsuleId = "";
  renderCapsules();
  setState("idle", "");
  validateCapsulePacking();
  candidateInput.focus();
}

function addCandidate(event) {
  event.preventDefault();
  if (state !== "idle") return;
  const candidate = candidateInput.value.trim();
  if (!candidate) return;

  const colorIndex = Math.floor(Math.random() * capsuleColors.length);
  const bedWidth = capsuleBed.clientWidth || 292;
  const bedHeight = capsuleBed.clientHeight || 216;
  const capsule = {
    id: createId(),
    name: candidate,
    colorIndex,
    size: capsuleSize(),
    rotation: Math.round(Math.random() * 26 - 13),
    depth: Math.floor(Math.random() * 3),
    x: null,
    y: null,
  };
  const position = simulateDrop(capsule, candidates, bedWidth, bedHeight, capsule.size);
  capsule.x = position.x;
  capsule.y = position.y;
  candidates.push(capsule);
  saveCandidates();
  updateCount();
  renderCapsules();
  candidateInput.value = "";
  candidateInput.focus();
  message.textContent = "";
  updateControls();
}

function undoLastCandidate() {
  if (state !== "idle" || candidates.length === 0) return;
  const removed = candidates.pop();
  capsuleElements.get(removed.id)?.remove();
  capsuleElements.delete(removed.id);
  saveCandidates();
  updateCount();
  renderCapsules();
  updateControls();
}

candidateForm.addEventListener("submit", addCandidate);
undoButton.addEventListener("click", undoLastCandidate);
drawButton.addEventListener("click", startDraw);
openCapsuleButton.addEventListener("click", openCapsule);
returnButton.addEventListener("click", returnToMachine);
window.addEventListener("resize", () => {
  if (state === "idle") {
    ensureCapsulePositions();
    renderCapsules();
  }
});

ensureCapsulePositions(true);
updateCount();
renderCapsules();
updateControls();
