# 半小时日计划

一个给个人使用的中文时间管理工具原型。它把一天拆成 48 个半小时时间格，用来记录计划、实际执行情况、状态和日复盘。

## 当前阶段

当前是第一阶段：React 前端 + Electron 桌面壳原型。

这个阶段不接数据库，不做本地文件存储。页面逻辑仍然是 React，桌面窗口由 Electron 提供。你在页面里输入的数据会保存在当前 Electron / 浏览器环境的 localStorage 中；如果清理应用或浏览器数据，记录也可能被清掉。

## 已实现功能

- 一天按 30 分钟划分为 48 个时间格。
- 时间范围从 00:00 到 24:00。
- 左侧显示全天时间表。
- 每个时间格显示时间范围、计划内容、实际内容和状态。
- 点击时间格后，右侧可以编辑计划内容、实际内容和状态。
- 状态包括：空白、已计划、完成、偏离计划。
- 顶部有前一天、后一天、回到今天按钮。
- 查看当天时，当前真实时间所在的半小时格会高亮。
- 右侧显示当前半小时任务卡片，可以一眼看到当前计划。
- 可以从主界面打开真正的 Electron 当前任务小窗，只显示当前时间段任务。
- 右侧包含今日复盘输入区域。

## 项目结构

```text
src/
  components/
    DayHeader.tsx      顶部日期区域
    TimeTable.tsx      左侧时间表
    CurrentTaskCard.tsx 当前任务卡片和小窗内容
    SlotEditor.tsx     右侧时间格编辑
    ReviewPanel.tsx    今日复盘
  lib/
    status.ts          状态中文文案
    timeSlots.ts       半小时时间格生成逻辑
  App.tsx              页面状态和整体布局
  main.tsx             React 启动入口
  styles.css           页面样式
  types.ts             数据类型
electron/
  main.cjs             Electron 主进程，创建主窗口和当前任务小窗
  preload.cjs          安全暴露打开小窗能力给 React
```

## 日常使用

如果你只是想使用这个工具，不需要每次打开调试服务器。

第一次或代码改动后，执行一次构建：

```powershell
npm.cmd run build
```

构建成功后，日常使用有三种方式：

- 双击项目根目录里的 `打开日计划.bat`，会先构建页面，再用 Electron 打开主日程窗口。
- 双击项目根目录里的 `打开当前任务小窗.bat`，会先构建页面，再用 Electron 直接打开当前任务小窗。
- 或直接打开 `dist\index.html`。

注意：`dist` 是构建产物。`npm.cmd run build` 会把 JS 和 CSS 内嵌进 `dist\index.html`，方便直接双击打开。以后如果修改了 `src` 里的代码，需要重新执行 `npm.cmd run build`，`dist\index.html` 才会更新。

在主界面点击“打开小窗”，或双击 `打开当前任务小窗.bat`，都会打开一个只显示当前任务的小窗口。这个小窗由 Electron 创建，不再依赖 Edge。

说明：当前 Electron 第一阶段只做主窗口和当前任务小窗；暂时不做置顶、托盘和安装包。

## 开发运行

在 Windows 的 PowerShell 或命令提示符中进入项目目录：

```powershell
cd G:\Documents\桌面管理
```

安装依赖：

```powershell
npm.cmd install
```

启动本地开发页面：

```powershell
npm.cmd run dev
```

成功后终端会显示类似：

```text
Local: http://localhost:5173/
```

用浏览器打开这个地址即可查看页面。

启动 Electron 桌面版：

```powershell
npm.cmd run desktop:start
```

## 如何验证

执行：

```powershell
npm.cmd run build
```

如果看到构建成功，说明当前代码可以正常打包。

如果要验证桌面窗口，执行：

```powershell
npm.cmd run desktop:start
```

## 下一步建议

第二步可以先做“按日期分别保存页面内数据”。仍然不引入数据库，只把当前单份 `dayPlan` 改成以日期为 key 的 React state。这样点击前一天、后一天时，每一天都会有自己的计划和复盘。
