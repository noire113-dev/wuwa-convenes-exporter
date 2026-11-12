# WuWa Convenes Exporter

[한국어](../README.md) | **English**
<img width="1280" height="876" alt="image" src="https://github.com/user-attachments/assets/9323f620-928d-4126-a280-78d6b4ef9d40" />

A tool that fetches your **Convene (gacha) history** from Wuthering Waves on PC, keeps it on your own computer, and shows per-banner statistics and charts.

Forked from [biuuu/genshin-wish-export](https://github.com/biuuu/genshin-wish-export) and rebuilt for Wuthering Waves with the same layout (pie charts + per-banner stats).

## Features

- Finds the Convene history URL in the game logs automatically
  - Recent clients store `Client.log` XOR-encrypted; it is decoded as well.
- The same 6 banners as the in-game Convene history page
  - Featured Resonator · Featured Weapon · Standard Resonator · Standard Weapon · Journey Resonator · Journey Weapon Convene
- Per-banner statistics
  - Total pulls, current pity, 5★/4★/3★ counts and rates
  - 5★ history with the pity of each pull, average 5★ pity
  - Featured Resonator Convene: standard 5★ (lost 50/50) shown in gray italics, plus 50/50 win count
- **Accumulating history**: the game server only shows roughly the last 6 months, but every update is merged into your saved history, so older records are kept. Duplicates are never added.
- Excel (.xlsx) export: one sheet per banner with pull number, pity and standard flag
- JSON export / import (merged into existing history), multiple accounts (UID)
- UI language: 한국어 / English (**More → Settings → Language**). Item names are saved in the language the game used when the history page was opened.

## Usage

1. Download the zip from [Releases](https://github.com/noire113-dev/wuwa-convenes-exporter/releases) and extract it anywhere.
2. Launch the game and open **Convene → History**.
3. Run `WuWa Convenes Exporter.exe` and click **Load Convene History** (**Update** afterwards).

- The game folder is detected from common install locations. If it is not found, set the launcher folder (`Wuthering Waves`) in **More → Settings → Game folder**.
- The URL expires after a while. If you see "The Convene history URL has expired", open the history page in game again and update.
- If auto detection fails, paste the URL manually via **More → Import from URL**.

## Where data is stored

History is saved in the `userData` folder next to the exe. Back up this folder to keep your history.

- `gacha-list-<UID>.json`: Convene history per account (the previous file is kept as `.bak` on every save)
- `config.json`: settings such as the game folder, and the last used URL

History is requested only from the official game server (`gmserver-api.aki-game2.net`, `.com` for the CN server); no data is sent anywhere else.

## Development

Requires Node.js 20 or later.

```bash
npm install
npm start          # run (or double-click start.bat)
npm test           # merge, pity and URL decoding checks
npm run build      # creates the exe folder under dist/
```

- `main.js`: Electron main process (IPC, file storage, dialogs)
- `src/url.js`: finding, decoding and parsing the URL from logs
- `src/api.js`: Convene history API calls
- `src/store.js`, `src/stats.js`: local storage, history merging, statistics and pity
- `src/excel.js`: Excel export
- `src/i18n.js`: UI, message and Excel strings (Korean / English)
- `renderer/`: UI (Vue 3 + Element Plus + ECharts)

## License

MIT, following the original project [genshin-wish-export](https://github.com/biuuu/genshin-wish-export).

The UI font is [Pretendard](https://github.com/orioncactus/pretendard) (SIL Open Font License 1.1); its license is bundled as `renderer/vendor/Pretendard-LICENSE.txt` in builds.

This is an unofficial fan tool and is not affiliated with Kuro Games.
