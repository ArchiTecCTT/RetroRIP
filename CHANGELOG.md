# Changelog

All notable changes to RetroRIP, in plain language.

## [1.1.0] — 19 October 2026

- **About section** — Now shows the RetroRIP app icon and version (v1.1) directly in Settings, with the new credit lines: "Made by Mr KNIGHT · Made possible with AI tools. · October 2026".
- **System accent** — "Use system accent" now follows your real Windows accent color and updates the moment you change it in Windows, instead of always staying blue.
- **Layout polish** — Hamburger moved below the title bar into the pane; slimmer 48px collapsed rail with centered headings; content panel sits flush with the right and bottom window edges, with straight corners and no stray border lines.
- **Title bar & pane** — App icon and name stay in the title bar at all times; only the categories collapse.
- **Downloads page** — Rebuilt as one clean list: green "Done" for finished files, a red exclamation for failures (hover it to see why), and a friendly message for private media.
- **Convert flow** — The **+** button now only adds a link to the queue; **Convert** downloads everything queued (plus any link still in the box). Started downloads show a temporary download icon in the Queue, then hand off to Downloads.
- **Headings** — Convert, Downloads, Library and Settings titles share the same spacing.
- **License** — Changed from MIT to GNU GPL-3.0, so the app and its source stay free for everyone.
- **Cleanup** — Removed unused code, imports and leftover files; the workspace and source tree were tidied.

### Security & reliability fixes

These issues were pointed out by **ArchiTecCTT** in [GitHub Pull Request #2](https://github.com/iamkrisstan2000/RetroRIP/pull/2) — thank you!

- Dragging a link onto the window could open a web page inside the app; dropped links now just fill the link box.
- File open/delete actions are now limited to media files inside your Audio/Video folders.
- Pasted text can no longer sneak extra commands into the downloader — only proper web links are accepted.
- The yt-dlp and ffmpeg downloads are now checked against their published SHA-256 checksums before use.
- Cancel now truly stops a download (including its helper processes), and cancelled items no longer appear as "Failed".
- Interrupted tool downloads no longer leave a broken file behind; yt-dlp also keeps itself up to date weekly, with an Update button in Settings.
- Several smaller fixes: default video quality is honored, Library previews work with special characters in filenames, at most 3 downloads run at once, only one copy of the app runs at a time, and Medium/Low quality works for more sites.

## [1.0.0] — 16 October 2026

- First release of RetroRIP (originally built as "YT Converter").
- Convert YouTube links to MP3, MP4, AVI, WAV and FLAC using yt-dlp and ffmpeg (downloaded automatically on first launch).
- Fluent Windows 11 design: Mica in light mode, Acrylic in dark mode, collapsible navigation pane, custom title bar with the matcha cassette icon.
- Convert queue, Downloads tracking, Library previews, and Settings for folders, theme, accent color and quality.
