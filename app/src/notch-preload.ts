import { contextBridge, ipcRenderer } from 'electron';

// IPC bridge exposed to the notch renderer process.
// Main → Renderer: start-recording, stop-recording, show-transcribing
// Renderer → Main: notch:recording-data (ArrayBuffer)

contextBridge.exposeInMainWorld('notch', {
  onStartRecording:  (cb: () => void) => ipcRenderer.on('notch:start-recording',  () => cb()),
  onStopRecording:   (cb: () => void) => ipcRenderer.on('notch:stop-recording',   () => cb()),
  onShowTranscribing:(cb: () => void) => ipcRenderer.on('notch:show-transcribing',() => cb()),

  sendRecordingData: (buffer: ArrayBuffer) =>
    ipcRenderer.send('notch:recording-data', buffer),
});
