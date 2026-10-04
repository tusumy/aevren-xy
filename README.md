# Aevren XY

A quiet, mobile-first chat frontend for Aevren and Amao.

## v0.1
- responsive chat shell
- local conversation history
- per-character memory with cross-chat recall
- journal, character, theme, MCP and settings surfaces
- localStorage persistence
- optional Cloudflare Worker API proxy for endpoints that need CORS help
- direct API connections stay native unless a proxy is explicitly configured
- zero build step: plain HTML/CSS/JS

Open `index.html` directly, or deploy the repository as a static site.

API proxy notes live in `workers/README.md`.
