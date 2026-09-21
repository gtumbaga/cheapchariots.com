# Form handling setup (Cloudflare Worker)

All 5 forms on the site (Contact, Driver Application, Driver Waiver,
Cleaning/Maintenance Application, Operators Agreement) now `POST` to:

```
https://cheapchariots-form-handler.gatumbaga.workers.dev/
```

The Worker code lives in [`worker.js`](./worker.js) — paste its contents into
the Cloudflare dashboard's Worker editor (replacing the default "Hello World"
code) and hit **Deploy**.

## Set up email delivery (Resend)

Cloudflare Workers can't send raw SMTP, so email goes through an HTTP email
API. [Resend](https://resend.com) is used here — free tier covers 3,000
emails/month, and the API is a single `fetch()` call (see `worker.js`).
Postmark or SendGrid work the same way if you'd rather use one of those
instead — just swap the `sendEmail()` function's endpoint/payload.

1. Sign up at https://resend.com.
2. **Domains → Add domain** → enter `cheapchariots.com` (or a subdomain like
   `mail.cheapchariots.com`). Resend gives you a few DNS records (SPF, DKIM,
   etc.) — add those in your Cloudflare DNS dashboard for the domain. Takes
   a few minutes to verify.
3. **API Keys → Create API key** → copy it.
4. In the Cloudflare Worker dashboard: **Settings → Variables and Secrets**,
   add:
   - `RESEND_API_KEY` (type: Secret) → the key from step 3.
   - `FROM_EMAIL` (type: Text) → e.g. `Cheap Chariots <forms@cheapchariots.com>`
     (must be on the domain you verified in step 2).
   - `TO_EMAIL` (type: Text) → `info@cheapchariots.com`
   - `SITE_ORIGIN` (type: Text) → `https://cheapchariots.com`
   - `ALLOWED_ORIGIN` (type: Text, optional but recommended) →
     `https://cheapchariots.com` — rejects submissions posted from anywhere
     else.

## Test it

After deploying the Worker and setting the variables, submit each form on
the live site (or locally) and confirm:

- You get an email at the `TO_EMAIL` address.
- The browser lands on a "Thank you!" confirmation page served by the
  Worker, with a link back to the site.

If something fails, check the Worker's **Logs** tab in the Cloudflare
dashboard (or `console.error` output) for the underlying error.

## Anti-spam

Each form includes a hidden honeypot field (`_gotcha`) — real visitors never
see or fill it, but simple bots often do. Submissions with that field
populated are silently accepted (so the bot thinks it worked) without
sending an email. For stronger protection later, consider adding
[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) (free,
no user friction) to the forms and verifying the token in the Worker.

## Logging submissions to a Google Sheet (later, if you want it)

Not set up right now, but if you want it down the line: the Worker can
`fetch()` a Google Apps Script Web App URL (deployed from a Sheet) as a
lightweight webhook, in the same `try`/`catch` pattern as the email send.
Just ask and this can be added back in without touching the HTML forms.
