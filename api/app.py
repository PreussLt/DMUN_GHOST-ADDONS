import os
import secrets
import sqlite3
import uuid
from functools import wraps

from flask import Flask, g, jsonify, render_template, request, send_from_directory
from flask_cors import CORS


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def create_app():
    app = Flask(__name__)
    CORS(app, origins=os.environ.get("CORS_ORIGINS", "*").split(","))

    app.config["DB_PATH"] = os.environ.get("DB_PATH", "/data/quiz.db")
    app.config["API_USER"] = os.environ.get("API_USER", "admin")
    app.config["API_PASSWORD"] = os.environ.get("API_PASSWORD", "changeme")
    app.config["PUBLIC_API_URL"] = os.environ.get("PUBLIC_API_URL", "http://localhost:5000")
    _upload_dir = os.path.join(os.path.dirname(app.config["DB_PATH"]), "uploads")
    app.config["UPLOAD_DIR"] = os.environ.get("UPLOAD_DIR", _upload_dir)
    os.makedirs(app.config["UPLOAD_DIR"], exist_ok=True)

    _init_db(app)

    # -----------------------------------------------------------------------
    # DB helpers
    # -----------------------------------------------------------------------

    def get_db():
        if "db" not in g:
            g.db = sqlite3.connect(app.config["DB_PATH"])
            g.db.row_factory = sqlite3.Row
            g.db.execute("PRAGMA foreign_keys = ON")
        return g.db

    @app.teardown_appcontext
    def close_db(_):
        db = g.pop("db", None)
        if db:
            db.close()

    # -----------------------------------------------------------------------
    # Auth
    # -----------------------------------------------------------------------

    def require_auth(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            auth = request.authorization
            if (
                not auth
                or auth.username != app.config["API_USER"]
                or auth.password != app.config["API_PASSWORD"]
            ):
                return (
                    jsonify({"error": "Nicht autorisiert"}),
                    401,
                    {"WWW-Authenticate": 'Basic realm="DMUN Quiz Admin"'},
                )
            return f(*args, **kwargs)
        return wrapper

    # -----------------------------------------------------------------------
    # Public quiz API
    # -----------------------------------------------------------------------

    @app.route("/api/quiz/<int:quiz_id>")
    def api_get_quiz(quiz_id):
        db = get_db()
        quiz = db.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
        if not quiz:
            return jsonify({"error": "Quiz nicht gefunden"}), 404

        questions = db.execute(
            "SELECT * FROM questions WHERE quiz_id = ? ORDER BY position", (quiz_id,)
        ).fetchall()

        result = dict(quiz)
        result["questions"] = []
        for q in questions:
            answers = db.execute(
                "SELECT id, answer_text FROM answers WHERE question_id = ? ORDER BY position",
                (q["id"],),
            ).fetchall()
            result["questions"].append({**dict(q), "answers": [dict(a) for a in answers]})

        return jsonify(result)

    @app.route("/api/quiz/<int:quiz_id>/submit", methods=["POST"])
    def api_submit_quiz(quiz_id):
        data = request.get_json(silent=True) or {}
        db = get_db()

        quiz = db.execute("SELECT id FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
        if not quiz:
            return jsonify({"error": "Quiz nicht gefunden"}), 404

        given = data.get("answers", {})  # {str(question_id): answer_id}
        session_id = data.get("session_id") or secrets.token_hex(16)

        questions = db.execute(
            "SELECT id, question_text FROM questions WHERE quiz_id = ?", (quiz_id,)
        ).fetchall()

        score = 0
        feedback = []

        for q in questions:
            correct = db.execute(
                "SELECT * FROM answers WHERE question_id = ? AND is_correct = 1 LIMIT 1",
                (q["id"],),
            ).fetchone()

            given_id = given.get(str(q["id"]))
            given_answer = None
            if given_id:
                given_answer = db.execute(
                    "SELECT * FROM answers WHERE id = ? AND question_id = ?",
                    (given_id, q["id"]),
                ).fetchone()

            is_correct = bool(given_answer and given_answer["is_correct"])
            if is_correct:
                score += 1

            feedback.append(
                {
                    "question_id": q["id"],
                    "question_text": q["question_text"],
                    "is_correct": is_correct,
                    "correct_answer": dict(correct) if correct else None,
                    "given_answer": dict(given_answer) if given_answer else None,
                    "explanation": correct["explanation"] if correct and correct["explanation"] else None,
                }
            )

        max_score = len(questions)
        db.execute(
            "INSERT INTO quiz_results (quiz_id, session_id, score, max_score) VALUES (?,?,?,?)",
            (quiz_id, session_id, score, max_score),
        )
        db.commit()

        return jsonify(
            {
                "score": score,
                "max_score": max_score,
                "percentage": round(score / max_score * 100) if max_score else 0,
                "feedback": feedback,
            }
        )

    # -----------------------------------------------------------------------
    # Admin API
    # -----------------------------------------------------------------------

    @app.route("/api/admin/quizzes")
    @require_auth
    def api_list_quizzes():
        db = get_db()
        rows = db.execute(
            "SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count"
            " FROM quizzes q ORDER BY created_at DESC"
        ).fetchall()
        return jsonify([dict(r) for r in rows])

    @app.route("/api/admin/quiz/<int:quiz_id>")
    @require_auth
    def api_get_quiz_admin(quiz_id):
        db = get_db()
        quiz = db.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
        if not quiz:
            return jsonify({"error": "Nicht gefunden"}), 404

        questions = db.execute(
            "SELECT * FROM questions WHERE quiz_id = ? ORDER BY position", (quiz_id,)
        ).fetchall()
        result = dict(quiz)
        result["questions"] = []
        for q in questions:
            answers = db.execute(
                "SELECT * FROM answers WHERE question_id = ? ORDER BY position", (q["id"],)
            ).fetchall()
            result["questions"].append({**dict(q), "answers": [dict(a) for a in answers]})
        return jsonify(result)

    @app.route("/api/admin/quiz", methods=["POST"])
    @require_auth
    def api_create_quiz():
        data = request.get_json(silent=True) or {}
        if not data.get("title"):
            return jsonify({"error": "Titel fehlt"}), 400
        db = get_db()
        cur = db.execute(
            "INSERT INTO quizzes (title, description, ghost_slug) VALUES (?,?,?)",
            (data["title"], data.get("description", ""), data.get("ghost_slug", "")),
        )
        quiz_id = cur.lastrowid
        _save_questions(db, quiz_id, data.get("questions", []))
        db.commit()
        return jsonify({"id": quiz_id}), 201

    @app.route("/api/admin/quiz/<int:quiz_id>", methods=["PUT"])
    @require_auth
    def api_update_quiz(quiz_id):
        data = request.get_json(silent=True) or {}
        db = get_db()
        db.execute(
            "UPDATE quizzes SET title=?, description=?, ghost_slug=? WHERE id=?",
            (data.get("title", ""), data.get("description", ""), data.get("ghost_slug", ""), quiz_id),
        )
        db.execute("DELETE FROM questions WHERE quiz_id = ?", (quiz_id,))
        _save_questions(db, quiz_id, data.get("questions", []))
        db.commit()
        return jsonify({"ok": True})

    @app.route("/api/admin/quiz/<int:quiz_id>", methods=["DELETE"])
    @require_auth
    def api_delete_quiz(quiz_id):
        db = get_db()
        db.execute("DELETE FROM quizzes WHERE id = ?", (quiz_id,))
        db.commit()
        return jsonify({"ok": True})

    @app.route("/api/admin/quiz/<int:quiz_id>/results")
    @require_auth
    def api_quiz_results(quiz_id):
        db = get_db()
        rows = db.execute(
            "SELECT * FROM quiz_results WHERE quiz_id = ? ORDER BY completed_at DESC LIMIT 200",
            (quiz_id,),
        ).fetchall()
        return jsonify([dict(r) for r in rows])

    # -----------------------------------------------------------------------
    # Meme Gallery API
    # -----------------------------------------------------------------------

    _ALLOWED_EXT = {"jpg", "jpeg", "png", "gif", "webp"}

    def _allowed_image(filename):
        return "." in filename and filename.rsplit(".", 1)[1].lower() in _ALLOWED_EXT

    @app.route("/api/memes")
    def api_list_memes():
        db = get_db()
        rows = db.execute("SELECT * FROM memes ORDER BY uploaded_at DESC").fetchall()
        base = app.config["PUBLIC_API_URL"].rstrip("/")
        return jsonify([{**dict(r), "url": f"{base}/uploads/{r['filename']}"} for r in rows])

    @app.route("/api/admin/meme", methods=["POST"])
    @require_auth
    def api_upload_meme():
        if "file" not in request.files:
            return jsonify({"error": "Keine Datei übermittelt"}), 400
        f = request.files["file"]
        if not f.filename or not _allowed_image(f.filename):
            return jsonify({"error": "Ungültiges Format – erlaubt: jpg, jpeg, png, gif, webp"}), 400

        ext = f.filename.rsplit(".", 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        f.save(os.path.join(app.config["UPLOAD_DIR"], filename))

        title = (request.form.get("title") or "").strip()
        db = get_db()
        cur = db.execute("INSERT INTO memes (filename, title) VALUES (?,?)", (filename, title))
        db.commit()
        base = app.config["PUBLIC_API_URL"].rstrip("/")
        return jsonify({"id": cur.lastrowid, "filename": filename, "url": f"{base}/uploads/{filename}"}), 201

    @app.route("/api/admin/meme/<int:meme_id>", methods=["DELETE"])
    @require_auth
    def api_delete_meme(meme_id):
        db = get_db()
        row = db.execute("SELECT filename FROM memes WHERE id = ?", (meme_id,)).fetchone()
        if not row:
            return jsonify({"error": "Nicht gefunden"}), 404
        filepath = os.path.join(app.config["UPLOAD_DIR"], row["filename"])
        if os.path.exists(filepath):
            os.remove(filepath)
        db.execute("DELETE FROM memes WHERE id = ?", (meme_id,))
        db.commit()
        return jsonify({"ok": True})

    @app.route("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(app.config["UPLOAD_DIR"], filename)

    # -----------------------------------------------------------------------
    # Admin UI
    # -----------------------------------------------------------------------

    @app.route("/")
    @app.route("/admin")
    def admin_ui():
        return render_template("admin.html", public_api_url=app.config["PUBLIC_API_URL"])

    return app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _init_db(app):
    with app.app_context():
        db = sqlite3.connect(app.config["DB_PATH"])
        db.execute("PRAGMA foreign_keys = ON")
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS quizzes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT    NOT NULL,
                description TEXT    DEFAULT '',
                ghost_slug  TEXT    DEFAULT '',
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS questions (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                quiz_id       INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
                question_text TEXT    NOT NULL,
                position      INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS answers (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                answer_text TEXT    NOT NULL,
                is_correct  INTEGER DEFAULT 0,
                explanation TEXT    DEFAULT '',
                position    INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS quiz_results (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                quiz_id      INTEGER NOT NULL REFERENCES quizzes(id),
                session_id   TEXT,
                score        INTEGER,
                max_score    INTEGER,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS memes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                filename    TEXT NOT NULL,
                title       TEXT DEFAULT '',
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        db.commit()
        db.close()


def _save_questions(db, quiz_id, questions):
    for i, q in enumerate(questions):
        cur = db.execute(
            "INSERT INTO questions (quiz_id, question_text, position) VALUES (?,?,?)",
            (quiz_id, q.get("question_text", ""), i),
        )
        q_id = cur.lastrowid
        for j, a in enumerate(q.get("answers", [])):
            db.execute(
                "INSERT INTO answers (question_id, answer_text, is_correct, explanation, position)"
                " VALUES (?,?,?,?,?)",
                (q_id, a.get("answer_text", ""), int(bool(a.get("is_correct"))), a.get("explanation", ""), j),
            )


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import os as _os
    _app = create_app()
    _app.run(
        host=_os.environ.get("APP_HOST", "0.0.0.0"),
        port=int(_os.environ.get("APP_PORT", 5000)),
        debug=_os.environ.get("APP_ENV", "production") == "development",
    )
