# Ghost-Integration – DMUN Quiz

## Voraussetzungen

- Der Quiz-API-Container läuft und ist öffentlich erreichbar  
  (z.B. `https://quiz.dmun.de` oder per Reverse-Proxy hinter Nginx/Caddy)
- `PUBLIC_API_URL` in `.env` ist auf diese öffentliche URL gesetzt
- In `.env` ist `CORS_ORIGINS` auf deine Ghost-Domain gesetzt (z.B. `https://dmun.de`)

---

## 1 · Quiz anlegen (Admin-UI)

1. Öffne `http://<dein-server>:5000/admin`
2. Melde dich mit den Zugangsdaten aus `.cred` an
3. Klicke **Neues Quiz** und fülle Titel, Beschreibung, Fragen + Antworten aus
4. Markiere bei jeder Frage genau eine Antwort als **Richtig**
5. Speichern → du erhältst eine Quiz-ID (z.B. `1`)

---

## 2 · Quiz in Ghost-Artikel einbetten

### Schritt A – CSS global einbinden (einmalig)

Ghost Admin → **Settings → Code Injection → Site Header**:

```html
<link rel="stylesheet" href="https://quiz.dmun.de/static/quiz-widget.css">
```

→ Datei `ghost-site-header.html` enthält diesen Schnipsel.

### Schritt B – Quiz im Artikel einbetten

Im Ghost-Editor auf **+** klicken → **HTML** auswählen, dann einfügen:

```html
<div class="dmun-quiz" data-quiz-id="1" data-api-url="https://quiz.dmun.de"></div>
<script src="https://quiz.dmun.de/static/quiz-widget.js"></script>
```

→ `data-quiz-id` auf die ID deines Quiz setzen  
→ `data-api-url` auf deine öffentliche API-URL setzen

Den fertigen Embed-Code für jedes Quiz findest du auch im Admin-Panel unter **Einbetten**.

---

## 3 · Mehrere Quizze auf einer Seite

Jedes `<div class="dmun-quiz" ...>` wird automatisch initialisiert.  
Das `<script>`-Tag nur einmal pro Seite einbinden.

```html
<div class="dmun-quiz" data-quiz-id="1" data-api-url="https://quiz.dmun.de"></div>
<div class="dmun-quiz" data-quiz-id="2" data-api-url="https://quiz.dmun.de"></div>
<script src="https://quiz.dmun.de/static/quiz-widget.js"></script>
```

---

## 4 · Reverse Proxy (empfohlen für Produktion)

### Nginx-Beispiel

```nginx
server {
    listen 443 ssl;
    server_name quiz.dmun.de;

    location / {
        proxy_pass         http://localhost:5000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
```

### Caddy-Beispiel

```
quiz.dmun.de {
    reverse_proxy localhost:5000
}
```

---

## 5 · Styling anpassen

Das Widget nutzt CSS Custom Properties, die du in Ghost überschreiben kannst:

```html
<style>
  :root {
    --dmun-primary: #003366;   /* Hauptfarbe (Header) */
    --dmun-accent:  #005b99;   /* Buttons, Hervorhebungen */
    --dmun-correct: #1e8449;   /* Richtige Antwort */
    --dmun-wrong:   #c0392b;   /* Falsche Antwort */
  }
</style>
```

Diese `<style>`-Block kommt ebenfalls in **Code Injection → Site Header**.

---

## 6 · API-Endpunkte (Übersicht)

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| GET | `/api/quiz/<id>` | – | Quiz-Daten (öffentlich) |
| POST | `/api/quiz/<id>/submit` | – | Antworten einreichen |
| GET | `/api/admin/quizzes` | Basic | Alle Quizze |
| POST | `/api/admin/quiz` | Basic | Quiz erstellen |
| PUT | `/api/admin/quiz/<id>` | Basic | Quiz bearbeiten |
| DELETE | `/api/admin/quiz/<id>` | Basic | Quiz löschen |
| GET | `/api/admin/quiz/<id>/results` | Basic | Ergebnisse |
