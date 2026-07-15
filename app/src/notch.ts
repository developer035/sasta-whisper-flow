import './notch.css';

// ─── IPC bridge (injected by notch-preload.ts) ────────────────────────────────

type NotchBridge = {
  onStartRecording:   (cb: () => void) => void;
  onStopRecording:    (cb: () => void) => void;
  onShowTranscribing: (cb: () => void) => void;
  sendRecordingData:  (buffer: ArrayBuffer) => void;
};

const bridge = (window as unknown as Window & { notch: NotchBridge }).notch;

// ─── Constants ────────────────────────────────────────────────────────────────

const BAR_COUNT = 14;

// ─── Build DOM ───────────────────────────────────────────────────────────────

const pill = document.createElement('div');
pill.className = 'notch-pill';

// ── Recording view ───────────────────────────────────────────────────────────

const recordingView = document.createElement('div');
recordingView.className = 'notch-view notch-recording';

const recDot = document.createElement('div');
recDot.className = 'rec-dot';

const waveformEl = document.createElement('div');
waveformEl.className = 'waveform';

const bars: HTMLDivElement[] = Array.from({ length: BAR_COUNT }, () => {
  const bar = document.createElement('div');
  bar.className = 'waveform-bar';
  waveformEl.appendChild(bar);
  return bar;
});

recordingView.append(recDot, waveformEl);

// ── Transcribing view ────────────────────────────────────────────────────────

const transcribingView = document.createElement('div');
transcribingView.className = 'notch-view notch-transcribing';
transcribingView.hidden = true;

// SVG loading ring
const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(SVG_NS, 'svg');
svg.setAttribute('width', '22');
svg.setAttribute('height', '22');
svg.setAttribute('viewBox', '0 0 22 22');
svg.classList.add('loading-ring');

const trackCircle = document.createElementNS(SVG_NS, 'circle');
trackCircle.setAttribute('cx', '11');
trackCircle.setAttribute('cy', '11');
trackCircle.setAttribute('r', '8');
trackCircle.setAttribute('fill', 'none');
trackCircle.setAttribute('stroke', '#262d3a');
trackCircle.setAttribute('stroke-width', '2.5');

const arcCircle = document.createElementNS(SVG_NS, 'circle');
arcCircle.setAttribute('cx', '11');
arcCircle.setAttribute('cy', '11');
arcCircle.setAttribute('r', '8');
arcCircle.setAttribute('fill', 'none');
arcCircle.setAttribute('stroke', '#e8a33d');
arcCircle.setAttribute('stroke-width', '2.5');
arcCircle.setAttribute('stroke-dasharray', '18 32');
arcCircle.setAttribute('stroke-linecap', 'round');
arcCircle.classList.add('ring-arc');

svg.append(trackCircle, arcCircle);

const transcribingLabel = document.createElement('span');
transcribingLabel.className = 'transcribing-label';
transcribingLabel.textContent = 'transcribing...';

transcribingView.append(svg, transcribingLabel);

// ── Mount ────────────────────────────────────────────────────────────────────

pill.append(recordingView, transcribingView);
pill.hidden = true; // stays hidden until the first notch:start-recording IPC arrives
document.body.appendChild(pill);

// ─── Audio state ──────────────────────────────────────────────────────────────

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let animId: number | null = null;

// ─── Waveform animation ───────────────────────────────────────────────────────

function startDraw(): void {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);

  function frame() {
    animId = requestAnimationFrame(frame);
    analyser!.getByteFrequencyData(data);
    bars.forEach((bar, i) => {
      const bin = Math.floor(i * data.length / BAR_COUNT);
      const h   = Math.max(2, (data[bin]! / 255) * 26);
      bar.style.height = `${h}px`;
    });
  }
  frame();
}

function stopDraw(): void {
  if (animId !== null) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

function resetBars(): void {
  bars.forEach(b => { b.style.height = '2px'; });
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

bridge.onStartRecording(async () => {
  // Un-hide the pill on first use (it starts hidden to avoid showing on launch)
  pill.hidden = false;

  // Reset to recording view
  recordingView.hidden = false;
  transcribingView.hidden = true;
  resetBars();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioCtx  = new AudioContext();
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;

    audioCtx.createMediaStreamSource(stream).connect(analyser);

    audioChunks   = [];
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.start(250); // chunk every 250 ms
    startDraw();
  } catch (err) {
    console.error('[notch] getUserMedia failed:', err);
    bridge.sendRecordingData(new ArrayBuffer(0)); // signal failure
  }
});

bridge.onStopRecording(() => {
  stopDraw();

  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    bridge.sendRecordingData(new ArrayBuffer(0));
    return;
  }

  // Collect remaining chunks then send the buffer
  mediaRecorder.onstop = async () => {
    const blob   = new Blob(audioChunks, { type: 'audio/webm' });
    const buffer = await blob.arrayBuffer();
    bridge.sendRecordingData(buffer);

    if (audioCtx) {
      await audioCtx.close();
      audioCtx  = null;
      analyser  = null;
    }
  };

  mediaRecorder.stop();
});

bridge.onShowTranscribing(() => {
  stopDraw();
  resetBars();
  recordingView.hidden    = true;
  transcribingView.hidden = false;
});
