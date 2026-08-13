# Vesper

> **Local, privacy-first speech-to-text pipeline that turns raw speech
> into clean, structured text --- without sending audio to a cloud
> API.**

Vesper is a desktop-oriented local transcription system
built around **Faster-Whisper**, with an optional **local LLM correction
layer** for turning raw ASR output into polished text.

The project is designed around a simple idea:

**Record / provide audio → transcribe locally → clean the transcript
locally → return usable text.**

No cloud transcription API is required.

------------------------------------------------------------------------

## ✨ What Problem Does It Solve?

Traditional speech-to-text applications often rely on remote APIs:

``` text
Microphone / Audio
       │
       ▼
   Cloud API
       │
       ▼
  Transcription
       │
       ▼
      User
```

This creates several problems:

-   Audio and transcripts may leave the user's machine.
-   Network connectivity becomes a dependency.
-   API usage can introduce recurring costs.
-   Latency depends on upload speed and server response time.
-   Users have less control over the underlying models.

Sasta Whisper Flow takes a local-first approach:

``` text
┌─────────────────────────────────────────────┐
│              USER'S COMPUTER                │
│                                             │
│  Audio → Faster-Whisper → LLM → Clean Text │
│                                             │
│             No cloud API required           │
└─────────────────────────────────────────────┘
```

The goal is not to build another generic Whisper wrapper. The goal is to
create a **practical local transcription pipeline** that can eventually
be packaged into a lightweight desktop product.

------------------------------------------------------------------------

# 🏗️ High-Level Architecture

``` mermaid
flowchart LR
    U[User] --> A[Audio Input]
    A --> F[FastAPI Sidecar]
    F --> W[Faster-Whisper]
    W --> T[Raw Transcript]
    T --> L[Local LLM Correction]
    L --> C[Clean Transcript]
    C --> E[Electron Desktop App]
    E --> U
```

### Core pipeline

``` text
                    Vesper
┌───────────────────────────────────────────────────────────┐
│                                                           │
│   🎙️ Audio                                               │
│      │                                                    │
│      ▼                                                    │
│   ┌───────────────┐                                      │
│   │ FastAPI       │                                      │
│   │ Backend       │                                      │
│   └───────┬───────┘                                      │
│           │                                               │
│           ▼                                               │
│   ┌───────────────┐                                      │
│   │ Faster-Whisper│                                      │
│   │     / ASR     │                                      │
│   └───────┬───────┘                                      │
│           │                                               │
│           ▼                                               │
│   ┌───────────────┐                                      │
│   │ Raw Speech    │                                      │
│   │ Transcript     │                                      │
│   └───────┬───────┘                                      │
│           │                                               │
│           ▼                                               │
│   ┌───────────────┐                                      │
│   │ Local LLM     │                                      │
│   │ Correction    │                                      │
│   └───────┬───────┘                                      │
│           │                                               │
│           ▼                                               │
│   ┌───────────────┐                                      │
│   │ Final Clean   │                                      │
│   │ Transcript     │                                      │
│   └───────┬───────┘                                      │
│           │                                               │
│           ▼                                               │
│      🖥️ Desktop UI                                       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 🔥 Key Features

-   🎙️ **Local speech recognition**
-   ⚡ **Faster-Whisper / CTranslate2 inference**
-   🧠 Optional **local LLM post-processing**
-   🔒 **Privacy-first architecture**
-   🌐 FastAPI-based local inference server
-   🖥️ Electron desktop application architecture
-   🧩 Separation between UI and ML inference
-   💻 Designed to support both CPU and NVIDIA GPU inference
-   🧹 Transcript cleanup for grammar, punctuation and filler words
-   📦 Designed with future standalone packaging in mind

------------------------------------------------------------------------

# 🧠 Why Faster-Whisper?

The project uses **Faster-Whisper** rather than the original Whisper
implementation.

Faster-Whisper uses **CTranslate2**, an inference engine optimized for
efficient Transformer execution.

Conceptually:

``` text
Original Whisper
       │
       ▼
 PyTorch Runtime
       │
       ▼
Higher runtime overhead
```

versus:

``` text
Faster-Whisper
       │
       ▼
CTranslate2
       │
       ▼
Optimized inference
       │
       ▼
