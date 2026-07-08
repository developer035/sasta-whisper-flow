import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { app, BrowserWindow } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

dotenv.config();

let sidecarProcess: ChildProcessWithoutNullStreams | null = null;

const SIDECAR_PORT = 8000;
const HEALTH_URL = `http://127.0.0.1:${SIDECAR_PORT}/health`;

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
      'Missing PYTHON_EXE_PATH. Set it in desktop_app/.env, then restart the app.',
    );
  }

  if (!existsSync(pythonExePath)) {
    throw new Error(
      `PYTHON_EXE_PATH does not exist: ${pythonExePath}. Check desktop_app/.env and confirm the conda environment path is correct.`,
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
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

app.whenReady().then(async () => {
  try {
    await startSidecar();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Sidecar failed: ', error);
    app.quit();
  }
});

app.on('before-quit', () => {
  stopSidecar();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});