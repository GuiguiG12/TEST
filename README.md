# G12 — Vite + Reown AppKit (Ethers v5 adapter)

This project is a **multi-page Vite** build (index/strategies/docs/access).

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages
- Build outputs to `dist/`.
- Configure Pages to serve the `dist` folder (or push `dist` to a `gh-pages` branch).

### IMPORTANT: base path
In `vite.config.js`, set:
- `base: '/TEST/'` if your repo is `TEST` and you deploy to `https://<user>.github.io/TEST/`
- otherwise set `base: '/'`

## Notes
- `metadata.url` uses `window.location.origin` as recommended (domain/subdomain match).
- AppKit button should render once `createAppKit()` runs.
