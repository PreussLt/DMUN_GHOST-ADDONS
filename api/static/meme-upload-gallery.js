/**
 * DMUN Meme Upload + Galerie Widget
 *
 * Einbettung in Ghost (HTML-Karte):
 *   <div class="dmun-meme-upload"
 *        data-api-url="https://quiz.khenselmann.de"
 *        data-upload-token=""
 *        data-columns="3"
 *        data-title="Unsere Meme-Galerie">
 *   </div>
 *   <script src="https://quiz.khenselmann.de/static/meme-upload-gallery.js"></script>
 *
 * data-upload-token  : Pflicht, wenn MEME_UPLOAD_TOKEN in .env gesetzt ist
 * data-columns       : Spalten der Galerie (Standard: 3)
 * data-title         : Überschrift des Widgets (optional)
 * data-upload-label  : Text über dem Upload-Bereich (optional)
 */
(function () {
  "use strict";

  const NS       = "dmun-mu";
  const STYLE_ID = "dmun-mu-style";

  // ── CSS einmalig injizieren ──────────────────────────────────────────────

  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = s.textContent = STYLE_ID;
    s.textContent = buildCSS();
    document.head.appendChild(s);
  }

  // ── Lightbox (einmalig pro Seite) ────────────────────────────────────────

  if (!document.getElementById(`${NS}-lightbox`)) {
    const lb = document.createElement("div");
    lb.id = `${NS}-lightbox`;
    lb.innerHTML = `<button id="${NS}-lb-close">✕</button><img id="${NS}-lb-img" src="" alt="">`;
    document.body.appendChild(lb);
    lb.addEventListener("click", () => lb.classList.remove("open"));
    document.getElementById(`${NS}-lb-close`).addEventListener("click", e => {
      e.stopPropagation();
      lb.classList.remove("open");
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") document.getElementById(`${NS}-lightbox`).classList.remove("open");
    });
  }

  function openLightbox(url) {
    document.getElementById(`${NS}-lb-img`).src = url;
    document.getElementById(`${NS}-lightbox`).classList.add("open");
  }

  // ── Session-ID ────────────────────────────────────────────────────────────

  function getSessionId() {
    let id = localStorage.getItem("dmun_session_id");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("dmun_session_id", id);
    }
    return id;
  }

  // ── Widget initialisieren ────────────────────────────────────────────────

  function initWidget(container) {
    const apiUrl      = (container.dataset.apiUrl || "").replace(/\/$/, "");
    const token       = container.dataset.uploadToken || "";
    const columns     = parseInt(container.dataset.columns || "3", 10);
    const title       = container.dataset.title || "";
    const uploadLabel = container.dataset.uploadLabel || "Meme hochladen und teilen";
    const sessionId   = getSessionId();

    container.style.setProperty("--mu-cols", columns);

    // ── Render skeleton ──────────────────────────────────────────────────

    container.innerHTML = `
      <div class="${NS}__inner">
        ${title ? `<header class="${NS}__header"><h2 class="${NS}__title">${esc(title)}</h2></header>` : ""}

        <div class="${NS}__upload-section">
          <p class="${NS}__upload-heading">${esc(uploadLabel)}</p>

          <div class="${NS}__drop-area" role="button" tabindex="0" aria-label="Datei auswählen">
            <div class="${NS}__drop-icon">🖼️</div>
            <div class="${NS}__drop-text">Bild hierher ziehen oder <span class="${NS}__drop-link">klicken</span></div>
            <div class="${NS}__drop-hint">JPG · PNG · GIF · WebP – max. 10 MB</div>
            <input class="${NS}__file-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple>
          </div>

          <div class="${NS}__meta">
            <input class="${NS}__caption-input" type="text" placeholder="Bildunterschrift (optional)…" maxlength="120">
            <button class="${NS}__upload-btn" type="button" disabled>Hochladen</button>
          </div>

          <div class="${NS}__status" aria-live="polite"></div>
        </div>

        <div class="${NS}__gallery-section">
          <div class="${NS}__grid"><div class="${NS}__loading">Lade Galerie…</div></div>
        </div>
      </div>`;

    // ── Element-Referenzen ───────────────────────────────────────────────

    const dropArea    = container.querySelector(`.${NS}__drop-area`);
    const fileInput   = container.querySelector(`.${NS}__file-input`);
    const captionInp  = container.querySelector(`.${NS}__caption-input`);
    const uploadBtn   = container.querySelector(`.${NS}__upload-btn`);
    const statusEl    = container.querySelector(`.${NS}__status`);
    const grid        = container.querySelector(`.${NS}__grid`);

    let pendingFiles = [];

    // ── Drag & Drop ──────────────────────────────────────────────────────

    dropArea.addEventListener("click", () => fileInput.click());
    dropArea.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });

    ["dragenter", "dragover"].forEach(evt =>
      dropArea.addEventListener(evt, e => { e.preventDefault(); dropArea.classList.add(`${NS}__drop-area--over`); })
    );
    ["dragleave", "drop"].forEach(evt =>
      dropArea.addEventListener(evt, () => dropArea.classList.remove(`${NS}__drop-area--over`))
    );
    dropArea.addEventListener("drop", e => {
      e.preventDefault();
      setPending(Array.from(e.dataTransfer.files).filter(isImage));
    });

    fileInput.addEventListener("change", () => {
      setPending(Array.from(fileInput.files));
      fileInput.value = "";
    });

    function setPending(files) {
      pendingFiles = files;
      if (!files.length) { uploadBtn.disabled = true; return; }
      uploadBtn.disabled = false;
      const names = files.map(f => f.name).join(", ");
      const preview = files.length === 1
        ? `<img class="${NS}__preview-img" src="${URL.createObjectURL(files[0])}" alt="">`
        : `<span class="${NS}__preview-count">${files.length} Bilder ausgewählt</span>`;
      dropArea.querySelector(`.${NS}__drop-text`).innerHTML = preview;
    }

    function resetDropArea() {
      pendingFiles = [];
      uploadBtn.disabled = true;
      captionInp.value = "";
      dropArea.querySelector(`.${NS}__drop-text`).innerHTML =
        `Bild hierher ziehen oder <span class="${NS}__drop-link">klicken</span>`;
    }

    // ── Upload ───────────────────────────────────────────────────────────

    uploadBtn.addEventListener("click", async () => {
      if (!pendingFiles.length) return;
      uploadBtn.disabled = true;
      const caption = captionInp.value.trim();
      let done = 0;
      let failed = 0;

      setStatus("info", `0 / ${pendingFiles.length} hochgeladen…`);

      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("title", caption || file.name.replace(/\.[^.]+$/, ""));
        if (token) fd.append("upload_token", token);

        try {
          const res = await fetch(`${apiUrl}/api/memes/upload`, { method: "POST", body: fd });
          if (res.ok) {
            done++;
          } else {
            const err = await res.json().catch(() => ({}));
            failed++;
            if (res.status === 403) {
              setStatus("error", "Upload nicht erlaubt – ungültiger Token.");
              break;
            }
            console.warn("Upload fehlgeschlagen:", err.error || res.status);
          }
        } catch {
          failed++;
        }
        setStatus("info", `${done} / ${pendingFiles.length} hochgeladen…`);
      }

      if (done > 0) {
        const plural = done !== 1 ? "er wurden eingereicht" : " wurde eingereicht";
        setStatus("pending", `${done} Bild${plural} und wird geprüft. Nach der Freigabe erscheint es in der Galerie.`);
        resetDropArea();
        // Galerie NICHT neu laden – das Bild ist noch pending und wäre unsichtbar
      } else if (failed > 0 && !statusEl.textContent.includes("Token")) {
        setStatus("error", `${failed} Upload${failed !== 1 ? "s" : ""} fehlgeschlagen.`);
        uploadBtn.disabled = false;
      }

    });

    function setStatus(type, msg) {
      statusEl.textContent = msg;
      statusEl.className   = `${NS}__status`;
      if (type) statusEl.classList.add(`${NS}__status--${type}`);
      statusEl.dataset.type = type;
      // Pending-Meldung bleibt stehen (kein Auto-Clear)
      if (type !== "pending" && type !== "error") {
        setTimeout(() => { if (statusEl.dataset.type === type) setStatus("", ""); }, 4000);
      }
    }

    // ── Galerie ──────────────────────────────────────────────────────────

    async function loadGallery() {
      try {
        const res = await fetch(`${apiUrl}/api/memes?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        renderGallery(await res.json());
      } catch {
        grid.innerHTML = `<div class="${NS}__error">Galerie konnte nicht geladen werden.</div>`;
      }
    }

    function renderGallery(memes) {
      if (!memes.length) {
        grid.innerHTML = `<div class="${NS}__empty">Noch keine Memes – lade das erste hoch!</div>`;
        return;
      }
      grid.innerHTML = memes.map(m => {
        const safeTitle  = esc(m.title || "");
        const safeUrl    = esc(m.url);
        const upActive   = m.user_vote ===  1 ? "active" : "";
        const downActive = m.user_vote === -1 ? "active" : "";
        return `
          <figure class="${NS}__card">
            <div class="${NS}__img-wrap">
              <img class="${NS}__card-img" src="${safeUrl}" alt="${safeTitle}" loading="lazy">
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
            ${m.title ? `<figcaption class="${NS}__card-caption">${safeTitle}</figcaption>` : ""}
          </figure>`;
      }).join("");

      grid.querySelectorAll(`.${NS}__card-img`).forEach(img => {
        img.addEventListener("click", () => openLightbox(img.src));
      });

      grid.querySelectorAll(`.${NS}__vote-btn`).forEach(btn => {
        btn.addEventListener("click", () => handleVote(btn));
      });
    }

    async function handleVote(btn) {
      const memeId   = btn.dataset.id;
      const vote     = parseInt(btn.dataset.vote, 10);
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

        const card    = btn.closest("figure");
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

    loadGallery();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function isImage(f) {
    return /\.(jpe?g|png|gif|webp)$/i.test(f.name);
  }

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = String(str || "");
    return d.innerHTML;
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  function init() {
    document.querySelectorAll(`.${NS}[data-api-url]`).forEach(initWidget);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ── CSS ───────────────────────────────────────────────────────────────────

  function buildCSS() {
    return `
/* ── DMUN Meme Upload Gallery ─────────────────────────────── */
.dmun-mu {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 1rem; line-height: 1.6;
  max-width: 860px; margin: 2rem auto;
}
.dmun-mu__inner {
  border: 1px solid #d5dde5; border-radius: 10px;
  overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.07);
  background: #fff;
}
/* Header */
.dmun-mu__header { background: #1a3a5c; padding: 1rem 1.5rem; }
.dmun-mu__title  { margin: 0; color: #fff; font-size: 1.2rem; font-weight: 700; }

/* Upload section */
.dmun-mu__upload-section { padding: 1.25rem 1.5rem; border-bottom: 1px solid #e8ecf0; background: #f8fafc; }
.dmun-mu__upload-heading { margin: 0 0 .75rem; font-weight: 700; font-size: .95rem; color: #1a3a5c; }

.dmun-mu__drop-area {
  border: 2px dashed #b0bec5; border-radius: 8px;
  padding: 1.75rem 1rem; text-align: center;
  cursor: pointer; transition: border-color .2s, background .2s;
  background: #fff; outline: none;
}
.dmun-mu__drop-area:hover,
.dmun-mu__drop-area--over  { border-color: #2e86c1; background: #eef5fb; }
.dmun-mu__drop-area:focus  { border-color: #2e86c1; box-shadow: 0 0 0 3px rgba(46,134,193,.2); }
.dmun-mu__drop-icon        { font-size: 2.2rem; margin-bottom: .35rem; }
.dmun-mu__drop-text        { font-size: .95rem; color: #444; }
.dmun-mu__drop-link        { color: #2e86c1; font-weight: 600; text-decoration: underline; }
.dmun-mu__drop-hint        { font-size: .78rem; color: #888; margin-top: .2rem; }
.dmun-mu__file-input       { display: none; }
.dmun-mu__preview-img      { max-height: 90px; max-width: 100%; border-radius: 6px; display: block; margin: 0 auto; }
.dmun-mu__preview-count    { font-weight: 600; color: #2e86c1; }

.dmun-mu__meta {
  display: flex; gap: .6rem; margin-top: .75rem; flex-wrap: wrap;
}
.dmun-mu__caption-input {
  flex: 1; min-width: 160px; padding: .5rem .75rem;
  border: 1px solid #d5dde5; border-radius: 7px;
  font-size: .9rem; outline: none; transition: border-color .15s;
}
.dmun-mu__caption-input:focus { border-color: #2e86c1; }

.dmun-mu__upload-btn {
  padding: .5rem 1.4rem; background: #2e86c1; color: #fff;
  border: none; border-radius: 7px; font-size: .9rem; font-weight: 600;
  cursor: pointer; transition: background .15s, transform .1s;
  white-space: nowrap;
}
.dmun-mu__upload-btn:hover:not(:disabled) { background: #1a3a5c; transform: translateY(-1px); }
.dmun-mu__upload-btn:disabled { opacity: .5; cursor: not-allowed; }

.dmun-mu__status {
  min-height: 1.4em; font-size: .85rem; margin-top: .5rem; font-weight: 500;
}
.dmun-mu__status--info    { color: #555; }
.dmun-mu__status--success { color: #1e8449; }
.dmun-mu__status--error   { color: #c0392b; }
.dmun-mu__status--pending {
  color: #7d4e00;
  background: #fff8e1;
  border: 1px solid #f0c070;
  border-radius: 6px;
  padding: .5rem .75rem;
  font-size: .85rem;
}

/* Gallery */
.dmun-mu__gallery-section { padding: 1.25rem 1.5rem; }
.dmun-mu__grid {
  display: grid;
  grid-template-columns: repeat(var(--mu-cols, 3), 1fr);
  gap: .85rem;
}
@media (max-width: 600px) { .dmun-mu__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 360px) { .dmun-mu__grid { grid-template-columns: 1fr; } }

.dmun-mu__card {
  margin: 0; border-radius: 7px; overflow: hidden;
  background: #fff; border: 1px solid #d5dde5;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
  transition: transform .2s, box-shadow .2s;
}
.dmun-mu__card:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,.12); }
.dmun-mu__img-wrap {
  position: relative; overflow: hidden; aspect-ratio: 1;
}
.dmun-mu__card-img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  cursor: zoom-in; transition: transform .25s;
}
.dmun-mu__card:hover .dmun-mu__card-img { transform: scale(1.04); }
.dmun-mu__card-caption {
  padding: .35rem .55rem; font-size: .75rem; color: #6b7280;
  text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dmun-mu__votes {
  position: absolute; bottom: .45rem; left: .45rem;
  display: flex; gap: .3rem; z-index: 1;
}
.dmun-mu__vote-btn {
  display: inline-flex; align-items: center; gap: .22rem;
  padding: .22rem .55rem; border: none; border-radius: 99px;
  background: rgba(0,0,0,.52); backdrop-filter: blur(4px);
  font-size: .78rem; font-weight: 700; cursor: pointer; color: #fff;
  transition: background .15s, transform .1s; user-select: none; line-height: 1.4;
}
.dmun-mu__vote-btn:hover { background: rgba(0,0,0,.72); transform: translateY(-1px); }
.dmun-mu__vote-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
.dmun-mu__vote-btn--up.active   { background: rgba(30,132,73,.85); }
.dmun-mu__vote-btn--down.active { background: rgba(192,57,43,.85); }

.dmun-mu__loading, .dmun-mu__empty, .dmun-mu__error {
  padding: 2rem; text-align: center; color: #888;
  border: 1px dashed #d5dde5; border-radius: 8px;
  grid-column: 1 / -1;
}
.dmun-mu__error { color: #c0392b; }

/* Lightbox */
#dmun-mu-lightbox {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,.9); z-index: 9999;
  align-items: center; justify-content: center; cursor: zoom-out;
}
#dmun-mu-lightbox.open { display: flex; }
#dmun-mu-lightbox img  { max-width: 92vw; max-height: 92vh; border-radius: 8px; }
#dmun-mu-lb-close {
  position: absolute; top: 1rem; right: 1.25rem;
  color: #fff; font-size: 2rem; cursor: pointer;
  background: none; border: none; line-height: 1;
}
`;
  }
})();
