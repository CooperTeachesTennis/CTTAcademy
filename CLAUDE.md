# CLAUDE.md — CTT Academy
**CooperTeachesTennis | cttacademy**
*Last updated: May 2026*

---

## Project Overview

CTT Academy is a private coaching management platform for Cooper Anderson
(CooperTeachesTennis). Phase 1 is a secure, owner-only web app for managing
student profiles, session notes, and coaching history. Phase 2 will open a
public-facing interface for client self-registration and eventually hosted
payments via a third-party processor.

**Repository:** github.com/[your-handle]/cttacademy *(update when customized)*
**Owner:** Cooper Anderson
**Status:** Phase 1 — private, owner-only access

---

## Security — Top Priority

Security is the single most important concern in this codebase. Every
architectural decision, every feature addition, and every dependency choice
must be evaluated through a security-first lens. When in doubt, do less and
ask.

### Non-Negotiable Security Rules

1. **No secrets in the repo — ever.** API keys, tokens, credentials, and
   Cloudflare KV binding names never appear in source files. Use environment
   variables exclusively. `.env` is in `.gitignore` and never committed.

2. **GitHub OAuth is the only authentication path.** No username/password
   login. No magic links. No workarounds. The app checks GitHub identity on
   every protected route. Owner UID is hardcoded server-side — not in the
   client.

3. **All API calls route through a Cloudflare Worker.** The browser never
   calls external APIs directly. The Worker validates the authenticated
   session before touching KV storage or any external service.

4. **KV data is owner-only.** No client-facing reads or writes to KV in
   Phase 1. All KV access is gated behind Worker-side auth validation.

5. **No sensitive client data in Phase 1.** Student profiles contain
   coaching notes, session history, and assessment data only. No financial
   information, no payment data, no SSNs or government IDs — ever.

6. **HTTPS only.** No HTTP fallback. All Workers routes enforce TLS.

7. **Dependency hygiene.** Minimize npm packages. Every new dependency
   requires justification. Run `npm audit` before every deploy.

8. **No commented-out credentials.** Ever. If a past key appears in git
   history, treat it as compromised and rotate immediately.

9. **Content Security Policy headers.** Set by the Cloudflare Worker on
   every response. No inline scripts. No `eval()`.

10. **Principle of least privilege.** Cloudflare API tokens scoped to this
    project only. GitHub OAuth app permissions: read-only, profile only.

---

## Architecture

### Phase 1 — Owner-Only Private App

```
Browser (GitHub OAuth login)
    ↓
Static HTML/CSS/JS (GitHub Pages)
    ↓ all data requests
Cloudflare Worker (auth validation + business logic)
    ↓
Cloudflare KV (student profiles + session notes)
```

### Phase 2 — Public-Facing (future)
- Public registration flow added to static frontend
- Worker adds new KV namespaces for client-owned data
- Third-party payment processor integrated via Worker (Stripe or equivalent)
- Auth expands to support client-facing login separate from owner access

---

## Tech Stack

| Layer | Tool | Reason |
|---|---|---|
| Frontend | Static HTML + CSS + Vanilla JS | Lightweight, easy to update, no build step |
| Auth | GitHub OAuth (via Cloudflare Worker) | Simple, secure, zero password management |
| API / Secret handling | Cloudflare Worker | Keeps all keys server-side |
| Data | Cloudflare KV | Fast, serverless, pairs natively with Workers |
| Hosting | GitHub Pages (Phase 1) | Free, simple, HTTPS included |
| Domain | github.io URL (Phase 1) → custom domain (Phase 2) | Update this file when domain is set |

**Do not introduce React, Next.js, or any frontend framework without discussion.**
The goal is code Cooper can read and update. Keep it simple.

---

## File Structure

```
cttacademy/
├── index.html           # Login / landing page
├── dashboard.html       # Owner dashboard (protected)
├── student.html         # Individual student profile view (protected)
├── session.html         # Session notes entry form (protected)
├── css/
│   └── style.css
├── js/
│   ├── auth.js          # GitHub OAuth token handling (client-side only)
│   └── app.js           # Dashboard and UI logic
├── worker/
│   └── index.js         # Cloudflare Worker — all server-side logic lives here
├── .gitignore
├── CLAUDE.md            # This file
└── README.md
```

---

## Feature Scope

### Phase 1 — Build Now

**Authentication**
- GitHub OAuth login flow
- Owner-only access enforced server-side (Worker checks GitHub user ID)
- Session tokens expire; no persistent login without re-auth

**Student Profiles**
- Create and edit student profiles
- Fields: Name, contact email, NTRP rating, play style, goals, start date
- Assessment: initial skill assessment form mapped to CTT fundamentals
- Each profile has a unique ID stored in KV

**Session Tracker**
- Log each coaching session: date, student, duration, topics covered
- "Last session" reminder: dashboard surfaces the most recent session
  notes before each new entry — Cooper sees what was covered before
  logging new notes
- Session history: chronological list per student

**Dashboard**
- List of all active students
- Quick-access: upcoming sessions, recent notes
- Search/filter by student name

### Phase 2 — Do Not Build Yet

- Public registration portal
- Client-facing login
- Payment integration (third-party processor — TBD)
- Email notifications
- File/video uploads

**Do not stub, scaffold, or placeholder Phase 2 features in Phase 1 code.
Build only what is listed above.**

---

## Cloudflare Worker Rules

- The Worker is the only place secrets live in production
- Validate GitHub session token on every request before any KV operation
- Return generic error messages to the client — never expose stack traces
  or internal KV key names
- KV keys follow this pattern: `student:{id}`, `session:{studentId}:{date}`
- All Worker routes are prefixed `/api/` — the static frontend never calls
  anything else
- Worker environment variables (set in Cloudflare dashboard, never in code):
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `OWNER_GITHUB_ID` *(numeric GitHub user ID — not username; update before first deploy)*
  - KV namespace binding: `CTT_KV`

---

## Working with Claude

### How Cooper works
- Not an experienced coder. Plain language explanations required alongside
  every file written or changed.
- Prefers finished drafts to react to over open-ended questions.
- If a decision is genuinely ambiguous, ask 1 question max before proceeding.
- Security concerns always pause the work — flag before building.

### Claude's job on this project
- Explain what code does in plain English alongside every file it writes
- Flag any security implications of a proposed change before implementing
- Never introduce a new dependency without explaining what it does and why
- Prefer the simplest solution that works over the clever one
- If asked to build a Phase 2 feature, confirm that's the intent first

### What Claude should never do
- Commit or suggest committing `.env` files or secrets
- Add packages not discussed without flagging them first
- Build beyond the Phase 1 feature scope without explicit instruction
- Assume a feature is needed — ask if scope is unclear

---

## Deployment Checklist

Before any push to `main`:
- [ ] No secrets or API keys in any file
- [ ] `.env` is in `.gitignore`
- [ ] `npm audit` run — no high or critical vulnerabilities
- [ ] Worker tested locally with `wrangler dev` before deploying
- [ ] Auth flow tested: login, access protected route, logout
- [ ] No `console.log` statements left in production code

---

## Domain & URL

**Current:** GitHub Pages URL *(update when repo is created)*
`https://[your-handle].github.io/cttacademy`

**Future:** Custom subdomain — `academy.cooperteachestennis.com` (Phase 2)

*Update this section when the domain changes.*

---

## Update Log

| Date | Change |
|---|---|
| May 2026 | Initial CLAUDE.md created |
