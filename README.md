# Cooper Teaches Tennis

A coaching management platform for Cooper Anderson. Players access their profiles, session notes, and Long-Term Tennis Development Plans. Cooper logs sessions and manages player data.

---

## Setup — Do This Before First Deploy

### 1. Create a Cloudflare account
Go to [cloudflare.com](https://cloudflare.com) and create a free account if you don't have one.

### 2. Install Wrangler (Cloudflare's CLI)
```bash
npm install -g wrangler
wrangler login
```

### 3. Create the KV namespace
```bash
# Production namespace
wrangler kv namespace create "CTT_KV"
# Copy the `id` value from the output — you'll need it in the next step

# Preview namespace (for local dev)
wrangler kv namespace create "CTT_KV" --preview
# Copy the `preview_id` value
```

### 4. Update wrangler.toml with the namespace IDs
Open `wrangler.toml` and replace:
- `REPLACE_WITH_KV_NAMESPACE_ID` → the `id` from the production namespace
- `REPLACE_WITH_KV_PREVIEW_NAMESPACE_ID` → the `id` from the preview namespace

### 5. Create two GitHub OAuth apps

**App 1 — Local development**
1. Go to GitHub → Settings → Developer Settings → OAuth Apps → New OAuth App
2. Fill in:
   - Application name: `CTT Dev`
   - Homepage URL: `http://localhost:8787`
   - Authorization callback URL: `http://localhost:8787/api/auth/callback`
3. Click "Register application"
4. Copy the **Client ID** and generate a **Client Secret**

**App 2 — Production**
1. Create another OAuth App
2. Fill in:
   - Application name: `Cooper Teaches Tennis`
   - Homepage URL: `https://YOUR-ACCOUNT.github.io/CTTA` (update with your actual URL)
   - Authorization callback URL: `https://ctt-worker.YOUR-ACCOUNT.workers.dev/api/auth/callback`
3. Copy the Client ID and generate a Client Secret

### 6. Find your GitHub numeric user ID
Go to: `https://api.github.com/users/CooperTeachesTennis`
Look for the `"id"` field — it's a number like `12345678`. This is your `OWNER_GITHUB_ID`.

### 7. Set Worker secrets
Run these commands and paste the values when prompted. **Never put these values in any file.**

For local dev (uses the dev OAuth app credentials):
```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put OWNER_GITHUB_ID
```

For production, the same command deploys to the live Worker. You may want to set these after deploying.

---

## Local Development

```bash
# Start the Worker locally
wrangler dev

# In a separate terminal, serve the static files
npx serve . -p 3000
```

The Worker runs at `http://localhost:8787`. The static site runs at `http://localhost:3000`.

**Important:** Update `API_BASE` in `js/api.js` to point to the Worker during local dev:
```js
const API_BASE = 'http://localhost:8787';
```
Reset this to `''` before deploying, or set it to your production Worker URL.

---

## Deploy

### Deploy the Worker
```bash
wrangler deploy
```
The Worker URL will be printed — something like `https://ctt-worker.YOUR-ACCOUNT.workers.dev`.

### Deploy the frontend (GitHub Pages)
1. Push all files to the `main` branch of your GitHub repository
2. Go to the repo on GitHub → Settings → Pages
3. Set Source to: `Deploy from a branch` → `main` → `/ (root)`
4. GitHub will publish the site at `https://YOUR-USERNAME.github.io/CTTA`

### Update the production API base URL
Once the Worker is deployed, update `js/api.js`:
```js
const API_BASE = 'https://ctt-worker.YOUR-ACCOUNT.workers.dev';
```
Commit and push.

---

## Pre-Deploy Checklist

- [ ] No API keys, tokens, or secrets in any file
- [ ] `.env` is in `.gitignore` (never committed)
- [ ] KV namespace IDs are in `wrangler.toml` (these are not secrets — safe to commit)
- [ ] All secrets set via `wrangler secret put`
- [ ] `API_BASE` in `js/api.js` points to the correct Worker URL
- [ ] Tested locally: player registration, email lookup, profile view, Cooper login, session log
- [ ] No `console.log` statements in production code

---

## Key Architecture Notes

**Two-user model:**
- **Cooper** authenticates via GitHub OAuth. His GitHub numeric user ID must be set as `OWNER_GITHUB_ID` in Worker secrets. Only this ID gets owner access — nobody else can log in as coach, regardless of what GitHub account they use.
- **Players** look up their profile by entering their email address. This is intentionally low-friction — the data is coaching notes only, not financial or sensitive personal information.

**Parent access:** When a player registers and provides a parent email, both emails are indexed in KV. A parent logging in with their email will see a profile selector listing all their kids' profiles.

**Session notes:** Cooper logs sessions from his dashboard. Players see the notes in read-only mode on their profile page. The session log form shows Cooper the most recent previous session before he writes new notes.

**LTTDP:** Cooper fills in the Long-Term Tennis Development Plan for each player from the player edit page. Players can read it on their profile.

---

## File Structure

```
CTTA/
├── index.html          ← Landing page (email login)
├── register.html       ← Player self-registration
├── profile.html        ← Player's view (read-only)
├── select.html         ← Multi-player selector (for parents)
├── guest.html          ← Public info page
├── dashboard.html      ← Cooper's player dashboard
├── player.html         ← Cooper's player editor + LTTDP
├── session.html        ← Session log form
├── css/style.css       ← All styles
├── js/
│   ├── auth.js         ← Session management, auth guards
│   ├── api.js          ← API fetch wrapper
│   ├── index-page.js   ← Landing page logic
│   ├── register.js     ← Registration form
│   ├── profile.js      ← Player profile view
│   ├── select.js       ← Profile selector
│   ├── guest.js        ← Guest info page
│   ├── dashboard.js    ← Coach dashboard
│   ├── player.js       ← Player editor
│   └── session.js      ← Session log
├── worker/index.js     ← Cloudflare Worker (all backend logic)
├── wrangler.toml       ← Worker configuration
├── .gitignore
├── CLAUDE.md           ← Project spec and AI coding instructions
└── README.md           ← This file
```
