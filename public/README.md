# SkullHarbor Website — Sprint 1

Static, mobile-first product website.

## Run locally

```bash
python3 -m http.server 8080
```

Open http://localhost:8080

## Sprint 1 scope

- Premium 90s/terminal product design
- Product and four-family coverage explanation
- Local-first/privacy positioning
- Download CTA routes to registration gate
- Registration UX communicates email verification + 7-day trial
- Advanced upgrade positioning
- FAQ and legal placeholders

## Intentionally not implemented yet

The registration form is frontend-only in Sprint 1. It does **not** create
accounts, send verification email, issue entitlements or expose a binary.
Those actions require the account/licensing/download backend and must not be
faked client-side.

Before public launch, replace the legal placeholders with final operator data
and reviewed legal/privacy text.

### Registration contact fields

Registration now requires first name, last name, company position/role, work email and password.
