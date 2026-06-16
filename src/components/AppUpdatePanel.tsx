import { useEffect, useRef, useState } from 'react';
import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater';
import type { ConfirmDialogContent } from './ConfirmDialog';

type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'installing' | 'error';

interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: unknown;
}

interface AppUpdatePanelProps {
  onConfirmRequest: (request: ConfirmDialogContent) => Promise<boolean>;
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

export function AppUpdatePanel({ onConfirmRequest }: AppUpdatePanelProps) {
  const isTauri = useRef(isTauriRuntime());
  const hasCheckedOnStartup = useRef(false);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
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

  async function confirmAndInstallUpdate(update: Update) {
    const shouldInstall = await onConfirmRequest({
      title: `发现新版本 ${update.version}`,
      message: '更新安装时软件会自动关闭并重启。',
      confirmLabel: '立即更新',
      cancelLabel: '稍后',
      tone: 'default',
    });

    if (!shouldInstall) {
      setMessage(`发现新版本 ${update.version}，你可以稍后再更新。`);
      return;
    }

    setPendingUpdate(null);
    await installUpdate(update);
  }

  async function checkForUpdate(source: 'startup' | 'manual') {
    if (!isTauri.current || phase === 'checking' || phase === 'downloading' || phase === 'installing') {
      return;
    }

    try {
      const { check } = await import('@tauri-apps/plugin-updater');

      if (source === 'manual') {
        setPhase('checking');
        setMessage('正在检查更新...');
      }

      const update = await check({ timeout: 30000 });

      if (update === null) {
        setPhase('idle');
        setPendingUpdate(null);
        setMessage(source === 'manual' ? '暂无更新，敬请期待~' : '启动时会自动检查更新。');

        if (source === 'manual') {
          await onConfirmRequest({
            title: '暂无更新',
            message: '暂无更新，敬请期待~',
            confirmLabel: '知道了',
            cancelLabel: null,
            tone: 'default',
          });
        }

        return;
      }

      setPhase('idle');
      setPendingUpdate(update);
      setMessage(`发现新版本 ${update.version}。`);

      if (source === 'startup') {
        return;
      }

      await confirmAndInstallUpdate(update);
    } catch (error) {
      setPhase('error');
      setMessage(error instanceof Error ? `检查更新失败：${error.message}` : '检查更新失败。');
    }
  }

  async function handleUpdateClick() {
    if (pendingUpdate !== null) {
      await confirmAndInstallUpdate(pendingUpdate);
      return;
    }

    await checkForUpdate('manual');
  }

  useEffect(() => {
    if (hasCheckedOnStartup.current) {
      return;
    }

    hasCheckedOnStartup.current = true;
    void checkForUpdate('startup');
  }, []);

  const isBusy = phase === 'checking' || phase === 'downloading' || phase === 'installing';
  const hasPendingUpdate = pendingUpdate !== null;

  return (
    <button
      type="button"
      className={hasPendingUpdate ? 'update-check-button primary-button' : 'update-check-button'}
      title={message}
      aria-label="软件更新"
      disabled={!isTauri.current || isBusy}
      onClick={() => void handleUpdateClick()}
    >
      {isBusy ? '检查更新中' : '更新'}
    </button>
  );
}
