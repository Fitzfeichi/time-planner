# 半小时日计划

一个运行在 Windows 本地的中文时间管理工具。它把一天拆成 48 个半小时格，方便记录计划、实际执行情况、当前状态和当天复盘。

## 主要功能

- 按 30 分钟划分一天，从 00:00 到 24:00 共 48 个时间格。
- 每个时间格可以填写计划内容、实际内容和状态。
- 支持前一天、今天、后一天切换，每个日期的数据独立保存。
- 查看当天时，会高亮当前真实时间所在的半小时格。
- 右侧显示当前任务卡片，方便快速看到现在该做什么。
- 支持打开当前任务小窗，小窗可以置顶、最小化和关闭。
- 支持今日复盘输入，适合每天结束后回顾。
- 支持 Tauri 安装版自动检查更新。
- 数据保存在本机 Tauri / 浏览器开发环境的 localStorage 中，不上传云端。

## 使用方式

这个项目目前是个人本地工具原型。第一次运行前需要先安装依赖：

```powershell
npm.cmd install
```

启动 Tauri 桌面开发版：

```powershell
npm.cmd run tauri:dev
```

如果只想构建前端页面：

```powershell
npm.cmd run build
```

## 打包

生成 Tauri Windows 安装包、签名和自动更新清单：

```powershell
npm.cmd run tauri:build
```

`package:tauri` 是同一条发布打包路径的别名：

```powershell
npm.cmd run package:tauri
```

打包产物会输出到 `src-tauri\target\release\bundle` 和 `release` 目录。`release` 属于本地构建产物，不提交到 GitHub。

Tauri 自动更新优先使用阿里云 OSS 更新源，GitHub Releases 作为备用源。发布步骤见 `docs/tauri-auto-update.md`。

## 数据说明

当前版本不做账号登录、云同步或多设备同步。计划和复盘数据保存在当前电脑的 Tauri / 浏览器开发环境本地存储中；如果清理应用数据、浏览器数据或更换运行环境，记录可能会丢失。

## 技术栈

- React
- TypeScript
- Vite
- Tauri

## 项目状态

这是一个面向个人使用场景的本地桌面工具原型，重点是低门槛记录每天的计划和执行情况。后续可以继续扩展提醒、托盘入口、数据导入导出或更稳定的本地文件保存，但当前版本先保持轻量。
