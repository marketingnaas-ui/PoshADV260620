# ClearAdvance Pro V2

**GitHub Repository:** https://github.com/marketingnaas-ui/advc1

## Run Locally

Prerequisite: Node.js

1. Install dependencies:
   `npm.cmd install`
2. Optional: copy `.env.example` to `.env` and set `GEMINI_API_KEY` for real Gemini OCR.
3. Run the app:
   `npm.cmd run dev`
4. Open:
   `http://127.0.0.1:3000`

PowerShell on some Windows machines blocks `npm.ps1`, so use `npm.cmd` as shown above.

If port 3000 is already in use:

```powershell
$env:PORT="3001"; npm.cmd run dev
```

## Commands

- `npm.cmd run lint` checks TypeScript.
- `npm.cmd run build` builds the frontend and production server.
- `npm.cmd start` runs the production build after `npm.cmd run build`.
- `npm.cmd run clean` removes generated build output.
