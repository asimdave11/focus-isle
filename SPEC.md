# Focus Isle — spec

A Forest-style focus timer. Focus for a set time and a pixel-art building or tree grows on your island. Leave the app and it dies.

## Interview answers (2026-10-11)
| Question | Answer |
|---|---|
| Devices | MacBook + iPhone |
| Approach | Installable web app (PWA) |
| What grows | Pixel-art world (island with trees and buildings) |
| Strictness | Dies if you leave the app for more than ~10 s. **Changed 2026-10-11:** off by default, so you can use any app or window your task needs; only Give up withers. Strict mode is an optional setting |
| v1 extras | Tags, stats & history, streaks & unlocks, sounds + breaks |
| Hosting | GitHub Pages |
| Sync | None in v1. Data stays on each device; JSON export/import |

## MVP scope
- **Focus**: duration 5–180 min, pick a tag, countdown, the tag's object builds up row by row.
- **Tag → object**: each tag builds its own object (Study → Library, Work → Cottage, Skill dev → Windmill, Wellbeing → Cherry, Other → Oak). Change it in Shop or Settings. The island legend counts per tag. **Other** asks what the session is for (required, with recent answers to pick from); that label is saved with the session and shown in history and stats.
- **Strict mode** (optional, off by default): the page goes hidden (app switch or tab switch) for longer than the grace period, and the session dies. The Mac option also counts window blur (switching to another app).
- **Island**: every finished session is placed on an island that grows organically, filtered by Today / Week / Month / All.
- **Size = time**: objects are drawn bigger for longer sessions: small under 20 min, normal 20–44, large 45–89 (2x2 plot), huge 90+ (2x2 plot). Withered ones are sized by the time you actually focused. The Focus screen previews the size as you change the length, and the Island screen shows a size key.
- **Stats**: totals, bar chart by hour/day/month, tag breakdown, success vs dead, history.
- **Streaks & coins**: 1 coin per focused minute. Streak = consecutive days with at least one finished session. Spend coins in the Shop to unlock objects (Pine, Lighthouse, Castle) and give them to a tag.
- **Animals**: Chicken 80, Duck 120, Pig 200, Sheep 250, Cow 350, Horse 500 coins. Once unlocked they wander between free tiles on the Island and Focus screens (8 fps hops, facing the way they walk; still when reduce motion is on; paused while the screen is hidden). They are not given to tags, and they sync like other unlocks.
- **Sounds**: rain, waves, brown noise and birds, generated with WebAudio (no assets). A chime at the end.
- **Notifications**: when a session or break ends while you're in another app (permission requested on the first Plant).
- **Breaks**: after a session, offer a short break (or a long break every 4th session).
- **PWA**: works offline and installs via Add to Home Screen. Keeps the screen awake during a session.

## Known limitation
A web app can't tell **locking the phone** apart from **switching apps**. Both kill the tree. The app keeps the screen awake and has a dim "deep focus" mode, so you never need to lock.

## Phase 2 (later)
- Friends and plant-together
- Native SwiftUI wrapper (Screen Time API app blocking)

## Design direction
"The island is the hero, the controls are the shore."
- **Palette:** Tide `#0e3440` (sea background), Shallows `#1f6f7a`, Sand `#f0dcae` (control sheet), Driftwood `#3b2a1e` (ink on sand), Sunlamp `#ffc93c` (the only accent: sun, coins, main action), Ember `#e5533d` (withered/give up).
- **Type:** Pixelify Sans for the timer and headings; Atkinson Hyperlegible for body text.
- **Signature:** a live sky on the Focus screen. Dawn, day, dusk or night follows the real clock, and the sun or moon moves along an arc as the session progresses.
- **Rules:** pixel-stepped corners instead of rounded ones, pixel-drawn dock icons (no emoji), the shop as a single list rather than a card grid, stats as a sentence rather than number tiles, and no "A · B" strings.

## Storage and data safety
Data lives in `localStorage` on each device, under the key `focusisle.v1`.
- **Merging saves:** each save merges sessions and purchases with what's on disk, keyed by id, so two tabs can't erase each other. Other tabs pick up changes live through the `storage` event.
- **Coins are derived:** coins = coins earned by sessions − purchases + a one-off migration adjustment, so merging two copies can never miscount them.
- **Epoch:** reset, import and restore change the `epoch`, so a merge can never bring back wiped data.
- **Corruption:** unreadable data is copied to `focusisle.corrupt.<time>` and never overwritten, and the app restores from the backup.
- **Automatic backup** (`focusisle.backup`): made daily, and before reset, import or restore. It never replaces a backup that has more sessions, and never replaces a real backup with an empty one.
- **Failed saves** show a red warning telling you to export.
- **Heartbeat:** `seenAt` is saved every 5 s during a session. A gap longer than the grace period (laptop asleep, app killed) counts as leaving, and focused time stops at the moment you left.
- **Persistence:** `navigator.storage.persist()` is requested, and its status is shown in Settings.
- **iPhone:** a Safari tab can lose script storage after 7 days without a visit, and the Home Screen app has separate storage. A banner tells Safari-tab users to install first.
- **Tested:** migration, close and reopen, corruption → restore, two tabs, killed session, failed save, and reset → restore (twice).

## Sync and Obsidian notes
- **Where:** the private repo `asimdave11/focus-isle-data`. `focus-isle.json` holds the shared history (sessions, purchases, unlocks, tags). Device settings and a running session never sync.
- **Token:** a fine-grained GitHub token, limited to that repo with Contents read/write, pasted once per device. It is stored under `focusisle.sync`, separate from the app data, so it never ends up in an export.
- **When it syncs:** when the app opens, after each session, 4 s after a change, when you come back to the app (at most every 30 s), and when the connection returns.
- **Merging:** sessions and purchases are combined by id. A new, empty device adopts the repo. When the epochs differ (after a reset, import or restore), the newer one wins and the losing side is backed up first; a deliberate reset is never undone. Tags follow the newest edit (`tagsAt`). A write rejected as stale (409) is re-read, merged and retried. If nothing changed, nothing is committed.
- **Daily notes:** `notes/YYYY-MM-DD Focus.md`, with frontmatter (date, focus_minutes, sessions, withered), a session table and totals per task. Times use a fixed 24-hour format, so devices don't keep rewriting each other's notes.
- **Mac → Obsidian:** `~/bin/focus-isle-obsidian.sh`, run every 10 minutes by `~/Library/LaunchAgents/com.asimdave.focus-isle-obsidian.plist`, pulls a clone in `~/.focus-isle-data` and copies the notes into `~/Documents/Obsidian Vault/Focus Isle/`. Log: `~/Library/Logs/focus-isle-obsidian.log`.
- **Guided setup:** on first open (when sync is off and setup hasn't been done or skipped), a 3-step flow appears before anything else: why to sync → "Open GitHub" with a pre-filled token form (name, description, 366-day expiry, Contents: write; the user only picks the repo) → paste (with a Paste from clipboard button) → connected, showing how many sessions were loaded. A "Not synced" (or "Sync paused") marker in the top bar reopens it.
- **After every session:** the finish popup shows "Saving to your repo…" and then "Saved to your repo". With sync off it says "Saved on this device only" and offers one-tap **Save backup file** and **Set up sync** buttons.
- **Testing:** `?api=http://127.0.0.1:PORT` points the app at a local mock API, and only works when the app itself runs on localhost.
