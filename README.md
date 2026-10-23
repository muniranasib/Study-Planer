# Study Space ♡

Study Space is a calm, responsive semester planner for students. It is built with plain HTML, CSS and JavaScript, requires no account or backend, and can be run with VS Code Live Server or published using GitHub Pages.

## Features

- Overview dashboard with subject counts, upcoming deadlines, completed assignments and learned topics.
- Create, edit and delete subjects with semester, exam date and a soft pastel colour for each subject.
- Track assignments, reading tasks and other work, including optional due dates and completion status.
- Deadlines page with three filters: **All**, **Due** (not completed) and **Complete**.
- Add topics per subject and check them off to track learning progress.
- Note library with separate notes, subject/topic fields, search and automatic local saving while typing.
- Pomodoro timer with focus/break lengths, start, pause, reset and a persistent sidebar countdown.
- Local background image selection, with a light overlay for readability.
- JSON export/import backup. Import asks before replacing current data.

## Project structure

```text
Study-Space/
├── index.html
├── styles.css
├── app.js
├── README.md
└── .gitignore
```

## Run on Windows with VS Code

1. Download and extract `Study-Space.zip`.
2. Open VS Code.
3. Choose **File → Open Folder…** and select the extracted `Study-Space` folder.
4. In Extensions, install **Live Server** by Ritwick Dey if it is not already installed.
5. Open `index.html`, right-click inside the editor and choose **Open with Live Server**.
6. Your browser will open the app. The Overview should render immediately.

You can also open `index.html` directly in a browser. Live Server is recommended while developing.

## Publish on GitHub Pages

1. Create a new public repository on GitHub, for example `study-space`.
2. Upload the files in this folder to the repository root (not the ZIP file).
3. Open **Settings → Pages**.
4. Under build/deployment, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. Wait for the deployment to finish and open the Pages URL shown in the settings.

The app is static, so it does not require a server, secrets, login or paid hosting. Google Fonts are optional visual enhancements; if unavailable, local serif/sans-serif fallbacks are used.

## Local data and privacy

Study Space stores subjects, assignments, topics, notes and the selected background in the browser's `localStorage`. The Pomodoro timer state is stored separately so the countdown can continue when its dialog is closed or you navigate to another page.

- Data remains in the same browser profile and origin unless browser site data is cleared.
- Local data is **not automatically synchronized** across browsers, computers or devices.
- Export a JSON backup regularly. Import replaces current app data after confirmation.
- Do not use personal notes in a public demo recording. Use fictional sample data.
- The selected background is stored in local browser storage; use a reasonably small image.

## Troubleshooting

- **Blank page:** Open browser Developer Tools (`F12`) → Console and check for an error. Confirm `app.js` and `styles.css` are next to `index.html`.
- **Changes do not appear:** Check that Live Server is serving this folder, then reload once.
- **Storage warning:** Export a backup and remove a very large background image if storage is full.
- **Timer:** The timer uses the system clock and corrects the displayed remaining time from its target end time. Browser throttling can delay the exact moment the interface updates while the tab is inactive, but the displayed time is recalculated on the next tick.

## Demo video

For a public YouTube demonstration, create fictional subjects and notes in a separate browser profile, record the workflow, and avoid showing your personal browser data or private notes.
