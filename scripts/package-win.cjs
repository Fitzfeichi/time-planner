const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(rootDir, 'package.json'));
const productName = packageJson.build?.productName ?? packageJson.name;
const version = packageJson.version;
const packageName = `${productName}-${version}-Windows-免安装`;
const releaseDir = path.join(rootDir, 'release');
const unpackedDir = path.join(releaseDir, 'win-unpacked');
const stagingDir = path.join(releaseDir, packageName);
const zipPath = path.join(releaseDir, `${packageName}.zip`);
const portablePath = path.join(releaseDir, `${productName}-${version}-Windows-便携版.exe`);
const electronBuilderBin = process.platform === 'win32'
  ? 'node_modules\\.bin\\electron-builder.cmd'
  : path.join(rootDir, 'node_modules', '.bin', 'electron-builder');

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

function resolveReleasePath(targetPath) {
  const resolvedPath = path.resolve(targetPath);
  const resolvedReleaseDir = path.resolve(releaseDir);

  if (resolvedPath !== resolvedReleaseDir && !resolvedPath.startsWith(`${resolvedReleaseDir}${path.sep}`)) {
    throw new Error(`Refusing to remove path outside release: ${resolvedPath}`);
  }

  return resolvedPath;
}

function removeReleasePath(targetPath) {
  const resolvedPath = resolveReleasePath(targetPath);

  if (fs.existsSync(resolvedPath)) {
    fs.rmSync(resolvedPath, { recursive: true, force: true });
  }
}

fs.mkdirSync(releaseDir, { recursive: true });
removeReleasePath(unpackedDir);
removeReleasePath(stagingDir);
removeReleasePath(zipPath);
removeReleasePath(portablePath);

run('npm.cmd', ['run', 'build']);

console.log('开始生成 Windows 便携版 exe。');
const portableStartedAt = Date.now();
run(electronBuilderBin, ['--win', 'portable'], {
  env: {
    ...process.env,
    ELECTRON_BUILDER_CACHE: path.join(rootDir, '.electron-builder-cache'),
  },
});

const portableCandidate = fs.readdirSync(releaseDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
  .map((entry) => {
    const filePath = path.join(releaseDir, entry.name);
    return {
      filePath,
      modifiedAt: fs.statSync(filePath).mtimeMs,
    };
  })
  .filter((entry) => entry.modifiedAt >= portableStartedAt - 1000)
  .sort((left, right) => right.modifiedAt - left.modifiedAt)[0];

if (!portableCandidate) {
  console.error('未找到刚生成的便携版 exe。');
  process.exit(1);
}

if (portableCandidate.filePath !== portablePath) {
  fs.renameSync(portableCandidate.filePath, portablePath);
}

removeReleasePath(unpackedDir);
removeReleasePath(stagingDir);
removeReleasePath(zipPath);

console.log(`Windows 便携版 exe 已生成: ${portablePath}`);
