import { contextBridge, ipcRenderer } from 'electron';

export type TranscriptionRecord = {
	id: number;
	filename: string;
	text: string;
	language: string;
	confidence: number;
	created_at: string;
};

contextBridge.exposeInMainWorld('vesper', {
	// Transcription
	transcribeAudio: (fileName: string, fileBuffer: ArrayBuffer) =>
		ipcRenderer.invoke('vesper:transcribe-audio', { fileName, fileBuffer }),
	
	// Clipboard
	copyText: (text: string) => ipcRenderer.invoke('vesper:copy-text', text),
	
	// History
	saveTranscription: (fileName: string, text: string, language: string, confidence: number) =>
		ipcRenderer.invoke('vesper:save-transcription', { fileName, text, language, confidence }),
	
	getHistory: (limit?: number, offset?: number) =>
		ipcRenderer.invoke('vesper:get-history', limit, offset),
	
	deleteTranscription: (id: number) =>
		ipcRenderer.invoke('vesper:delete-transcription', id),
	
	clearHistory: () =>
		ipcRenderer.invoke('vesper:clear-history'),
	
	getHistoryCount: () =>
		ipcRenderer.invoke('vesper:get-history-count'),
});