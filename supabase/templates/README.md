# Supabase E-Mail-Templates

Gebrandete deutsche Auth-Mails (Theme-Olivton). Werden **nicht** automatisch
deployt — manuell ins Supabase-Dashboard kopieren, sobald möglich:

**Authentication → Email Templates** → jeweiliges Template → HTML einfügen + Betreff setzen.

| Datei | Template | Betreff |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `Willkommen bei Stellpatz Finder – E-Mail bestätigen` |
| `magic-link.html` | Magic Link | `Dein Login-Link – Stellpatz Finder` |

Variablen: `{{ .ConfirmationURL }}` (Login-Link), `{{ .Token }}` (6-stelliger Code,
falls man auf OTP umstellt), `{{ .SiteURL }}`, `{{ .Email }}`.

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

## Hinweise

- Der eingebaute Mailversand ist stark rate-limited → für echten Betrieb eigenes
  SMTP unter **Authentication → SMTP Settings** (Resend / Postmark / SendGrid …).
- Für PWA/Standalone ist ein **6-stelliger Code** (`{{ .Token }}` + `verifyOtp` im
  Client) robuster als der Link — bei Bedarf als Folge-PR.
