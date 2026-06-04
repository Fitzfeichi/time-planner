const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(rootDir, 'package.json'));
const tauriConfig = require(path.join(rootDir, 'src-tauri', 'tauri.conf.json'));
const productName = tauriConfig.productName ?? packageJson.name;
const version = packageJson.version;
const updateMirrorBaseUrl = 'https://time-planner-update-8976988489.oss-cn-shanghai.aliyuncs.com';
const releaseDir = path.join(rootDir, 'release');
const nsisDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const latestJsonPath = path.join(releaseDir, 'latest.json');
const signingKeyPath = path.join(releaseDir, 'tauri-updater.key');
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

if (!fs.existsSync(signingKeyPath)) {
  console.error(`未找到 Tauri 更新签名私钥: ${signingKeyPath}`);
  console.error('请先生成或恢复私钥，否则无法生成可自动更新的安装包。');
  process.exit(1);
}

const startedAt = Date.now();
run(tauriBin, ['build', '--bundles', 'nsis'], {
  env: {
    ...getEnvWithCargoPath(),
    TAURI_SIGNING_PRIVATE_KEY: fs.readFileSync(signingKeyPath, 'utf8').trim(),
    TAURI_SIGNING_PRIVATE_KEY_PATH: signingKeyPath,
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '',
  },
});

const installer = findNewestNsisInstaller(startedAt);

if (!installer) {
  console.error(`未找到刚生成的 Tauri NSIS 安装包: ${nsisDir}`);
  process.exit(1);
}

const signaturePath = `${installer.filePath}.sig`;
const outputPath = path.join(releaseDir, path.basename(installer.filePath));
const outputSignaturePath = `${outputPath}.sig`;

if (!fs.existsSync(signaturePath)) {
  console.error(`未找到刚生成的 Tauri 更新签名文件: ${signaturePath}`);
  process.exit(1);
}

if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath, { force: true });
}

if (fs.existsSync(outputSignaturePath)) {
  fs.rmSync(outputSignaturePath, { force: true });
}

fs.copyFileSync(installer.filePath, outputPath);
fs.copyFileSync(signaturePath, outputSignaturePath);

const assetName = path.basename(outputPath);
const latestJson = {
  version,
  notes: `${productName} ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: fs.readFileSync(signaturePath, 'utf8').trim(),
      url: `${updateMirrorBaseUrl}/${encodeURIComponent(assetName)}`,
    },
  },
};

fs.writeFileSync(latestJsonPath, `${JSON.stringify(latestJson, null, 2)}\n`, 'utf8');

console.log(`Windows Tauri 安装包已生成: ${outputPath}`);
console.log(`Windows Tauri 更新签名已生成: ${outputSignaturePath}`);
console.log(`Tauri 更新清单已生成: ${latestJsonPath}`);
