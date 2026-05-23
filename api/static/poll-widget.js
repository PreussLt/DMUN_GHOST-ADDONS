/**
 * DMUN Poll Widget
 * Einbettung: <div class="dmun-poll" data-poll-id="1" data-api-url="https://quiz.dmun.de"></div>
 *             <script src="https://quiz.dmun.de/static/poll-widget.js"></script>
 */
(function () {
  "use strict";

  const NS = "dmun-poll";

  // --- Dynamic CSS Injection ---
  const style = document.createElement("style");
  style.textContent = `
:root {
  --dp-primary: #0C4695;
  --dp-accent:  #1a5ea8;
  --dp-correct: #1e8449;
  --dp-border:  #d5dde5;
  --dp-bg:      #f8fafc;
  --dp-radius:  10px;
}
.dmun-poll {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 1.6rem !important;
  line-height: 1.6 !important;
  color: #15171a !important;
  max-width: 640px !important;
  margin: 4rem auto !important;
  display: block !important;
}
div.dmun-poll .dmun-poll__inner {
  background: #ffffff !important;
  border: 1px solid var(--dp-border) !important;
  border-radius: var(--dp-radius) !important;
  overflow: hidden !important;
  box-shadow: 0 4px 15px rgba(0, 0, 0, .08) !important;
  display: block !important;
}
div.dmun-poll .dmun-poll__header {
  background: var(--dp-primary) !important;
  color: #ffffff !important;
  padding: 1.5rem 2rem !important;
  display: block !important;
}
div.dmun-poll .dmun-poll__title {
  margin: 0 0 .5rem !important;
  font-size: 2.2rem !important;
  font-weight: 800 !important;
  line-height: 1.2 !important;
  color: #ffffff !important;
}
div.dmun-poll .dmun-poll__desc {
  margin: 0 !important;
  opacity: .9 !important;
  font-size: 1.6rem !important;
  color: #ffffff !important;
}
div.dmun-poll .dmun-poll__body {
  padding: 2.5rem !important;
  display: block !important;
}
div.dmun-poll .dmun-poll__options {
  display: flex !important;
  flex-direction: column !important;
  gap: 1.5rem !important; /* Deutlicherer Abstand zwischen den Optionen */
  margin-bottom: 2rem !important;
}
div.dmun-poll .dmun-poll__option {
  display: flex !important;
  align-items: center !important;
  gap: 1.2rem !important;
  padding: 1.25rem 1.5rem !important;
  border: 1.5px solid var(--dp-border) !important;
  border-radius: var(--dp-radius) !important;
  cursor: pointer !important;
  transition: all .15s !important;
  background: #ffffff !important;
  margin: 0 !important;
}
div.dmun-poll .dmun-poll__option:hover {
  background: #f0f7ff !important;
  border-color: var(--dp-accent) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05) !important;
}
div.dmun-poll .dmun-poll__option input {
  accent-color: var(--dp-accent) !important;
  width: 1.4em !important;
  height: 1.4em !important;
  margin: 0 !important;
}
div.dmun-poll .dmun-poll__option-text {
  font-size: 1.7rem !important;
  font-weight: 500 !important;
  color: #15171a !important;
}
div.dmun-poll .dmun-poll__vote-btn {
  display: inline-block !important;
  padding: 1.2rem 3rem !important;
  background: var(--dp-accent) !important;
  color: #ffffff !important;
  border: none !important;
  border-radius: var(--dp-radius) !important;
  font-size: 1.7rem !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  transition: all .15s !important;
  box-shadow: 0 4px 12px rgba(26, 94, 168, 0.3) !important;
}
div.dmun-poll .dmun-poll__vote-btn:hover {
  background: var(--dp-primary) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(12, 70, 149, 0.4) !important;
}
div.dmun-poll .dmun-poll__bar-row {
  margin-bottom: 1.5rem !important;
}
div.dmun-poll .dmun-poll__bar-label {
  display: flex !important;
  justify-content: space-between !important;
  margin-bottom: .6rem !important;
  font-size: 1.6rem !important;
  font-weight: 600 !important;
}
div.dmun-poll .dmun-poll__bar-track {
  height: 28px !important;
  background: #e2e8f0 !important;
  border-radius: 99px !important;
  overflow: hidden !important;
}
div.dmun-poll .dmun-poll__bar-fill {
  height: 100% !important;
  background: var(--dp-accent) !important;
  transition: width .8s cubic-bezier(.4, 0, .2, 1) !important;
}
@media (max-width: 540px) {
  .dmun-poll { margin: 2rem auto !important; }
  div.dmun-poll .dmun-poll__body { padding: 1.5rem !important; }
}
  `;
  document.head.appendChild(style);

  // -------------------------------------------------------------------------

  // ── Widget-Instanz ─────────────────────────────────────────────────────────

  function initPoll(container) {
    const pollId = container.dataset.pollId;
    const apiUrl = (container.dataset.apiUrl || "").replace(/\/$/, "");

    const SID_KEY = "dmun_poll_sid_" + pollId;
    const sessionId = sessionStorage.getItem(SID_KEY) || (function () {
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SID_KEY, id);
      return id;
    }());

    let poll = null;

    // ── Laden ──────────────────────────────────────────────────────────────

    async function load() {
      container.innerHTML = "<div class=\"" + NS + "__loading\">Lade Umfrage…</div>";
      try {
        const res = await fetch(apiUrl + "/api/poll/" + pollId + "?session_id=" + encodeURIComponent(sessionId));
        if (!res.ok) throw new Error("HTTP " + res.status);
        poll = await res.json();
        render();
      } catch (e) {
        container.innerHTML = "<div class=\"" + NS + "__error\">Umfrage konnte nicht geladen werden.<br><small>" + e.message + "</small></div>";
      }
    }

    // ── Rendern ─────────────────────────────────────────────────────────────

    function render() {
      const closed      = !poll.active;
      const showResults = poll.already_voted || !!poll.show_results_before_vote || closed;

      container.innerHTML =
        "<div class=\"" + NS + "__inner\">" +
          "<header class=\"" + NS + "__header\">" +
            "<h2 class=\"" + NS + "__title\">" + esc(poll.title) + "</h2>" +
            (poll.description ? "<p class=\"" + NS + "__desc\">" + esc(poll.description) + "</p>" : "") +
            (closed ? "<span class=\"" + NS + "__closed-badge\">Geschlossen</span>" : "") +
          "</header>" +
          "<div class=\"" + NS + "__body\">" +
            (showResults ? renderResults() : renderVoteForm()) +
          "</div>" +
        "</div>";

      if (!showResults && !closed) {
        container.querySelector("." + NS + "__vote-btn").addEventListener("click", onVote);
      }
    }

    function renderVoteForm() {
      const type = poll.multiple ? "checkbox" : "radio";
      return poll.options.map(function (o) {
        return "<label class=\"" + NS + "__option\">" +
          "<input type=\"" + type + "\" name=\"poll_" + pollId + "\" value=\"" + o.id + "\">" +
          "<span class=\"" + NS + "__option-text\">" + esc(o.option_text) + "</span>" +
          "</label>";
      }).join("") +
      "<button class=\"" + NS + "__vote-btn\" type=\"button\">Abstimmen</button>" +
      (poll.multiple ? "<p class=\"" + NS + "__hint\">Mehrfachauswahl möglich</p>" : "");
    }

    function renderResults() {
      const justVoted = !!poll._justVoted;
      // Fuehrendes Ergebnis anhand hoechstem Prozentsatz bestimmen
      const maxPct = poll.options.length
        ? Math.max.apply(null, poll.options.map(function (o) { return o.percentage || 0; }))
        : 0;

      let html = "";

      // Danke-Banner
      if (justVoted) {
        const msg = (poll.thank_you_text && poll.thank_you_text.trim())
          ? esc(poll.thank_you_text)
          : "Deine Stimme wurde gezaehlt!";
        html += "<div class=\"" + NS + "__voted-banner\">" +
          "<span class=\"" + NS + "__voted-check\">✓</span>" + msg +
          "</div>";
      }

      // Balken - nur Prozent, keine absoluten Zahlen
      html += "<div class=\"" + NS + "__results\">";
      poll.options.forEach(function (o) {
        const pct   = o.percentage != null ? o.percentage : 0;
        const voted = poll.voted_options && poll.voted_options.indexOf(o.id) !== -1;
        const isTop = pct > 0 && pct === maxPct;

        let rowCls = NS + "__bar-row";
        if (voted) rowCls += " " + NS + "__bar-row--voted";
        if (isTop)  rowCls += " " + NS + "__bar-row--top";

        html += "<div class=\"" + rowCls + "\">" +
          "<div class=\"" + NS + "__bar-label\">" +
            "<span class=\"" + NS + "__bar-text\">" +
              (voted ? "<span class=\"" + NS + "__voted-tick\">✓</span>" : "") +
              esc(o.option_text) +
              (isTop ? "<span class=\"" + NS + "__leader-badge\">Führend</span>" : "") +
            "</span>" +
            "<span class=\"" + NS + "__bar-pct\">" + pct + " %</span>" +
          "</div>" +
          "<div class=\"" + NS + "__bar-track\">" +
            "<div class=\"" + NS + "__bar-fill\" style=\"width:0%\" data-pct=\"" + pct + "\"></div>" +
          "</div>" +
        "</div>";
      });
      html += "</div>";

      // Fuszeile - kein absoluter Gesamtzaehler, nur Status
      html += "<div class=\"" + NS + "__footer\">" +
        (!poll.active ? "<span class=\"" + NS + "__closed-note\">Umfrage geschlossen</span>" : "") +
      "</div>";

      return html;
    }


    // ── Abstimmen ───────────────────────────────────────────────────────────

    async function onVote() {
      const inputs     = container.querySelectorAll("input[name=\"poll_" + pollId + "\"]:checked");
      const option_ids = Array.prototype.map.call(inputs, function (i) { return parseInt(i.value, 10); });

      if (!option_ids.length) {
        const btn = container.querySelector("." + NS + "__vote-btn");
        if (btn) {
          btn.classList.add(NS + "__vote-btn--shake");
          setTimeout(function () { btn.classList.remove(NS + "__vote-btn--shake"); }, 500);
        }
        return;
      }

      try {
        const res = await fetch(apiUrl + "/api/poll/" + pollId + "/vote", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ option_ids: option_ids, session_id: sessionId }),
        });

        if (res.status === 409) {
          // Bereits abgestimmt — Ergebnisse laden
          const full = await fetch(apiUrl + "/api/poll/" + pollId + "?session_id=" + encodeURIComponent(sessionId));
          poll = await full.json();
          render();
          scheduleBarAnimation();
          return;
        }
        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();
        poll = Object.assign({}, poll, data, { _justVoted: true });
        render();
        scheduleBarAnimation();
      } catch (e) {
        alert("Fehler beim Abstimmen. Bitte versuche es erneut.\n(" + e.message + ")");
      }
    }

    // ── Animationen ─────────────────────────────────────────────────────────

    function animateBars() {
      container.querySelectorAll("." + NS + "__bar-fill[data-pct]").forEach(function (el) {
        el.style.width = el.dataset.pct + "%";
      });
    }

    function scheduleBarAnimation() {
      requestAnimationFrame(function () {
        requestAnimationFrame(animateBars);
      });
    }

    // ── Start ───────────────────────────────────────────────────────────────

    load().then(function () {
      if (poll && (poll.already_voted || poll.show_results_before_vote || !poll.active)) {
        scheduleBarAnimation();
      }
    });
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = String(str || "");
    return d.innerHTML;
  }

  function init() {
    document.querySelectorAll("." + NS + "[data-poll-id]").forEach(initPoll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
