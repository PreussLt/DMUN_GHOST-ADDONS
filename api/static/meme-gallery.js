/**
 * DMUN Meme Gallery Widget
 * Einbettung: <div class="dmun-memes" data-api-url="https://quiz.dmun.de"></div>
 *             <script src="https://quiz.dmun.de/static/meme-gallery.js"></script>
 */
(function () {
  "use strict";

  const NS = "dmun-memes";

  function initGallery(container) {
    const apiUrl = (container.dataset.apiUrl || "").replace(/\/$/, "");
    const columns = parseInt(container.dataset.columns || "3", 10);

    container.style.setProperty("--dmun-memes-cols", columns);

    // Inject scoped styles once
    if (!document.getElementById("dmun-memes-style")) {
      const style = document.createElement("style");
      style.id = "dmun-memes-style";
      style.textContent = getMemeCSS();
      document.head.appendChild(style);
    }

    // Lightbox (shared, one per page)
    if (!document.getElementById("dmun-memes-lightbox")) {
      const lb = document.createElement("div");
      lb.id = "dmun-memes-lightbox";
      lb.innerHTML = '<button id="dmun-memes-lb-close">✕</button><img id="dmun-memes-lb-img" src="" alt="">';
      document.body.appendChild(lb);
      lb.addEventListener("click", () => lb.classList.remove("open"));
      document.getElementById("dmun-memes-lb-close").addEventListener("click", e => { e.stopPropagation(); lb.classList.remove("open"); });
      document.addEventListener("keydown", e => { if (e.key === "Escape") lb.classList.remove("open"); });
    }

    async function load() {
      container.innerHTML = `<div class="${NS}__loading">Lade Galerie…</div>`;
      try {
        const res = await fetch(`${apiUrl}/api/memes`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const memes = await res.json();
        render(memes);
      } catch (e) {
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
    }

    function renderCard(m) {
      const d = document.createElement("div");
      d.textContent = m.title || "";
      const safeTitle = d.innerHTML;
      return `
        <figure class="${NS}__card">
          <img class="${NS}__img" src="${m.url}" alt="${safeTitle}" loading="lazy">
          ${m.title ? `<figcaption class="${NS}__caption">${safeTitle}</figcaption>` : ""}
        </figure>`;
    }

    load();
  }

  function getMemeCSS() {
    return `
.dmun-memes__grid {
  display: grid;
  grid-template-columns: repeat(var(--dmun-memes-cols, 3), 1fr);
  gap: 1rem;
  margin: 1.5rem 0;
}
@media (max-width: 640px) {
  .dmun-memes__grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 380px) {
  .dmun-memes__grid { grid-template-columns: 1fr; }
}
.dmun-memes__card {
  margin: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #f0f4f8;
  border: 1px solid #d5dde5;
  box-shadow: 0 2px 6px rgba(0,0,0,.06);
  transition: transform .2s, box-shadow .2s;
}
.dmun-memes__card:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,.12); }
.dmun-memes__img {
  width: 100%; aspect-ratio: 1; object-fit: cover; display: block; cursor: zoom-in;
}
.dmun-memes__caption {
  padding: .4rem .6rem; font-size: .78rem; color: #6b7280; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
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
