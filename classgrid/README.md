# ClassGrid

Snap a photo of your COR/registration form, get an offline weekly timetable.

## Deploy (Netlify — same flow as your other PWAs)

1. Push this folder to a GitHub repo (or drag-drop the folder into Netlify's deploy UI).
2. In Netlify: **Site settings → Environment variables** → add
   - `GEMINI_API_KEY` = your Gemini API key (free — get one at
     https://aistudio.google.com/apikey)
3. Deploy. Netlify auto-detects `netlify.toml` and serves the function at
   `/.netlify/functions/parse-schedule`.
4. Open the deployed URL on your phone → browser menu → **Add to Home Screen**.
   Once installed, the app shell (HTML/CSS/JS/icons) is cached by the service
   worker and works fully offline. Only *scanning a new COR* needs internet
   (it calls Gemini to read the image); viewing/editing your saved schedule
   never needs a connection.

## How it works

- `index.html` / `app.js` / `styles.css` — the installable PWA shell.
- `sw.js` — caches the shell on first load so it works offline after install.
- `netlify/functions/parse-schedule.js` — serverless function that sends
  your COR image to Gemini (2.5 Flash, vision) with a prompt that specifically
  handles the "Thu/Fri" + "08:00 PM-09:00 PM/08:00 PM-09:00 PM" slash-paired
  format, and returns one row per actual session.
- Your parsed schedule is saved in `localStorage` only — nothing is stored
  server-side, and no accounts.

## Notes

- If a COR has an unusual layout, just tap Remove on any wrong rows and
  re-scan — new scans can either replace or append to what's already saved.
- Swap `gemini-2.5-flash` for a different Gemini model string (e.g.
  `gemini-2.5-pro`) in `parse-schedule.js` if you want higher accuracy on
  messier scans, at the cost of speed/free-tier quota.
