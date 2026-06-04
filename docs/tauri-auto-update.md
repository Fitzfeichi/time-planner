# Tauri 自动更新发布说明

这个项目的 Tauri 版本使用官方 updater 插件做软件内更新。当前方案是手动发布更新文件，软件启动时自动检查更新，用户也可以在主界面右侧点击“检查更新”。

## 当前更新源

- 国内优先更新清单地址：`https://time-planner-update-8976988489.oss-cn-shanghai.aliyuncs.com/latest.json`
- 备用更新清单地址：`https://github.com/Fitzfeichi/time-planner/releases/latest/download/latest.json`
- 更新安装包地址由 `scripts/package-tauri.cjs` 生成到 `latest.json`，当前指向同一个 OSS Bucket 根目录。

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
5. 上传上面三个文件到阿里云 OSS Bucket 根目录。
6. 在浏览器直接打开 OSS 上的 `latest.json`，确认返回 JSON 内容，而不是登录页、下载页或 403。
7. 在浏览器直接打开 `latest.json` 里的安装包 URL，确认可以下载 `.exe` 安装包。
8. 可选：在 GitHub 创建 tag 和 Release，例如 `v0.1.1`，并上传同样三个文件作为备用源。
9. 已安装的 Tauri 软件下次打开时会自动检查更新；用户也可以点“检查更新”。

## 数据不丢的边界

当前日计划数据保存在同一个 Tauri 应用环境的 localStorage 中。只要应用 identifier 不变，并且更新是覆盖安装同一个应用，正常更新不会清空日计划数据。

不要随意修改 `src-tauri/tauri.conf.json` 里的 `identifier`。如果换 identifier，系统会把它当成另一个应用，本地数据可能无法沿用。

## OSS 更新源要求

- OSS 文件必须允许公网读取。
- OSS 访问地址必须是 HTTPS。
- `latest.json`、安装包、`.sig` 要放在同一个发布目录中。
- `latest.json` 里的安装包 URL 必须和 OSS 上的真实文件名一致。

## GitHub 备用源

当前配置会先访问阿里云 OSS，再把 GitHub Releases 作为备用 endpoint。如果用户电脑不能访问 GitHub，只要 OSS 上的 `latest.json` 和安装包可访问，软件内检查更新和下载安装包仍然可以正常走国内更新源。
