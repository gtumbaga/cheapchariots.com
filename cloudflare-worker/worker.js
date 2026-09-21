/**
 * Cheap Chariots Transportation — form submission handler.
 *
 * Handles POSTs from the site's HTML forms (contact, driver application,
 * driver waiver, cleaning/maintenance application, operators agreement):
 *   1. Emails the submission (via Resend) to your inbox.
 *   2. Responds with a branded "thank you" (or error) HTML page.
 *
 * ---------------------------------------------------------------------
 * REQUIRED SETUP (Cloudflare dashboard → Worker → Settings → Variables
 * and Secrets):
 *
 *   RESEND_API_KEY   (secret)  API key from https://resend.com
 *   FROM_EMAIL       (var)     e.g. "Cheap Chariots <forms@cheapchariots.com>"
 *                              Must be on a domain verified in Resend.
 *   TO_EMAIL         (var)     e.g. "info@cheapchariots.com"
 *
 * OPTIONAL:
 *   ALLOWED_ORIGIN   (var)      e.g. "https://cheapchariots.com" — if set,
 *                                requests from any other origin are rejected.
 *   SITE_ORIGIN      (var)      Fallback "back to site" link, e.g.
 *                                "https://cheapchariots.com"
 * ---------------------------------------------------------------------
 */

const INTERNAL_FIELDS = new Set(["form", "_gotcha"]);

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const origin = request.headers.get("Origin") || request.headers.get("Referer") || "";
    if (env.ALLOWED_ORIGIN && origin && !origin.startsWith(env.ALLOWED_ORIGIN)) {
      return new Response("Forbidden", { status: 403 });
    }

    const backUrl = env.SITE_ORIGIN || safeOrigin(origin) || "https://cheapchariots.com";

    let fields;
    try {
      fields = await parseBody(request);
    } catch (err) {
      return htmlPage(
        "Something went wrong",
        "We couldn't read your submission. Please try again, or email us directly at info@cheapchariots.com.",
        backUrl,
        502
      );
    }

    // Honeypot: bots fill this hidden field, humans never see it.
    if (fields._gotcha) {
      return htmlPage(
        "Thank you!",
        "We received your submission and will be in touch soon.",
        backUrl,
        200
      );
    }

    const formName = fields.form || "Website Form";

    try {
      await sendEmail(fields, formName, env);
    } catch (err) {
      console.error("Email send failed:", err);
      return htmlPage(
        "Something went wrong",
        `We couldn't send your "${formName}" submission. Please email info@cheapchariots.com directly, or call (510) 299-6199.`,
        backUrl,
        502
      );
    }

    return htmlPage(
      "Thank you!",
      `We received your ${formName.toLowerCase()} and will be in touch soon.`,
      backUrl,
      200
    );
  },
};

/** Parses url-encoded or multipart form bodies (what plain HTML forms send),
 *  with a JSON fallback for any future fetch()-based submissions. */
async function parseBody(request) {
  const contentType = request.headers.get("content-type") || "";
  const data = {};

  if (contentType.includes("application/json")) {
    Object.assign(data, await request.json());
    return data;
  }

  const form = await request.formData();
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue; // skip file uploads, if any
    if (data[key] !== undefined) {
      data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
    } else {
      data[key] = value;
    }
  }
  return data;
}

async function sendEmail(fields, formName, env) {
  const entries = Object.entries(fields).filter(([key]) => !INTERNAL_FIELDS.has(key));

  const text = entries
    .map(([key, value]) => `${labelize(key)}: ${joinValue(value)}`)
    .join("\n");

  const rowsHtml = entries
    .map(
      ([key, value]) => `
        <tr>
          <td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;background:#f7f2e7;white-space:nowrap;">${escapeHtml(
            labelize(key)
          )}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">${escapeHtml(joinValue(value))}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;">
      <h2 style="color:#b8860b;margin-bottom:4px;">${escapeHtml(formName)}</h2>
      <p style="color:#666;margin-top:0;">Submitted via cheapchariots.com</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">${rowsHtml}</table>
    </div>
  `;

  const replyTo = typeof fields.email === "string" ? fields.email : undefined;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: env.TO_EMAIL,
      reply_to: replyTo,
      subject: `New submission: ${formName}`,
      text,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend API error ${response.status}: ${await response.text()}`);
  }
}

function joinValue(value) {
  return Array.isArray(value) ? value.join(", ") : value;
}

function labelize(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function safeOrigin(originOrReferer) {
  try {
    return new URL(originOrReferer).origin;
  } catch {
    return null;
  }
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function htmlPage(title, message, backUrl, status) {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | Cheap Chariots Transportation</title>
  <style>
    body { margin:0; background:#0a0a0a; color:#f5f5f5; font-family: Arial, Helvetica, sans-serif;
           display:grid; place-items:center; min-height:100vh; }
    .card { max-width: 480px; text-align:center; padding: 40px 32px; border:1px solid #2a2a2a;
            border-top:3px solid #d4a017; border-radius:4px; background:#161616; }
    h1 { color:#f0c14b; font-size: 24px; margin-bottom: 12px; }
    p { color:#ccc; line-height:1.5; }
    a.btn { display:inline-block; margin-top:24px; background: linear-gradient(#f0c14b,#d4a017);
            color:#1a1400; font-weight:800; text-transform:uppercase; letter-spacing:.8px;
            padding:12px 20px; border-radius:3px; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a class="btn" href="${escapeHtml(backUrl)}">Back to site</a>
  </div>
</body>
</html>`;

  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
}
