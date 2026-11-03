# Mahamm · مهام

**All your Moodle assignments and deadlines in one report.**
Desktop program (window + terminal) and browser extension · English / العربية · Windows, macOS, Linux · Chrome, Edge, Firefox.

[العربية](README.ar.md)

Built for Azrieli College of Engineering Jerusalem (`moodle.jce.ac.il`), works with any Moodle site that has the Moodle mobile app enabled.

## What you get

- Every assignment and quiz in the semester you choose, sorted by nearest deadline. Late items are marked.
- Status from Moodle itself: submitted, draft, late but still open, closed, plus grades once they are out.
- The task description and its attached instruction files. With `--download-files`, the files are saved next to the report.
- Course names always as **Hebrew - your language**, e.g. `תיכון מונחה עצמים - Object-Oriented Design` or `תיכון מונחה עצמים - تصميم البرمجيات الكائنية`.
- Reports as **PDF, HTML, Markdown or JSON**, saved wherever you choose.
- A note on the Moodle "00:00" trap: a deadline at 00:00 on Monday means the **end of Sunday**, and the report says so next to each one.
- Extension only: a badge with the number of open tasks (red if something is late) and reminders 24 h and 3 h before each deadline.

## Desktop program

### Install

Download the file for your system from **[Releases](../../releases/latest)**. Nothing else is needed.

| System | File |
|---|---|
| Windows | `mahamm-windows-x64.exe` |
| macOS (Apple Silicon / Intel) | `mahamm-macos-arm64` / `mahamm-macos-x64` |
| Linux | `mahamm-linux-x64` / `mahamm-linux-arm64` |

- **macOS / Linux:** make it executable with `chmod +x mahamm-*`. On macOS, if it is blocked, run `xattr -d com.apple.quarantine mahamm-macos-*`.
- **With Node.js 22+ instead:** run `npm install -g github:<owner>/mahamm`, then use `mahamm`.

### Use it with the window

Run `mahamm` (or double-click it). A page opens in your browser:

1. **Sign in to Moodle.** A separate browser window opens on the college login. Sign in there as usual, and the window closes by itself.
2. Pick the semester, language, file type and folder, then click **Create report**. A live preview is shown next to the options.

### Use it from the terminal

```sh
mahamm login                          # sign in (opens a browser window)
mahamm semesters                      # list your semesters, e.g. 2027-1, 2026-2
mahamm list                           # tasks still to do, in the terminal
mahamm report                         # PDF of the latest semester → Documents
mahamm report -l ar -o ~/Desktop      # Arabic report, saved on the Desktop
mahamm report -s 2026-2 -f md -o ./tasks.md
mahamm report --pending-only --download-files --open
mahamm report -o ~/Desktop -n "my tasks {date}"   # choose the file name
mahamm --help                         # everything else
```

| Option | Meaning |
|---|---|
| `-s, --semester` | `latest` (default), `all`, or a key from `mahamm semesters` |
| `-l, --lang` | `en` or `ar`. Course names stay "Hebrew - language" |
| `-f, --format` | `pdf`, `html`, `md`, `json` (default: taken from the `--out` extension, otherwise pdf) |
| `-o, --out` | a file **or** a folder. Missing folders are created |
| `-n, --name` | file name; may contain `{semester}`, `{date}`, `{lang}` (default `moodle-tasks_{semester}_{date}`). The extension is added for you |
| `--pending-only` | only tasks still to do |
| `--materials` | also list files/links whose names look like homework (no submission box) |
| `--download-files` | save the instruction files next to the report |
| `--open` | open the report when done |

PDF output uses a browser that is already installed (Chrome, Edge, Chromium, Brave or Firefox) in the background.

## Browser extension

- **Chrome / Edge / Brave:** download `mahamm-extension-chrome-*.zip` from Releases and unzip it. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked**, and choose the folder.
- **Firefox:** install from addons.mozilla.org once it is published. For testing: open `about:debugging` → **This Firefox** → **Load Temporary Add-on**, and pick `manifest.json` from the unzipped `mahamm-extension-firefox-*.zip`.

Click the icon, then **Sign in to Moodle**. A tab opens on the college login and closes by itself when you are done. The list refreshes every hour. **Full report** opens a page where you can print or save a PDF, or download HTML, Markdown or JSON, choosing where to save each file.

Under ⚙ there is a **key for the desktop program**: `mahamm login --token <key>` signs the program in without opening a browser.

## Report a problem

Use **Report a problem**: the button in the window, the link at the bottom of the extension popup, or `mahamm bug` in the terminal. It opens a form on GitHub Issues with the version, system, browser and the last error already filled in. Your Moodle key, password, name and tasks are never included, and you see everything before you send it. You need a free GitHub account to submit.

Ideas and missing course translations have their own forms on the [Issues page](../../issues/new/choose).

## Sign-in and privacy

Mahamm signs in the same way as the official Moodle mobile app. You log in on the real college page (Microsoft / SSO included). Moodle then gives the tool a personal access key. **Your password is never seen or stored.**

- The program keeps the key in a file only you can read:
  - Windows: `%APPDATA%\mahamm`
  - macOS: `~/Library/Application Support/mahamm`
  - Linux: `~/.config/mahamm`
- The extension keeps it in its local storage.
- Nothing is sent anywhere except to your Moodle site.
- To revoke the key: in Moodle, go to **Preferences → Security keys** and reset the key for "Moodle mobile web service". `mahamm logout` or **Sign out** removes it locally.

If the automatic sign-in window cannot be used, run `mahamm login --paste` and follow the steps.

## Other Moodle sites

```sh
mahamm config --site https://moodle.example.ac.il
mahamm login
```

In the extension, change the site on the sign-in screen. Semesters are detected from course categories such as `2027- סמסטר 1`. Other category names are listed as they are.

## Course name translations

Translations live in [`core/translations.js`](core/translations.js) as `'Hebrew name': { en: '…', ar: '…' }`. If a course has no translation, only the Hebrew name is shown, and `mahamm report` tells you which ones are missing.

- **Add it for everyone:** add a line and open a pull request 🙏
- **Just for you:** create `translations.json` in the config folder above:

```json
{ "שם הקורס בעברית": { "en": "Course name", "ar": "اسم المساق" } }
```

## Development

```sh
npm test                          # unit tests (Node 22+)
node app/bin/mahamm.js            # run the program from source
node scripts/build-extension.mjs  # dist/extension-chrome, dist/extension-firefox + zips
node scripts/build-binaries.mjs   # single-file programs (needs Bun)
```

```
core/        shared by the program and the extension (Moodle client, names, report, i18n)
app/         desktop program: CLI (bin/), window (lib/gui.js + ui/), sign-in, PDF
extension/   WebExtension source (Manifest V3) – one codebase for Chrome, Edge, Firefox
scripts/     build scripts
tests/       unit tests
```

To publish a release, bump `version` in `package.json`, then push a tag: `git tag v1.0.1 && git push origin v1.0.1`. GitHub Actions builds all programs and both extension zips and attaches them to the release.

## License

MIT
