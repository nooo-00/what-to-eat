const candidateForm = document.querySelector("#candidate-form");
const candidateInput = document.querySelector("#candidate-input");
const candidateList = document.querySelector("#candidate-list");
const candidateCount = document.querySelector("#candidate-count");
const message = document.querySelector("#message");
const result = document.querySelector("#result");
const resultText = document.querySelector("#result-text");
const drawButton = document.querySelector("#draw-button");
const storageKey = "what-to-eat-candidates";
let candidates = [];

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
    removeButton.addEventListener("click", () => {
      candidates.splice(index, 1);
      saveCandidates();
      renderCandidates();
    });

    item.append(number, text, removeButton);
    candidateList.append(item);
  });
}

candidateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const candidate = candidateInput.value.trim();
  if (!candidate) return;

  candidates.push(candidate);
  saveCandidates();
  renderCandidates();
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
  resultText.textContent = candidates[Math.floor(Math.random() * candidates.length)];
  result.hidden = false;
  drawButton.textContent = "다시 뽑기";
});

renderCandidates();
