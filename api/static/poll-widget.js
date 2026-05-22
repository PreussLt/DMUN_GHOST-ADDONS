/**
 * DMUN Poll Widget
 * Einbettung: <div class="dmun-poll" data-poll-id="1" data-api-url="https://quiz.dmun.de"></div>
 *             <script src="https://quiz.dmun.de/static/poll-widget.js"></script>
 */
(function () {
  "use strict";

  const NS = "dmun-poll";

  // ── CSS (muss vor der ersten Nutzung stehen) ───────────────────────────────

  function buildCSS() {
    return `
:root {
  --dp-primary: #1a3a5c;
  --dp-accent:  #2e86c1;
  --dp-border:  #d5dde5;
  --dp-bg:      #f8fafc;
  --dp-radius:  8px;
  --dp-voted:   #1e8449;
}
.dmun-poll { font-family:system-ui,-apple-system,"Segoe UI",sans-serif; font-size:1rem; line-height:1.6; max-width:640px; margin:2rem auto; }
.dmun-poll__inner { background:#fff; border:1px solid var(--dp-border); border-radius:var(--dp-radius); overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.06); }
.dmun-poll__header { background:var(--dp-primary); color:#fff; padding:1.1rem 1.4rem; }
.dmun-poll__title  { margin:0 0 .2rem; font-size:1.15rem; font-weight:700; }
.dmun-poll__desc   { margin:0; opacity:.85; font-size:.9rem; }
.dmun-poll__closed-badge { display:inline-block; margin-top:.5rem; padding:.15em .6em; background:rgba(255,255,255,.2); border-radius:99px; font-size:.75rem; font-weight:700; letter-spacing:.03em; text-transform:uppercase; }
.dmun-poll__body { padding:1.25rem 1.4rem; }
/* Abstimmformular */
.dmun-poll__options { display:flex; flex-direction:column; gap:.5rem; margin-bottom:1rem; }
.dmun-poll__option  { display:flex; align-items:center; gap:.65rem; padding:.55rem .9rem; border:1px solid var(--dp-border); border-radius:calc(var(--dp-radius) - 2px); cursor:pointer; transition:background .15s,border-color .15s; }
.dmun-poll__option:hover { background:var(--dp-bg); border-color:var(--dp-accent); }
.dmun-poll__option input { accent-color:var(--dp-accent); flex-shrink:0; }
.dmun-poll__option-text { flex:1; }
.dmun-poll__vote-btn { padding:.65rem 1.6rem; background:var(--dp-accent); color:#fff; border:none; border-radius:var(--dp-radius); font-size:1rem; font-weight:600; cursor:pointer; transition:background .15s,transform .1s; }
.dmun-poll__vote-btn:hover { background:var(--dp-primary); transform:translateY(-1px); }
.dmun-poll__vote-btn--shake { animation:dp-shake .4s; }
@keyframes dp-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
.dmun-poll__hint { margin:.5rem 0 0; font-size:.8rem; color:#888; }
/* Ergebnisse */
.dmun-poll__voted-banner { display:flex; align-items:center; gap:.65rem; background:#eafaf1; border:1px solid #a9dfbf; border-radius:7px; padding:.65rem 1rem; color:#1e8449; font-weight:600; font-size:.95rem; margin-bottom:.85rem; }
.dmun-poll__voted-check  { display:inline-flex; align-items:center; justify-content:center; width:1.6em; height:1.6em; background:var(--dp-voted); color:#fff; border-radius:50%; font-size:.82em; font-weight:700; flex-shrink:0; }
.dmun-poll__results { display:flex; flex-direction:column; gap:.8rem; }
.dmun-poll__bar-row--voted .dmun-poll__bar-text { color:var(--dp-voted); font-weight:700; }
.dmun-poll__bar-row--voted .dmun-poll__bar-fill  { background:var(--dp-voted); }
.dmun-poll__bar-row--top   .dmun-poll__bar-fill  { background:var(--dp-primary); }
.dmun-poll__bar-label { display:flex; justify-content:space-between; align-items:baseline; gap:.5rem; margin-bottom:.3rem; font-size:.9rem; }
.dmun-poll__bar-text  { flex:1; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:.35rem; flex-wrap:wrap; }
.dmun-poll__voted-tick { color:var(--dp-voted); font-weight:700; flex-shrink:0; }
.dmun-poll__leader-badge { font-size:.68rem; font-weight:700; padding:.1em .5em; background:var(--dp-primary); color:#fff; border-radius:4px; flex-shrink:0; }
.dmun-poll__bar-pct   { flex-shrink:0; font-weight:700; color:#444; font-size:.85rem; white-space:nowrap; }
.dmun-poll__bar-track { height:22px; background:var(--dp-bg); border-radius:5px; overflow:hidden; border:1px solid var(--dp-border); }
.dmun-poll__bar-fill  { height:100%; width:0; background:var(--dp-accent); border-radius:5px; transition:width .65s cubic-bezier(.4,0,.2,1); }
.dmun-poll__footer    { display:flex; align-items:center; gap:1rem; margin-top:.5rem; flex-wrap:wrap; padding-top:.5rem; border-top:1px solid var(--dp-border); }
.dmun-poll__total     { font-size:.82rem; color:#888; }
.dmun-poll__closed-note { font-size:.78rem; color:#c0392b; font-weight:600; }
/* Zustände */
.dmun-poll__loading,.dmun-poll__error { padding:2rem; text-align:center; color:#888; border:1px dashed var(--dp-border); border-radius:var(--dp-radius); }
.dmun-poll__error { color:#c0392b; }
`;
  }

  // CSS einmalig in den <head> injizieren
  function ensureStyles() {
    if (!document.getElementById("dmun-poll-style")) {
      const s = document.createElement("style");
      s.id = "dmun-poll-style";
      s.textContent = buildCSS();
      document.head.appendChild(s);
    }
  }

  // ── Widget-Instanz ─────────────────────────────────────────────────────────

  function initPoll(container) {
    ensureStyles();

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
