# RetroRIP

A lightweight Windows 11 desktop app for converting YouTube links to **MP3, MP4, AVI, WAV, or FLAC** — wrapped in a native Fluent UI with real Mica/Acrylic materials, so it blends right into Windows 11.

## Screenshots

<img width="1919" height="1079" alt="Screenshot 2026-10-19 224058" src="https://github.com/user-attachments/assets/9400e987-8108-4fca-ab15-5d077f0f9e53" />
<img width="1919" height="1079" alt="Screenshot 2026-10-19 224053" src="https://github.com/user-attachments/assets/044c544b-b501-456b-aed6-4790d2267490" />
<img width="1919" height="1079" alt="Screenshot 2026-10-19 224047" src="https://github.com/user-attachments/assets/f3702da7-a5d5-4ab2-983b-6eb93a060516" />
<img width="1919" height="1079" alt="Screenshot 2026-10-19 224033" src="https://github.com/user-attachments/assets/12c4bf44-9f6d-4825-ab32-674208ca818b" />
<img width="1919" height="1079" alt="Screenshot 2026-10-19 224025" src="https://github.com/user-attachments/assets/801153f0-7912-45a6-b453-3c35ab115b85" />
<img width="1919" height="1079" alt="Screenshot 2026-10-19 224015" src="https://github.com/user-attachments/assets/d06fd76d-16de-44a8-8fcf-514aaea02695" />
<img width="1919" height="1079" alt="Screenshot 2026-10-19 224011" src="https://github.com/user-attachments/assets/6afec171-bc38-4965-80bf-24684a22f7dc" />
<img width="1919" height="1079" alt="Screenshot 2026-10-19 221308" src="https://github.com/user-attachments/assets/1c0a0f72-592f-4674-b241-0e4fe7630c37" />


Downloads are powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org/), which RetroRIP fetches automatically on first launch.


## Features

- **Convert** — Paste a link, park it in the queue with **+**, then hit **Convert** to download everything at once (a link still in the box is downloaded right away).
- **Downloads** — Live progress for active downloads, a green **Done** badge for finished files, and a red exclamation indicator for failures — hover it to see exactly why a download failed.
- **Queue handoff** — Started downloads show a temporary download indicator in the Queue, then move over to Downloads to keep the list clean.
- **Library** — Browse, preview, open, and delete your downloaded audio and video.
- **Settings** — Separate default Audio/Video folders, Light / Dark / System theme, system or custom accent colors (Red, Pink, Matcha, Purple, Blue, White), default download quality, and an **Update yt-dlp** button (RetroRIP also checks for a new yt-dlp once a week).
- **Windows 11 native feel** — Mica in light mode, Acrylic in dark mode, collapsible Fluent navigation pane, and a custom title bar with the RetroRIP cassette icon.

## Download (ready to run)

Download `RetroRIP-1.1.0.exe` from the Releases page and double-click it — it's a portable build, no installation required.

> On first launch Windows SmartScreen may warn that the app is unsigned: choose **More info → Run anyway**. RetroRIP will then download yt-dlp and ffmpeg into its app-data folder (checking each download against its published SHA-256 checksum), so the first start needs an internet connection.

### Check your download

Release builds are made by GitHub Actions straight from this repository's code ([workflow](.github/workflows/build.yml)), not on a personal computer. To check that the `.exe` you downloaded is exactly that build:

- **Checksum:** in PowerShell, run `Get-FileHash .\RetroRIP-1.0.0.exe` and compare the result with the `.sha256` file attached to the release (upper or lower case doesn't matter).
- **Build provenance:** with the [GitHub CLI](https://cli.github.com/), run `gh attestation verify RetroRIP-1.0.0.exe --repo iamkrisstan2000/RetroRIP`. It confirms which commit and workflow produced the file.

## Run from source

Requirements: Node.js 20+ (npm) and, for packaging, Windows 10/11.

```bash
npm ci

# Develop (Vite dev server + Electron)
npm run electron:dev

# Production frontend build only
npm run build

# Build the portable Windows .EXE (output in ./release)
npm run electron:build
```

Default save locations are your system **Music** and **Videos** folders; both can be changed in Settings.

## Project structure

```
electron/   Main process (window, Mica/Acrylic material, IPC, yt-dlp/ffmpeg runner)
src/        React + Fluent UI renderer (App, themes)
assets/     App icon (icon.png / icon.ico)
```

## Legal

RetroRIP is a tool for downloading media you own or have permission to download. Please respect copyright law and YouTube's Terms of Service. RetroRIP is not affiliated with YouTube or Google.

## Credits

Made by **Mr KNIGHT** · Made possible with AI tools. · October 2026

## Support Development

This application is free to use.

If you enjoy using it and would like to support
future development, voluntary donations are welcome.

Donations are entirely optional and are not required
to download or use this application.

## License

[GNU GPL-3.0](LICENSE) © 2026 Mr Knight
