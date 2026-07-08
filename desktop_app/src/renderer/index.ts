import './style.css';

type TabKey = 'upload' | 'history';

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

header.append(titleBlock, statusChip);

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

controls.append(transcribeButton, copyButton);
uploadGrid.append(dropzone, fileInput, controls, resultLabel, resultArea);
uploadPanel.append(uploadGrid);

const historyPanel = document.createElement('section');
historyPanel.className = 'panel';
historyPanel.setAttribute('role', 'tabpanel');

const historyHeader = document.createElement('div');
historyHeader.className = 'panel__header';

const historyTitle = document.createElement('h2');
historyTitle.className = 'panel__title';
historyTitle.textContent = 'History';

const historyHint = document.createElement('p');
historyHint.className = 'panel__hint';
historyHint.textContent = 'Transcription history will be added in milestone 4.';

historyHeader.append(historyTitle, historyHint);

const historyList = document.createElement('ul');
historyList.className = 'history-list';
historyList.setAttribute('aria-label', 'Transcription history');

historyPanel.append(historyHeader, historyList);

tabPanels.set('upload', uploadPanel);
tabPanels.set('history', historyPanel);

content.append(uploadPanel, historyPanel);

function updateSelectedFile(fileName: string) {
	selectedFile.textContent = fileName || 'No file selected';
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

transcribeButton.addEventListener('click', () => {
	resultArea.value = resultArea.value || 'Transcription will be generated here in the next milestone.';
	statusChip.textContent = 'Ready';
});

copyButton.addEventListener('click', async () => {
	if (!resultArea.value) {
		return;
	}

	await navigator.clipboard.writeText(resultArea.value);
	statusChip.textContent = 'Copied';
});

setActiveTab('upload');

root.append(header, tabs, content);

document.body.appendChild(root);