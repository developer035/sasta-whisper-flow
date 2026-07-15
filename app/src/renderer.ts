import './style.css';

type TabKey = 'upload' | 'history';

type TranscribeResponse = {
	text: string;
	language: string;
	confidence: number;
};

export type TranscriptionRecord = {
	id: number;
	filename: string;
	text: string;
	language: string;
	confidence: number;
	created_at: string;
};

type VesperApi = {
	transcribeAudio: (fileName: string, fileBuffer: ArrayBuffer) => Promise<TranscribeResponse>;
	copyText: (text: string) => Promise<boolean>;
	saveTranscription: (fileName: string, text: string, language: string, confidence: number) => Promise<TranscriptionRecord>;
	getHistory: (limit?: number, offset?: number) => Promise<TranscriptionRecord[]>;
	deleteTranscription: (id: number) => Promise<boolean>;
	clearHistory: () => Promise<boolean>;
	getHistoryCount: () => Promise<number>;
	toggleNotch: () => Promise<void>;
};

const vesper = (window as unknown as Window & { vesper: VesperApi }).vesper;

const root = document.createElement('main');
root.className = 'app-shell';

const header = document.createElement('header');
header.className = 'app-shell__header';

const titleBlock = document.createElement('div');
titleBlock.className = 'app-shell__title-block';

const eyebrow = document.createElement('p');
eyebrow.className = 'app-shell__eyebrow';
eyebrow.textContent = 'Local voice dictation';

const heading = document.createElement('h1');
heading.className = 'app-shell__title';
heading.textContent = 'Vesper';

const subheading = document.createElement('p');
subheading.className = 'app-shell__subtitle';
subheading.textContent = 'Upload audio, transcribe locally, and keep a lightweight history ready for the next milestone.';

titleBlock.append(eyebrow, heading, subheading);

const statusChip = document.createElement('div');
statusChip.className = 'status-chip';
statusChip.textContent = 'Idle';

const notchToggleBtn = document.createElement('button');
notchToggleBtn.type = 'button';
notchToggleBtn.className = 'notch-toggle-btn';
notchToggleBtn.title = 'Toggle notch overlay (Milestone 5 test)';
notchToggleBtn.textContent = '⬡ Notch';
notchToggleBtn.addEventListener('click', () => vesper.toggleNotch());

const headerControls = document.createElement('div');
headerControls.className = 'header-controls';
headerControls.append(notchToggleBtn, statusChip);

header.append(titleBlock, headerControls);

const tabs = document.createElement('nav');
tabs.className = 'tab-bar';
tabs.setAttribute('role', 'tablist');

const tabButtons = new Map<TabKey, HTMLButtonElement>();
const tabPanels = new Map<TabKey, HTMLElement>();

function setActiveTab(tabKey: TabKey) {
	tabButtons.forEach((button, key) => {
		const selected = key === tabKey;
		button.dataset.active = String(selected);
		button.setAttribute('aria-selected', String(selected));
		button.tabIndex = selected ? 0 : -1;
	});

	tabPanels.forEach((panel, key) => {
		panel.hidden = key !== tabKey;
	});

	// Refresh history when switching to history tab
	if (tabKey === 'history') {
		loadHistory();
	}
}

function createTabButton(label: string, tabKey: TabKey) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'tab-button';
	button.textContent = label;
	button.setAttribute('role', 'tab');
	button.setAttribute('aria-selected', 'false');
	button.dataset.active = 'false';
	button.addEventListener('click', () => setActiveTab(tabKey));
	tabButtons.set(tabKey, button);
	return button;
}

tabs.append(createTabButton('Upload & Transcribe', 'upload'), createTabButton('History', 'history'));

const content = document.createElement('section');
content.className = 'tab-panels';

// Upload Panel
const uploadPanel = document.createElement('section');
uploadPanel.className = 'panel';
uploadPanel.setAttribute('role', 'tabpanel');

const uploadGrid = document.createElement('div');
uploadGrid.className = 'panel__grid';

const dropzone = document.createElement('label');
dropzone.className = 'dropzone';
dropzone.htmlFor = 'audio-file-input';

const dropzoneInner = document.createElement('div');
dropzoneInner.className = 'dropzone__inner';

const dropzoneKicker = document.createElement('p');
dropzoneKicker.className = 'dropzone__kicker';
dropzoneKicker.textContent = 'Audio file';