Better CPU/GPU efficiency
```

This is particularly useful for a project whose target is **local
execution on ordinary consumer hardware**.

------------------------------------------------------------------------

# 🧩 System Architecture

The application is split into two major layers.

``` mermaid
flowchart TB
    subgraph Desktop["Desktop Application"]
        UI[Electron Renderer]
        IPC[Electron IPC / Preload]
    end

    subgraph Backend["Local ML Sidecar"]
        API[FastAPI]
        WS[WhisperService]
        CS[CorrectionService]
    end

    subgraph Models["Local Models"]
        W[Faster-Whisper]
        G[Gemma 2 2B Instruct]
    end

    UI --> IPC
    IPC --> API
    API --> WS
    WS --> W
    WS --> CS
    CS --> G
    G --> CS
    CS --> API
    API --> IPC
    IPC --> UI
```

### Why separate the backend from Electron?

Running ML inference directly inside the Electron process would tightly
couple:

-   Python
-   PyTorch
-   CTranslate2
-   model loading
-   GPU libraries
-   desktop UI lifecycle

Instead, the architecture treats the Python service as a **local
inference sidecar**.

``` text
Electron
   │
   │ HTTP
   ▼
FastAPI
   │
   ├── Whisper
   │
   └── LLM
```

This makes the system easier to debug, test and eventually package.

------------------------------------------------------------------------

# 🔄 End-to-End Request Flow

When the user submits an audio file:

``` mermaid
sequenceDiagram
    participant U as User
    participant E as Electron
    participant F as FastAPI
    participant W as Whisper
    participant L as Local LLM

    U->>E: Select / record audio
    E->>F: POST /transcribe
    F->>W: Send audio for inference
    W-->>F: Raw transcript
    F->>L: Send transcript for cleanup
    L-->>F: Corrected transcript
    F-->>E: Final result
    E-->>U: Display clean text
```

The important design decision is that **model loading should happen
once**, rather than loading the model for every request.

------------------------------------------------------------------------

# ⚙️ Model Lifecycle

Loading a large model repeatedly would be extremely inefficient.

Bad approach:

``` text
Request 1 → Load Whisper → Transcribe → Destroy
Request 2 → Load Whisper → Transcribe → Destroy
Request 3 → Load Whisper → Transcribe → Destroy
```

Preferred approach:

``` text
Application Start
       │
       ▼
Load Whisper Model
       │
       ▼
Keep Model in Memory
       │
       ├──── Request 1 → Inference
       ├──── Request 2 → Inference
       ├──── Request 3 → Inference
       └──── Request N → Inference
```

The same singleton-style approach is used for the local LLM correction
layer.

------------------------------------------------------------------------

# 🎙️ Speech-to-Text Pipeline

``` mermaid
flowchart TD
    A[Audio File / Microphone] --> B[Audio Validation]
    B --> C[Whisper Model]
    C --> D[Audio Encoding]
    D --> E[Transformer Encoder]
    E --> F[Decoder]
    F --> G[Raw Transcript]
```

The raw transcript is intentionally treated as an intermediate
representation.

Example:

``` text
Input speech:

"uh so basically I wanted to uh create a backend
which can process audio locally"

Raw ASR:

"uh so basically I wanted to uh create a backend
which can process audio locally"
```

The next stage can transform it into:

``` text
"I wanted to create a backend that can process
audio locally."
```

------------------------------------------------------------------------

# 🧠 Local LLM Correction Layer

The project can place a local LLM after speech recognition.

Current design:

``` text
Faster-Whisper
      │
      ▼
Raw Transcript
      │
      ▼
Gemma 2 2B Instruct
      │
      ├── Grammar correction
      ├── Punctuation
      ├── Capitalization
      ├── Filler-word removal
      └── Light text normalization
      │
      ▼
Final Transcript
```

The important distinction is:

> **Whisper performs speech recognition. The LLM performs text
> refinement.**

The LLM should not be treated as the primary transcription model.

------------------------------------------------------------------------

# 🧹 Transcript Processing Flow

``` mermaid
flowchart LR
    A[Raw ASR Text] --> B[LLM]
    B --> C{Correction}
    C --> D[Grammar]
    C --> E[Punctuation]
    C --> F[Capitalization]
    C --> G[Filler Removal]
    D --> H[Final Text]
    E --> H
    F --> H
    G --> H
```

### Example

**Raw ASR**

``` text
uh I think we need to basically change the backend
because it is not working properly right
```

**Processed output**

``` text
I think we need to change the backend because it
is not working properly.
```

The correction layer is intentionally constrained to **preserving the
user's meaning** rather than rewriting their content creatively.

------------------------------------------------------------------------

# 🖥️ CPU vs GPU Execution

The architecture is designed to support different hardware
configurations.

``` mermaid
flowchart TD
    A[Application] --> B{Available Hardware?}

    B -->|NVIDIA GPU| C[CUDA]
    C --> D[Faster-Whisper GPU]
    D --> E[float16]

    B -->|CPU Only| F[Faster-Whisper CPU]
    F --> G[int8]

    E --> H[Transcript]
    G --> H[Transcript]
