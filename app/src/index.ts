import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import clipboardy from 'clipboardy';
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import {
	initializeDatabase,
	saveTranscription,
	getAllTranscriptions,
	deleteTranscription,
	clearAllTranscriptions,
	getTranscriptionCount,
	closeDatabase,
	type TranscriptionRecord
} from './main/database';
import { startHotkeyListener, stopHotkeyListener, setStateChangeCallback, forceIdle } from './main/hotkeys';
import { runTranscriptionPipeline } from './main/transcription';

declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const NOTCH_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const NOTCH_WINDOW_WEBPACK_ENTRY: string;

dotenv.config();

let sidecarProcess: ChildProcessWithoutNullStreams | null = null;
let sidecarReady = false;
let notchWindow: BrowserWindow | null = null;

const SIDECAR_PORT = 8000;
const HEALTH_URL = `http://127.0.0.1:${SIDECAR_PORT}/health`;
const TRANSCRIBE_URL = `http://127.0.0.1:${SIDECAR_PORT}/transcribe`;

type TranscribeAudioPayload = {
  fileName: string;
  fileBuffer: ArrayBuffer;
};

type TranscribeAudioResult = {
  text: string;
  language: string;
  confidence: number;
};

ipcMain.handle('vesper:transcribe-audio', async (_event, payload: TranscribeAudioPayload) => {
  if (!sidecarReady) {
    throw new Error('Sidecar is not ready yet. Please wait a moment and try again.');
  }

  const response = await fetch(TRANSCRIBE_URL, {
    method: 'POST',
    body: (() => {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([payload.fileBuffer], { type: 'application/octet-stream' }),
        payload.fileName,
      );
      return formData;
    })(),
  });

  if (!response.ok) {
    throw new Error(`Transcribe request failed with ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as TranscribeAudioResult;
});

ipcMain.handle('vesper:copy-text', async (_event, text: string) => {
  await clipboardy.write(text);
  return true;
});

// History IPC Handlers
ipcMain.handle('vesper:save-transcription', async (_event, payload: { fileName: string; text: string; language: string; confidence: number }) => {
  return saveTranscription(payload.fileName, payload.text, payload.language, payload.confidence);
});

ipcMain.handle('vesper:get-history', async (_event, limit = 100, offset = 0) => {
  return getAllTranscriptions(limit, offset);
});

ipcMain.handle('vesper:delete-transcription', async (_event, id: number) => {
  return deleteTranscription(id);
});

ipcMain.handle('vesper:clear-history', async () => {
  return clearAllTranscriptions();
});

ipcMain.handle('vesper:get-history-count', async () => {
  return getTranscriptionCount();
});

function getServerPaths() {
  const isDev = !app.isPackaged;

  if (isDev) {
    const serverDir = path.join(__dirname, '..', '..', '..', 'server');
    const pythonExe = resolvePythonExecutable(serverDir);
    const scriptPath = path.join(serverDir, 'main.py');
    return { serverDir, pythonExe, scriptPath };
  }

  const serverDir = path.join(process.resourcesPath, 'server');
  const pythonExe = resolvePythonExecutable(serverDir);
  const scriptPath = path.join(serverDir, 'main.py');
  return { serverDir, pythonExe, scriptPath };
}

function resolvePythonExecutable(serverDir: string) {
  const pythonExePath = process.env.PYTHON_EXE_PATH;

  if (!pythonExePath) {
    throw new Error(
      'Missing PYTHON_EXE_PATH. Set it in app/.env, then restart the app.',
    );
  }

  if (!existsSync(pythonExePath)) {
    throw new Error(
      `PYTHON_EXE_PATH does not exist: ${pythonExePath}. Check app/.env and confirm the conda environment path is correct.`,
    );
  }

  return pythonExePath;
}

function checkHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(maxAttempts = 60, intervalMs = 500): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const healthy = await checkHealth();
    if (healthy) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

async function startSidecar(): Promise<void> {
  const { serverDir, pythonExe, scriptPath } = getServerPaths();

  console.log('Sidecar starting...');
  console.log('[sidecar] launching:', pythonExe, scriptPath);

  sidecarProcess = spawn(
    pythonExe,
    ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(SIDECAR_PORT)],
    {
      cwd: serverDir,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: serverDir,
      },
    },
  );

  sidecarProcess.stdout.on('data', (data) => {
    console.log(`[sidecar stdout] ${data.toString().trim()}`);
  });

  sidecarProcess.stderr.on('data', (data) => {
    console.log(`[sidecar stderr] ${data.toString().trim()}`);
  });

  sidecarProcess.on('exit', (code, signal) => {
    console.log(`[sidecar] exited with code ${code}, signal ${signal}`);
    sidecarProcess = null;
  });

  sidecarProcess.on('error', (error) => {
    console.error('[sidecar] failed to start:', error);
  });

  const healthy = await waitForHealth();

  if (!healthy) {
    const error = new Error('Sidecar did not become healthy in time');
    console.error('Sidecar failed: ', error);
    throw error;
  }

  sidecarReady = true;

  console.log('Sidecar ready');
  console.log('[sidecar] ready.');
}

function stopSidecar(): void {
  if (!sidecarProcess) {
    return;
  }

  console.log('[sidecar] stopping...');

  if (process.platform === 'win32' && sidecarProcess.pid) {
    spawn('taskkill', ['/pid', String(sidecarProcess.pid), '/T', '/F']);
  } else {
    sidecarProcess.kill();
  }

  sidecarProcess = null;
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

function createNotchWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 200;
  const height = 44;
  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = workArea.y + workArea.height - height;

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    show: false, // hidden on creation; revealed only when recording starts
    webPreferences: {
      preload: NOTCH_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadURL(NOTCH_WINDOW_WEBPACK_ENTRY);
  return win;
}

// Notch toggle — test trigger for Milestone 5; real hotkeys come in Milestone 6
ipcMain.handle('vesper:toggle-notch', () => {
  if (!notchWindow || notchWindow.isDestroyed()) return;
  if (notchWindow.isVisible()) {
    notchWindow.hide();
  } else {
    notchWindow.showInactive();
  }
});

app.whenReady().then(async () => {
  try {
    // Initialize database first
    await initializeDatabase();
    
    await startSidecar();
    createWindow();

    // Create the notch window — hidden until the first hotkey triggers recording.
    notchWindow = createNotchWindow();

    // Wire state-change callback BEFORE starting the hotkey listener.
    // Register the ipcMain listener first to avoid a race with the renderer.
    setStateChangeCallback(async (newState) => {
      if (!notchWindow || notchWindow.isDestroyed()) return;

      switch (newState) {
        case 'recording_ptt':
        case 'recording_locked':
          notchWindow.showInactive();
          notchWindow.webContents.send('notch:start-recording');
          break;

        case 'transcribing': {
          // 1. Register listener BEFORE sending stop to avoid race condition.
          const bufferPromise = new Promise<ArrayBuffer>((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error('Recording data timed out after 30 s')),
              30_000,
            );
            ipcMain.once('notch:recording-data', (_evt, data: ArrayBuffer) => {
              clearTimeout(timeout);
              resolve(data);
            });
          });

          // 2. Tell the renderer to stop recording and show the loading ring.
          notchWindow.webContents.send('notch:stop-recording');
          notchWindow.webContents.send('notch:show-transcribing');

          // 3. Await the recorded data then run the full pipeline.
          try {
            const buffer = await bufferPromise;
            await runTranscriptionPipeline(buffer, () => {
              notchWindow?.hide();
              forceIdle();
            });
          } catch (err) {
            console.error('[main] Transcription pipeline error:', err);
            notchWindow?.hide();
            forceIdle();
          }
          break;
        }

        default:
          break;
      }
    });

    // Start the global hotkey listener (state machine)
    startHotkeyListener();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('App initialization failed: ', error);
    app.quit();
  }
});

app.on('before-quit', () => {
  stopSidecar();
  stopHotkeyListener();
  closeDatabase();
  if (notchWindow && !notchWindow.isDestroyed()) {
    notchWindow.destroy();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
