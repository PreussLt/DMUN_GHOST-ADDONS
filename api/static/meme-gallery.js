/**
 * DMUN Meme Gallery Widget
 * Einbettung: <div class="dmun-memes" data-api-url="https://quiz.dmun.de"></div>
 *             <script src="https://quiz.dmun.de/static/meme-gallery.js"></script>
 */
(function () {
  "use strict";

  const NS = "dmun-memes";

  function getSessionId() {
    let id = localStorage.getItem("dmun_session_id");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("dmun_session_id", id);
    }
    return id;
  }

  function initGallery(container) {
    const apiUrl  = (container.dataset.apiUrl || "").replace(/\/$/, "");
    const columns = parseInt(container.dataset.columns || "3", 10);
    const sessionId = getSessionId();

    container.style.setProperty("--dmun-memes-cols", columns);

    if (!document.getElementById("dmun-memes-style")) {
      const style = document.createElement("style");
      style.id = "dmun-memes-style";
      style.textContent = getMemeCSS();
      document.head.appendChild(style);
    }

    if (!document.getElementById("dmun-memes-lightbox")) {
      const lb = document.createElement("div");
      lb.id = "dmun-memes-lightbox";
      lb.innerHTML = '<button id="dmun-memes-lb-close">✕</button><img id="dmun-memes-lb-img" src="" alt="">';
      document.body.appendChild(lb);
      lb.addEventListener("click", () => lb.classList.remove("open"));
      document.getElementById("dmun-memes-lb-close").addEventListener("click", e => {
        e.stopPropagation(); lb.classList.remove("open");
      });
      document.addEventListener("keydown", e => {
        if (e.key === "Escape") lb.classList.remove("open");
      });
    }

    async function load() {
      container.innerHTML = `<div class="${NS}__loading">Lade Galerie…</div>`;
      try {
        const res = await fetch(`${apiUrl}/api/memes?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        render(await res.json());
      } catch {
        container.innerHTML = `<div class="${NS}__error">Galerie konnte nicht geladen werden.</div>`;
      }
    }

    function render(memes) {
      if (!memes.length) {
        container.innerHTML = `<div class="${NS}__empty">Noch keine Memes vorhanden.</div>`;
        return;
      }
      container.innerHTML = `<div class="${NS}__grid">${memes.map(renderCard).join("")}</div>`;

      container.querySelectorAll(`.${NS}__img`).forEach(img => {
        img.addEventListener("click", () => {
          document.getElementById("dmun-memes-lb-img").src = img.src;
          document.getElementById("dmun-memes-lightbox").classList.add("open");
        });
      });

      container.querySelectorAll(`.${NS}__vote-btn`).forEach(btn => {
        btn.addEventListener("click", () => handleVote(btn, apiUrl, sessionId));
      });
    }

    load();
  }

  function renderCard(m) {
    const d = document.createElement("div");
    d.textContent = m.title || "";
    const safeTitle = d.innerHTML;
    const upActive   = m.user_vote ===  1 ? "active" : "";
    const downActive = m.user_vote === -1 ? "active" : "";
    return `
      <figure class="${NS}__card">
        <div class="${NS}__img-wrap">
          <img class="${NS}__img" src="${m.url}" alt="${safeTitle}" loading="lazy">
          <div class="${NS}__votes">
            <button class="${NS}__vote-btn ${NS}__vote-btn--up ${upActive}"
                    data-id="${m.id}" data-vote="1" title="Gefällt mir">
              👍 <span>${m.upvotes || 0}</span>
            </button>
            <button class="${NS}__vote-btn ${NS}__vote-btn--down ${downActive}"
                    data-id="${m.id}" data-vote="-1" title="Gefällt mir nicht">
              👎 <span>${m.downvotes || 0}</span>
            </button>
          </div>
        </div>
        ${m.title ? `<figcaption class="${NS}__caption">${safeTitle}</figcaption>` : ""}
      </figure>`;
  }

  async function handleVote(btn, apiUrl, sessionId) {
    const memeId  = btn.dataset.id;
    const vote    = parseInt(btn.dataset.vote, 10);
    const isActive = btn.classList.contains("active");
    const send     = isActive ? 0 : vote;

    btn.disabled = true;
    try {
      const res = await fetch(`${apiUrl}/api/memes/${memeId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, vote: send }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      const card = btn.closest("figure");
      const upBtn   = card.querySelector(`.${NS}__vote-btn--up`);
      const downBtn = card.querySelector(`.${NS}__vote-btn--down`);

      upBtn.classList.toggle("active",   data.user_vote ===  1);
      downBtn.classList.toggle("active", data.user_vote === -1);
      upBtn.querySelector("span").textContent   = data.upvotes;
      downBtn.querySelector("span").textContent = data.downvotes;
    } catch {
      // silently ignore
    } finally {
      btn.disabled = false;
    }
  }

  function getMemeCSS() {
    return `
.dmun-memes__grid {
  display: grid;
  grid-template-columns: repeat(var(--dmun-memes-cols, 3), 1fr);
  gap: 1rem;
  margin: 1.5rem 0;
}
@media (max-width: 640px) { .dmun-memes__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 380px) { .dmun-memes__grid { grid-template-columns: 1fr; } }
.dmun-memes__card {
  margin: 0; border-radius: 8px; overflow: hidden;
  background: #fff; border: 1px solid #d5dde5;
  box-shadow: 0 2px 6px rgba(0,0,0,.06);
  transition: transform .2s, box-shadow .2s;
}
.dmun-memes__card:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,.12); }
.dmun-memes__img-wrap {
  position: relative; overflow: hidden; aspect-ratio: 1;
}
.dmun-memes__img {
  width: 100%; height: 100%; object-fit: cover; display: block; cursor: zoom-in;
  transition: transform .25s;
}
.dmun-memes__card:hover .dmun-memes__img { transform: scale(1.04); }
.dmun-memes__caption {
  padding: .35rem .6rem; font-size: .78rem; color: #6b7280; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dmun-memes__votes {
  position: absolute; bottom: .45rem; left: .45rem;
  display: flex; gap: .3rem; z-index: 1;
}
.dmun-memes__vote-btn {
  display: inline-flex; align-items: center; gap: .22rem;
  padding: .22rem .55rem; border: none; border-radius: 99px;
  background: rgba(0,0,0,.52); backdrop-filter: blur(4px);
  font-size: .78rem; font-weight: 700; cursor: pointer; color: #fff;
  transition: background .15s, transform .1s; user-select: none; line-height: 1.4;
}
.dmun-memes__vote-btn:hover { background: rgba(0,0,0,.72); transform: translateY(-1px); }
.dmun-memes__vote-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
.dmun-memes__vote-btn--up.active   { background: rgba(30,132,73,.85); }
.dmun-memes__vote-btn--down.active { background: rgba(192,57,43,.85); }
.dmun-memes__loading, .dmun-memes__error, .dmun-memes__empty {
  padding: 2rem; text-align: center; color: #6b7280;
  border: 1px dashed #d5dde5; border-radius: 8px;
}
.dmun-memes__error { color: #c0392b; }
/* Lightbox */
#dmun-memes-lightbox {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,.9); z-index: 9999;
  align-items: center; justify-content: center; cursor: zoom-out;
}
#dmun-memes-lightbox.open { display: flex; }
#dmun-memes-lightbox img { max-width: 92vw; max-height: 92vh; border-radius: 8px; }
#dmun-memes-lb-close {
  position: absolute; top: 1rem; right: 1.25rem;
  color: #fff; font-size: 2rem; cursor: pointer;
  background: none; border: none; line-height: 1;
}`;
  }

  function init() {
    document.querySelectorAll(`.${NS}[data-api-url]`).forEach(initGallery);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
