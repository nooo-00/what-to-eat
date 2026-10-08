const form = document.querySelector("#picker-form");
const choicesInput = document.querySelector("#choices");
const message = document.querySelector("#message");
const result = document.querySelector("#result");
const resultText = document.querySelector("#result-text");
const button = form.querySelector("button");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const choices = choicesInput.value
    .split(/\r?\n/)
    .map((choice) => choice.trim())
    .filter(Boolean);

  if (choices.length === 0) {
    message.textContent = "먼저 후보를 입력해주세요.";
    return;
  }

  message.textContent = "";
  resultText.textContent = choices[Math.floor(Math.random() * choices.length)];
  result.hidden = false;
  button.textContent = "다시 뽑기";
});

choicesInput.addEventListener("input", () => {
  if (choicesInput.value.trim()) message.textContent = "";
});
