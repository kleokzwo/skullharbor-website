# SkullHarbor Website + CyberBasis Checkout

Static SkullHarbor website served by a small Node/Express service. CyberBasis checkout uses a Stripe Payment Link and verifies the resulting Checkout Session server-side before exposing a short-lived download URL.

## Stripe setting
Set the Payment Link redirect to:
`https://skullharbor.org/cyberbasis/success?session_id={CHECKOUT_SESSION_ID}`

## Server setup
```bash
cd /var/www/skullharbor.org
npm ci
cp .env.example .env
chmod 600 .env
# Fill Stripe values in .env; never commit it.
mkdir -p private/products
# Copy SkullHarbor-CyberBasis-V1.0-DE.zip into private/products/
pm start
```

Generate the download signing secret with:
```bash
openssl rand -hex 32
```

## PM2
```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Nginx remains pointed at `http://127.0.0.1:8787`.

## Security
- `.env` is ignored by Git.
- Product ZIP is ignored by Git and is not under `public/`.
- Download requires a paid Stripe Checkout Session for EUR 29.00.
- Set `STRIPE_PAYMENT_LINK_ID` to the CyberBasis Payment Link ID so another paid Stripe session cannot unlock the product.
- Generated download URLs expire after 15 minutes.
