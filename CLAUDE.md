# CLAUDE.md — Cooper Teaches Tennis
**CooperTeachesTennis/CTTAcademy**
*Last updated: June 2026*

---

## Project Overview

Cooper Teaches Tennis is a coaching management platform for Cooper Anderson.
Built and maintained by Mitch Anderson (Cooper's brother).

**Primary purpose:** Cooper logs session notes after each lesson. Players access
their notes, track their Long-Term Tennis Development Plan (LTTDP), and review
their progress. Cooper reviews the previous session before logging new notes.

**Live site:** https://ctt-academy.pages.dev
**Worker:** https://ctt-worker.andermd535.workers.dev
**Repo:** https://github.com/CooperTeachesTennis/CTTAcademy
**Cloudflare account:** Mitch Anderson (andermd535@gmail.com)

**Explicitly out of scope:** scheduling, payments, file/video uploads.

---

## Security — Top Priority

Security is the most important concern in this codebase. Every architectural
decision must be evaluated through a security-first lens. When in doubt, do
less and ask.

### Non-Negotiable Rules

1. **No secrets in the repo — ever.** All credentials live in Cloudflare Worker
   secrets set via `wrangler secret put`. Never in source files. `.env` is in
   `.gitignore`.

2. **Coach auth is GitHub OAuth only.** The Worker validates the coach's numeric
   GitHub user ID server-side on every protected request. No other auth path
   exists for coach access.

3. **All API calls route through the Cloudflare Worker.** The browser never
   calls external APIs directly. The Worker validates auth before any KV access.

4. **No sensitive player data.** Profiles contain coaching notes, session
   history, and LTTDP data only. No financial information, no payment data,
   no SSNs or government IDs — ever.

5. **HTTPS only.** No HTTP fallback.

6. **CSP headers on every Worker response.** No inline scripts. No `eval()`.

7. **No CDN-loaded libraries.** All JS is loaded from `'self'` only.

8. **Generic error messages.** Never expose stack traces or KV key names in
   responses.

9. **Principle of least privilege.** GitHub OAuth app: read-only profile scope
   only.

### Intentional Security Tradeoffs (Documented)

- **Email-only player auth:** Anyone with a player's email can view their
  profile. Accepted tradeoff — data is coaching notes only, not sensitive.
- **Hidden coach URL:** `/coach` page is not linked anywhere. Security through
  obscurity supplements OAuth — finding the URL still requires Cooper's GitHub
  account to pass auth.

---

## Architecture

```
Browser
  ↓ static files served from
Cloudflare Pages (ctt-academy.pages.dev)
  ↓ all /api/* requests go to
Cloudflare Worker (ctt-worker.andermd535.workers.dev)
  ↓
Cloudflare KV (CTT_KV) — all data storage
```

### Two User Types

**Coach (Cooper):**
- Accesses via private bookmark: `https://ctt-academy.pages.dev/coach`
- `coach.html` redirects to GitHub OAuth on the Worker
- Worker validates numeric GitHub user ID against `OWNER_GITHUB_ID` secret
- Session cookie: 32-byte random token, 7-day TTL, HttpOnly/Secure/SameSite=None
- Full read/write access to all data

**Players/Parents:**
- Enter email on landing page → Worker looks up `email-index:{email}` in KV
- One match → straight to profile; multiple matches → selector screen (parents)
- Player ID stored in sessionStorage (clears on tab close)
- Read-only access to their own profile, LTTDP, and sessions only

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Static HTML + CSS + Vanilla JS (no framework, no build step) |
| Hosting | Cloudflare Pages |
| Backend / Auth | Cloudflare Worker |
| Data | Cloudflare KV |
| Coach Auth | GitHub OAuth |

**Do not introduce React, Next.js, or any frontend framework without discussion.**

---

## File Structure

```
CTTAcademy/
├── index.html          # Landing page — email login + "View as Guest"
├── home.html           # Public home — placeholder for future reels/blog
├── register.html       # Player self-registration
├── profile.html        # Player read-only view (profile + LTTDP + sessions)
├── select.html         # Multi-player selector (parents with multiple kids)
├── coach.html          # Hidden redirect → GitHub OAuth (Cooper's bookmark)
├── dashboard.html      # Coach player list (protected)
├── player.html         # Coach player editor + LTTDP editor (protected)
├── session.html        # Session log form + last-session reminder (protected)
├── about.html          # About Me tab (fetches from Worker)
├── store.html          # Store tab (placeholder)
├── education.html      # Education tab (placeholder)
├── linktree.html       # Link Tree tab (Instagram, TikTok, LinkedIn)
├── guest.html          # Legacy — superseded by home.html
├── css/
│   └── style.css       # Single stylesheet for all pages
├── js/
│   ├── auth.js         # Session management, auth guards, redirect logic
│   ├── api.js          # Fetch wrapper — X-Player-Id injection, 401 handling
│   ├── index-page.js   # Landing page — email lookup, state switching
│   ├── register.js     # Registration form
│   ├── profile.js      # Player profile view
│   ├── select.js       # Parent profile selector
│   ├── home.js         # Home page (checks if player already signed in)
│   ├── about.js        # About Me (fetches from /api/guest/info)
│   ├── dashboard.js    # Coach dashboard
│   ├── player.js       # Coach player editor
│   └── session.js      # Session log (create + edit mode)
├── worker/
│   └── index.js        # Cloudflare Worker — all backend logic
├── wrangler.toml       # Worker config + KV binding (no secrets)
├── .gitignore
├── README.md           # Deployment runbook
├── CLAUDE.md           # This file
└── lastsessionssummary.txt  # Detailed session log from June 2026 build
```

---

## KV Data Schema

```
player:{playerId}             Full player object
email-index:{email}           Array of playerIds linked to that email
lttdp:{playerId}              LTTDP object (4 sections)
sessions:list:{playerId}      Ordered array of session IDs (newest first)
session:{sessionId}           Individual session object
players:all                   Array of all player IDs (for dashboard)
owner:session:{token}         Coach session (32-byte random token, 7-day TTL)
oauth:state:{state}           CSRF protection for OAuth (10-min TTL)
```

Player and session IDs are UUID v4. Email keys are always lowercased + trimmed.

---

## Worker Routes

All responses include CSP, X-Content-Type-Options, X-Frame-Options, and
Referrer-Policy headers. CORS is locked to `ctt-academy.pages.dev` and
`cooperteachestennis.github.io` only.

| Route | Auth | Description |
|---|---|---|
| GET /api/auth/github | none | Initiates GitHub OAuth |
| GET /api/auth/callback | none | Completes OAuth, sets session cookie |
| GET /api/auth/check | cookie | Returns `{authenticated: bool}` |
| POST /api/auth/logout | cookie | Clears session |
| POST /api/player/lookup | none | Email → player summaries |
| POST /api/player | none | Create player (registration) |
| GET /api/player/:id | cookie or X-Player-Id | Get player |
| PUT /api/player/:id | cookie | Update player (coach only) |
| GET /api/players | cookie | All players (coach dashboard) |
| GET /api/lttdp/:id | cookie or X-Player-Id | Get LTTDP |
| PUT /api/lttdp/:id | cookie | Update LTTDP (coach only) |
| GET /api/sessions/:id | cookie or X-Player-Id | Get session list |
| GET /api/sessions/:id/latest | cookie | Most recent session (reminder panel) |
| POST /api/session | cookie | Create session (coach only) |
| PUT /api/session/:id | cookie | Edit session (coach only) |
| GET /api/guest/info | none | Static Cooper bio/info |

---

## Worker Secrets

Set via `wrangler secret put` — never appear in any file:

| Secret | Description |
|---|---|
| `GITHUB_CLIENT_ID` | OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | OAuth app client secret |
| `OWNER_GITHUB_ID` | Numeric GitHub user ID of the coach (currently Mitch: 283034047) |

KV binding name: `CTT_KV`
KV Namespace ID: `945aa45b37d94e22a71a5271a004b50c`
KV Preview ID: `ddf7b4d41a964abc8995343066cec6a1`

---

## Feature Scope

### Built and Live

- Player email lookup and self-registration
- Parent/multi-player support (one email → multiple player profiles)
- Player profile view (read-only): contact info, NTRP, improvement goals
- LTTDP: Goals / Technical Skills / Patterns & Plays / On-Off Season
- Session notes: Cooper logs, players read
- Last-session reminder on session log form
- Coach dashboard: player list with search, add/edit players
- Coach player editor: profile edit + LTTDP editor + session history
- Public nav: Home, Player Profile, Store, Education, Link Tree, About Me
- Placeholder pages: Store, Education (coming soon)
- Link Tree: Instagram, TikTok, LinkedIn
- About Me: fetched from Worker

### Not Built — Do Not Add Without Discussion

- Scheduling
- Payments
- File or video uploads
- Email notifications
- Blog/newsletter system
- Merch store backend

---

## Deploying Changes

```bash
# Backend changes (worker/index.js):
wrangler deploy

# Frontend changes (any HTML/CSS/JS):
wrangler pages deploy /Users/mitchanderson/CTTA --project-name ctt-academy --commit-dirty=true

# Keep GitHub repo in sync:
git add -A && git commit -m "description" && git push origin main
```

Worker and Pages deploy independently. Always push to GitHub to keep the repo
in sync with what's live.

---

## Working with Claude

### Context
- Mitch Anderson builds and maintains this. Cooper is the end user / domain expert.
- Cooper is not a coder — plain language explanations required for anything
  he needs to understand or operate.
- Mitch prefers to set a clear plan and let Claude work autonomously.
- Security concerns always pause the work — flag before building.

### Rules
- Never commit `.env` files or secrets
- Never add packages without explaining what they do and why
- Never build beyond the listed feature scope without explicit instruction
- Prefer the simplest solution that works
- No inline scripts in HTML (CSP requirement)
- All JS files are external, loaded via `<script src="...">` tags only

---

## Deployment Checklist

Before any push to `main`:
- [ ] No secrets or API keys in any file
- [ ] No `console.log` statements in production code
- [ ] No inline `<script>` blocks in any HTML file
- [ ] Worker deployed: `wrangler deploy`
- [ ] Pages deployed: `wrangler pages deploy ...`
- [ ] GitHub pushed: `git push origin main`

---

## Live URLs & Infrastructure

| Item | Value |
|---|---|
| Live site | https://ctt-academy.pages.dev |
| Worker | https://ctt-worker.andermd535.workers.dev |
| Coach login | https://ctt-academy.pages.dev/coach (bookmark only — not linked) |
| GitHub repo | https://github.com/CooperTeachesTennis/CTTAcademy |
| Cloudflare account | andermd535@gmail.com (Mitch) |

**Future:** Custom domain (`cooperteachestennis.com`) via Cloudflare when ready.

---

## Pending / Next Steps

1. Confirm Cooper's real social media URLs → update `linktree.html`
2. Update About Me content in `worker/index.js` → `handleGuestInfo()` with
   Cooper's real bio
3. Custom domain setup through Cloudflare dashboard
4. Transfer `OWNER_GITHUB_ID` to Cooper's GitHub account when he has one
5. GitHub Pages on CooperTeachesTennis/CTTAcademy requires Cooper to enable
   in repo Settings (org admin access — Mitch can't do it)

---

## Update Log

| Date | Change |
|---|---|
| May 2026 | Initial CLAUDE.md created |
| June 2026 | Full Phase 1 built and deployed — see lastsessionssummary.txt |
