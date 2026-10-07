import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import Stripe from 'stripe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const productFile = path.join(
  root,
  'private',
  'products',
  'SkullHarbor-CyberBasis-V1.0-DE.zip'
);

const stateDir = path.join(root, 'private', 'state');
const stateFile = path.join(stateDir, 'fulfillment.json');

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const expectedPaymentLink = process.env.STRIPE_PAYMENT_LINK_ID || '';
const paymentUrl = process.env.STRIPE_PAYMENT_LINK_URL || '';

const DOWNLOAD_TTL_SECONDS = 15 * 60;

const app = express();

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.static(publicDir, { extensions: ['html'] }));

function esc(v = '') {
  return String(v).replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]
  );
}

function page(title, body) {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} — SkullHarbor</title>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
  <main class="purchase-status">
    <div class="eyebrow">SKULLHARBOR // CYBERBASIS</div>
    ${body}
  </main>
</body>
</html>`;
}

function validSession(session) {
  return (
    session &&
    session.payment_status === 'paid' &&
    session.mode === 'payment' &&
    session.currency === 'eur' &&
    session.amount_total === 2900 &&
    (!expectedPaymentLink || session.payment_link === expectedPaymentLink)
  );
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function ensureState() {
  fs.mkdirSync(stateDir, { recursive: true });

  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, '{}\n', {
      encoding: 'utf8',
      mode: 0o600,
    });
  }
}

function readState() {
  ensureState();

  try {
    const raw = fs.readFileSync(stateFile, 'utf8');
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid fulfillment state');
    }

    return parsed;
  } catch (error) {
    console.error('fulfillment state read failed:', error.message);
    throw new Error('fulfillment state unavailable');
  }
}

function writeState(state) {
  ensureState();

  const tempFile = `${stateFile}.tmp`;

  fs.writeFileSync(
    tempFile,
    `${JSON.stringify(state, null, 2)}\n`,
    {
      encoding: 'utf8',
      mode: 0o600,
    }
  );

  fs.renameSync(tempFile, stateFile);
}

function issueTicket(sessionId) {
  const state = readState();

  /*
   * A Stripe Checkout Session may create exactly one fulfillment.
   * Once registered, /success never creates another ticket.
   */
  if (state[sessionId]) {
    return null;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = Math.floor(Date.now() / 1000);

  state[sessionId] = {
    tokenHash: tokenHash(token),
    issuedAt: now,
    expiresAt: now + DOWNLOAD_TTL_SECONDS,
    consumedAt: null,
  };

  writeState(state);

  return {
    token,
    expiresAt: state[sessionId].expiresAt,
  };
}

function consumeTicket(sessionId, token) {
  const state = readState();
  const entry = state[sessionId];
  const now = Math.floor(Date.now() / 1000);

  if (!entry) {
    return false;
  }

  if (entry.consumedAt !== null) {
    return false;
  }

  if (!entry.expiresAt || entry.expiresAt < now) {
    return false;
  }

  if (!entry.tokenHash || tokenHash(token) !== entry.tokenHash) {
    return false;
  }

  /*
   * Consume BEFORE sending the file.
   * After this write succeeds, this ticket can never be used again.
   */
  entry.consumedAt = now;
  writeState(state);

  return true;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'skullharbor-web',
  });
});

app.get('/buy/cyberbasis', (_req, res) => {
  if (!paymentUrl) {
    return res
      .status(503)
      .send(
        page(
          'Noch nicht verfügbar',
          '<h1>Checkout wird eingerichtet.</h1><p>Bitte versuchen Sie es später erneut.</p>'
        )
      );
  }

  res.redirect(302, paymentUrl);
});

app.get('/cyberbasis/success', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '');

    if (!sessionId.startsWith('cs_')) {
      throw new Error('missing session');
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!validSession(session)) {
      return res
        .status(403)
        .send(
          page(
            'Zahlung nicht bestätigt',
            '<h1>Download noch nicht freigegeben.</h1><p>Die Zahlung konnte nicht als abgeschlossen bestätigt werden.</p>'
          )
        );
    }

    const ticket = issueTicket(session.id);

    /*
     * Important:
     * A previously registered Checkout Session NEVER receives
     * another download ticket.
     */
    if (!ticket) {
      return res
        .status(403)
        .send(
          page(
            'Download bereits freigegeben',
            '<h1>Download-Link nicht mehr verfügbar.</h1><p>Diese Bestellung wurde bereits für einen Download freigegeben. Aus Sicherheitsgründen kann kein neuer Download-Link erzeugt werden.</p>'
          )
        );
    }

    const url =
      `/cyberbasis/download` +
      `?session_id=${encodeURIComponent(session.id)}` +
      `&token=${encodeURIComponent(ticket.token)}`;

    return res.send(
      page(
        'Vielen Dank',
        `<h1>Vielen Dank für Ihren Kauf.</h1>
         <p>Ihre Zahlung wurde bestätigt. Dieser Download kann einmal ausgeführt werden und ist maximal 15 Minuten gültig.</p>
         <a class="btn primary" href="${url}">CYBERBASIS HERUNTERLADEN →</a>`
      )
    );
  } catch (error) {
    console.error('success verification failed:', error.message);

    return res
      .status(400)
      .send(
        page(
          'Ungültiger Aufruf',
          '<h1>Download nicht verfügbar.</h1><p>Die Checkout-Session konnte nicht verifiziert werden.</p>'
        )
      );
  }
});

app.get('/cyberbasis/download', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '');
    const token = String(req.query.token || '');

    if (!sessionId.startsWith('cs_') || !token) {
      return res
        .status(403)
        .send('Download-Link ungültig oder abgelaufen.');
    }

    /*
     * Verify payment again before consuming the one-time ticket.
     */
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!validSession(session)) {
      return res.status(403).send('Zahlung nicht bestätigt.');
    }

    /*
     * This permanently consumes the ticket BEFORE file delivery.
     */
    if (!consumeTicket(sessionId, token)) {
      return res
        .status(403)
        .send('Download-Link ungültig, abgelaufen oder bereits verwendet.');
    }

    if (!fs.existsSync(productFile)) {
      return res
        .status(404)
        .send('Produktdatei nicht verfügbar.');
    }

    return res.download(
      productFile,
      'SkullHarbor-CyberBasis-V1.0-DE.zip',
      error => {
        if (error) {
          console.error('product delivery failed:', error.message);
        }
      }
    );
  } catch (error) {
    console.error('download failed:', error.message);

    if (!res.headersSent) {
      return res
        .status(400)
        .send('Download konnte nicht verifiziert werden.');
    }
  }
});

ensureState();

app.listen(port, host, () => {
  console.log(`SkullHarbor listening on http://${host}:${port}`);
});