```

Typical configuration concept:

``` python
# GPU
compute_type="float16"

# CPU
compute_type="int8"
```

The exact optimal configuration depends on the user's CPU, GPU, VRAM,
RAM and model size.

------------------------------------------------------------------------

# 📡 FastAPI Service

The ML layer is exposed through a local FastAPI service.

Conceptually:

``` text
Electron
   │
   │ POST /transcribe
   ▼
FastAPI
   │
   ▼
WhisperService
   │
   ▼
Faster-Whisper
   │
   ▼
LLM Correction
   │
   ▼
JSON Response
```

Example API flow:

``` http
POST /transcribe
Content-Type: multipart/form-data
```

Response:

``` json
{
  "text": "I wanted to create a backend that can process audio locally."
}
```

This API boundary allows the ML pipeline to be tested independently of
the desktop application.

------------------------------------------------------------------------

# 🧪 Why Test the Model Independently?

One of the most important engineering decisions in the project is
separating:

``` text
MODEL PROBLEM
```

from:

``` text
APPLICATION PROBLEM
```

Before debugging Electron, UI, IPC or packaging, the model should be
verified independently.

Recommended development order:

``` mermaid
flowchart TD
    A[Load Whisper Independently] --> B[Test Audio]
    B --> C[Measure Latency]
    C --> D[Verify Output]
    D --> E[Create FastAPI Service]
    E --> F[Test API]
    F --> G[Add LLM]
    G --> H[Test Complete Pipeline]
    H --> I[Connect Electron]
    I --> J[Package Application]
```

This prevents a UI bug from being mistaken for an ML inference bug.

------------------------------------------------------------------------

# 📁 Project Structure

A representative structure is:

``` text
sasta-whisper-flow/
│
├── backend/
│   ├── main.py
│   ├── services/
│   │   ├── whisper_service.py
│   │   └── correction_service.py
│   │
│   ├── models/
│   │   └── ...
│   │
│   ├── requirements.txt
│   └── .env
│
├── desktop_app/
│   ├── src/
│   │   ├── renderer/
│   │   ├── main/
│   │   └── preload/
│   │
│   ├── package.json
│   └── webpack.config.js
│
├── tests/
│   ├── test_whisper.py
│   ├── test_api.py
│   └── test_correction.py
│
├── README.md
└── LICENSE
```

> The exact directory layout may evolve as the application moves toward
> packaging and production deployment.

------------------------------------------------------------------------

# 🚀 Getting Started

## 1. Clone the repository

``` bash
git clone https://github.com/<your-username>/sasta-whisper-flow.git
cd sasta-whisper-flow
```

## 2. Create the Python environment

Using Conda:

``` bash
conda create -n sastaWhisperFlow python=3.11
conda activate sastaWhisperFlow
```

## 3. Install backend dependencies

``` bash
pip install -r backend/requirements.txt
```

For GPU inference, install a compatible PyTorch/CUDA configuration for
your NVIDIA environment.

## 4. Start the FastAPI service

``` bash
uvicorn backend.main:app --reload
```

The local API will then be available on the configured localhost port.

## 5. Start the desktop application

``` bash
cd desktop_app
npm install
npm start
```

------------------------------------------------------------------------

# 🧪 Development & Testing Strategy

The project should be tested progressively rather than as one large
application.

### Stage 1 --- Model

``` text
Audio
 ↓
Whisper
 ↓
Transcript
```

Verify:

-   model loads
-   audio is accepted
-   transcription works
-   latency is measured
-   CPU/GPU configuration works

### Stage 2 --- API

``` text
Client
 ↓
FastAPI
 ↓
Whisper
 ↓
Response
```

Verify:

-   endpoint works
-   multipart upload works
-   errors are handled
-   response schema is stable

### Stage 3 --- LLM

``` text
Whisper
 ↓
Raw text
 ↓
Gemma
 ↓
Clean text
```

Verify:

-   model loads once
-   correction preserves meaning
-   filler removal works
-   punctuation works
-   inference latency is acceptable

### Stage 4 --- Desktop App

``` text
Electron
 ↓
FastAPI
 ↓
ML Pipeline
```

Verify:

-   backend starts correctly
-   Electron can communicate with it
-   UI handles loading states
-   failures are surfaced properly

### Stage 5 --- Packaging

``` text
Source Code
     │
     ├── Electron
     ├── Python
     ├── ML Runtime
     └── Models
            │
            ▼
      Standalone App