const dropzoneTitle = document.createElement('h2');
dropzoneTitle.className = 'dropzone__title';
dropzoneTitle.textContent = 'Drop a recording here';

const dropzoneCopy = document.createElement('p');
dropzoneCopy.className = 'dropzone__copy';
dropzoneCopy.textContent = 'MP3, WAV, M4A, and WEBM are supported for the next milestone.';

const selectedFile = document.createElement('p');
selectedFile.className = 'dropzone__file';
selectedFile.textContent = 'No file selected';

dropzoneInner.append(dropzoneKicker, dropzoneTitle, dropzoneCopy, selectedFile);
dropzone.append(dropzoneInner);

const fileInput = document.createElement('input');
fileInput.id = 'audio-file-input';
fileInput.type = 'file';
fileInput.accept = 'audio/*,.webm';
fileInput.className = 'sr-only';

const controls = document.createElement('div');
controls.className = 'panel__controls';

const transcribeButton = document.createElement('button');
transcribeButton.type = 'button';
transcribeButton.className = 'primary-button';
transcribeButton.textContent = 'Transcribe';

const copyButton = document.createElement('button');
copyButton.type = 'button';
copyButton.className = 'secondary-button';
copyButton.textContent = 'Copy';

const resultLabel = document.createElement('p');
resultLabel.className = 'panel__label';
resultLabel.textContent = 'Result';

const resultArea = document.createElement('textarea');
resultArea.className = 'result-area';
resultArea.readOnly = true;
resultArea.value = '';
resultArea.placeholder = 'Transcription will appear here.';

const dropzoneStatus = document.createElement('p');
dropzoneStatus.className = 'dropzone__status';
dropzoneStatus.textContent = 'Select an audio file to begin.';

controls.append(transcribeButton, copyButton);
dropzoneInner.append(dropzoneStatus);
uploadGrid.append(dropzone, fileInput, controls, resultLabel, resultArea);
uploadPanel.append(uploadGrid);

// History Panel
const historyPanel = document.createElement('section');
historyPanel.className = 'panel';
historyPanel.setAttribute('role', 'tabpanel');

const historyHeader = document.createElement('div');
historyHeader.className = 'panel__header';

const historyTitle = document.createElement('h2');
historyTitle.className = 'panel__title';
historyTitle.textContent = 'History';

const historyActions = document.createElement('div');
historyActions.className = 'history-actions';

const refreshButton = document.createElement('button');
refreshButton.type = 'button';
refreshButton.className = 'icon-button';
refreshButton.textContent = '↻';
refreshButton.title = 'Refresh';
refreshButton.addEventListener('click', loadHistory);

const clearAllButton = document.createElement('button');
clearAllButton.type = 'button';
clearAllButton.className = 'danger-button';
clearAllButton.textContent = 'Clear All';
clearAllButton.addEventListener('click', handleClearAll);

historyActions.append(refreshButton, clearAllButton);

historyHeader.append(historyTitle, historyActions);

const historyList = document.createElement('ul');
historyList.className = 'history-list';
historyList.setAttribute('aria-label', 'Transcription history');

const historyEmpty = document.createElement('p');
historyEmpty.className = 'history-empty';
historyEmpty.textContent = 'No transcription history yet. Transcribe an audio file to get started.';

historyPanel.append(historyHeader, historyEmpty, historyList);

tabPanels.set('upload', uploadPanel);
tabPanels.set('history', historyPanel);

content.append(uploadPanel, historyPanel);

function updateSelectedFile(fileName: string) {
	selectedFile.textContent = fileName || 'No file selected';
	dropzoneStatus.textContent = fileName ? 'Ready to transcribe.' : 'Select an audio file to begin.';
}

fileInput.addEventListener('change', () => {
	const file = fileInput.files?.[0];
	updateSelectedFile(file ? file.name : 'No file selected');
});

dropzone.addEventListener('dragover', (event) => {
	event.preventDefault();
	dropzone.dataset.dragging = 'true';
});

dropzone.addEventListener('dragleave', () => {
	delete dropzone.dataset.dragging;
});

dropzone.addEventListener('drop', (event) => {
	event.preventDefault();
	delete dropzone.dataset.dragging;

	const file = event.dataTransfer?.files?.[0];
	if (!file) {
		return;
	}

	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	fileInput.files = dataTransfer.files;
	updateSelectedFile(file.name);
});

