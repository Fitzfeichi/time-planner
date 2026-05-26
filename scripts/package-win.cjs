const path = require('node:path');
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

function quotePowerShellPath(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runPowerShell(command) {
  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    command,
  ], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npm.cmd', ['run', 'build']);
run(electronBuilderBin, ['--win', '--dir'], {
  env: {
    ...process.env,
    ELECTRON_BUILDER_CACHE: path.join(rootDir, '.electron-builder-cache'),
  },
});

console.log('Electron 文件夹打包完成，开始生成 zip。');
runPowerShell([
  `$unpacked = ${quotePowerShellPath(unpackedDir)}`,
  `$staging = ${quotePowerShellPath(stagingDir)}`,
  `$destination = ${quotePowerShellPath(zipPath)}`,
  'if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }',
  'if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }',
  'Copy-Item -LiteralPath $unpacked -Destination $staging -Recurse -Force',
  'Write-Host "临时免安装目录准备完成，开始压缩。"',
  '$source = $staging',
  'Compress-Archive -LiteralPath $source -DestinationPath $destination -Force',
].join('; '));

console.log(`Windows 免安装试用包已生成: ${zipPath}`);
