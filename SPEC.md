# Focus Isle — spec

A Forest-style focus timer. Focus for a set time and a pixel-art building or tree grows on your island. Leave the app and it dies.

## Interview answers (2026-10-11)
| Question | Answer |
|---|---|
| Devices | MacBook + iPhone |
| Approach | Installable web app (PWA) |
| What grows | Pixel-art world (island with trees and buildings) |
| Strictness | Dies if you leave the app for more than ~10 s |
| v1 extras | Tags, stats & history, streaks & unlocks, sounds + breaks |
| Hosting | GitHub Pages |
| Sync | None in v1. Data stays on each device; JSON export/import |

## MVP scope
- **Focus**: duration 5–180 min, pick a tag, countdown, the tag's object builds up row by row.
- **Tag → object**: each tag builds its own object (Study → Library, Work → Cottage, Coding → Windmill, Reading → Cherry, Other → Oak). Change it in Shop or Settings. The island legend counts per tag.
- **Strict mode**: the page goes hidden (app switch or tab switch) for longer than the grace period, and the session dies. The Mac option also counts window blur (switching to another app).
- **Island**: every finished session is placed on an island that grows organically, filtered by Today / Week / Month / All.
- **Stats**: totals, bar chart by hour/day/month, tag breakdown, success vs dead, history.
- **Streaks & coins**: 1 coin per focused minute. Streak = consecutive days with at least one finished session. Spend coins in the Shop to unlock objects (Pine, Lighthouse, Castle) and give them to a tag.
- **Sounds**: rain, waves, brown noise and birds, generated with WebAudio (no assets). A chime at the end.
- **Breaks**: after a session, offer a short break (or a long break every 4th session).
- **PWA**: works offline and installs via Add to Home Screen. Keeps the screen awake during a session.

## Known limitation
A web app can't tell **locking the phone** apart from **switching apps**. Both kill the tree. The app keeps the screen awake and has a dim "deep focus" mode, so you never need to lock.

## Phase 2 (later)
- Sync between devices (Supabase/Firebase + login)
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
