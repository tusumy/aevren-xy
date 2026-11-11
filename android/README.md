# Aevren XY Android shell

This module keeps the existing web UI and moves HTTP requests to Android native networking.

## Architecture

- UI: the published Aevren XY page in WebView
- JS bridge: `/native-bridge.js`
- Native transport: Kotlin + OkHttp
- Web fallback: normal fetch / Cloudflare Worker remains unchanged

The bridge supports JSON/text, binary responses and multipart FormData, so chat, model listing, MCP and speech-to-text requests can use native networking inside the APK.

## Build

GitHub Actions workflow: `Build Android APK`.

You can also build locally with Gradle 8.9 + JDK 17:

```bash
gradle -p android :app:assembleDebug
```

Output:

`android/app/build/outputs/apk/debug/app-debug.apk`

## Island splash refresh (2026-10-22)

The previous cottage drawing is removed from both the native loading curtain and adaptive launcher icon.
The native loading curtain now waits for the illustrated island WebView scene to finish loading before fading, and Android Back delegates to the island's navigation stack.
Install a newly built `app-debug.apk` over the currently installed `com.aevren.xy` to update native resources without clearing app data, provided Android accepts the matching signing key.

## Landscape island / portrait mobile update

The online island now uses a full-width desktop scene with location navigation, synchronized touch panning, and landmark backgrounds inside selected tools. The native loading curtain draws the same island scene image, rather than a text-only intermediate screen. The package name remains `com.aevren.xy` for upgrade compatibility.

## Pinch zoom / configurable HTML cards (2026-10-23)

Android WebView now enables built-in pinch-to-zoom with hidden zoom buttons; the webpage also preserves `pinch-zoom` during horizontal island navigation. HTML and role-status card glass can be disabled or adjusted independently through the theme panel. The previous blanket blur was removed from large content surfaces. Installing the rebuilt APK is necessary for native WebView settings to take effect. The app id remains unchanged for in-place upgrades.
