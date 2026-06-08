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
- **Coach session in sessionStorage (not HttpOnly cookie):** The coach session
  token lives in `sessionStorage` and is sent as an `X-Coach-Token` header.
  This means XSS could theoretically read it — mitigated by strict CSP
  (`script-src 'self'`, no inline scripts, no CDN). The tradeoff was forced by
  cross-site cookie blocking: the Worker (`*.workers.dev`) and Pages
  (`*.pages.dev`) are different domains, so HttpOnly cookies were blocked by
  Chrome and Safari regardless of `SameSite=None`. This approach is immune to
  CSRF. When a custom domain is set up with both on the same eTLD+1, this can
  be revisited.

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

**Coach (Cooper and Mitch):**
- Accesses via private bookmark: `https://ctt-academy.pages.dev/coach`
- `coach.html` redirects to GitHub OAuth on the Worker
- Worker validates numeric GitHub user ID against `OWNER_GITHUB_ID` secret (comma-separated list supports multiple coaches)
- Session token: 32-byte random token, 7-day TTL, stored in `sessionStorage` as `ctt_coach_token`, sent as `X-Coach-Token` request header
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
├── resources.html      # Resources tab — coach-editable discount codes + links
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
│   ├── session.js      # Session log (create + edit mode)
│   └── resources.js    # Resources page (public view + coach edit)
├── worker/
│   └── index.js        # Cloudflare Worker — all backend logic
├── wrangler.toml       # Worker config + KV binding (no secrets)
├── .gitignore
├── README.md           # Deployment runbook
├── CLAUDE.md           # This file
├── USER_GUIDE.md       # Plain-language guide for Cooper (coach) — update each session
└── lastsessionssummary.txt  # Detailed session log from June 2026 build
```

---

## KV Data Schema

```
player:{playerId}             Full player object (includes active: bool field)
email-index:{email}           Array of playerIds linked to that email
lttdp:{playerId}              LTTDP object (4 sections)
sessions:list:{playerId}      Ordered array of session IDs (newest first)
session:{sessionId}           Individual or group session object
players:all                   Array of all player IDs (for dashboard)
owner:session:{token}         Coach session (32-byte random token, 7-day TTL)
oauth:state:{state}           CSRF protection for OAuth (10-min TTL)
content:resources             Coach-editable resources page content (discountCodes + links array)
```

Player and session IDs are UUID v4. Email keys are always lowercased + trimmed.

### Player object fields
`id, firstName, lastName, email, phone, ntrpLevel, improvementGoals, parentEmail,
active (bool, default true), createdAt, updatedAt`
Old records without `active` are treated as `active: true` on read.

### Session object fields
Individual: `id, playerId, date, durationMinutes, topicsCovered, notes, createdAt, updatedAt`
Group: adds `isGroup: true, groupSessionId, groupSize, groupMemberSessionIds[], sharedNotes, individualNotes`
— `groupSessionId` links all player records from the same group lesson for analytics deduplication.
— `groupMemberSessionIds` allows sharedNotes edits to propagate to all group members.

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
| DELETE /api/player/:id | cookie | Delete player + all data (coach only) |
| GET /api/players | cookie | All players; `?include_inactive=true` to include inactive |
| GET /api/analytics | cookie | Stats: active/inactive counts, NTRP distribution, unique session count |
| GET /api/lttdp/:id | cookie or X-Player-Id | Get LTTDP |
| PUT /api/lttdp/:id | cookie | Update LTTDP (coach only) |
| GET /api/sessions/:id | cookie or X-Player-Id | Get session list |
| GET /api/sessions/:id/latest | cookie | Most recent session (reminder panel) |
| POST /api/session | cookie | Create session (coach only) |
| PUT /api/session/:id | cookie | Edit session (coach only) |
| GET /api/guest/info | none | Static Cooper bio/info |
| GET /api/resources | none | Get resources page content |
| PUT /api/resources | cookie | Update resources page content (coach only) |

---

## Worker Secrets

Set via `wrangler secret put` — never appear in any file:

| Secret | Description |
|---|---|
| `GITHUB_CLIENT_ID` | OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | OAuth app client secret |
| `OWNER_GITHUB_ID` | Comma-separated numeric GitHub user IDs allowed coach access (Mitch: 283034047, Cooper: set Jun 2026) |

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
- Coach dashboard: player list with search, add player
- Coach player editor: static view with Edit toggle for profile + LTTDP independently; session history with edit links
- Coach nav mirrors public nav: Home | Your Players | Store | Education | Resources | Link Tree | About Me
- Public nav: Home | Player Profile | Store | Education | Resources | Link Tree | About Me
- When coach token is in sessionStorage, public pages auto-swap "Player Profile" → "Your Players" and "Sign In" → "Sign out" via auth.js DOMContentLoaded hook
- Placeholder pages: Store, Education (coming soon)
- Link Tree: Instagram, TikTok, LinkedIn
- About Me: fetched from Worker
- Coach login hidden at `/coach` (not linked from anywhere)
- **Active/inactive players:** Coach toggles per-player on player.html; inactive badge +
  greyed-out card on dashboard; "Show Inactive" toggle; one-time modal on profile.html
  for inactive players; registration blocked with tailored message for inactive email;
  select.html shows Inactive badge for inactive players in parent selector
- **Group sessions:** "Group lesson" toggle on session form; multi-player checkbox list
  with real-time filter input and selected-player chips (click × to deselect); shared
  notes + optional per-player individual notes; all records linked by `groupSessionId`;
  edit mode shows shared notes (propagates to all group members) + this player's individual notes
- **Analytics panel:** Stats cards on dashboard — Active Players, Sessions Taught
  (deduplicated by groupSessionId), Inactive count (shown when > 0); NTRP breakdown chips
- **CSV export:** "Export CSV" button on dashboard — active players only, dated filename,
  pure JS (no libraries)
- **Delete player:** Red "Delete" button on player.html; requires confirm dialog; full KV
  cleanup (player record, email-index, lttdp, sessions, players:all); coach-only via DELETE /api/player/:id
- **Resources page:** `resources.html` / `js/resources.js` — public read-only view; coach
  can edit via Edit button (shown only when coach token present); sections: Discount Codes
  (free-form text, B button for bold) and Player Resources (label+URL+description link list,
  manual `**asterisks**` for bold in descriptions); stored as `content:resources` in KV;
  GET /api/resources (public) and PUT /api/resources (coach)
- **Nav coach swap:** `auth.js` auto-detects coach token on DOMContentLoaded and swaps
  "Player Profile" tab → "Your Players" (dashboard.html) on public pages; also swaps
  "Sign In" top-nav link to "Sign out" behavior

### Known Issues / Flagged for Future Session

- Parent/guardian account model needs redesign. Field exists in data model and
  player self-registration but removed from coach UI until the flow is rethought.
  Goal: one parent email → parent account with active/inactive control; child
  profiles as sub-records inheriting parent's status. Deferred — deserves its own session.

### Not Built — Do Not Add Without Discussion

- Scheduling
- Payments
- File or video uploads
- Email sending / newsletter system (CSV export covers distribution list use case)
- Blog/newsletter system
- Merch store backend
- Coach editing privileges on Home, Store, Education, About Me pages (planned but not built)
- Instagram Reels on About Me page (discussed; deferred until Cooper decides he wants it)

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
- Update `USER_GUIDE.md` at the end of every session when new coach-facing features are added

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
4. ~~Transfer `OWNER_GITHUB_ID` to Cooper's GitHub account~~ — Done. Both Mitch
   and Cooper have coach access via comma-separated `OWNER_GITHUB_ID` secret.
5. GitHub Pages on CooperTeachesTennis/CTTAcademy requires Cooper to enable
   in repo Settings (org admin access — Mitch can't do it)

---

## Update Log

| Date | Change |
|---|---|
| May 2026 | Initial CLAUDE.md created |
| June 2026 | Full Phase 1 built and deployed — see lastsessionssummary.txt |
| June 2026 | Coach nav unified with public nav; static view/edit toggle on player page; coach login hidden at /coach; CORS + auth URL fixes |
| June 2026 | Switched coach auth from cross-site cookies to sessionStorage + X-Coach-Token header (fixes Chrome/Safari cookie blocking); added multi-coach support via comma-separated OWNER_GITHUB_ID; fixed session.html missing nav-back-link crash |
| June 2026 | Active/inactive players, group sessions, analytics panel, CSV export — see lastsessionssummary.txt |
| June 2026 | Group session player picker improved — filter input + selected-player chips |
| June 2026 | USER_GUIDE.md created — plain-language coach guide, updated each session |
| June 2026 | Delete player (coach-only), Resources page (coach-editable), nav coach swap fix |
| June 2026 | Visual design overhaul — Outfit font, OKLCH green palette, split-panel login, entry animations, nav/card/tab component updates; no functional changes |
