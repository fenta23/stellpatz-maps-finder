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
   | Sender name | `Stellpatz Finder` |
3. Speichern → das Supabase-Rate-Limit greift dann nicht mehr.

> Für eine eigene Absender-Domain muss diese in Resend verifiziert sein
> (DNS-Records SPF/DKIM). Ohne eigene Domain reicht zum Testen `onboarding@resend.dev`.

## Hinweise

- Magic-Link **und** OTP brauchen beide eine Mail → lösen das Rate-Limit **nicht**.
  Nur eigenes SMTP (oben) oder ein OAuth-Provider (Google/GitHub, mailfrei) helfen.
- Für PWA/Standalone ist ein **6-stelliger Code** (`{{ .Token }}` + `verifyOtp` im
  Client) robuster als der Link — bei Bedarf als Folge-PR.
