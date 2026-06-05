const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(rootDir, 'package.json'));
const legacyShellName = ['elec', 'tron'].join('');
const legacyBuilderName = `${legacyShellName}-builder`;
const legacyInlineScriptName = ['inline', '-dist.cjs'].join('');

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('package scripts expose only the Tauri desktop shell', () => {
  assert.deepEqual(Object.keys(packageJson.scripts).sort(), [
    'build',
    'dev',
    'package:tauri',
    'preview',
    'tauri:build',
    'tauri:dev',
  ]);
  assert.equal(packageJson.scripts.build, 'tsc -p tsconfig.app.json && vite build');
  assert.equal(packageJson.scripts.dev, 'vite');
  assert.equal(packageJson.scripts.preview, 'vite preview');
  assert.equal(packageJson.scripts['tauri:dev'], 'tauri dev');
  assert.equal(packageJson.scripts['tauri:build'], 'node scripts/package-tauri.cjs');
  assert.equal(packageJson.scripts['package:tauri'], 'node scripts/package-tauri.cjs');
  assert.equal('main' in packageJson, false);
  assert.equal('build' in packageJson && typeof packageJson.build === 'object', false);
});

test('old desktop shell files and dependencies are removed', () => {
  assert.equal(fs.existsSync(path.join(rootDir, legacyShellName)), false);
  assert.equal(fs.existsSync(path.join(rootDir, 'scripts/package-win.cjs')), false);
  assert.equal(fs.existsSync(path.join(rootDir, 'scripts', legacyInlineScriptName)), false);
  assert.equal(packageJson.devDependencies[legacyShellName], undefined);
  assert.equal(packageJson.devDependencies[legacyBuilderName], undefined);
});

test('Tauri config loads the existing Vite app and builds NSIS by default', () => {
  const config = JSON.parse(readText('src-tauri/tauri.conf.json'));

  assert.equal(config.productName, '半小时日计划');
  assert.equal(config.build.devUrl, 'http://localhost:5173');
  assert.equal(config.build.frontendDist, '../dist');
  assert.equal(config.build.beforeDevCommand, 'npm.cmd run dev');
  assert.equal(config.build.beforeBuildCommand, 'npm.cmd run build');
  assert.deepEqual(config.bundle.targets, ['nsis']);
  assert.equal(config.app.windows[0].label, 'main');
  assert.equal(config.app.windows[0].title, '半小时日计划');
});

test('Tauri Rust manifest points only to files that exist', () => {
  const cargoToml = readText('src-tauri/Cargo.toml');
  const hasLibraryTarget = /^\[lib\]/m.test(cargoToml);
  const hasLibrarySource = fs.existsSync(path.join(rootDir, 'src-tauri/src/lib.rs'));

  assert.equal(hasLibraryTarget, hasLibrarySource);
});

test('Tauri Windows resource icon exists', () => {
  const iconPath = path.join(rootDir, 'src-tauri/icons/icon.ico');

  assert.equal(fs.existsSync(iconPath), true);
  assert.ok(fs.statSync(iconPath).size > 0);
});

test('Tauri package script copies the NSIS installer to release', () => {
  const packageScript = readText('scripts/package-tauri.cjs');

  assert.match(packageScript, /'build', '--bundles', 'nsis'/);
  assert.match(packageScript, /src-tauri', 'tauri\.conf\.json'/);
  assert.match(packageScript, /path\.basename\(installer\.filePath\)/);
  assert.match(packageScript, /fs\.copyFileSync\(installer\.filePath, outputPath\)/);
  assert.match(packageScript, /src-tauri.+bundle.+nsis/s);
});

test('Tauri development launcher starts the desktop dev shell from the project root', () => {
  const launcher = readText('打开Tauri开发版.bat');
  const mainLauncher = readText('打开日计划.bat');
  const miniLauncher = readText('打开当前任务小窗.bat');

  for (const launcherSource of [launcher, mainLauncher, miniLauncher]) {
    assert.match(launcherSource, /cd \/d "%~dp0"/);
    assert.match(launcherSource, /call npm\.cmd run tauri:dev/);
    assert.match(launcherSource, /pause/);
    assert.equal(launcherSource.includes(`node_modules\\${legacyShellName}\\dist`), false);
  }
});

test('React uses a Tauri-only desktop bridge', () => {
  const appSource = readText('src/App.tsx');
  const bridgeSource = readText('src/lib/desktopBridge.ts');

  assert.match(appSource, /getDesktopBridge/);
  assert.match(bridgeSource, /@tauri-apps\/api\/webviewWindow/);
  assert.doesNotMatch(bridgeSource, /window\.desktopBridge/);
  assert.match(bridgeSource, /setAlwaysOnTop/);
  assert.match(bridgeSource, /LogicalSize/);
  assert.match(bridgeSource, /LogicalPosition/);
  assert.match(bridgeSource, /resizeMiniWindow/);
  assert.match(bridgeSource, /toggleStickyNoteWindow/);
  assert.match(bridgeSource, /view=mini/);
  assert.match(bridgeSource, /view=sticky-note/);
});

test('Tauri permissions allow the mini window to resize itself', () => {
  const capability = JSON.parse(readText('src-tauri/capabilities/default.json'));

  assert.ok(capability.permissions.includes('core:window:allow-set-size'));
});

test('Tauri permissions allow the sticky note window to attach beside the mini window', () => {
  const capability = JSON.parse(readText('src-tauri/capabilities/default.json'));

  assert.ok(capability.windows.includes('sticky-note'));
  assert.ok(capability.permissions.includes('core:window:allow-outer-position'));
  assert.ok(capability.permissions.includes('core:window:allow-outer-size'));
  assert.ok(capability.permissions.includes('core:window:allow-set-position'));
});
