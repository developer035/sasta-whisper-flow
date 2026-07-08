import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vesper', {
	transcribeAudio: (fileName: string, fileBuffer: ArrayBuffer) =>
		ipcRenderer.invoke('vesper:transcribe-audio', { fileName, fileBuffer }),
	copyText: (text: string) => ipcRenderer.invoke('vesper:copy-text', text),
});