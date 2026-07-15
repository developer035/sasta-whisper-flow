// __non_webpack_require__ bypasses webpack's module resolver so ffmpeg-static
// returns the real node_modules binary path, not a bogus .webpack/main/ffmpeg.exe.
declare const __non_webpack_require__: NodeRequire;
const ffmpegPath: string | null = __non_webpack_require__('ffmpeg-static');
import { spawn }   from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir }  from 'node:os';
import { join }    from 'node:path';
import clipboardy  from 'clipboardy';
import { keyboard, Key } from '@nut-tree-fork/nut-js';
import { saveTranscription } from './database';

const TRANSCRIBE_URL = 'http://127.0.0.1:8000/transcribe';

// ─── webm → 16-kHz mono wav ──────────────────────────────────────────────────

async function webmToWav(webmBuffer: ArrayBuffer): Promise<Buffer> {
  if (!ffmpegPath) throw new Error('[transcription] ffmpeg-static binary not found');

  const ts         = Date.now();
  const inputPath  = join(tmpdir(), `vesper-in-${ts}.webm`);
  const outputPath = join(tmpdir(), `vesper-out-${ts}.wav`);

  writeFileSync(inputPath, Buffer.from(webmBuffer));

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      ffmpegPath,
      ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputPath],
      { windowsHide: true },
    );
    proc.stderr.on('data', (d: Buffer) => console.log(`[ffmpeg] ${d.toString().trim()}`));
    proc.on('close', (code: number | null) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)),
    );
    proc.on('error', reject);
  });

  const wav = readFileSync(outputPath);
  try { unlinkSync(inputPath);  } catch {}
  try { unlinkSync(outputPath); } catch {}
  return wav;
}

// ─── POST to /transcribe ─────────────────────────────────────────────────────

async function postTranscribe(wav: Buffer, filename: string) {
  const fd = new FormData();
  fd.append('file', new Blob([wav], { type: 'audio/wav' }), filename);

  const res = await fetch(TRANSCRIBE_URL, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`Transcribe failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<{ text: string; language: string; confidence: number }>;
}

// ─── Paste into focused app ──────────────────────────────────────────────────

async function pasteText(text: string): Promise<void> {
  await clipboardy.write(text);
  await new Promise(r => setTimeout(r, 80)); // let clipboard settle on Windows
  keyboard.config.autoDelayMs = 0;
  await keyboard.pressKey(Key.LeftControl, Key.V);
  await keyboard.releaseKey(Key.LeftControl, Key.V);
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Converts the raw webm ArrayBuffer from the notch renderer into wav,
 * transcribes it, pastes the result, saves to SQLite, then calls onComplete.
 * onComplete is always called (even on error) so the state machine can
 * return to idle and the notch can be hidden.
 */
export async function runTranscriptionPipeline(
  webmBuffer: ArrayBuffer,
  onComplete: () => void,
): Promise<void> {
  if (!webmBuffer || webmBuffer.byteLength === 0) {
    console.warn('[transcription] Empty recording buffer — skipping pipeline');
    onComplete();
    return;
  }

  const filename = `live-${Date.now()}`;

  try {
    const wav    = await webmToWav(webmBuffer);
    const result = await postTranscribe(wav, `${filename}.wav`);

    console.log(`[transcription] "${result.text.slice(0, 80)}"`);

    await pasteText(result.text);

    saveTranscription(
      `${filename}.webm`,
      result.text,
      result.language,
      result.confidence,
      'live-dictation',
    );
  } catch (err) {
    console.error('[transcription] Pipeline error:', err);
  } finally {
    onComplete();
  }
}
