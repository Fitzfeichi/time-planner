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

- `src/App.tsx`: application state and page composition entry point; includes per-date localStorage persistence, current-task refresh, mini mode, and cross-window synchronization.
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

- Date switching loads the plan and review for the selected date.
- Plans are saved separately per local date key (`YYYY-MM-DD`) in localStorage.
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

## Visual Design Baseline

- Use `DESIGN.md` as the reference for future UI and visual design changes.
- Apply the reference in a tool-oriented way: keep the planner dense, efficient, and practical instead of turning it into a marketing-style landing page.
- Prefer a quiet Apple-inspired system: white and off-white surfaces, near-black text, a single blue action color, soft hairline borders, restrained shadows, and clear typography.
- Do not introduce decorative gradients, extra brand accent colors, large ornamental backgrounds, or broad layout changes that reduce day-to-day planning efficiency.
- Keep the main window and `?view=mini` current-task mini window visually consistent when making interface changes.

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



Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