```

------------------------------------------------------------------------

# 📊 Performance Considerations

Local AI applications are heavily constrained by:

-   RAM
-   VRAM
-   storage
-   model size
-   CPU/GPU inference speed
-   startup time
-   quantization
-   audio duration

The project therefore treats **performance as a system-level concern**,
not simply a model-selection problem.

``` text
Performance
    │
    ├── Model Size
    ├── Compute Type
    ├── CPU / GPU
    ├── Model Loading
    ├── Audio Preprocessing
    ├── LLM Inference
    └── IPC / API Overhead
```

A model that is theoretically faster can still produce a worse user
experience if it causes excessive memory pressure or startup time.

------------------------------------------------------------------------

# 💾 Memory & Storage Considerations

Running multiple local models means that storage and RAM must be
considered separately.

``` text
Disk Storage
    │
    ├── Python environment
    ├── PyTorch
    ├── CTranslate2
    ├── Whisper model
    ├── LLM model
    └── Electron dependencies
```

At runtime:

``` text
RAM / VRAM
    │
    ├── Operating System
    ├── Application
    ├── Whisper model
    ├── LLM model
    └── Runtime buffers
```

This is one of the reasons the project focuses on **small local models
and efficient inference**.

------------------------------------------------------------------------

# 🔐 Privacy Model

Vesper follows a local-first architecture.

``` mermaid
flowchart LR
    A[User Audio] --> B[Local Machine]
    B --> C[Whisper]
    C --> D[Local Transcript]
    D --> E[Local LLM]
    E --> F[Final Transcript]
```

There is no mandatory:

``` text
Audio → Internet → Cloud ASR
```

pipeline.

This makes the architecture suitable for scenarios where users prefer to
keep audio and transcripts on their own machine.

------------------------------------------------------------------------

# 🏛️ Architectural Principles

## 1. Local-first

The system should work without requiring a remote AI API.

## 2. Separation of concerns

``` text
Electron
   ↓
API
   ↓
Inference Services
   ↓
Models
```

Each layer has a clear responsibility.

## 3. Load models once

Models are expensive resources and should be reused across requests.

## 4. Model independence

Whisper and the LLM solve different problems:

``` text
Whisper = Speech → Text

LLM = Raw Text → Clean Text
```

## 5. Hardware adaptability

The same pipeline should be able to operate under different compute
constraints.

------------------------------------------------------------------------

# 🛣️ Roadmap

``` mermaid
flowchart LR
    A[Whisper Prototype] --> B[FastAPI]
    B --> C[Local LLM]
    C --> D[Electron Integration]
    D --> E[Performance Optimization]
    E --> F[Standalone Packaging]
    F --> G[Polished Desktop Product]
```

### Current / Planned

-   [x] Faster-Whisper prototype
-   [x] Local FastAPI inference service
-   [x] Whisper service abstraction
-   [x] Local LLM correction architecture
-   [ ] Complete LLM integration
-   [ ] Robust error handling
-   [ ] Electron ↔ FastAPI integration
-   [ ] Streaming transcription
-   [ ] Microphone recording
-   [ ] GPU/CPU auto-detection
-   [ ] Model selection
-   [ ] Better progress reporting
-   [ ] Persistent transcript history
-   [ ] Export to TXT / Markdown / clipboard
-   [ ] Standalone Windows packaging
-   [ ] Resource-aware model management
-   [ ] Performance benchmarking

------------------------------------------------------------------------

# 📈 Future Architecture

The long-term architecture can evolve toward:

``` mermaid
flowchart TD
    A[Microphone] --> B[Audio Capture]
    B --> C[VAD]
    C --> D[Streaming Whisper]
    D --> E[Partial Transcript]
    E --> F[Correction Layer]
    F --> G[Final Transcript]
    G --> H[History / Export]

    I[Settings] --> D
    I --> F
    I --> J[Model Manager]
    J --> D
    J --> F
```

Potential future improvements include:

-   Voice Activity Detection
-   streaming transcription
-   incremental LLM correction
-   hotkey-based recording
-   automatic model selection
-   GPU detection
-   CPU fallback
-   transcript history
-   searchable local database
-   multiple transcription languages
-   timestamps
-   speaker diarization
-   custom correction prompts

------------------------------------------------------------------------

# 🧠 Engineering Lessons

Vesper is also an exploration of **local AI application
engineering**.

The interesting engineering problems are not limited to loading a model.

The complete system involves:

``` text
Machine Learning
       +
