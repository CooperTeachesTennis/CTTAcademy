# Cooper Teaches Tennis — Coach User Guide

*For Cooper Anderson. Updated at the end of each development session.*

---

## Logging In

You access the dashboard through a private bookmark — the URL is not linked anywhere on the public site.

**Bookmark:** `https://ctt-academy.pages.dev/coach`

Visiting that URL sends you to GitHub to confirm your identity. If you're already signed into GitHub on that device, it's usually one tap on "Authorize." Once authorized, you're taken straight to your dashboard.

**Your session lasts 7 days.** On most days the dashboard just opens from the bookmark with no login step. When your session expires, open the bookmark and tap Authorize again.

**Sign out:** Click "Sign out" in the top-right corner of any coach page.

---

## The Dashboard

The dashboard is your home base. It shows:

### Analytics Panel
At the top of the page, three stats:
- **Active Players** — total number of active players on your roster
- **Sessions Taught** — total unique sessions logged (group lessons count as one session, not one per player)
- **Inactive** — number of inactive players (only shown if you have any)

Below the stats, an **NTRP breakdown** shows how many active players are at each level (e.g. "3.0: 4 · 3.5: 6").

### Player List
All active players listed alphabetically by last name.

**Search:** Type in the search bar to filter by name in real time.

**Show Inactive:** Check the "Show inactive players" box to reveal inactive players in the list. They appear greyed out with an "Inactive" badge.

### Buttons
- **Export CSV** — downloads a spreadsheet of all active players (name, email, phone, NTRP level, goals, member since). Use this for email announcements, newsletters, or discount offers in Mailchimp or any email tool.
- **+ Add player** — opens a form to manually register a new player.

---

## Adding a Player

Click **+ Add player** on the dashboard.

Fill in:
- First name, last name, email, phone — all required
- NTRP level — optional
- What they want to improve — optional

Click **Create Player**. The player is added to your roster and you're taken to their profile page.

> Players can also register themselves by visiting the site and entering their email. If no profile is found, they're offered the option to create one.

---

## Viewing and Editing a Player

Click **View** on any player card to open their profile page.

### Player Info
Displayed in read-only view by default. Click **Edit** to update:
- Name, email, phone, NTRP level, improvement goals

Click **Save** to confirm or **Cancel** to discard.

### Marking a Player Inactive / Reactivating
In the Player Info section, there's a **Mark Inactive** button next to the Edit button.

- **Mark Inactive** — removes the player from your active roster and export list. All their session history and LTTDP is preserved. Use this when a player stops lessons — if they come back, you can pick up right where you left off.
- **Reactivate** — appears in place of Mark Inactive for inactive players. One click brings them back to your active roster.

> When an inactive player logs into the site, they see a message letting them know their profile is inactive and to contact you to resume.

### Deleting a Player
In the Player Info section, there's a red **Delete** button.

Click it and confirm the dialog to permanently remove the player and all their data — profile, LTTDP, and every session. **This cannot be undone.** Use Mark Inactive instead if you might want their history later. Only delete if you're sure the record is no longer needed (e.g. a test profile or a data entry mistake).

### Long-Term Tennis Development Plan (LTTDP)
Four sections: Goals, Technical Skills, Patterns & Plays, On/Off Season.

Click **Edit** in the LTTDP card to fill in or update any section. Click **Save** when done. Players see this in read-only view on their own profile.

### Session History
All logged sessions appear below the LTTDP, newest first. Each entry shows the date, duration, topics covered, and notes. Group sessions show a "Group · N players" badge.

Click **Edit** on any session to update it.

Click **+ Log session** at the top of the page to add a new session for this player.

---

## Logging a Session

From the dashboard, click **Log session** on a player card. Or from a player's profile page, click **+ Log session**.

### Last Session Reminder
Before the form, you'll see the most recent session you logged for this player — date, topics, and notes. This is your recap before writing new notes.

### Individual Session
Fill in:
- **Date** — defaults to today
- **Duration** — in minutes
- **Topics covered** — a short summary (e.g. "Backhand, serve mechanics, footwork")
- **Session notes** — your full notes for the session

All fields are required. Click **Log Session** to save.

### Group Lesson
Check the **Group lesson** box to switch to group mode.

**Selecting players:**
- A searchable player list appears. Type a name to filter it.
- Check the box next to each player in the session. The player you started from is pre-checked.
- Selected players appear as green chips at the top (e.g. "Sarah J. ×"). Click × on a chip to remove someone.

**Notes:**
- **Shared notes** — shown to every player in the session on their profile. Write what the group worked on.
- **Additional notes per player** — optional. A separate text box appears for each selected player. Use this for anything specific to one person that you don't want shown to the rest of the group.

Click **Log Group Session** to save. One session record is created per player, all linked together.

---

## Editing a Session

From a player's profile page, click **Edit** on any session entry.

**Individual session:** All fields are editable — date, duration, topics, notes.

**Group session:** You can edit:
- Date, duration, and topics
- **Shared notes** — your changes here update the notes for every player in that group session automatically
- **Personal notes for [player name]** — edits only that player's individual notes

---

## What Your Players See

When a player logs in with their email, they see their profile in read-only view:
- Their contact info and NTRP level
- Their LTTDP (all four sections, as you've filled them in)
- Their full session history, newest first — each session shows the date, duration, topics, and your notes. Group sessions show shared notes plus any personal notes you wrote specifically for them.

Players cannot edit anything. They cannot see other players' profiles.

**Parents** who provided their email during registration see a player selector when they log in, letting them pick which child's profile to view.

---

## Managing Your Roster Over Time

| Situation | What to do |
|---|---|
| New player starting lessons | Add them from the dashboard (or they self-register) |
| Player takes a break | Mark Inactive on their profile |
| Player comes back | Reactivate on their profile — all history is intact |
| Player info changes (email, phone) | Edit on their profile page |
| Sending an announcement or newsletter | Export CSV → import into your email tool |

---

---

## Resources Page

The **Resources** tab is visible to everyone — players, parents, and visitors. You manage its content when you're signed in as a coach.

### What you can put there
- **Discount Codes** — type codes one per line, exactly as you want players to see them (e.g. "Tennis Warehouse — use code CTT10 for 10% off").
- **Player Resources** — a list of links. Each link has a label, a URL, and an optional description. Use this for Google Sheets you maintain for players, your book, or any other external resource.

### Editing the Resources page
1. Open the Resources tab while signed in as a coach.
2. An **Edit** button appears at the top right — click it.
3. Update the Discount Codes box and add/remove links as needed.
4. Click **Save**. Changes go live immediately.

### Bold formatting
Both sections support bold text. Select the text you want to bold, then click the **B** button above the Discount Codes box (or next to the description field for links). The selected text displays as bold when players view the page.

Players and guests see the content in read-only view without the Edit button.

---

## Quick Reference

| Page | How to get there |
|---|---|
| Dashboard | Open your bookmark: `https://ctt-academy.pages.dev/coach` |
| Player profile | Dashboard → View on any player card |
| Log a session | Dashboard → Log session · or · Player profile → + Log session |
| Add a player | Dashboard → + Add player |
| Export player emails | Dashboard → Export CSV |
| Edit Resources | Resources tab (while signed in as coach) → Edit |
