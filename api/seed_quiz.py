#!/usr/bin/env python3
"""
Lädt ein Quiz-Template (JSON) in die Datenbank.

Aufruf (direkt gegen die API):
    python api/seed_quiz.py
    python api/seed_quiz.py --fixture api/fixtures/un_quiz.json
    python api/seed_quiz.py --api-url http://localhost:5000 --user admin --password geheim

Umgebungsvariablen werden aus ../.env und ../.cred gelesen, wenn vorhanden.
"""
import argparse
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from base64 import b64encode

ROOT = Path(__file__).parent.parent


def load_env_file(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip()
    return env


def main():
    env  = load_env_file(ROOT / ".env")
    cred = load_env_file(ROOT / ".cred")

    parser = argparse.ArgumentParser(description="Quiz-Template in die Datenbank laden")
    parser.add_argument(
        "--fixture",
        default=str(Path(__file__).parent / "fixtures" / "un_quiz.json"),
        help="Pfad zur JSON-Vorlage (Standard: fixtures/un_quiz.json)",
    )
    parser.add_argument(
        "--api-url",
        default=env.get("PUBLIC_API_URL", "http://localhost:5000").rstrip("/"),
        help="API-Basis-URL",
    )
    parser.add_argument(
        "--user",
        default=cred.get("API_USER", "admin"),
        help="Admin-Benutzername",
    )
    parser.add_argument(
        "--password",
        default=cred.get("API_PASSWORD", ""),
        help="Admin-Passwort",
    )
    args = parser.parse_args()

    fixture_path = Path(args.fixture)
    if not fixture_path.exists():
        sys.exit(f"Fehler: Template nicht gefunden: {fixture_path}")

    quiz = json.loads(fixture_path.read_text(encoding="utf-8"))

    if not args.password:
        sys.exit("Fehler: Kein Passwort angegeben (--password oder API_PASSWORD in .cred)")

    token = b64encode(f"{args.user}:{args.password}".encode()).decode()
    url   = f"{args.api_url}/api/admin/quiz"
    body  = json.dumps(quiz).encode("utf-8")
    req   = Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": f"Basic {token}",
    })

    print(f"Lade Quiz \"{quiz['title']}\" ({len(quiz['questions'])} Fragen) → {url}")

    try:
        with urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
    except HTTPError as e:
        body_text = e.read().decode(errors="replace")
        sys.exit(f"HTTP-Fehler {e.code}: {body_text}")
    except URLError as e:
        sys.exit(f"Verbindungsfehler: {e.reason}\nLäuft der Server unter {args.api_url}?")

    quiz_id = result.get("id")
    print(f"\nErfolgreich erstellt! Quiz-ID: {quiz_id}")
    print(f"\nEmbed-Code für Ghost:")
    print(f'  <div class="dmun-quiz" data-quiz-id="{quiz_id}" data-api-url="{args.api_url}"></div>')
    print(f'  <script src="{args.api_url}/static/quiz-widget.js"></script>')
    print(f"\nAdmin-Panel: {args.api_url}/admin")


if __name__ == "__main__":
    main()
