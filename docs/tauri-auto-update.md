# Tauri 自动更新发布说明

这个项目的 Tauri 版本使用官方 updater 插件做软件内更新。当前方案是手动发布到 GitHub Releases，软件启动时自动检查更新，用户也可以在主界面右侧点击“检查更新”。

## 当前更新源

- 更新清单地址：`https://github.com/Fitzfeichi/time-planner/releases/latest/download/latest.json`
- 更新安装包地址由 `scripts/package-tauri.cjs` 按版本号生成，格式是 GitHub tag `v版本号`。
- 例如 `0.1.1` 版本对应 tag：`v0.1.1`。

## 私钥和公钥

Tauri updater 必须校验签名。

- 公钥已经写入 `src-tauri/tauri.conf.json`。
- 私钥生成在 `release\tauri-updater.key`，这个文件不能提交到 GitHub。
- `release/` 已经在 `.gitignore` 中，所以默认不会提交。
- 如果私钥丢失，已经安装旧版本的用户将无法通过软件内更新到后续版本。

建议把 `release\tauri-updater.key` 单独备份到安全位置。以后换电脑发布时，需要恢复同一个私钥。

## 发布新版本

1. 修改版本号：
   - `package.json` 的 `version`
   - `src-tauri/Cargo.toml` 的 `version`
   - `src-tauri/tauri.conf.json` 的 `version`
2. 确认 `release\tauri-updater.key` 存在。
3. 运行：

```powershell
npm.cmd run package:tauri
```

4. 到 `release/` 目录确认生成了这些文件：
   - `半小时日计划-版本号-Windows-Tauri-安装包.exe`
   - `半小时日计划-版本号-Windows-Tauri-安装包.exe.sig`
   - `latest.json`
5. 在 GitHub 创建 tag 和 Release，例如 `v0.1.1`。
6. 上传上面三个文件到该 Release。
7. 已安装的 Tauri 软件下次打开时会自动检查更新；用户也可以点“检查更新”。

## 数据不丢的边界

当前日计划数据保存在同一个 Tauri 应用环境的 localStorage 中。只要应用 identifier 不变，并且更新是覆盖安装同一个应用，正常更新不会清空日计划数据。

不要随意修改 `src-tauri/tauri.conf.json` 里的 `identifier`。如果换 identifier，系统会把它当成另一个应用，本地数据可能无法沿用。

## GitHub 网络问题

当前方案先只使用 GitHub Releases。如果用户电脑不能访问 GitHub，软件内检查更新和下载安装包都会失败。

后续如果需要照顾中国大陆网络，可以再加一个国内 HTTPS 静态文件地址作为 updater endpoint，把 `latest.json` 和安装包同步到国内对象存储或其他稳定托管平台。
