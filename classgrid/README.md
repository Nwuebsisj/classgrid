# ClassGrid

Snap a photo of your COR/registration form, get a responsive weekly timetable —
sidebar layout on desktop/laptop, bottom-nav layout on phone, installable as
an offline PWA.

## Deploy (Netlify)

1. Push this folder to a GitHub repo (or drag-drop the folder into Netlify's deploy UI).
2. In Netlify: **Site settings → Environment variables** → add
   - `GEMINI_API_KEY` = your Google AI Studio key (free tier at
     https://aistudio.google.com/apikey)
3. Deploy. Netlify auto-detects `netlify.toml` and serves the function at
   `/.netlify/functions/parse-schedule`.
4. On your phone: open the deployed URL in Safari → Share → **Add to Home Screen**.
   Once installed, the app shell is cached by the service worker and works
   fully offline. Only *scanning a new COR* needs internet.

## Layout

- **Below 900px** (phone) — top bar + bottom nav, single-column dashboard,
  horizontally scrollable weekly grid.
- **900px and up** (tablet/laptop/desktop) — left sidebar nav, 4-column
  dashboard stats, full 7-day week grid with no scrolling needed, centered
  modal for add/edit instead of a bottom sheet.

## Files

- `index.html` / `app.js` / `styles.css` — the installable PWA shell (sidebar
  + mobile nav, dashboard stats, weekly/daily schedule views, add/edit sheet).
- `sw.js` — caches the shell on first load so it works offline after install.
- `netlify/functions/parse-schedule.js` — serverless function that sends your
  COR image to Gemini 2.5 Flash with a prompt that handles the "Thu/Fri" +
  "08:00 PM-09:00 PM/08:00 PM-09:00 PM" slash-paired format, using a
  `responseSchema` (includes `desc`, `section`, `room`, etc.) so the model's
  JSON output is structurally enforced rather than just prompted for.
- Your parsed schedule is saved in `localStorage` only — nothing is stored
  server-side, and no accounts.

## Notes

- If a COR has an unusual layout, tap a card to edit it, or Remove and
  re-scan — new scans can either replace or append to what's already saved.
- PDFs aren't supported yet — the upload only accepts images. Gemini can
  accept PDFs via `inlineData` with `mimeType: 'application/pdf'`, so this is
  addable if you want it later (would need the `accept` attribute on the file
  input updated too, and a fallback for the thumbnail preview since `<img>`
  can't render a PDF).
