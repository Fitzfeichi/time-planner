# AGENTS.md

## Project Overview

This is a local Chinese Windows time-management tool prototype built with React + TypeScript + Vite.

The project is currently in "Phase 1: React frontend with an Electron desktop shell":

- Do not connect to a database for now.
- Do not implement local file persistence for now.
- Data is driven by React state and synchronized to localStorage in the current Electron/browser environment. Records may be lost if application or browser data is cleared.

The core experience is a daily planning and daily review interface based on half-hour blocks. One day is divided into 48 time slots, covering 00:00 to 24:00. The user can select a time slot, edit the planned content, actual content, and status, and fill in the daily review.

The current interface includes desktop app-like behavior through Electron: the right side of the main interface has a "current task" card; the same page supports a `?view=mini` mini-window mode that only shows the current half-hour task. `打开日计划.bat` opens the main Electron window, and `打开当前任务小窗.bat` opens only the mini current-task window.

## Main Files

- `src/App.tsx`: application state and page composition entry point; includes localStorage persistence, current-task refresh, mini mode, and cross-window synchronization.
- `src/types.ts`: TypeScript types for time slots, day plans, statuses, and related data.
- `src/lib/timeSlots.ts`: generates 48 half-hour time slots, creates empty plans, and calculates the current time slot.
- `src/lib/status.ts`: status values and Chinese display labels.
- `src/components/DayHeader.tsx`: top date title and "previous day / today / next day" buttons.
- `src/components/TimeTable.tsx`: left-side full-day time table.
- `src/components/CurrentTaskCard.tsx`: current half-hour task card and the `?view=mini` mini-window content.
- `src/components/SlotEditor.tsx`: right-side editor panel for a single time slot.
- `src/components/ReviewPanel.tsx`: daily review input area.
- `src/styles.css`: global layout, table, sidebar, current-task card, and responsive styles.
- `scripts/inline-dist.cjs`: inlines JS/CSS into `dist\index.html` after build so the app can be opened by double-clicking the local HTML file.
- `electron/main.cjs`: Electron main process; creates the main window and current-task mini window.
- `electron/preload.cjs`: safely exposes `openMiniWindow()` to the React renderer through `contextBridge`.
- `打开日计划.bat`: starts the Electron desktop app.
- `打开当前任务小窗.bat`: starts the Electron app in mini-window mode.

## Common Commands

Run these from the project root: `G:\Documents\桌面管理`.

- Install dependencies: `npm.cmd install`
- Local development: `npm.cmd run dev`
- Build verification: `npm.cmd run build`
- Desktop app: `npm.cmd run desktop:start`
- Preview build output: `npm.cmd run preview`
- Daily use: double-click `打开日计划.bat`, double-click `打开当前任务小窗.bat`, or open `dist\index.html` directly.

Notes:

- `npm.cmd run build` first runs the Vite build, then runs `scripts/inline-dist.cjs` to generate a single-file `dist\index.html` suitable for local double-click use.
- `npm.cmd run desktop:start` builds the React app, then starts Electron with `electron/main.cjs`.
- `打开日计划.bat` runs `npm.cmd run build`, then starts `node_modules\electron\dist\electron.exe` with the project root as the app path.
- `打开当前任务小窗.bat` runs `npm.cmd run build`, then starts `node_modules\electron\dist\electron.exe` with `--mini`.
- In Windows PowerShell, `npm` may be blocked by script execution policy, so prefer `npm.cmd`.
- When reading text files that may contain Chinese in PowerShell, explicitly use UTF-8 to avoid display mojibake, for example: `Get-Content -LiteralPath AGENTS.md -Raw -Encoding UTF8`.

## Current Functional Boundaries

- Date switching currently only changes the displayed date at the top.
- The current version does not yet save separate plans per date. `dayPlan` is a single React state object.
- The current time slot is highlighted only when viewing the system's current date.
- The current-task card refreshes system time every 30 seconds.
- The current-task mini-window is an Electron `BrowserWindow`; it does not yet provide always-on-top, tray, or notification behavior.
- There is no login, cloud sync, import/export, reminder system, notification system, tray integration, installer/package build, or file persistence.

## Working Principles

- This project is for Chinese users. UI text, buttons, prompts, and default content should use natural and clear Chinese.
- The user is a programming beginner. When explaining changes, describe what was completed, what the next step is, and why the change was made.
- Do not introduce complex architecture all at once. Prefer keeping the current lightweight structure.
- When adding fields, update `src/types.ts` first, then update creator functions, component props, and UI.
- `createTimeSlots()` generates the standard 48-slot base time table. User-edited data comes from `DayPlan.slots`.
- Components should keep controlled input mode. `textarea` values are driven by state and passed back to the parent component through `onChange`.
- Styles are centralized in `src/styles.css`. Keep the interface simple, clear, and desktop-tool-like.
- Keep Electron integration in `electron/`; React should call desktop capabilities only through the preload bridge and keep browser fallbacks where practical.

## Code Style

- Use TypeScript strict mode and avoid `any`.
- Use React function components with explicit props interfaces.
- Keep single quotes, semicolons, and two-space indentation.
- Add short comments only before complex logic. Do not add noisy comments for obvious code.
- Put new utility functions in `src/lib/` when appropriate, and put shared types in `src/types.ts`.

## Verification Checklist

After code changes, check at least the following:

- `npm.cmd run build` passes.
- The date buttons can switch to the previous day, today, and the next day.
- Clicking a time slot makes the right-side editor show the corresponding time range.
- After editing planned content, actual content, or status, the left-side time table updates.
- When viewing the system's current date, the current half-hour slot is highlighted; when viewing other dates, the current slot highlight is not shown.
- The right-side current-task card shows the system's current half-hour task, and "jump to current task" scrolls to the matching row.
- `dist\index.html?view=mini` only shows the current-task mini-window content.
- `npm.cmd run desktop:start` opens the Electron main window.
- Clicking "打开小窗" in Electron opens an Electron mini window instead of a browser tab.
- Double-clicking `打开日计划.bat` and `打开当前任务小窗.bat` opens the corresponding Electron window.
- On narrow screens, the time table and sidebar stack vertically, and text does not overlap.

## Collaboration Habits

- The user mainly communicates in Chinese, so replies should usually be in Chinese.
- The user may use voice input. If homophones, filler words, or incomplete sentences affect implementation, ask for confirmation before modifying.
- If the user says "你的理解", "你理解了吗", "明白我的意思了吗", "你懂我意思了吗", or similar expressions, first restate the understanding, then ask at least 3 clarifying questions, and do not start execution directly.
- Before modifying code, briefly explain in Chinese what will be changed and why.
- After modifying `AGENTS.md`, explicitly say in the reply: `AGENTS.md 已更新，请过目`.
