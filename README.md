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

## Unified app background (November 2026)

- `background-scene.js` / `background-scene.css` mount one fixed application backdrop for the home tab and all home subroutes (Moments, favorites, personal page, Tool Hub, settings and other panels), instead of painting a different wallpaper per page.
- The chat keeps its original `#themeBackdrop`, wallpaper URL/upload, chat tint and blur controls. In **主题 → 应用背景**, the user can select a distinct URL/photo, choose an independent application base color, tune image overlay/blur, or opt into **聊天背景跟随应用背景**. This does not overwrite the saved chat wallpaper.
- Existing home/chat wallpaper imagery is used as the initial app image by reference. Only when the chat picture is changed for the first time does the app snapshot the former image, avoiding duplicate large data URLs on first startup. The app base color follows the theme palette until manually changed.
- Image imports reuse `theme-core.js` compression; saved image configuration uses `xy.appBackground.v1` in localStorage, included in existing XY backups. No remote image service or extra model call is required.
- This is a static frontend change; end-to-end Android WebView wallpaper rendering and memory usage have not been benchmarked.

## 对话泡泡 · Keepsake（2026-11-12）

- 首页底部 **收藏 → 对话泡泡 → 泡泡池**。原单句收藏、表情包和工具收藏不动；旧的 xy.quoteFavorites.v1 数据仍然保留。单句收藏提供「扩成泡泡」。
- 聊天长按消息 → **存成泡泡 · 多选**，最多勾 30 段；可以写名字、前情，并决定下次聊天是否通知角色。独立数据键 xy.keepsake.bubbles.v1 储存原文快照、原聊天/消息指针、前后文、双方前情、留言和回复关系。
- AI 角色可以在自然回复末尾使用 ⟪封存:标题|原文开头|原文结尾|当时经过⟫ 自己封存；⟪泡:kID|留言⟫ 留言；⟪前情:kID|经过⟫ 补前情。一次最多执行两个标记；成功返回可打开的泡泡卡，失败留下明确的「没封上」原因。没有定时催促。
- **发给角色**是单独的选项；只留在泡泡里的私人留言不会发送给模型。收到有效 AI 留言时会实际保存至本地，而不是仅口头承诺。无需增加额外的模型调用轮次。
- 泡泡池为轻量 CSS 漂浮动画，只在打开页面时建立；展示最近最多六颗和起雾较重最多三颗，并配搜索列表。3 天后开始起雾、83 天达到最大；打开或留言会清亮。保留深浅色、减少动态效果兼容。这不是原项目的 three.js 物理玻璃版本。
- 数据管理器支持按 ID 合并导入收藏泡泡和旧单句收藏；备份依然可导出全部 xy. 数据。
- 设计参考开源项目 [Cheiineeey/keepsake](https://github.com/Cheiineeey/keepsake)（MIT）；砚屿针对现有本地数据模型重新实现。尚未经过用户安卓 WebView 实机回归。
