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
- microphone recording with OpenAI-compatible audio transcription
- ElevenLabs playback through a connected `text_to_speech` MCP tool
- zero build step: plain HTML/CSS/JS

Open `index.html` directly, or deploy the repository as a static site.

API proxy notes live in `workers/README.md`.

## Natural chat and moments (Purr-inspired)

- `purr-mode.js` adds a local, debounced auto-reply mode (5s by default, configurable in **Settings → 自然聊天**). The existing **直接回答** action remains available.
- Replies containing multiple natural paragraphs are revealed in sequence; one backend assistant message is preserved for model history and regeneration. Markdown/code is not forcibly split.
- New user messages can be queued while a request is running; if additional messages arrive, an obsolete model response is discarded and a fresh reply is scheduled.
- **首页底部五栏 → 朋友圈** opens the social feed directly in one tap, replacing the former bottom Tools tab. The sidebar **工具中心** and Home's "Keep exploring" entry remain; Moments is not duplicated inside the Tool Hub. Posts, likes, and comments stay local; model-powered posting/replies are explicit and automatic activity is opt-in.
- **从当前聊天提炼便签** suggests up to three long-term memories. They are saved only after the user reviews and confirms them. Per-character notes are scoped to their character.
- Data stays under `xy.purr.*` in localStorage (included in the existing XY data export). No Purr/Python backend, operating-system push, persistent background worker or cross-device synchronization is added. Scheduled actions run only while the page is open.
- The chat rhythm and moments ideas are inspired by [purr](https://github.com/2005selene2005-a11y/purr) (MIT License, copyright 2026 purr contributors). This implementation is original JavaScript adapted to the existing XY frontend.

## Startup and settings improvements (November 2026)

- The cold-start home view no longer builds all chat bubbles or runs full legacy timestamp migration before entering the chat tab. Existing chats remain stored; each conversation is backfilled only when opened.
- Local backup scans are deferred away from initial startup; hourly and manual backup protections remain available.
- Settings → 自然聊天 is included in the collapsed advanced-settings accordion.
- These changes reduce unnecessary startup work but are not an Android device benchmark. The app still loads existing frontend modules and requires a normal refresh to load updated assets.

- Bottom navigation has five items: 首页、对话、朋友圈、收藏、我. The direct Moments entry uses normal page navigation and works when restoring a Moments route after reload.
