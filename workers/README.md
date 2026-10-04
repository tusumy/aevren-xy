# Aevren XY API Proxy (Cloudflare Worker)

This Worker is an optional CORS bridge for browser-hosted OpenAI-compatible APIs.

## Deploy

1. Create a Cloudflare Worker and paste `api-proxy.js` into the Worker editor.
2. Add at least one safety restriction in Worker Variables:
   - `ALLOWED_HOSTS`: comma-separated upstream hostnames, for example `freeapi.site,api.openai.com`
   - or `PROXY_KEY`: a private string you will also enter in Aevren XY's API settings.
3. Optional but recommended: set `ALLOWED_ORIGIN` to `https://tusumy.github.io`.
4. Deploy the Worker and copy its `https://...workers.dev` URL.
5. In Aevren XY → 设置 → edit the API → fill `代理地址`. If you configured `PROXY_KEY`, fill `代理密钥` too.

The original Base URL stays unchanged. Aevren XY uses the proxy only when a proxy URL is configured for that API.
