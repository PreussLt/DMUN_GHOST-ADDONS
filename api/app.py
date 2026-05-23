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
    app.config["MEME_UPLOAD_TOKEN"] = os.environ.get("MEME_UPLOAD_TOKEN", "")
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

            db.execute(
                "INSERT INTO quiz_answer_log (quiz_id, question_id, answer_id, session_id, is_correct)"
                " VALUES (?,?,?,?,?)",
                (quiz_id, q["id"], given_id, session_id, int(is_correct)),
            )

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
            "SELECT q.*,"
            " (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,"
            " (SELECT COUNT(*) FROM quiz_results WHERE quiz_id = q.id) AS result_count,"
            " (SELECT AVG(CAST(score AS FLOAT)/NULLIF(max_score,0)*100)"
            "  FROM quiz_results WHERE quiz_id = q.id) AS avg_pct"
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

    @app.route("/api/admin/quiz/<int:quiz_id>/analytics")
    @require_auth
    def api_quiz_analytics(quiz_id):
        db = get_db()
        quiz = db.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
        if not quiz:
            return jsonify({"error": "Nicht gefunden"}), 404

        results = db.execute(
            "SELECT score, max_score FROM quiz_results WHERE quiz_id = ?", (quiz_id,)
        ).fetchall()

        if not results:
            return jsonify({
                "sessions": 0, "avg_pct": 0, "min_score": 0, "max_score_val": 0,
                "max_score_possible": 0, "score_distribution": [], "question_stats": []
            })

        scores = [r["score"] for r in results]
        max_possible = results[0]["max_score"] if results else 0
        avg_pct = round(
            sum(r["score"] / r["max_score"] * 100 if r["max_score"] else 0 for r in results)
            / len(results), 1
        )

        dist: dict[int, int] = {}
        for r in results:
            dist[r["score"]] = dist.get(r["score"], 0) + 1
        score_distribution = [{"score": k, "count": v} for k, v in sorted(dist.items())]

        question_stats = []
        questions = db.execute(
            "SELECT id, question_text FROM questions WHERE quiz_id = ? ORDER BY position",
            (quiz_id,),
        ).fetchall()
        for q in questions:
            row = db.execute(
                "SELECT SUM(is_correct) AS correct, COUNT(*) AS total"
                " FROM quiz_answer_log WHERE question_id = ?",
                (q["id"],),
            ).fetchone()
            if row and row["total"]:
                question_stats.append({
                    "question_id": q["id"],
                    "question_text": q["question_text"],
                    "correct": row["correct"] or 0,
                    "wrong": (row["total"] or 0) - (row["correct"] or 0),
                    "total": row["total"] or 0,
                })

        return jsonify({
            "sessions": len(results),
            "avg_pct": avg_pct,
            "min_score": min(scores),
            "max_score_val": max(scores),
            "max_score_possible": max_possible,
            "score_distribution": score_distribution,
            "question_stats": question_stats,
        })

    # -----------------------------------------------------------------------
    # Meme Gallery API
    # -----------------------------------------------------------------------

    _ALLOWED_EXT = {"jpg", "jpeg", "png", "gif", "webp"}

    def _allowed_image(filename):
        return "." in filename and filename.rsplit(".", 1)[1].lower() in _ALLOWED_EXT

    @app.route("/api/memes")
    def api_list_memes():
        """Öffentlich: nur freigegebene Memes mit Vote-Counts."""
        db = get_db()
        session_id = request.args.get("session_id", "")
        rows = db.execute(
            "SELECT m.*,"
            " COALESCE((SELECT COUNT(*) FROM meme_votes WHERE meme_id=m.id AND vote=1),  0) AS upvotes,"
            " COALESCE((SELECT COUNT(*) FROM meme_votes WHERE meme_id=m.id AND vote=-1), 0) AS downvotes"
            " FROM memes m WHERE m.status = 'approved' ORDER BY m.uploaded_at DESC"
        ).fetchall()
        base = app.config["PUBLIC_API_URL"].rstrip("/")
        result = []
        for r in rows:
            d = {**dict(r), "url": f"{base}/uploads/{r['filename']}"}
            if session_id:
                v = db.execute(
                    "SELECT vote FROM meme_votes WHERE meme_id=? AND session_id=?",
                    (r["id"], session_id),
                ).fetchone()
                d["user_vote"] = v["vote"] if v else 0
            else:
                d["user_vote"] = 0
            result.append(d)
        return jsonify(result)

    @app.route("/api/admin/memes")
    @require_auth
    def api_admin_list_memes():
        """Admin: alle Memes mit Status und Vote-Counts."""
        db = get_db()
        rows = db.execute(
            "SELECT m.*,"
            " COALESCE((SELECT COUNT(*) FROM meme_votes WHERE meme_id=m.id AND vote=1),  0) AS upvotes,"
            " COALESCE((SELECT COUNT(*) FROM meme_votes WHERE meme_id=m.id AND vote=-1), 0) AS downvotes"
            " FROM memes m ORDER BY m.uploaded_at DESC"
        ).fetchall()
        base = app.config["PUBLIC_API_URL"].rstrip("/")
        return jsonify([{**dict(r), "url": f"{base}/uploads/{r['filename']}"} for r in rows])

    @app.route("/api/memes/upload", methods=["POST"])
    def api_public_upload_meme():
        """Öffentlicher Upload: landet als 'pending', muss freigegeben werden."""
        token = app.config["MEME_UPLOAD_TOKEN"]
        if token:
            provided = (
                request.headers.get("X-Upload-Token")
                or request.form.get("upload_token", "")
            ).strip()
            if provided != token:
                return jsonify({"error": "Ungültiger Upload-Token"}), 403
        return _handle_meme_upload(status="pending")

    @app.route("/api/memes/<int:meme_id>/vote", methods=["POST"])
    def api_vote_meme(meme_id):
        """Öffentlich: Up-/Downvote für ein Meme abgeben oder wechseln."""
        data = request.get_json(silent=True) or {}
        db = get_db()

        if not db.execute(
            "SELECT id FROM memes WHERE id=? AND status='approved'", (meme_id,)
        ).fetchone():
            return jsonify({"error": "Nicht gefunden"}), 404

        session_id = (data.get("session_id") or "").strip()
        if not session_id:
            return jsonify({"error": "session_id fehlt"}), 400

        vote = data.get("vote")
        if vote not in (1, -1, 0):
            return jsonify({"error": "vote muss 1, -1 oder 0 sein"}), 400

        existing = db.execute(
            "SELECT vote FROM meme_votes WHERE meme_id=? AND session_id=?",
            (meme_id, session_id),
        ).fetchone()

        if vote == 0 or (existing and existing["vote"] == vote):
            db.execute(
                "DELETE FROM meme_votes WHERE meme_id=? AND session_id=?",
                (meme_id, session_id),
            )
        elif existing:
            db.execute(
                "UPDATE meme_votes SET vote=?, voted_at=CURRENT_TIMESTAMP"
                " WHERE meme_id=? AND session_id=?",
                (vote, meme_id, session_id),
            )
        else:
            db.execute(
                "INSERT INTO meme_votes (meme_id, session_id, vote) VALUES (?,?,?)",
                (meme_id, session_id, vote),
            )
        db.commit()

        counts = db.execute(
            "SELECT"
            " COALESCE((SELECT COUNT(*) FROM meme_votes WHERE meme_id=? AND vote=1),  0) AS upvotes,"
            " COALESCE((SELECT COUNT(*) FROM meme_votes WHERE meme_id=? AND vote=-1), 0) AS downvotes",
            (meme_id, meme_id),
        ).fetchone()
        current = db.execute(
            "SELECT vote FROM meme_votes WHERE meme_id=? AND session_id=?",
            (meme_id, session_id),
        ).fetchone()

        return jsonify({
            "upvotes":   counts["upvotes"],
            "downvotes": counts["downvotes"],
            "user_vote": current["vote"] if current else 0,
        })

    @app.route("/api/admin/meme", methods=["POST"])
    @require_auth
    def api_upload_meme():
        """Admin-Upload: sofort freigegeben."""
        return _handle_meme_upload(status="approved")

    @app.route("/api/admin/meme/<int:meme_id>/approve", methods=["POST"])
    @require_auth
    def api_approve_meme(meme_id):
        db = get_db()
        db.execute("UPDATE memes SET status = 'approved' WHERE id = ?", (meme_id,))
        db.commit()
        return jsonify({"ok": True})

    @app.route("/api/admin/meme/<int:meme_id>/reject", methods=["POST"])
    @require_auth
    def api_reject_meme(meme_id):
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

    def _handle_meme_upload(status="approved"):
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
        cur = db.execute(
            "INSERT INTO memes (filename, title, status) VALUES (?,?,?)",
            (filename, title, status),
        )
        db.commit()
        base = app.config["PUBLIC_API_URL"].rstrip("/")
        return jsonify({
            "id": cur.lastrowid,
            "filename": filename,
            "url": f"{base}/uploads/{filename}",
            "status": status,
        }), 201

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
    # Poll API
    # -----------------------------------------------------------------------

    def _poll_with_results(db, poll_id, result_mode="full"):
        """
        result_mode:
          "full"  – Stimmen + Prozent (Admin)
          "pct"   – nur Prozent, keine absoluten Zahlen (öffentlich nach Abstimmung)
          "none"  – keine Ergebnisse (öffentlich vor Abstimmung)
        """
        poll = db.execute("SELECT * FROM polls WHERE id = ?", (poll_id,)).fetchone()
        if not poll:
            return None
        options = db.execute(
            "SELECT po.id, po.option_text, po.position, COUNT(pv.id) AS votes"
            " FROM poll_options po"
            " LEFT JOIN poll_votes pv ON pv.option_id = po.id"
            " WHERE po.poll_id = ? GROUP BY po.id ORDER BY po.position",
            (poll_id,),
        ).fetchall()
        total = sum(o["votes"] for o in options)
        result = dict(poll)
        result["total_votes"] = total if result_mode == "full" else None
        result["options"] = []
        for o in options:
            od = dict(o)
            if result_mode == "full":
                od["percentage"] = round(o["votes"] / total * 100) if total else 0
            elif result_mode == "pct":
                od["percentage"] = round(o["votes"] / total * 100) if total else 0
                od.pop("votes")
            else:  # "none"
                od.pop("votes")
                od["percentage"] = None
            result["options"].append(od)
        return result

    @app.route("/api/poll/<int:poll_id>")
    def api_get_poll(poll_id):
        db = get_db()
        session_id = request.args.get("session_id", "")
        already_voted = False
        voted_options = []
        if session_id:
            rows = db.execute(
                "SELECT option_id FROM poll_votes WHERE poll_id = ? AND session_id = ?",
                (poll_id, session_id),
            ).fetchall()
            already_voted = bool(rows)
            voted_options = [r["option_id"] for r in rows]

        poll = db.execute("SELECT * FROM polls WHERE id = ?", (poll_id,)).fetchone()
        if not poll:
            return jsonify({"error": "Umfrage nicht gefunden"}), 404

        show = already_voted or bool(poll["show_results_before_vote"])
        mode = "pct" if show else "none"
        data = _poll_with_results(db, poll_id, result_mode=mode)
        data["already_voted"] = already_voted
        data["voted_options"] = voted_options
        return jsonify(data)

    @app.route("/api/poll/<int:poll_id>/vote", methods=["POST"])
    def api_vote_poll(poll_id):
        data = request.get_json(silent=True) or {}
        db = get_db()
        poll = db.execute("SELECT * FROM polls WHERE id = ? AND active = 1", (poll_id,)).fetchone()
        if not poll:
            return jsonify({"error": "Umfrage geschlossen oder nicht gefunden"}), 404

        session_id = data.get("session_id") or secrets.token_hex(16)
        if db.execute(
            "SELECT id FROM poll_votes WHERE poll_id = ? AND session_id = ?",
            (poll_id, session_id),
        ).fetchone():
            return jsonify({"error": "Bereits abgestimmt"}), 409

        option_ids = data.get("option_ids", [])
        if not option_ids:
            return jsonify({"error": "Keine Option gewählt"}), 400
        if not poll["multiple"]:
            option_ids = option_ids[:1]

        for oid in option_ids:
            if db.execute(
                "SELECT id FROM poll_options WHERE id = ? AND poll_id = ?", (oid, poll_id)
            ).fetchone():
                db.execute(
                    "INSERT INTO poll_votes (poll_id, option_id, session_id) VALUES (?,?,?)",
                    (poll_id, oid, session_id),
                )
        db.commit()

        result = _poll_with_results(db, poll_id, result_mode="pct")
        result["already_voted"] = True
        result["voted_options"] = option_ids
        result["session_id"] = session_id
        return jsonify(result)

    @app.route("/api/admin/polls")
    @require_auth
    def api_list_polls():
        db = get_db()
        poll_ids = [r["id"] for r in db.execute(
            "SELECT id FROM polls ORDER BY created_at DESC"
        ).fetchall()]
        return jsonify([_poll_with_results(db, pid, result_mode="full") for pid in poll_ids])

    @app.route("/api/admin/poll/<int:poll_id>")
    @require_auth
    def api_get_poll_admin(poll_id):
        db = get_db()
        data = _poll_with_results(db, poll_id, result_mode="full")
        if not data:
            return jsonify({"error": "Nicht gefunden"}), 404
        return jsonify(data)

    @app.route("/api/admin/poll", methods=["POST"])
    @require_auth
    def api_create_poll():
        data = request.get_json(silent=True) or {}
        if not data.get("title"):
            return jsonify({"error": "Titel fehlt"}), 400
        db = get_db()
        cur = db.execute(
            "INSERT INTO polls (title, description, ghost_slug, multiple, show_results_before_vote, thank_you_text)"
            " VALUES (?,?,?,?,?,?)",
            (data["title"], data.get("description", ""), data.get("ghost_slug", ""),
             int(bool(data.get("multiple"))), int(bool(data.get("show_results_before_vote"))),
             data.get("thank_you_text", "")),
        )
        poll_id = cur.lastrowid
        _save_options(db, poll_id, data.get("options", []))
        db.commit()
        return jsonify({"id": poll_id}), 201

    @app.route("/api/admin/poll/<int:poll_id>", methods=["PUT"])
    @require_auth
    def api_update_poll(poll_id):
        data = request.get_json(silent=True) or {}
        db = get_db()
        db.execute(
            "UPDATE polls SET title=?, description=?, ghost_slug=?, multiple=?, show_results_before_vote=?, thank_you_text=?"
            " WHERE id=?",
            (data.get("title", ""), data.get("description", ""), data.get("ghost_slug", ""),
             int(bool(data.get("multiple"))), int(bool(data.get("show_results_before_vote"))),
             data.get("thank_you_text", ""), poll_id),
        )
        db.execute("DELETE FROM poll_options WHERE poll_id = ?", (poll_id,))
        _save_options(db, poll_id, data.get("options", []))
        db.commit()
        return jsonify({"ok": True})

    @app.route("/api/admin/poll/<int:poll_id>/toggle", methods=["POST"])
    @require_auth
    def api_toggle_poll(poll_id):
        db = get_db()
        db.execute("UPDATE polls SET active = 1 - active WHERE id = ?", (poll_id,))
        db.commit()
        row = db.execute("SELECT active FROM polls WHERE id = ?", (poll_id,)).fetchone()
        return jsonify({"active": bool(row["active"])})

    @app.route("/api/admin/poll/<int:poll_id>", methods=["DELETE"])
    @require_auth
    def api_delete_poll(poll_id):
        db = get_db()
        db.execute("DELETE FROM polls WHERE id = ?", (poll_id,))
        db.commit()
        return jsonify({"ok": True})

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
                status      TEXT DEFAULT 'approved',
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS polls (
                id                       INTEGER PRIMARY KEY AUTOINCREMENT,
                title                    TEXT    NOT NULL,
                description              TEXT    DEFAULT '',
                ghost_slug               TEXT    DEFAULT '',
                multiple                 INTEGER DEFAULT 0,
                active                   INTEGER DEFAULT 1,
                show_results_before_vote INTEGER DEFAULT 0,
                thank_you_text           TEXT    DEFAULT '',
                created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS poll_options (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                poll_id     INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
                option_text TEXT    NOT NULL,
                position    INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS poll_votes (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                poll_id    INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
                option_id  INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
                session_id TEXT,
                voted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS quiz_answer_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                quiz_id     INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
                question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                answer_id   INTEGER,
                session_id  TEXT,
                is_correct  INTEGER DEFAULT 0,
                logged_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS meme_votes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                meme_id     INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
                session_id  TEXT    NOT NULL,
                vote        INTEGER NOT NULL CHECK(vote IN (-1, 1)),
                voted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(meme_id, session_id)
            );
            """
        )
        db.commit()
        # Migrations für bestehende Datenbanken
        poll_cols = [r[1] for r in db.execute("PRAGMA table_info(polls)").fetchall()]
        if "thank_you_text" not in poll_cols:
            db.execute("ALTER TABLE polls ADD COLUMN thank_you_text TEXT DEFAULT ''")
        meme_cols = [r[1] for r in db.execute("PRAGMA table_info(memes)").fetchall()]
        if "status" not in meme_cols:
            db.execute("ALTER TABLE memes ADD COLUMN status TEXT DEFAULT 'approved'")
        db.commit()
        db.close()


def _save_options(db, poll_id, options):
    for i, o in enumerate(options):
        text = o.get("option_text", "").strip()
        if text:
            db.execute(
                "INSERT INTO poll_options (poll_id, option_text, position) VALUES (?,?,?)",
                (poll_id, text, i),
            )


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
