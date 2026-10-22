# Pink Study Space ♡

A local-first study planner prototype built for a Generative AI / Vibe Coding assignment.

## Features
- Semester dashboard with subject cards and an aggregated deadline list
- Create and edit subjects, including semester and exam date
- Track assignments and course topics
- Per-subject notes with automatic local saving
- Pomodoro focus timer with adjustable focus and break lengths
- Choose a local background image
- Export and import a JSON backup

## Run locally
For best results, run the folder through a local web server (rather than opening `index.html` directly), so browser storage works consistently.

### Option 1: Python
1. Install Python if needed.
2. Open a terminal in this folder.
3. Run: `python -m http.server 8000`
4. Open `http://localhost:8000` in your browser.

### Option 2: VS Code
Install the Live Server extension, right-click `index.html`, and choose **Open with Live Server**.

## Local data and privacy
Subjects, assignments, topics, notes, and background image data are stored in browser storage on this device. They do not automatically sync to other devices. Use **Export backup** regularly. Clearing browser data can remove the local app data.

## Notes
- Google Fonts are loaded from an external service when internet is available; the app otherwise uses fallback fonts.
- This prototype does not include cloud sync or automatic course-page importing.
- Test all features before submitting the assignment.


## Data persistence
The app saves your subjects, assignments, topics, notes, and background locally in your browser using IndexedDB (with a localStorage fallback). Keep using the same browser and the same local server address. Do not clear browser site data; use Export backup regularly.


## Version 3 change
- Removed only the Pomodoro/focus countdown card from the right-hand side of the overview dashboard. The persistent Pomodoro timer in the left sidebar remains. All other features are unchanged.


## Version 3 change
The extra Pomodoro button in the top-right header has been removed. The persistent Pomodoro timer in the left sidebar remains, and all other app features are retained.
