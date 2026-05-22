/**
 * DMUN Poll Widget
 * Einbettung: <div class="dmun-poll" data-poll-id="1" data-api-url="https://quiz.dmun.de"></div>
 *             <script src="https://quiz.dmun.de/static/poll-widget.js"></script>
 */
(function () {
  "use strict";

  const NS = "dmun-poll";

  // ── CSS laden ─────────────────────────────────────────────────────────────
  // Bevorzugt die externe poll-widget.css (kein CSP-Problem).
  // Fallback: minimale Inline-Stile damit das Widget sichtbar bleibt.

  function ensureStyles(apiUrl) {
    if (document.getElementById("dmun-poll-style")) return;

    // Externe CSS-Datei verlinken (gleiche Origin wie die API)
    const link = document.createElement("link");
    link.id   = "dmun-poll-style";
    link.rel  = "stylesheet";
    link.href = apiUrl + "/static/poll-widget.css";
    document.head.appendChild(link);
  }

  // ── Widget-Instanz ─────────────────────────────────────────────────────────

  function initPoll(container) {
    const pollId = container.dataset.pollId;
    const apiUrl = (container.dataset.apiUrl || "").replace(/\/$/, "");

    ensureStyles(apiUrl);

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
      const total     = poll.total_votes || 0;
      const justVoted = !!poll._justVoted;
      const maxVotes  = poll.options.length ? Math.max.apply(null, poll.options.map(function (o) { return o.votes || 0; })) : 0;

      let html = "";

      // Danke-Banner
      if (justVoted) {
        const msg = (poll.thank_you_text && poll.thank_you_text.trim())
          ? esc(poll.thank_you_text)
          : "Deine Stimme wurde gezählt!";
        html += "<div class=\"" + NS + "__voted-banner\">" +
          "<span class=\"" + NS + "__voted-check\">✓</span>" + msg +
          "</div>";
      }

      // Balken
      html += "<div class=\"" + NS + "__results\">";
      poll.options.forEach(function (o) {
        const pct   = o.percentage != null ? o.percentage : 0;
        const votes = o.votes != null ? o.votes : 0;
        const voted = poll.voted_options && poll.voted_options.indexOf(o.id) !== -1;
        const isTop = total > 0 && maxVotes > 0 && votes === maxVotes;

        let rowCls = NS + "__bar-row";
        if (voted) rowCls += " " + NS + "__bar-row--voted";
        if (isTop)  rowCls += " " + NS + "__bar-row--top";

        html += "<div class=\"" + rowCls + "\">" +
          "<div class=\"" + NS + "__bar-label\">" +
            "<span class=\"" + NS + "__bar-text\">" +
              (voted ? "<span class=\"" + NS + "__voted-tick\">✓</span>" : "") +
              esc(o.option_text) +
              (isTop && total > 0 ? "<span class=\"" + NS + "__leader-badge\">Führend</span>" : "") +
            "</span>" +
            "<span class=\"" + NS + "__bar-pct\">" + votes + " (" + pct + " %)</span>" +
          "</div>" +
          "<div class=\"" + NS + "__bar-track\">" +
            "<div class=\"" + NS + "__bar-fill\" style=\"width:0%\" data-pct=\"" + pct + "\"></div>" +
          "</div>" +
        "</div>";
      });
      html += "</div>";

      // Fußzeile
      html += "<div class=\"" + NS + "__footer\">" +
        "<span class=\"" + NS + "__total\">" + total + " Stimme" + (total !== 1 ? "n" : "") + " insgesamt</span>" +
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
