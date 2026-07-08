import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import { app } from 'electron';

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
  const explicitPythonExe = process.env.VESPER_PYTHON_EXE;
  if (explicitPythonExe) {
    return explicitPythonExe;
  }

  const condaPrefix = process.env.CONDA_PREFIX;
  if (condaPrefix) {
    return path.join(condaPrefix, 'python.exe');
  }

  const condaEnv = process.env.CONDA_DEFAULT_ENV;
  if (condaEnv && process.env.CONDA_EXE) {
    const condaBase = path.dirname(process.env.CONDA_EXE);
    return path.join(condaBase, 'envs', condaEnv, 'python.exe');
  }

  return path.join(serverDir, 'venv', 'Scripts', 'python.exe');
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

export async function startSidecar(): Promise<void> {
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
    console.error('Sidecar failed: ', new Error('Sidecar did not become healthy in time'));
    throw new Error('Sidecar did not become healthy in time');
  }

  console.log('Sidecar ready');
  console.log('[sidecar] ready.');
}

export function stopSidecar(): void {
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