Backend Engineering
       +
Desktop Application Development
       +
Systems / Performance Engineering
       +
Packaging
```

The difficult part is making all of these pieces behave like **one
reliable application**.

------------------------------------------------------------------------

# 🐛 Common Development Problems

Some classes of problems encountered during development include:

### GPU / CUDA

``` text
PyTorch
   ↓
CUDA
   ↓
CTranslate2
   ↓
Faster-Whisper
```

A mismatch between these layers can prevent GPU inference.

### Electron

Electron introduces another dependency chain:

``` text
Electron
   ↓
Node.js
   ↓
Native modules
   ↓
Visual Studio / Build Tools
```

Native dependencies can therefore introduce build compatibility
problems.

### Model loading

Large local models can cause:

-   slow startup
-   RAM pressure
-   VRAM exhaustion
-   disk usage spikes

These need to be treated as first-class engineering constraints.

------------------------------------------------------------------------

# 🧪 Benchmarking Philosophy

Instead of only asking:

> "Does it work?"

the project should eventually measure:

``` text
┌────────────────────────────┐
│       Benchmark Suite      │
├────────────────────────────┤
│ Model load time            │
│ First inference latency    │
│ Subsequent inference       │
│ Audio duration             │
│ Processing time            │
│ Real-time factor           │
│ RAM usage                  │
│ VRAM usage                 │
│ LLM latency                │
│ End-to-end latency         │
└────────────────────────────┘
```

A useful metric is:

``` text
Real-Time Factor (RTF)

RTF = Processing Time / Audio Duration
```

For example:

``` text
Audio duration = 120 seconds
Processing time = 30 seconds

RTF = 30 / 120 = 0.25
```

Lower is faster.

------------------------------------------------------------------------

# 🧱 Why the Sidecar Architecture Matters

The Python ML runtime and Electron UI have very different
responsibilities.

### Electron

``` text
UI
State
User interaction
Desktop integration
Settings
```

### Python

``` text
Audio processing
Whisper
PyTorch
CTranslate2
LLM
Inference
```

Keeping these responsibilities separate means either side can be
improved without rewriting the entire application.

``` text
             ┌──────────────┐
             │   Electron   │
             │     UI       │
             └──────┬───────┘
                    │
                 HTTP/IPC
                    │
             ┌──────▼───────┐
             │   FastAPI    │
             └──────┬───────┘
                    │
             ┌──────▼───────┐
             │ ML Services  │
             └──────┬───────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     Faster-Whisper        Local LLM
```

------------------------------------------------------------------------

# 🤝 Contributing

Contributions are welcome.

A good contribution should generally follow this flow:

``` text
Issue
  ↓
Understand the existing architecture
  ↓
Create a focused change
  ↓
Test independently
  ↓
Test end-to-end
  ↓
Open Pull Request
```

For larger architectural changes, open an issue first so the design can
be discussed before implementation.

------------------------------------------------------------------------

# 📄 License

Add the project's license here.

For example:

``` text
MIT License
```

if the repository is eventually released under MIT.

------------------------------------------------------------------------

# ⭐ Project Vision

Vesper started with a simple question:

> **Can useful speech recognition be made local, fast and affordable
> enough to run on an ordinary personal computer?**

The project explores that question from an engineering perspective.

The end goal is a desktop application where:

``` text
🎙️ Speak
   ↓
⚡ Local transcription
   ↓
🧠 Local cleanup
   ↓
✨ Clean text
```

happens directly on the user's machine.

**No mandatory cloud inference.\
No per-minute transcription bill.\
No unnecessary network dependency.**

Just local AI running on hardware the user already owns.

------------------------------------------------------------------------

## 🧰 Tech Stack

  Layer                Technology
  -------------------- ----------------------------------
  Speech Recognition   Faster-Whisper
  Inference Engine     CTranslate2
  LLM Correction       Gemma 2 2B Instruct
  ML Runtime           PyTorch / Transformers
  Backend              FastAPI
  Desktop              Electron
  Frontend             JavaScript / TypeScript
  GPU Acceleration     NVIDIA CUDA
  CPU Inference        CTranslate2 INT8
  Communication        Local HTTP / IPC
  Packaging            Electron-based desktop packaging

------------------------------------------------------------------------

## 📌 Project Status

**Vesper is an active development project.**

The core local transcription pipeline has been prototyped, while the
desktop integration, local LLM correction, performance optimization and
packaging layers continue to evolve.

> Built as an exploration of practical **local AI + desktop + systems
> engineering**.
