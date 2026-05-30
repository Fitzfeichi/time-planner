const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(rootDir, 'package.json'));
const productName = packageJson.build?.productName ?? packageJson.name;
const version = packageJson.version;
const releaseDir = path.join(rootDir, 'release');
const nsisDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const outputPath = path.join(releaseDir, `${productName}-${version}-Windows-Tauri-安装包.exe`);
const tauriBin = process.platform === 'win32'
  ? 'node_modules\\.bin\\tauri.cmd'
  : path.join(rootDir, 'node_modules', '.bin', 'tauri');

function run(command, args, options = {}) {
  const isWindows = process.platform === 'win32';
  const commandLine = [command, ...args].map((value) => {
    if (/^[A-Za-z0-9_./:=\\-]+$/.test(value)) {
      return value;
    }

    return `"${value.replaceAll('"', '""')}"`;
  }).join(' ');
  const result = spawnSync(
    isWindows ? 'cmd.exe' : command,
    isWindows ? ['/d', '/c', commandLine] : args,
    {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
      ...options,
    },
  );

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${command} exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function getEnvWithCargoPath() {
  const cargoBin = path.join(process.env.USERPROFILE ?? '', '.cargo', 'bin');

  if (process.platform !== 'win32' || !fs.existsSync(cargoBin)) {
    return { ...process.env };
  }

  return {
    ...process.env,
    PATH: `${cargoBin}${path.delimiter}${process.env.PATH ?? ''}`,
  };
}

function findNewestNsisInstaller(startedAt) {
  if (!fs.existsSync(nsisDir)) {
    return null;
  }

  return fs.readdirSync(nsisDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('-setup.exe'))
    .map((entry) => {
      const filePath = path.join(nsisDir, entry.name);
      return {
        filePath,
        modifiedAt: fs.statSync(filePath).mtimeMs,
      };
    })
    .filter((entry) => entry.modifiedAt >= startedAt - 1000)
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0] ?? null;
}

fs.mkdirSync(releaseDir, { recursive: true });

if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath, { force: true });
}

const startedAt = Date.now();
run(tauriBin, ['build', '--bundles', 'nsis'], {
  env: getEnvWithCargoPath(),
});

const installer = findNewestNsisInstaller(startedAt);

if (!installer) {
  console.error(`未找到刚生成的 Tauri NSIS 安装包: ${nsisDir}`);
  process.exit(1);
}

fs.copyFileSync(installer.filePath, outputPath);
console.log(`Windows Tauri 安装包已生成: ${outputPath}`);
