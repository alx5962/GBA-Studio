# Discord Activity Setup

## One-time Developer Portal registration

1. Go to https://discord.com/developers/applications → **New Application**
2. Name it "GBA Studio" (or your game's name).
3. Copy the **Application ID** — you'll put it in `index.html` where it says
   `YOUR_DISCORD_APP_ID_HERE`.
4. In the left sidebar → **Activities** → toggle **Activities** on.
5. Under **URL Mappings → Root Mapping**, paste your public HTTPS URL
   (GitHub Pages URL or a tunnel URL for development).

## Local development tunnel

Discord Activities must run on HTTPS. Use `cloudflared` during development:

```bash
# Install once
npm install -g cloudflared

# Point at your local dev server (e.g. VS Code Live Server on 5500)
cloudflared tunnel --url http://localhost:5500
```

Copy the `*.trycloudflare.com` URL → paste into the Developer Portal Root Mapping.
Paste the same URL into a Discord voice channel invite with `?rom=../player/roms/demo.gba`.

## Production deployment

Once `docs/` is served via GitHub Pages:

```
Root Mapping: https://eoinjordan.github.io/GBA-Studio/activity/
```

## Launching the activity

Add the activity to a voice channel via the Activities button (rocket icon), or
deep-link it with:

```
discord://-/channels/<guild_id>/<channel_id>?activity=<your_app_id>
```

## Passing a ROM URL to the activity

Append `?rom=<encoded-url>` to your Root Mapping URL.
The `index.html` reads this and passes it straight to EmulatorJS.

Example (from a Discord bot slash command):
```
https://eoinjordan.github.io/GBA-Studio/activity/?rom=https%3A%2F%2Fexample.com%2Fgame.gba
```

## Asset proxy

Inside a real Activity frame (`*.discordsays.com`) the page patches `fetch` and
`XMLHttpRequest` to route all external requests through `/.proxy/<url>`.
This is required by Discord — external CDN calls will be blocked otherwise.
