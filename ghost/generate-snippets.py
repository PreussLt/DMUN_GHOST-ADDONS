#!/usr/bin/env python3
"""
Generiert die Ghost-Snippet-Dateien anhand der PUBLIC_API_URL aus ../.env

Aufruf:
    python ghost/generate-snippets.py
    python ghost/generate-snippets.py --quiz-id 2   # Embed-Snippet für Quiz-ID 2
"""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
ENV_FILE = ROOT / ".env"


def load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip()
    return env


def write(path: Path, content: str):
    path.write_text(content, encoding="utf-8")
    print(f"  ✓  {path.relative_to(ROOT)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiz-id", default="1", help="Quiz-ID für das Embed-Snippet (Standard: 1)")
    parser.add_argument("--meme-columns", default="3", help="Spalten der Meme-Galerie (Standard: 3)")
    args = parser.parse_args()

    if not ENV_FILE.exists():
        sys.exit(f"Fehler: {ENV_FILE} nicht gefunden")

    env = load_env(ENV_FILE)
    api_url = env.get("PUBLIC_API_URL", "").rstrip("/")

    if not api_url:
        sys.exit("Fehler: PUBLIC_API_URL fehlt in .env")

    print(f"\nVerwende API-URL: {api_url}\n")

    # --- ghost-site-header.html ---
    write(
        ROOT / "ghost" / "ghost-site-header.html",
        f"""<!-- ============================================================
     DMUN Quiz – Ghost Code Injection > Site Header
     Ghost Admin → Settings → Code Injection → Site Header
     ============================================================ -->
<link rel="stylesheet" href="{api_url}/static/quiz-widget.css">

<!-- Optional: Farben anpassen -->
<!--
<style>
  :root {{
    --dmun-primary: #003366;
    --dmun-accent:  #005b99;
  }}
</style>
-->
""",
    )

    # --- embed-snippet.html (Quiz) ---
    write(
        ROOT / "ghost" / "embed-snippet.html",
        f"""<!-- ============================================================
     DMUN Quiz – Embed-Snippet für einen Ghost-Artikel
     Im Ghost-Editor: + → HTML-Karte → diesen Code einfügen.
     data-quiz-id auf die ID deines Quiz setzen.
     ============================================================ -->

<div class="dmun-quiz"
     data-quiz-id="{args.quiz_id}"
     data-api-url="{api_url}">
</div>
<script src="{api_url}/static/quiz-widget.js"></script>
""",
    )

    # --- embed-snippet-memes.html (Meme-Galerie) ---
    write(
        ROOT / "ghost" / "embed-snippet-memes.html",
        f"""<!-- ============================================================
     DMUN Meme-Galerie – Embed-Snippet für einen Ghost-Artikel
     Im Ghost-Editor: + → HTML-Karte → diesen Code einfügen.
     data-columns: Anzahl Spalten (Standard: 3)
     ============================================================ -->

<div class="dmun-memes"
     data-api-url="{api_url}"
     data-columns="{args.meme_columns}">
</div>
<script src="{api_url}/static/meme-gallery.js"></script>
""",
    )

    print(f"""
Fertig! Nächste Schritte:
  1. ghost/ghost-site-header.html     → Ghost Admin → Settings → Code Injection → Site Header
  2. ghost/embed-snippet.html         → Im Quiz-Artikel als HTML-Karte einfügen
  3. ghost/embed-snippet-memes.html   → Im Meme-Galerie-Artikel als HTML-Karte einfügen
  4. Memes hochladen und Embed-Code im Admin-Panel abrufen:
     {api_url}/admin
""")


if __name__ == "__main__":
    main()
