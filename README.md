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
- The **朋友圈** sidebar entry supports local posts, likes and comments; users can explicitly ask the active character to write or reply. Automatic activity is opt-in and consumes model tokens when enabled.
- **从当前聊天提炼便签** suggests up to three long-term memories. They are saved only after the user reviews and confirms them. Per-character notes are scoped to their character.
- Data stays under `xy.purr.*` in localStorage (included in the existing XY data export). No Purr/Python backend, operating-system push, persistent background worker or cross-device synchronization is added. Scheduled actions run only while the page is open.
- The chat rhythm and moments ideas are inspired by [purr](https://github.com/2005selene2005-a11y/purr) (MIT License, copyright 2026 purr contributors). This implementation is original JavaScript adapted to the existing XY frontend.
