import { useEffect, useRef, useState } from 'react';
import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater';

type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'installing' | 'error';

interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: unknown;
}

function isTauriRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  return (window as TauriWindow).__TAURI_INTERNALS__ !== undefined;
}

function formatProgress(downloadedBytes: number, contentLength: number | null) {
  if (contentLength === null || contentLength <= 0) {
    return '正在下载更新包...';
  }

  const progress = Math.min(99, Math.round((downloadedBytes / contentLength) * 100));
  return `正在下载更新包...${progress}%`;
}

export function AppUpdatePanel() {
  const isTauri = useRef(isTauriRuntime());
  const hasCheckedOnStartup = useRef(false);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [message, setMessage] = useState(
    isTauri.current ? '启动时会自动检查更新。' : '软件内更新仅支持 Tauri 安装版。',
  );

  async function installUpdate(update: Update) {
    const { relaunch } = await import('@tauri-apps/plugin-process');
    let downloadedBytes = 0;
    let contentLength: number | null = null;

    setPhase('downloading');
    setMessage('正在准备下载更新包...');

    await update.downloadAndInstall((event: DownloadEvent) => {
      if (event.event === 'Started') {
        downloadedBytes = 0;
        contentLength = event.data.contentLength ?? null;
        setMessage(formatProgress(downloadedBytes, contentLength));
        return;
      }

      if (event.event === 'Progress') {
        downloadedBytes += event.data.chunkLength;
        setMessage(formatProgress(downloadedBytes, contentLength));
        return;
      }

      setMessage('更新包下载完成，正在安装...');
    });

    setPhase('installing');
    setMessage('更新已安装，正在重启软件...');
    await relaunch();
  }

  async function checkForUpdate(source: 'startup' | 'manual') {
    if (!isTauri.current || phase === 'checking' || phase === 'downloading') {
      return;
    }

    try {
      const { check } = await import('@tauri-apps/plugin-updater');

      setPhase('checking');
      setMessage(source === 'manual' ? '正在检查更新...' : '正在自动检查更新...');

      const update = await check({ timeout: 30000 });

      if (update === null) {
        setPhase('idle');
        setMessage(source === 'manual' ? '当前已经是最新版本。' : '启动时会自动检查更新。');
        return;
      }

      setPhase('idle');
      setMessage(`发现新版本 ${update.version}。`);

      const shouldInstall = window.confirm(
        `发现新版本 ${update.version}，是否现在更新？\n\n更新安装时软件会自动关闭并重启。`,
      );

      if (!shouldInstall) {
        setMessage(`发现新版本 ${update.version}，你可以稍后再检查更新。`);
        return;
      }

      await installUpdate(update);
    } catch (error) {
      setPhase('error');
      setMessage(error instanceof Error ? `检查更新失败：${error.message}` : '检查更新失败。');
    }
  }

  useEffect(() => {
    if (hasCheckedOnStartup.current) {
      return;
    }

    hasCheckedOnStartup.current = true;
    void checkForUpdate('startup');
  }, []);

  const isBusy = phase === 'checking' || phase === 'downloading' || phase === 'installing';

  return (
    <section className="panel-block app-update-panel" aria-label="软件更新">
      <div className="panel-title">
        <strong>软件更新</strong>
        <p>{message}</p>
      </div>
      <button
        type="button"
        className="update-check-button"
        disabled={!isTauri.current || isBusy}
        onClick={() => void checkForUpdate('manual')}
      >
        {isBusy ? '更新处理中' : '检查更新'}
      </button>
    </section>
  );
}
