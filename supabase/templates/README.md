# Supabase E-Mail-Templates

Gebrandete deutsche Auth-Mails (Theme-Olivton). Diese Dateien sind die **Source of
Truth** — per Management-API ins gehostete Projekt deployen:

```sh
npm run deploy:email
```

> ⚠️ **Voraussetzung: Custom SMTP.** Auf dem Free-Tier mit dem Default-Mailprovider
> ist jede Template-Änderung gesperrt — `deploy:email` antwortet dann mit
> `400 Email template modification is not available for free tier projects`.
> Erst **Custom SMTP** (Resend, s. u.) oder Supabase Pro freischalten, dann deployen.

Nutzt denselben Token wie `deploy:edge`: wer per `npm run supabase:login` eingeloggt
ist (`~/.config/supabase/access-token`), braucht nichts weiter zu setzen. Alternativ
`SUPABASE_ACCESS_TOKEN` in der Umgebung oder `.env` (Personal Access Token `sbp_…` aus
**Dashboard → Account → Access Tokens**, NICHT der `service_role`-Key). Das Skript
([`scripts/deploy-email-templates.mjs`](../../scripts/deploy-email-templates.mjs))
pusht beide Templates + Betreffzeilen via `PATCH /v1/projects/{ref}/config/auth`.

| Datei | Template | Betreff |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `Willkommen bei Stellplatz Finder – E-Mail bestätigen` |
| `magic-link.html` | Magic Link | `Dein Login-Code – Stellplatz Finder` |

> Fallback ohne Token: HTML manuell unter **Authentication → Email Templates** einfügen.

Variablen: `{{ .Token }}` (6-stelliger OTP-Code), `{{ .ConfirmationURL }}`
(Login-Link, Browser-Fallback), `{{ .SiteURL }}`, `{{ .Email }}`.

> **Wichtig:** Das `magic-link.html` enthält jetzt `{{ .Token }}`. Der Client nutzt
> primär den **OTP-Code** (`verifyOtp`, siehe unten) — ohne den Token im aktiven Template
> kommt zwar die Mail, aber kein Code. Nach jeder Änderung also `npm run deploy:email`.

## Wichtig: Redirect-Konfiguration

Damit die Links nicht auf `localhost` zeigen — **Authentication → URL Configuration**:

- **Site URL** = Produktions-URL (Render), z. B. `https://<render-service>.onrender.com`
- **Redirect URLs** (Allowlist):
  ```
  http://localhost:5173/**
  http://localhost:3000/**
  https://<render-service>.onrender.com/**
  ```

Der Client schickt `emailRedirectTo = window.location.origin` — Supabase nutzt das
nur, wenn die Origin in der Allowlist steht, sonst fällt es auf die Site URL zurück.

## Rate-Limit & eigenes SMTP (Resend)

Der **eingebaute** Supabase-Mailversand ist absichtlich stark gedrosselt
(Free-Tier: ~2–4 Mails/Stunde, projektweit). Symptom: `email rate limit exceeded`.
Das ist kein Code-Bug — jeder Login-Versuch zählt mit.

**Lösung: eigenes SMTP** unter **Authentication → SMTP Settings** → „Enable Custom SMTP".
Mit Resend (kostenloses Kontingent) am einfachsten:

1. Account bei [resend.com](https://resend.com), API-Key erstellen.
2. In Supabase eintragen:
   | Feld | Wert |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | dein Resend-API-Key |
   | Sender email | `login@<deine-domain>` (zum Testen: `onboarding@resend.dev`) |
   | Sender name | `Stellplatz Finder` |
3. Speichern → das Supabase-Rate-Limit greift dann nicht mehr.

> Für eine eigene Absender-Domain muss diese in Resend verifiziert sein
> (DNS-Records SPF/DKIM). Ohne eigene Domain reicht zum Testen `onboarding@resend.dev`.

## PWA-Login per OTP-Code (implementiert)

Der Client (`AuthPanel` + `auth.verifyOtp`) nutzt primär den **6-stelligen Code**, nicht
den Link. Grund: Ein E-Mail-Link öffnet immer den System-Browser, nicht die installierte
Home-Screen-PWA — und auf iOS haben Browser und PWA **getrennte Storages**, d. h. die
Anmeldung im Browser loggt die PWA nie ein. Mit dem Code bleibt der User in der App, tippt
ihn ein, `verifyOtp` legt die Session direkt im PWA-Storage an. Der Link bleibt als
Browser-Fallback in der Mail.

**Voraussetzung:** `magic-link.html` (mit `{{ .Token }}`) muss im Dashboard hinterlegt sein.

### Lokale Entwicklung (optional, `supabase start`)
Statt Dashboard kann das Template per `config.toml` versioniert werden:
```toml
[auth.email.template.magic_link]
subject = "Dein Login-Code – Stellplatz Finder"
content_path = "./supabase/templates/magic-link.html"
```
Greift **nur lokal** — das gehostete Prod-Projekt wird weiterhin übers Dashboard gepflegt.

## Hinweise

- Magic-Link **und** OTP brauchen beide eine Mail → lösen das Rate-Limit **nicht**.
  Nur eigenes SMTP (oben) oder ein OAuth-Provider (Google/GitHub, mailfrei) helfen.
