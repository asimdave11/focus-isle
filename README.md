# Focus Isle 🏝️

A Forest-style focus timer. Focus and a pixel tree or building grows on your island. Leave the app and it withers.

## Install
- **iPhone:** open the site in Safari → Share → **Add to Home Screen**.
- **Mac:** Safari → File → **Add to Dock** (or Chrome → Install app).

## Features
- Timer from 5 to 180 min, strict mode with a grace period, and Cancel within the first 10 s
- Each tag builds its own object (Study → Library, Skill dev → Windmill…; Other asks what the session is for). Unlock more with coins (1 coin per focused minute) and assign them to any tag
- Island view (Today / Week / Month / All), stats, tags, streaks
- Ambient sounds (rain, waves, brown noise, birds), short and long breaks
- Works offline. Data stays on each device; use Settings → Export/Import to move it

## Develop
```sh
python3 -m http.server 8765      # open http://127.0.0.1:8765/?speed=60  (60× time for testing)
python3 tools/make_icons.py      # regenerate icons
```
Bump `VERSION` in `sw.js` when shipping changes so installed apps update.

See [SPEC.md](SPEC.md) for scope and the phase 2 plan.