transcribeButton.addEventListener('click', async () => {
	const file = fileInput.files?.[0];
	if (!file) {
		statusChip.textContent = 'No file';
		dropzoneStatus.textContent = 'Pick an audio file first.';
		return;
	}

	statusChip.textContent = 'Transcribing';
	transcribeButton.disabled = true;
	copyButton.disabled = true;
	dropzoneStatus.textContent = 'Uploading to sidecar...';
	resultArea.value = 'Transcribing...';

	try {
		const response = await vesper.transcribeAudio(file.name, await file.arrayBuffer());
		resultArea.value = response.text;
		statusChip.textContent = 'Ready';
		dropzoneStatus.textContent = `Language: ${response.language} · Confidence: ${response.confidence.toFixed(2)}`;

		// Save to history
		try {
			await vesper.saveTranscription(file.name, response.text, response.language, response.confidence);
			console.log('[renderer] Transcription saved to history');
		} catch (saveError) {
			console.error('[renderer] Failed to save transcription:', saveError);
		}
	} catch (error) {
		resultArea.value = '';
		statusChip.textContent = 'Error';
		dropzoneStatus.textContent = error instanceof Error ? error.message : 'Transcription failed.';
	} finally {
		transcribeButton.disabled = false;
		copyButton.disabled = false;
	}
});

copyButton.addEventListener('click', async () => {
	if (!resultArea.value) {
		return;
	}

	await vesper.copyText(resultArea.value);
	statusChip.textContent = 'Copied';
});

// History Functions
async function loadHistory() {
	try {
		const records = await vesper.getHistory();
		renderHistory(records);
	} catch (error) {
		console.error('[renderer] Failed to load history:', error);
	}
}

function renderHistory(records: TranscriptionRecord[]) {
	// Clear existing items
	historyList.innerHTML = '';

	if (records.length === 0) {
		historyEmpty.style.display = 'block';
		return;
	}

	historyEmpty.style.display = 'none';

	records.forEach(record => {
		const item = createHistoryItem(record);
		historyList.appendChild(item);
	});
}

function createHistoryItem(record: TranscriptionRecord): HTMLLIElement {
	const li = document.createElement('li');
	li.className = 'history-item';
	li.dataset.id = String(record.id);

	// Format date
	const date = new Date(record.created_at);
	const formattedDate = date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
	const formattedTime = date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit'
	});

	// Truncate text for preview
	const previewText = record.text.length > 200 
		? record.text.substring(0, 200) + '...' 
		: record.text;

	li.innerHTML = `
		<div class="history-item__header">
			<span class="history-item__filename">${escapeHtml(record.filename)}</span>
			<span class="history-item__meta">
				${record.language} · ${(record.confidence * 100).toFixed(1)}%
			</span>
		</div>
		<div class="history-item__text">${escapeHtml(previewText)}</div>
		<div class="history-item__footer">
			<span class="history-item__date">${formattedDate} ${formattedTime}</span>
			<div class="history-item__actions">
				<button type="button" class="history-item__action history-item__action--copy" title="Copy full text">Copy</button>
				<button type="button" class="history-item__action history-item__action--delete" title="Delete">Delete</button>
			</div>
		</div>
	`;

	// Add event listeners
	const copyBtn = li.querySelector('.history-item__action--copy');
	const deleteBtn = li.querySelector('.history-item__action--delete');

	copyBtn?.addEventListener('click', async () => {
		await vesper.copyText(record.text);
		statusChip.textContent = 'Copied from history';
	});

	deleteBtn?.addEventListener('click', async () => {
		if (confirm('Delete this transcription from history?')) {
			try {
				await vesper.deleteTranscription(record.id);
				li.remove();
				// Check if list is now empty
				if (historyList.children.length === 0) {
					historyEmpty.style.display = 'block';
				}
			} catch (error) {
				console.error('[renderer] Failed to delete transcription:', error);
			}
		}
	});

	return li;
}

function escapeHtml(text: string): string {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

async function handleClearAll() {
	const count = await vesper.getHistoryCount();
	if (count === 0) {
		return;
	}

	if (confirm(`Clear all ${count} transcriptions from history? This cannot be undone.`)) {
		try {
			await vesper.clearHistory();
			historyList.innerHTML = '';
			historyEmpty.style.display = 'block';
		} catch (error) {
			console.error('[renderer] Failed to clear history:', error);
		}
	}
}

setActiveTab('upload');

root.append(header, tabs, content);

document.body.appendChild(root);
