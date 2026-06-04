const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appSource = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
const styles = readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

test('main workspace has a persisted draggable divider', () => {
  assert.match(appSource, /WORKSPACE_LAYOUT_STORAGE_KEY = 'time-manager-workspace-layout'/);
  assert.match(appSource, /className="workspace-divider"/);
  assert.match(appSource, /role="separator"/);
  assert.match(appSource, /aria-orientation="vertical"/);
  assert.match(appSource, /onPointerDown=\{startWorkspaceResize\}/);
  assert.match(appSource, /onKeyDown=\{handleWorkspaceDividerKeyDown\}/);
});

test('main workspace divider is hidden in the stacked narrow layout', () => {
  assert.match(
    styles,
    /\.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+var\(--workspace-divider-width\)\s+var\(--side-panel-width\);/s,
  );
  assert.match(styles, /\.workspace-divider\s*\{[^}]*cursor:\s*col-resize;/s);
  assert.match(
    styles,
    /@media \(max-width:\s*980px\)\s*\{[\s\S]*?\.workspace\s*\{[^}]*grid-template-columns:\s*1fr;[\s\S]*?\.workspace-divider\s*\{[^}]*display:\s*none;/s,
  );
});
