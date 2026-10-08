const candidateForm = document.querySelector("#candidate-form");
const candidateInput = document.querySelector("#candidate-input");
const candidateList = document.querySelector("#candidate-list");
const candidateCount = document.querySelector("#candidate-count");
const message = document.querySelector("#message");
const result = document.querySelector("#result");
const resultText = document.querySelector("#result-text");
const drawButton = document.querySelector("#draw-button");
const returnButton = document.querySelector("#return-button");
const capsuleBed = document.querySelector("#capsule-bed");
const dispensedArea = document.querySelector("#dispensed-area");
const openCapsuleButton = document.querySelector("#open-capsule");
const capsuleReveal = document.querySelector("#capsule-reveal");
const machineStatus = document.querySelector("#machine-status");
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
let selectedCapsuleId = -1;

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const durations = () => motionPreference.matches
  ? { mixing: 180, dispensing: 120, opening: 180, reveal: 70 }
  : { mixing: 2500, dispensing: 900, opening: 800, reveal: 350 };

try {
  const savedCandidates = JSON.parse(localStorage.getItem(storageKey) || "[]");
  if (Array.isArray(savedCandidates)) {
    candidates = savedCandidates.filter((candidate) => typeof candidate === "string" && candidate.trim());
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

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function capsuleSize(count) {
  if (count <= 3) return 46;
  if (count <= 8) return 38;
  if (count <= 14) return 30;
  return 24;
}

function renderCapsules(assignments = shuffle(candidates)) {
  capsuleBed.replaceChildren();
  const count = assignments.length;
  capsuleBed.style.setProperty("--capsule-width", `${capsuleSize(count)}px`);
  if (!count) return;

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  assignments.forEach((_candidate, index) => {
    const capsule = document.createElement("span");
    capsule.className = "machine-capsule";
    capsule.setAttribute("aria-hidden", "true");
    capsule.dataset.capsuleId = String(index);
    const [light, dark] = capsuleColors[Math.floor(Math.random() * capsuleColors.length)];
    const radius = Math.sqrt((index + 0.55) / count) * 0.76;
    const angle = index * goldenAngle + Math.random() * 0.22;
    const x = 50 + Math.cos(angle) * 39 * radius;
    const y = 51 + Math.sin(angle) * 34 * radius;
    capsule.style.setProperty("--x", `${x}%`);
    capsule.style.setProperty("--y", `${y}%`);
    capsule.style.setProperty("--cap-light", light);
    capsule.style.setProperty("--cap-dark", dark);
    capsuleBed.append(capsule);
  });
}

function renderCandidates() {
  candidateList.replaceChildren();
  candidateCount.textContent = `${candidates.length}개`;

  candidates.forEach((candidate, index) => {
    const item = document.createElement("li");
    item.className = "candidate-item";

    const number = document.createElement("span");
    number.className = "candidate-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const text = document.createElement("span");
    text.className = "candidate-text";
    text.textContent = candidate;

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `${candidate} 삭제`);
    removeButton.disabled = state !== "idle";
    removeButton.addEventListener("click", () => {
      if (state !== "idle") return;
      candidates.splice(index, 1);
      saveCandidates();
      renderCandidates();
      renderCapsules();
      updateControls();
    });

    item.append(number, text, removeButton);
    candidateList.append(item);
  });
}

function updateControls() {
  const isIdle = state === "idle";
  candidateInput.disabled = !isIdle;
  candidateForm.querySelector("button").disabled = !isIdle;
  candidateList.querySelectorAll(".remove-button").forEach((button) => {
    button.disabled = !isIdle;
  });
  drawButton.disabled = !isIdle || candidates.length === 0;
  drawButton.textContent = "뽑기 시작";
}

function setState(nextState, status = "") {
  state = nextState;
  machineStatus.textContent = status;
  updateControls();
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function startDraw() {
  if (state !== "idle" || candidates.length === 0) return;

  const assignments = shuffle(candidates);
  selectedCapsuleId = Math.floor(Math.random() * assignments.length);
  selectedCandidate = assignments[selectedCapsuleId];
  renderCapsules(assignments);
  setState("mixing", "캡슐을 섞고 있어요...");
  document.querySelector(".gacha-machine").classList.add("is-mixing");
  await wait(durations().mixing);

  if (state !== "mixing") return;
  setState("dispensing", "캡슐이 나오고 있어요...");
  document.querySelector(".gacha-machine").classList.remove("is-mixing");
  const selectedCapsule = capsuleBed.querySelector(`[data-capsule-id="${selectedCapsuleId}"]`);
  const light = selectedCapsule.style.getPropertyValue("--cap-light");
  const dark = selectedCapsule.style.getPropertyValue("--cap-dark");
  selectedCapsule.classList.add("is-selected");
  await wait(durations().dispensing);

  if (state !== "dispensing") return;
  selectedCapsule.remove();
  openCapsuleButton.style.setProperty("--cap-light", light);
  openCapsuleButton.style.setProperty("--cap-dark", dark);
  dispensedArea.hidden = false;
  setState("waitingToOpen", "캡슐을 눌러 결과를 확인하세요.");
}

async function openCapsule() {
  if (state !== "waitingToOpen") return;
  setState("opening", "캡슐을 열고 있어요...");
  openCapsuleButton.disabled = true;
  openCapsuleButton.classList.add("is-opening");
  const timing = durations();
  await wait(timing.reveal);
  if (state !== "opening") return;
  capsuleReveal.textContent = selectedCandidate;
  await wait(timing.opening - timing.reveal);
  if (state !== "opening") return;
  resultText.textContent = selectedCandidate;
  dispensedArea.hidden = true;
  result.hidden = false;
  setState("result", "추첨 결과입니다.");
}

function returnToMachine() {
  if (state !== "result") return;
  result.hidden = true;
  capsuleReveal.textContent = "";
  openCapsuleButton.classList.remove("is-opening");
  openCapsuleButton.disabled = false;
  dispensedArea.hidden = true;
  selectedCandidate = "";
  selectedCapsuleId = -1;
  renderCapsules();
  setState("idle", "");
  candidateInput.focus();
}

candidateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state !== "idle") return;
  const candidate = candidateInput.value.trim();
  if (!candidate) return;

  candidates.push(candidate);
  saveCandidates();
  renderCandidates();
  renderCapsules();
  updateControls();
  candidateInput.value = "";
  candidateInput.focus();
  message.textContent = "";
});

drawButton.addEventListener("click", () => {
  if (candidates.length === 0) {
    message.textContent = "먼저 후보를 입력해주세요.";
    return;
  }

  message.textContent = "";
  startDraw();
});

openCapsuleButton.addEventListener("click", openCapsule);
returnButton.addEventListener("click", returnToMachine);
renderCapsules();
renderCandidates();
updateControls();
