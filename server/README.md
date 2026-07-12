# Gream API server (Fáze 2)

Bezzávislostní Node server (stdlib). Běží na VPS Hetzneru za Caddy.

- **Veřejná URL:** `https://3rstudio.eu/api/gream/*` (Caddy `handle_path` strip prefix → `gream-api:8092`)
- **Kontejner:** `roman-storage-gream-api-1` (node:24-alpine), definice v `/opt/roman-storage/docker-compose.yml`
- **Kód na VPS:** `/opt/roman-storage/gream-api.js` (bind-mount, read-only) — tento soubor
- **Data:** `/opt/roman-storage/gream-data/{reports,battle,poi}.json`
- **CORS:** `*` (Gream běží na GitHub Pages = jiný origin)

## Endpointy (po strip_prefix)
- `GET  /health`
- `POST /report`          `{challengeId, world, difficulty, text, lang, reason, note, pid}`
- `POST /battle/opponent` `{difficulty, rating}` → `{name, score, rating, bot}`
- `POST /battle/result`   `{pid, name, difficulty, score, oppScore, win, oppRating}` → `{rating, rank, wins}`
- `GET  /battle/leaderboard`
- `POST /poi/done` `{poiId}` / `GET /poi/counts?ids=a,b`

## Aktualizace serveru
```
scp server/gream-api.js root@89.167.123.58:/opt/roman-storage/gream-api.js
ssh root@89.167.123.58 'cd /opt/roman-storage && docker compose restart gream-api'
```

## Kontrola reportů (k ladění otázek)
```
ssh root@89.167.123.58 'cat /opt/roman-storage/gream-data/reports.json' | python3 -m json.tool
```
