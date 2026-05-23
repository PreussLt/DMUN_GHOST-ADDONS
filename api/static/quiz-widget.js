/**
 * DMUN Quiz Widget
 * Einbettung: <div class="dmun-quiz" data-quiz-id="1" data-api-url="https://quiz.dmun.de"></div>
 *             <script src="https://quiz.dmun.de/static/quiz-widget.js"></script>
 */
(function () {
  "use strict";

  const CSS_NS = "dmun-quiz";

  // --- Dynamic CSS Injection ---
  const style = document.createElement("style");
  style.textContent = `
:root {
  --dmun-primary: #0C4695;
  --dmun-accent:  #1a5ea8;
  --dmun-correct: #1e8449;
  --dmun-wrong:   #c0392b;
  --dmun-bg:      #f4f7fa;
  --dmun-border:  #d0dae5;
  --dmun-text:    #15171a;
  --dmun-radius:  10px;
  --dmun-shadow:  0 2px 10px rgba(0, 0, 0, .08);
}
.dmun-quiz {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 1.6rem !important;
  line-height: 1.6 !important;
  color: var(--dmun-text) !important;
  max-width: 740px !important;
  margin: 4rem auto !important;
  display: block !important;
}
div.dmun-quiz .dmun-quiz__inner {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  overflow: visible !important;
  display: block !important;
}
div.dmun-quiz .dmun-quiz__header {
  background: var(--dmun-primary) !important;
  color: #ffffff !important;
  padding: 2.5rem !important;
  margin-bottom: 3.5rem !important;
  border-radius: var(--dmun-radius) !important;
  box-shadow: 0 4px 15px rgba(12, 70, 149, 0.2) !important;
  display: block !important;
}
div.dmun-quiz .dmun-quiz__title {
  margin: 0 0 .5rem !important;
  font-size: 2.6rem !important;
  font-weight: 800 !important;
  letter-spacing: -.01em !important;
  color: #ffffff !important;
  line-height: 1.2 !important;
}
div.dmun-quiz .dmun-quiz__desc {
  margin: 0 !important;
  opacity: .9 !important;
  font-size: 1.7rem !important;
  line-height: 1.5 !important;
  color: #ffffff !important;
}
div.dmun-quiz .dmun-quiz__form {
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 4rem !important;
  background: transparent !important;
  border: none !important;
}
div.dmun-quiz .dmun-quiz__question {
  background: #ffffff !important;
  border: 2px solid #e2e8f0 !important;
  border-radius: var(--dmun-radius) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1) !important;
  overflow: hidden !important;
  transition: transform .2s, box-shadow .2s, border-color .2s !important;
  display: block !important;
  position: relative !important;
  margin: 0 !important;
}
div.dmun-quiz .dmun-quiz__question:hover {
  transform: translateY(-3px) !important;
  border-color: var(--dmun-accent) !important;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15) !important;
}
div.dmun-quiz .dmun-quiz__question::before {
  content: "" !important;
  display: block !important;
  height: 6px !important;
  background: var(--dmun-accent) !important;
  transition: background .25s !important;
}
div.dmun-quiz .dmun-quiz__question--correct { border-color: #a8dfc0 !important; }
div.dmun-quiz .dmun-quiz__question--correct::before { background: var(--dmun-correct) !important; }
div.dmun-quiz .dmun-quiz__question--correct .dmun-quiz__question-header { background: #f0faf4 !important; }
div.dmun-quiz .dmun-quiz__question--correct .dmun-quiz__question-num   { background: var(--dmun-correct) !important; }
div.dmun-quiz .dmun-quiz__question--wrong { border-color: #f0aeae !important; }
div.dmun-quiz .dmun-quiz__question--wrong::before { background: var(--dmun-wrong) !important; }
div.dmun-quiz .dmun-quiz__question--wrong .dmun-quiz__question-header { background: #fdf4f4 !important; }
div.dmun-quiz .dmun-quiz__question--wrong .dmun-quiz__question-num   { background: var(--dmun-wrong) !important; }
div.dmun-quiz .dmun-quiz__question-header {
  display: flex !important;
  align-items: baseline !important;
  gap: .8rem !important;
  padding: 1.2rem 1.5rem !important;
  background: #f8fafc !important;
  border-bottom: 1px solid var(--dmun-border) !important;
  transition: background .2s !important;
  margin: 0 !important;
}
div.dmun-quiz .dmun-quiz__question-num {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 1.8em !important;
  height: 1.8em !important;
  min-width: 1.8em !important;
  background: var(--dmun-accent) !important;
  color: #ffffff !important;
  border-radius: 50% !important;
  font-size: 1.4rem !important;
  font-weight: 800 !important;
  flex-shrink: 0 !important;
}
div.dmun-quiz .dmun-quiz__question-text {
  margin: 0 !important;
  font-weight: 700 !important;
  font-size: 1.8rem !important;
  line-height: 1.4 !important;
  color: var(--dmun-text) !important;
}
div.dmun-quiz .dmun-quiz__answers {
  display: flex !important;
  flex-direction: column !important;
  gap: .8rem !important;
  padding: 1.5rem 2rem !important;
  background: #ffffff !important;
  margin: 0 !important;
}
div.dmun-quiz .dmun-quiz__answer {
  display: flex !important;
  align-items: center !important;
  gap: 1rem !important;
  padding: 1rem 1.4rem !important;
  border: 1.5px solid var(--dmun-border) !important;
  border-radius: calc(var(--dmun-radius) - 3px) !important;
  background: #ffffff !important;
  cursor: pointer !important;
  transition: all .15s !important;
  user-select: none !important;
  margin: 0 !important;
}
div.dmun-quiz .dmun-quiz__answer:hover:not(:has(input:disabled)) {
  background: #f0f7ff !important;
  border-color: var(--dmun-accent) !important;
}
div.dmun-quiz .dmun-quiz__answer input[type="radio"] {
  accent-color: var(--dmun-accent) !important;
  width: 1.4em !important;
  height: 1.4em !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
}
div.dmun-quiz .dmun-quiz__answer-text {
  flex: 1 !important;
  font-size: 1.65rem !important;
  color: var(--dmun-text) !important;
  line-height: 1.4 !important;
}
div.dmun-quiz .dmun-quiz__answer--correct {
  border-color: #8ecfaa !important;
  background: #eefaf4 !important;
  box-shadow: 0 0 0 2px rgba(30, 132, 73, .12) !important;
}
div.dmun-quiz .dmun-quiz__answer--wrong {
  border-color: #f0aeae !important;
  background: #fef2f2 !important;
  box-shadow: 0 0 0 2px rgba(192, 57, 43, .1) !important;
}
div.dmun-quiz .dmun-quiz__badge {
  font-size: 1.3rem !important;
  font-weight: 700 !important;
  padding: .2em .55em !important;
  border-radius: 5px !important;
  white-space: nowrap !important;
  flex-shrink: 0;
  display: inline-block !important;
}
div.dmun-quiz .dmun-quiz__badge--ok  { background: var(--dmun-correct) !important; color: #fff !important; }
div.dmun-quiz .dmun-quiz__badge--err { background: var(--dmun-wrong) !important;   color: #fff !important; }
div.dmun-quiz .dmun-quiz__explanation {
  margin: 0 2rem 2rem !important;
  padding: 1.5rem !important;
  border: 1px solid #fecaca !important;
  border-left: 6px solid #ef4444 !important;
  border-radius: 8px !important;
  background: #fff5f5 !important;
  color: #9b1c1c !important;
  display: flex !important;
  align-items: flex-start !important;
  gap: 1rem !important;
  font-size: 1.55rem !important;
  font-weight: 500 !important;
  line-height: 1.6 !important;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.08) !important;
}
div.dmun-quiz .dmun-quiz__explanation::before {
  content: "ℹ" !important;
  flex-shrink: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 1.6em !important;
  height: 1.6em !important;
  background: #ef4444 !important;
  color: #fff !important;
  border-radius: 5px !important;
  font-size: 1.4rem !important;
  font-weight: 700 !important;
  font-style: normal !important;
  margin-top: .05em !important;
}
div.dmun-quiz .dmun-quiz__submit-btn,
div.dmun-quiz .dmun-quiz__retry-btn {
  align-self: flex-end !important;
  padding: 1.2rem 3.5rem !important;
  background: var(--dmun-accent) !important;
  color: #ffffff !important;
  border: none !important;
  border-radius: var(--dmun-radius) !important;
  font-size: 1.7rem !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  letter-spacing: .01em !important;
  transition: all .15s !important;
  box-shadow: 0 4px 12px rgba(46, 134, 193, 0.3) !important;
  margin: 1rem 0 !important;
}
div.dmun-quiz .dmun-quiz__submit-btn:hover:not(:disabled),
div.dmun-quiz .dmun-quiz__retry-btn:hover {
  background: var(--dmun-primary) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(12, 70, 149, 0.4) !important;
}
div.dmun-quiz .dmun-quiz__result {
  margin-top: 5rem !important;
  padding: 4rem 3rem !important;
  text-align: center !important;
  background: #f0f7ff !important;
  border: 3px solid var(--dmun-primary) !important;
  border-radius: var(--dmun-radius) !important;
  box-shadow: 0 20px 50px rgba(12, 70, 149, 0.15) !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 2rem !important;
  position: relative !important;
  overflow: hidden !important;
}
div.dmun-quiz .dmun-quiz__result::before {
  content: "" !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 8px !important;
  background: var(--dmun-primary) !important;
}
div.dmun-quiz .dmun-quiz__result-emoji { font-size: 6rem !important; line-height: 1 !important; margin-bottom: 1rem !important; }
div.dmun-quiz .dmun-quiz__result-label { font-size: 2.6rem !important; font-weight: 800 !important; color: var(--dmun-primary) !important; margin: 0 !important; }
div.dmun-quiz .dmun-quiz__result-score { font-size: 1.9rem !important; color: #444 !important; margin-bottom: 1.5rem !important; }
div.dmun-quiz .dmun-quiz__result-bar {
  width: 100% !important;
  max-width: 400px !important;
  height: 14px !important;
  background: #e2e8f0 !important;
  border-radius: 99px !important;
  overflow: hidden !important;
  margin: .5rem 0 2rem !important;
}
div.dmun-quiz .dmun-quiz__result-fill {
  height: 100% !important;
  background: linear-gradient(90deg, var(--dmun-accent), var(--dmun-primary)) !important;
  border-radius: 99px !important;
  transition: width .7s cubic-bezier(.4, 0, .2, 1) !important;
}
@media (max-width: 540px) {
  .dmun-quiz { margin: 2rem auto !important; }
  div.dmun-quiz .dmun-quiz__header { padding: 2rem 1.5rem !important; }
  div.dmun-quiz .dmun-quiz__question-header { padding: 1rem !important; }
  div.dmun-quiz .dmun-quiz__answers { padding: 1rem !important; }
  div.dmun-quiz .dmun-quiz__explanation { margin: 0 1rem 1.5rem !important; }
  div.dmun-quiz .dmun-quiz__submit-btn,
  div.dmun-quiz .dmun-quiz__retry-btn { width: 100% !important; justify-content: center !important; }
}
  `;
  document.head.appendChild(style);

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
          ${fb && fb.explanation
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
