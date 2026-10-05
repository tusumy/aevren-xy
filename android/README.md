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
