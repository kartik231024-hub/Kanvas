# Kanvas Studio

A separated front-end editor with a local Gemini image-generation proxy.

## Files

- `index.html` - app markup
- `styles.css` - editor styling
- `app.js` - editor interactions, animations, templates and AI panel
- `server.mjs` - local static server and secure Gemini proxy

## Start it

1. Install Node.js 18 or newer.
2. Copy `.env.example` to a new file named `.env` in this same folder. Open `.env` and paste your key after `GEMINI_API_KEY=`. Do not add the key to `app.js` or `index.html`.

3. Start the app:

   `node --env-file=.env server.mjs`

4. Open `http://localhost:3000` in your browser.

## Gemini model

The default is `gemini-2.5-flash-image`. To use another image-capable Gemini model, set this before starting:

`$env:GEMINI_IMAGE_MODEL="gemini-3.1-flash-image"`

Your API key is read only by `server.mjs`; it is never sent to or saved in browser JavaScript.
