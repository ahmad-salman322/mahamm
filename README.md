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

Open the **[latest release](https://github.com/ahmad-salman322/mahamm/releases/latest)** and scroll down to **Assets**. Download **only the one file** for your system. You do not need Node.js or anything else.

| Your computer | Download this file |
|---|---|
| Windows | `mahamm-windows-x64.exe` |
| Mac with Apple chip (M1, M2, M3, M4…) | `mahamm-macos-arm64` |
| Mac with Intel chip | `mahamm-macos-x64` |
| Linux (most PCs) | `mahamm-linux-x64` |
| Linux on ARM (Raspberry Pi, ARM laptops) | `mahamm-linux-arm64` |

> Not sure which Mac you have? Apple menu → **About This Mac**. "Chip: Apple M…" means `arm64`, "Processor: Intel" means `x64`.
>
> The files named "Source code (zip / tar.gz)" are the source, not the program. You don't need them.

#### Windows

1. Double-click `mahamm-windows-x64.exe`.
2. Windows may show **"Windows protected your PC"**, because the program is not signed by a paid certificate. Click **More info**, then **Run anyway**. This happens only the first time.
3. A black window opens, and then a page in your browser. **Keep the black window open** while you use Mahamm.

To use the terminal commands, open PowerShell in the folder with the file and run `.\mahamm-windows-x64.exe report`, for example. You can rename the file to `mahamm.exe` to make it shorter.

#### macOS

Open **Terminal**, then run (replace `arm64` with `x64` on an Intel Mac):

```sh
cd ~/Downloads
chmod +x mahamm-macos-arm64
xattr -d com.apple.quarantine mahamm-macos-arm64
./mahamm-macos-arm64
```

- `chmod +x` makes the file runnable. `xattr …` removes the "downloaded from the internet" mark, so macOS does not say *"cannot be opened because the developer cannot be verified"*.
- If macOS still blocks it: **System Settings → Privacy & Security**, scroll down, click **Open Anyway**, and run it again.

#### Linux

```sh
cd ~/Downloads
chmod +x mahamm-linux-x64
./mahamm-linux-x64
```

Optional: move it into your PATH so you can type just `mahamm`:

```sh
mkdir -p ~/.local/bin && mv mahamm-linux-x64 ~/.local/bin/mahamm
```

#### With Node.js instead (any system)

If you already have Node.js 22 or newer:

```sh
npm install -g github:ahmad-salman322/mahamm
mahamm
```

### Use it with the window

Run the program (double-click on Windows, `./mahamm-…` on macOS / Linux). A page opens in your browser:

1. Click **Sign in to Moodle.** A separate browser window opens on the college login. Sign in there as usual (Microsoft / SSO included), and the window closes by itself.
2. Pick the semester, language, file type and folder, then click **Create report**. A live preview is shown next to the options.
3. When you are done, close the browser tab. The program stops by itself after about a minute, or press `Ctrl+C` in its window.

If the page does not open by itself, look at the program's window: it prints an address like `http://127.0.0.1:…`. Copy it into your browser.

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

The extension is not in the Chrome or Firefox stores yet, so you load it by hand. It takes a minute.

**Chrome / Edge / Brave**

1. From the [latest release](https://github.com/ahmad-salman322/mahamm/releases/latest), download `mahamm-extension-chrome-<version>.zip`.
2. Unzip it (right-click → **Extract All** on Windows, double-click on macOS). You get a folder with `manifest.json` inside.
3. Move that folder somewhere permanent, e.g. Documents. **Do not delete it later**, or the extension stops working.
4. Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`).
5. Turn on **Developer mode** (top-right in Chrome, left side in Edge).
6. Click **Load unpacked** and choose the folder that **directly contains `manifest.json`**. If you get "Manifest file is missing", you picked the folder one level too high.
7. Click the puzzle icon 🧩 in the toolbar and pin **Mahamm**.

**Firefox**

Firefox only keeps hand-loaded extensions until it restarts. Until Mahamm is on addons.mozilla.org:

1. Download and unzip `mahamm-extension-firefox-<version>.zip`.
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
3. Pick the `manifest.json` file inside the unzipped folder.

Click the icon, then **Sign in to Moodle**. A tab opens on the college login and closes by itself when you are done. The list refreshes every hour. **Full report** opens a page where you can print or save a PDF, or download HTML, Markdown or JSON, choosing where to save each file.

Under ⚙ there is a **key for the desktop program**: `mahamm login --token <key>` signs the program in without opening a browser.

## Troubleshooting

| Problem | What to do |
|---|---|
| The release page has no program files, only "Source code" | No release has been built yet. Ask the maintainer, or use the Node.js install above. |
| Windows: "Windows protected your PC" | **More info → Run anyway**. |
| Windows: the black window opens and closes at once | Open PowerShell in that folder and run `.\mahamm-windows-x64.exe`, so you can read the error. Then use **Report a problem**. |
| macOS: "cannot be opened because the developer cannot be verified" / "is damaged" | Run the `xattr -d com.apple.quarantine …` command from the macOS steps. |
| macOS / Linux: `permission denied` | Run `chmod +x` on the file first. |
| macOS: `bad CPU type in executable` | You downloaded the wrong file. Use `arm64` for Apple chips and `x64` for Intel. |
| Linux: double-clicking does nothing | Run it from a terminal: `./mahamm-linux-x64`. |
| The sign-in window does not open, or does not close after login | Run `mahamm login --paste` and follow the steps. |
| "No supported browser found" | Install Chrome, Edge, Chromium, Brave or Firefox. To sign in without one, use `mahamm login --paste`. For reports, choose HTML or Markdown instead of PDF. |
| A course shows only its Hebrew name | It has no translation yet. See [Course name translations](#course-name-translations). |
| Chrome: "Manifest file is missing or unreadable" | Choose the folder that directly contains `manifest.json`. |

## Report a problem

Use **Report a problem**: the button in the window, the link at the bottom of the extension popup, or `mahamm bug` in the terminal. It opens a form on GitHub Issues with the version, system, browser and the last error already filled in. Your Moodle key, password, name and tasks are never included, and you see everything before you send it. You need a free GitHub account to submit.

Ideas and missing course translations have their own forms on the [Issues page](https://github.com/ahmad-salman322/mahamm/issues/new/choose).

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
