/**
 * DMUN Quiz Widget
 * Einbettung: <div class="dmun-quiz" data-quiz-id="1" data-api-url="https://quiz.dmun.de"></div>
 *             <script src="https://quiz.dmun.de/static/quiz-widget.js"></script>
 */
(function () {
  "use strict";

  const CSS_NS = "dmun-quiz";

  // -------------------------------------------------------------------------
  // Haupt-Widget
  // -------------------------------------------------------------------------

  function initWidget(container) {
    const quizId = container.dataset.quizId;
    const apiUrl = (container.dataset.apiUrl || "").replace(/\/$/, "");

    let quiz = null;
    let answers = {};   // { question_id: answer_id }
    let submitted = false;
    let result = null;

    // --- Render helpers ---

    function esc(str) {
      const d = document.createElement("div");
      d.textContent = String(str);
      return d.innerHTML;
    }

    function renderAnswer(q, a, fb) {
      const selected = String(answers[q.id]) === String(a.id);
      const isCorrect = fb && fb.correct_answer && String(fb.correct_answer.id) === String(a.id);
      const isWrong = selected && fb && !fb.is_correct;

      const cls = [
        `${CSS_NS}__answer`,
        isCorrect ? `${CSS_NS}__answer--correct` : "",
        isWrong ? `${CSS_NS}__answer--wrong` : "",
      ].filter(Boolean).join(" ");

      return `
        <label class="${cls}">
          <input type="radio" name="q_${q.id}" value="${a.id}"
            ${selected ? "checked" : ""} ${submitted ? "disabled" : ""}>
          <span class="${CSS_NS}__answer-text">${esc(a.answer_text)}</span>
          ${isCorrect && submitted ? `<span class="${CSS_NS}__badge ${CSS_NS}__badge--ok">✓ Richtig</span>` : ""}
          ${isWrong ? `<span class="${CSS_NS}__badge ${CSS_NS}__badge--err">✗ Falsch</span>` : ""}
        </label>`;
    }

    function renderQuestion(q, idx) {
      const fb = result && result.feedback.find((f) => f.question_id === q.id);
      const qCls = [
        `${CSS_NS}__question`,
        fb ? (fb.is_correct ? `${CSS_NS}__question--correct` : `${CSS_NS}__question--wrong`) : "",
      ].filter(Boolean).join(" ");

      return `
        <div class="${qCls}" data-qid="${q.id}">
          <div class="${CSS_NS}__question-header">
            <span class="${CSS_NS}__question-num">${idx + 1}</span>
            <p class="${CSS_NS}__question-text">${esc(q.question_text)}</p>
          </div>
          <div class="${CSS_NS}__answers">
            ${q.answers.map((a) => renderAnswer(q, a, fb)).join("")}
          </div>
          ${fb && fb.explanation && !fb.is_correct
            ? `<p class="${CSS_NS}__explanation">${esc(fb.explanation)}</p>`
            : ""}
        </div>`;
    }

    function renderResult() {
      const pct = result.percentage;
      let label, emoji;
      if (pct >= 80) { label = "Ausgezeichnet!"; emoji = "🎉"; }
      else if (pct >= 60) { label = "Gut gemacht!"; emoji = "👍"; }
      else if (pct >= 40) { label = "Noch etwas üben!"; emoji = "📚"; }
      else { label = "Weitermachen!"; emoji = "💪"; }

      return `
        <div class="${CSS_NS}__result">
          <div class="${CSS_NS}__result-emoji">${emoji}</div>
          <div class="${CSS_NS}__result-label">${label}</div>
          <div class="${CSS_NS}__result-score">${result.score} / ${result.max_score} Punkten</div>
          <div class="${CSS_NS}__result-bar">
            <div class="${CSS_NS}__result-fill" style="width:${pct}%"></div>
          </div>
          <button class="${CSS_NS}__retry-btn" type="button">Nochmal versuchen</button>
        </div>`;
    }

    function render() {
      if (!quiz) return;
      container.innerHTML = `
        <div class="${CSS_NS}__inner">
          <header class="${CSS_NS}__header">
            <h2 class="${CSS_NS}__title">${esc(quiz.title)}</h2>
            ${quiz.description ? `<p class="${CSS_NS}__desc">${esc(quiz.description)}</p>` : ""}
          </header>
          <form class="${CSS_NS}__form" novalidate>
            ${quiz.questions.map((q, i) => renderQuestion(q, i)).join("")}
            ${!submitted
              ? `<button class="${CSS_NS}__submit-btn" type="submit">Auswertung anzeigen</button>`
              : ""}
          </form>
          ${result ? renderResult() : ""}
        </div>`;

      if (!submitted) {
        container.querySelector("form").addEventListener("submit", onSubmit);
        container.querySelectorAll("input[type=radio]").forEach((r) => {
          r.addEventListener("change", () => {
            const qid = r.name.replace("q_", "");
            answers[qid] = r.value;
          });
        });
      } else {
        const retryBtn = container.querySelector(`.${CSS_NS}__retry-btn`);
        if (retryBtn) retryBtn.addEventListener("click", reset);
      }
    }

    // --- Data ---

    async function load() {
      container.innerHTML = `<div class="${CSS_NS}__loading">Lade Quiz…</div>`;
      try {
        const res = await fetch(`${apiUrl}/api/quiz/${quizId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        quiz = await res.json();
        render();
      } catch (e) {
        container.innerHTML = `<div class="${CSS_NS}__error">Quiz konnte nicht geladen werden (${e.message})</div>`;
      }
    }

    async function onSubmit(e) {
      e.preventDefault();
      const submitBtn = container.querySelector(`.${CSS_NS}__submit-btn`);
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch(`${apiUrl}/api/quiz/${quizId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, session_id: sessionId() }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        result = await res.json();
        submitted = true;
        render();
      } catch (e) {
        if (submitBtn) submitBtn.disabled = false;
        alert("Fehler beim Übermitteln. Bitte versuche es erneut.");
      }
    }

    function reset() {
      answers = {};
      submitted = false;
      result = null;
      render();
    }

    function sessionId() {
      const key = `dmun_quiz_sid_${quizId}`;
      let sid = sessionStorage.getItem(key);
      if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(key, sid); }
      return sid;
    }

    load();
  }

  // -------------------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------------------

  function init() {
    document.querySelectorAll(`.${CSS_NS}[data-quiz-id]`).forEach(initWidget);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
