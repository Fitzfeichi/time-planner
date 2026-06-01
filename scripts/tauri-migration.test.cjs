const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(rootDir, 'package.json'));

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('package scripts keep Electron and add Tauri commands', () => {
  assert.equal(packageJson.scripts['desktop:start'], 'npm run build && electron .');
  assert.equal(packageJson.scripts['package:win'], 'node scripts/package-win.cjs');
  assert.equal(packageJson.scripts['tauri:dev'], 'tauri dev');
  assert.equal(packageJson.scripts['tauri:build'], 'tauri build');
  assert.equal(packageJson.scripts['package:tauri'], 'node scripts/package-tauri.cjs');
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
  assert.match(packageScript, /Windows-Tauri-安装包\.exe/);
  assert.match(packageScript, /src-tauri.+bundle.+nsis/s);
});

test('Tauri development launcher starts the desktop dev shell from the project root', () => {
  const launcher = readText('打开Tauri开发版.bat');

  assert.match(launcher, /cd \/d "%~dp0"/);
  assert.match(launcher, /call npm\.cmd run tauri:dev/);
  assert.match(launcher, /pause/);
});

test('React uses a shared desktop bridge with Electron and Tauri support', () => {
  const appSource = readText('src/App.tsx');
  const bridgeSource = readText('src/lib/desktopBridge.ts');

  assert.match(appSource, /getDesktopBridge/);
  assert.match(bridgeSource, /@tauri-apps\/api\/webviewWindow/);
  assert.match(bridgeSource, /window\.desktopBridge/);
  assert.match(bridgeSource, /setAlwaysOnTop/);
  assert.match(bridgeSource, /view=mini/);
});
