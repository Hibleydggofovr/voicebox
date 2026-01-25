# Qwen3-TTS Implementation Analysis

Comprehensive analysis of five existing Qwen3-TTS implementations to inform the architecture of voicebox.

---

## Projects Analyzed

1. **voice** - Rust CLI with Python backend
2. **Voice-Clone-Studio** - Feature-rich Gradio app
3. **Qwen3-TTS_server** - FastAPI REST API wrapper
4. **mimic** - Web app with audio studio (conceptually the best)
5. **qwen3-tts-enhanced** - Production-quality single-file Gradio app

---

## 1. voice (Rust CLI)

**Repository:** `/Users/jamespine/Projects/voice`

### Architecture

**Dual-mode design:**
- One-shot mode: Single generation via CLI args
- Server mode: Long-running HTTP server (port 3000)

**Language split:**
- Rust: CLI, HTTP server, IPC orchestration
- Python: TTS inference, model management

**IPC Pattern:**
```
Rust → spawn Python subprocess → JSON over stdin/stdout → Rust
```

### Python Backend (`tts.py`)

**Model Management:**
- Lazy loading via `get_tts_model()`
- Qwen3-TTS CustomVoice models (0.6B/1.7B)
- `torch_dtype=torch.bfloat16` for VRAM efficiency
- Flash Attention 2 with SDPA fallback

**Voice Profile System:**
- Profiles stored in `~/.config/voice/profiles/`
- Each profile: `audio.wav` + `reference.txt`
- Automatic voice prompt creation and caching
- Hash-based cache invalidation (MD5 of audio + text)

**Generation Pipeline:**
```python
1. Load model (lazy, cached)
2. Get voice prompt (cached if available)
3. Set seed for reproducibility
4. model.generate_voice_clone(text, language, voice_prompt)
5. Save to temp file
6. Return path as JSON
```

**Special Features:**
- M3GAN voice effect (pitch shift + formant preservation)
- Uses `librosa` + `soundfile` for audio processing
- Voice profile listing with metadata

### Rust Frontend

**HTTP Server (`main.rs`):**
- Axum web framework
- Single endpoint: `POST /generate`
- JSON request/response
- Spawns Python subprocess per request

**CLI (`cli.rs`):**
- Clap for argument parsing
- Commands: `generate`, `server`, `list-voices`
- Profile management integrated

**Process Management:**
```rust
let mut child = Command::new("python3")
    .arg("tts.py")
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .spawn()?;
```

### Strengths

1. **Clean separation of concerns** - Rust for I/O, Python for ML
2. **Dual-mode flexibility** - CLI and server in one binary
3. **Voice profile abstraction** - Easy to add/manage voices
4. **M3GAN effect** - Unique feature, well-implemented
5. **Good error handling** - Rust's `Result` type enforced

### Weaknesses

1. **Synchronous inference** - Blocks during generation
2. **No concurrent requests** - Server spawns subprocess per request
3. **Limited caching** - Only voice prompts, not models
4. **No generation history** - Fire and forget
5. **Basic HTTP API** - No auth, rate limiting, or WebSocket streaming

### Key Learnings

- IPC via JSON stdin/stdout is simple and works
- Voice profile pattern is user-friendly
- For Tauri, we can skip the IPC layer and use direct HTTP/IPC channels
- M3GAN effect is a differentiator worth preserving

---

## 2. Voice-Clone-Studio

**Repository:** `/Users/jamespine/Projects/Voice-Clone-Studio`

### Architecture

**Monolithic Gradio App:**
- Single file: `voice_clone_studio.py` (2,815 lines)
- Gradio for web UI
- Global state for model management
- Tab-based organization (6 tabs)

### Model Support

**Dual Engine:**
1. **Qwen3-TTS** - Base, CustomVoice, VoiceDesign
2. **VibeVoice TTS** - 1.5B/Large, multi-speaker

**Model sizes:**
- Qwen Small: 0.6B (~1GB VRAM)
- Qwen Large: 1.7B (~3GB VRAM)
- VibeVoice Small: 1.5B (~3GB VRAM)
- VibeVoice Large: ~6GB VRAM
- VibeVoice ASR: 7B (~14GB VRAM)

### Voice Prompt Caching

**Smart caching system:**
```python
def get_or_create_voice_prompt(audio_path, reference_text):
    cache_key = hashlib.md5(audio_bytes + text.encode()).hexdigest()

    # Check in-memory cache
    if cache_key in _voice_prompt_cache:
        return _voice_prompt_cache[cache_key]

    # Check disk cache
    prompt_file = f"{audio_path}.{cache_key}.prompt"
    if os.path.exists(prompt_file):
        prompt = torch.load(prompt_file)
        _voice_prompt_cache[cache_key] = prompt
        return prompt

    # Create new
    prompt = model.create_voice_clone_prompt(audio, text)
    torch.save(prompt, prompt_file)
    _voice_prompt_cache[cache_key] = prompt
    return prompt
```

**Cache invalidation:**
- Hash changes if audio or text changes
- Orphaned `.prompt` files cleaned up on demand

### Features

**Tab 1: Voice Clone**
- Clone from samples with Qwen or VibeVoice
- Sample selection dropdown
- Language selection (en/zh)
- Seed control for reproducibility
- Model size selection

**Tab 2: Conversation**
- Multi-speaker dialogue generation
- Script format: `[1]: Text`, `[2]: Text`
- Automatic speaker assignment
- Pause duration control between speakers

**Tab 3: Voice Presets**
- 9 pre-built Qwen speakers
- Style control (narrative, conversational, etc.)
- No sample needed

**Tab 4: Voice Design**
- Generate voices from text descriptions
- "Young female, energetic, bright tone"
- Qwen VoiceDesign model (1.7B only)

**Tab 5: Prep Samples**
- Audio/video file upload
- Auto-transcription (Whisper or VibeVoice ASR)
- Audio editing (trim, normalize, mono conversion)
- Save as voice sample

**Tab 6: Output History**
- Browse generated files
- Metadata display (timestamp, seed, engine, text)
- Re-generate from metadata

### VRAM Management

**Lazy loading + mutual exclusion:**
```python
def get_tts_model():
    global _tts_model, _whisper_model, _vibe_voice_model

    # Unload ASR to free VRAM
    if _whisper_model:
        del _whisper_model
        _whisper_model = None
    if _vibe_voice_model:
        del _vibe_voice_model
        _vibe_voice_model = None

    torch.cuda.empty_cache()

    if not _tts_model:
        _tts_model = load_model(...)

    return _tts_model
```

### Audio Processing

**Pipeline:**
1. **Input normalization:**
   - Peak normalization to [-1, 1]
   - 0.85 scaling (15% headroom)
   - Stereo → mono (average channels)

2. **Video extraction:**
   - ffmpeg subprocess for audio extraction
   - 24kHz mono output

3. **Transcription:**
   - Whisper medium model
   - VibeVoice ASR with speaker diarization
   - Auto-cleans `[Speaker X]:` labels

4. **Generation:**
   - Seed control via `torch.manual_seed()`
   - bfloat16 inference
   - Direct .wav output (soundfile)

### Strengths

1. **Voice prompt caching** - Brilliant UX (⚡ cached indicator)
2. **Dual engine support** - Qwen + VibeVoice flexibility
3. **Feature-rich** - Voice design, presets, conversations, long-form
4. **VRAM efficiency** - Smart loading/unloading
5. **Video support** - Extract audio from video files
6. **Metadata tracking** - Every output has reproducibility data
7. **Sample management** - Integrated prep workspace

### Weaknesses

1. **2,815-line single file** - Impossible to maintain
2. **Global state everywhere** - Testing nightmare
3. **Duplicated code** - 5 model loaders with identical fallback logic
4. **No separation of concerns** - UI + logic + audio all mixed
5. **No concurrency** - All operations block UI
6. **No error recovery** - Generic error messages
7. **Hardcoded parameters** - CFG scale, inference steps in function bodies
8. **No tests** - Zero test coverage
9. **No logging** - Only print statements

### Key Learnings

**Adopt:**
- Voice prompt caching with hash validation
- Lazy model loading with automatic unloading
- Metadata alongside outputs
- Sample management patterns
- Status indicators (cached vs not)

**Avoid:**
- Monolithic files over 2,000 lines
- Global mutable state
- Duplicated logic without abstraction
- Hardcoded parameters

---

## 3. Qwen3-TTS_server

**Repository:** `/Users/jamespine/Projects/Qwen3-TTS_server`

### Architecture

**FastAPI REST API:**
- Single server process
- Three endpoints: `/generate`, `/clone`, `/health`
- Deployed on RunPod with Docker
- Port 8000 (configurable)

### Project Structure

```
Qwen3-TTS_server/
├── main.py              # FastAPI app
├── models/
│   └── tts.py          # Model management
├── api/
│   └── routes.py       # Endpoint definitions
├── utils/
│   └── audio.py        # Audio processing
├── config.py           # Settings
├── Dockerfile          # Multi-stage build
└── requirements.txt    # Dependencies
```

### API Design

**POST /generate**
```json
{
  "text": "Hello world",
  "language": "en",
  "speaker": "default",
  "seed": 42
}

Response:
{
  "audio_url": "https://...",
  "duration": 2.5,
  "sample_rate": 24000
}
```

**POST /clone**
```json
{
  "text": "Hello world",
  "language": "en",
  "reference_audio": "base64_encoded_audio",
  "reference_text": "This is my voice",
  "seed": 42
}

Response:
{
  "audio_url": "https://...",
  "duration": 2.5,
  "sample_rate": 24000
}
```

**GET /health**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "gpu_available": true,
  "vram_used_mb": 1024
}
```

### Model Management

**Singleton pattern:**
```python
class ModelManager:
    _instance = None
    _model = None

    def __new__(cls):
        if not cls._instance:
            cls._instance = super().__new__(cls)
        return cls._instance

    def get_model(self):
        if not self._model:
            self._model = self._load_model()
        return self._model
```

**Lazy loading:**
- Model loaded on first request
- Kept in memory for subsequent requests
- No unloading (server dedicated to TTS)

### Deployment

**Docker multi-stage build:**
```dockerfile
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04 AS base
# Install dependencies

FROM base AS builder
# Install Python packages

FROM base AS runtime
COPY --from=builder /usr/local/lib/python3.10 /usr/local/lib/python3.10
# Runtime only
```

**RunPod integration:**
- Configured for GPU instances
- Automatic model download on startup
- Health checks for orchestration

### Strengths

1. **Clean API design** - RESTful, well-documented
2. **Proper separation** - Routes, models, utils in separate modules
3. **Singleton model manager** - Better than global variables
4. **Health endpoint** - Essential for deployment
5. **Docker deployment** - Production-ready containerization
6. **Base64 audio input** - No file upload needed for cloning

### Weaknesses

1. **No authentication** - Wide open API
2. **No rate limiting** - DoS vulnerable
3. **Sequential inference** - No request queuing
4. **No caching** - Voice prompts recreated every time
5. **No streaming** - Returns only after full generation
6. **No WebSocket** - Can't send progress updates
7. **Synchronous endpoints** - Blocks during generation
8. **No storage** - Audio URLs expire quickly
9. **Limited error handling** - Generic 500 errors

### Key Learnings

**Adopt:**
- FastAPI for REST API
- Modular structure (routes, models, utils)
- Health endpoint for monitoring
- Base64 audio input option
- Docker deployment pattern

**Improve:**
- Add async/await throughout
- Implement request queue
- Add WebSocket for streaming
- Cache voice prompts
- Authentication and rate limiting

---

## 4. mimic

**Repository:** `/Users/jamespine/Projects/mimic`

### Architecture

**Three-tier web app:**
- Frontend: Vanilla JS (no framework)
- Backend: Python FastAPI
- Database: SQLite

**Best-structured backend** of all projects analyzed.

### Project Structure

```
mimic/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── models.py            # Pydantic models
│   ├── tts.py              # TTS inference
│   ├── transcribe.py       # Whisper ASR
│   ├── profiles.py         # Voice profile management
│   ├── history.py          # Generation history
│   ├── studio.py           # Audio studio features
│   └── database.py         # SQLite ORM
├── frontend/
│   ├── index.html
│   ├── app.js              # Main app (2,794 lines)
│   ├── studio.js           # Audio studio (2,363 lines)
│   ├── profiles.js         # Profile management
│   └── history.js          # History UI
└── data/
    ├── profiles/           # Voice profiles
    ├── generations/        # Generated audio
    └── mimic.db           # SQLite database
```

### Backend Design

**Async/await throughout:**
```python
@router.post("/generate")
async def generate(request: GenerateRequest):
    audio = await tts.generate_async(
        text=request.text,
        profile_id=request.profile_id,
        language=request.language
    )

    history_entry = await db.create_generation(
        profile_id=request.profile_id,
        text=request.text,
        audio_path=audio.path
    )

    return history_entry
```

**Modular separation:**
- `models.py` - Pydantic request/response models
- `tts.py` - TTS inference logic only
- `transcribe.py` - ASR logic only
- `profiles.py` - CRUD for voice profiles
- `history.py` - CRUD for generation history
- `studio.py` - Audio editing features
- `database.py` - SQLAlchemy ORM

### Features

**Voice Profiles:**
- Create from audio file + reference text
- Multiple samples per profile (combined)
- Metadata: name, description, tags, language
- Thumbnail generation from waveform

**Generation History:**
- SQLite database with full-text search
- Filters: profile, date range, language
- Regeneration from history
- Export to various formats

**Audio Studio:**
- Timeline-based editing
- Multiple audio tracks
- Word-level timestamps (Whisper alignment)
- Trim, fade, volume control
- Export with normalization

**Projects:**
- Save/load studio sessions
- Project metadata and versioning
- Export project as single file

### Database Schema

```sql
CREATE TABLE profiles (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    description TEXT,
    language TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE profile_samples (
    id INTEGER PRIMARY KEY,
    profile_id INTEGER,
    audio_path TEXT,
    reference_text TEXT,
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE TABLE generations (
    id INTEGER PRIMARY KEY,
    profile_id INTEGER,
    text TEXT,
    language TEXT,
    audio_path TEXT,
    duration REAL,
    seed INTEGER,
    created_at TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT,
    data JSON,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Frontend Design

**Major issue: Monolithic classes**

**app.js (2,794 lines):**
```javascript
class MimicApp {
    constructor() {
        this.profiles = [];
        this.generations = [];
        this.currentProfile = null;
        this.currentGeneration = null;
        // ... 50+ properties
    }

    // 80+ methods, no organization
    async loadProfiles() { ... }
    async createProfile() { ... }
    async deleteProfile() { ... }
    async generate() { ... }
    async loadHistory() { ... }
    // ... hundreds more lines
}
```

**studio.js (2,363 lines):**
```javascript
class AudioStudio {
    constructor() {
        this.wavesurfer = null;
        this.timeline = null;
        this.tracks = [];
        this.regions = [];
        this.words = [];
        // ... 40+ properties
    }

    // 60+ methods, all mixed
    initWavesurfer() { ... }
    addTrack() { ... }
    removeTrack() { ... }
    playPause() { ... }
    exportAudio() { ... }
    // ... hundreds more lines
}
```

**Global state everywhere:**
```javascript
let app = null;
let studio = null;
let currentProfile = null;
let isGenerating = false;
```

**No module system:**
- All files loaded via `<script>` tags
- No bundler, no tree-shaking
- jQuery for DOM manipulation
- No type safety

### Audio Studio Implementation

**WaveSurfer.js integration:**
```javascript
this.wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#4a9eff',
    progressColor: '#1e3a8a',
    cursorColor: '#ef4444',
    height: 128,
    normalize: true,
    plugins: [
        TimelinePlugin.create(),
        RegionsPlugin.create()
    ]
});
```

**Word-level timestamps:**
- Whisper alignment API
- Each word: `{ word, start, end }`
- Clickable timeline
- Visual highlighting during playback

**Track mixing:**
- Multiple audio files on timeline
- Independent volume control
- Fade in/out per track
- Export as single mixed audio

### Strengths

1. **Best backend structure** - Modular, async, clean separation
2. **Database-backed** - Proper persistence layer
3. **Audio studio** - Timeline editing is unique
4. **Word-level timestamps** - Great UX for editing
5. **Project system** - Save/load sessions
6. **Search and filters** - Full-text search in history
7. **Multi-sample profiles** - Combine multiple references
8. **Proper API design** - RESTful with Pydantic validation

### Weaknesses

1. **Frontend is amateur:**
   - 2,794-line app.js
   - 2,363-line studio.js
   - Global state everywhere
   - No module system
   - No TypeScript
   - jQuery instead of modern framework

2. **No real-time updates** - Polling instead of WebSocket
3. **No concurrency** - Single generation at a time
4. **No batch processing** - One at a time only
5. **Limited audio formats** - WAV only
6. **No export options** - Can't export profiles or projects easily

### Key Learnings

**Backend patterns to adopt:**
- Async/await throughout
- Modular file structure (tts.py, transcribe.py, profiles.py, history.py)
- SQLite for persistence
- Pydantic for validation
- Proper CRUD separation

**Frontend patterns to avoid:**
- Monolithic classes over 2,000 lines
- Global state
- jQuery-based architecture
- No type safety

**Features to adopt:**
- Audio studio with timeline
- Word-level timestamps
- Project system
- Multi-sample voice profiles
- Generation history with search

---

## 5. qwen3-tts-enhanced

**Repository:** `/Users/jamespine/Projects/qwen3-tts-enhanced`

### Architecture

**Production-quality Gradio app:**
- Single file: `app.py` (1,892 lines)
- Much cleaner than Voice-Clone-Studio despite being monolithic
- Clear section comments and function organization
- Cross-platform support (Windows, Mac, Linux)

### Unique Features

**Multi-Reference Voice Cloning:**
```python
def combine_references(audio_paths, reference_texts):
    """Combine multiple voice samples for better quality"""
    combined_audio = []
    combined_text = []

    for audio_path, text in zip(audio_paths, reference_texts):
        audio, sr = sf.read(audio_path)
        audio = normalize_audio(audio)
        combined_audio.append(audio)
        combined_text.append(text)

    # Mix with equal weighting and normalization
    mixed = np.concatenate(combined_audio)
    mixed = normalize_audio(mixed)

    combined_text_str = " ".join(combined_text)

    return mixed, combined_text_str
```

**Batch Variation Generation:**
- Generate N variations of same text
- Different seeds for each
- Compare and pick best output
- Parallel generation support

**Smart Audio Mixing:**
```python
def normalize_audio(audio, target_db=-20):
    """Normalize to target loudness with peak limiting"""
    # Convert to float32
    audio = audio.astype(np.float32)

    # Calculate current RMS
    rms = np.sqrt(np.mean(audio**2))

    # Calculate target RMS
    target_rms = 10**(target_db / 20)

    # Apply gain
    if rms > 0:
        gain = target_rms / rms
        audio = audio * gain

    # Peak limiting to prevent clipping
    audio = np.clip(audio, -1.0, 1.0)

    return audio
```

### Code Organization

**Clear sections:**
```python
# ============================================
# CONFIGURATION AND CONSTANTS
# ============================================

# ============================================
# MODEL MANAGEMENT
# ============================================

# ============================================
# AUDIO PROCESSING
# ============================================

# ============================================
# GENERATION FUNCTIONS
# ============================================

# ============================================
# UI COMPONENTS
# ============================================

# ============================================
# APPLICATION LAUNCH
# ============================================
```

**Consistent patterns:**
- All functions have docstrings
- Type hints on critical functions
- Error handling with context
- Progress callbacks throughout

### Cross-Platform Support

**Graceful degradation:**
```python
def get_audio_device():
    """Get audio playback device, cross-platform"""
    try:
        import sounddevice as sd
        devices = sd.query_devices()
        return sd.default.device
    except ImportError:
        logger.warning("sounddevice not available, using fallback")
        return None
    except Exception as e:
        logger.warning(f"Audio device detection failed: {e}")
        return None

def play_audio(audio_path):
    """Play audio with platform-specific fallback"""
    device = get_audio_device()

    if device is not None:
        # Use sounddevice
        audio, sr = sf.read(audio_path)
        sd.play(audio, sr)
    elif sys.platform == 'darwin':
        # macOS fallback
        subprocess.run(['afplay', audio_path])
    elif sys.platform == 'win32':
        # Windows fallback
        import winsound
        winsound.PlaySound(audio_path, winsound.SND_FILENAME)
    else:
        # Linux fallback
        subprocess.run(['aplay', audio_path])
```

**Path handling:**
```python
def ensure_cross_platform_path(path):
    """Convert paths to platform-specific format"""
    return os.path.normpath(path)

def get_config_dir():
    """Get config directory, respecting platform conventions"""
    if sys.platform == 'win32':
        return os.path.join(os.getenv('APPDATA'), 'qwen-tts')
    elif sys.platform == 'darwin':
        return os.path.expanduser('~/Library/Application Support/qwen-tts')
    else:
        return os.path.expanduser('~/.config/qwen-tts')
```

### Quality Improvements

**Reference audio validation:**
```python
def validate_reference_audio(audio_path):
    """Check if reference audio is suitable for cloning"""
    audio, sr = sf.read(audio_path)

    # Check duration (3-10 seconds ideal)
    duration = len(audio) / sr
    if duration < 2:
        return False, "Audio too short (minimum 2 seconds)"
    if duration > 30:
        return False, "Audio too long (maximum 30 seconds)"

    # Check for silence
    rms = np.sqrt(np.mean(audio**2))
    if rms < 0.01:
        return False, "Audio is too quiet or silent"

    # Check for clipping
    if np.abs(audio).max() > 0.99:
        return False, "Audio is clipping (reduce input gain)"

    # Check sample rate
    if sr < 16000:
        return False, f"Sample rate too low ({sr}Hz, minimum 16kHz)"

    return True, "Audio is suitable"
```

**Generation quality settings:**
```python
# Conservative defaults for quality
DEFAULT_CFG_SCALE = 4.5  # Higher = more faithful to prompt
DEFAULT_STEPS = 20       # More steps = better quality
DEFAULT_TEMPERATURE = 1.0

# Fast mode (lower quality)
FAST_CFG_SCALE = 3.0
FAST_STEPS = 10
```

### Backward Compatibility

**Config migration:**
```python
def migrate_config(config):
    """Migrate old config to new format"""
    version = config.get('version', 1)

    if version == 1:
        # Add new fields from version 2
        config['batch_size'] = 1
        config['version'] = 2

    if version == 2:
        # Add new fields from version 3
        config['multi_reference'] = False
        config['version'] = 3

    return config
```

**Legacy sample format:**
```python
def load_sample(sample_path):
    """Load voice sample, supporting both old and new formats"""
    # Try new format (JSON metadata)
    json_path = sample_path.replace('.wav', '.json')
    if os.path.exists(json_path):
        with open(json_path) as f:
            metadata = json.load(f)
        return {
            'audio': sample_path,
            'text': metadata['reference_text'],
            'language': metadata.get('language', 'en')
        }

    # Try old format (text file)
    txt_path = sample_path.replace('.wav', '.txt')
    if os.path.exists(txt_path):
        with open(txt_path) as f:
            text = f.read().strip()
        return {
            'audio': sample_path,
            'text': text,
            'language': 'en'  # Assume English
        }

    # No metadata found
    return None
```

### Strengths

1. **Multi-reference cloning** - Combine samples for better quality
2. **Batch variations** - Generate multiple outputs, pick best
3. **Smart audio normalization** - RMS targeting + peak limiting
4. **Cross-platform support** - Graceful degradation everywhere
5. **Backward compatibility** - Config migration, legacy formats
6. **Reference validation** - Check audio before generation
7. **Quality presets** - Fast vs. high-quality modes
8. **Clean code** - Well-organized despite being single file
9. **Good error messages** - Contextual, actionable
10. **Progress callbacks** - User sees what's happening

### Weaknesses

1. **Still monolithic** - 1,892 lines in one file
2. **No database** - File-based storage
3. **No history** - Can't search past generations
4. **No API** - Gradio UI only
5. **No concurrent generation** - One at a time
6. **No streaming** - Wait for full generation

### Key Learnings

**Production patterns to adopt:**
- Multi-reference combination for quality
- Audio validation before generation
- Cross-platform graceful degradation
- Config migration for backward compatibility
- RMS normalization with peak limiting
- Quality presets (fast vs. high-quality)
- Clear section organization in code
- Progress callbacks everywhere

**Clean code practices:**
- Docstrings on all functions
- Type hints where useful
- Error messages with context
- Consistent naming conventions

---

## Comparative Analysis

### Model Management

| Project | Pattern | VRAM Strategy | Caching |
|---------|---------|--------------|---------|
| voice | Lazy load | Single model | Voice prompts only |
| Voice-Clone-Studio | Lazy + mutex | Unload on switch | Voice prompts + disk |
| Qwen3-TTS_server | Singleton | Keep in memory | None |
| mimic | Lazy async | Single model | None |
| qwen3-tts-enhanced | Lazy load | Single model | Voice prompts only |

**Winner:** Voice-Clone-Studio (most sophisticated caching)

### Architecture

| Project | Backend | Frontend | Separation | Modularity |
|---------|---------|----------|------------|------------|
| voice | Python subprocess | Rust CLI | Excellent | Good |
| Voice-Clone-Studio | Gradio monolith | Gradio | None | Poor |
| Qwen3-TTS_server | FastAPI | None (API only) | Excellent | Excellent |
| mimic | FastAPI | Vanilla JS | Good | Backend: Excellent, Frontend: Poor |
| qwen3-tts-enhanced | Gradio monolith | Gradio | None | Good (sections) |

**Winner:** mimic (backend), Qwen3-TTS_server (overall separation)

### Features

| Feature | voice | Voice-Clone-Studio | Qwen3-TTS_server | mimic | qwen3-tts-enhanced |
|---------|-------|-------------------|-----------------|-------|-------------------|
| Voice cloning | ✓ | ✓ | ✓ | ✓ | ✓ |
| Multi-reference | ✗ | ✗ | ✗ | ✓ | ✓ |
| Voice design | ✗ | ✓ | ✗ | ✗ | ✗ |
| Presets | ✗ | ✓ (9) | ✗ | ✗ | ✗ |
| Conversations | ✗ | ✓ | ✗ | ✗ | ✗ |
| History | ✗ | ✓ (file) | ✗ | ✓ (database) | ✗ |
| Audio studio | ✗ | ✗ | ✗ | ✓ | ✗ |
| Batch generation | ✗ | ✗ | ✗ | ✗ | ✓ |
| M3GAN effect | ✓ | ✗ | ✗ | ✗ | ✗ |

**Winner:** mimic (most comprehensive feature set)

### Code Quality

| Project | Lines | Organization | Type Safety | Tests | Documentation |
|---------|-------|--------------|-------------|-------|---------------|
| voice | ~500 | Good | Rust: Yes, Python: No | None | README only |
| Voice-Clone-Studio | 2,815 | Poor | No | None | Good README |
| Qwen3-TTS_server | ~800 | Excellent | Partial (Pydantic) | None | API docs |
| mimic | ~4,000 | Backend: Good, Frontend: Poor | Backend: Partial | None | Basic |
| qwen3-tts-enhanced | 1,892 | Good | Partial | None | Good |

**Winner:** Qwen3-TTS_server (best organized)

### Production Readiness

| Project | Deployment | Error Handling | Cross-Platform | Graceful Degradation | Monitoring |
|---------|-----------|----------------|----------------|---------------------|------------|
| voice | Binary | Good (Rust) | Yes | Limited | None |
| Voice-Clone-Studio | Python script | Basic | Yes | Good (flash attn) | None |
| Qwen3-TTS_server | Docker | Basic | Linux (container) | None | Health endpoint |
| mimic | Python script | Good | Yes | Limited | None |
| qwen3-tts-enhanced | Python script | Excellent | Excellent | Excellent | None |

**Winner:** qwen3-tts-enhanced (most robust), Qwen3-TTS_server (deployment)

---

## Recommended Architecture for voicebox

### Backend (Python + FastAPI)

**Structure (from mimic):**
```
backend/
├── main.py              # FastAPI app
├── models.py            # Pydantic models
├── tts.py              # TTS inference
├── transcribe.py       # Whisper ASR
├── profiles.py         # Voice profile management
├── history.py          # Generation history
├── studio.py           # Audio editing
├── effects.py          # M3GAN, etc.
├── database.py         # SQLite ORM
└── utils/
    ├── audio.py        # Audio processing
    ├── cache.py        # Voice prompt caching
    └── validation.py   # Input validation
```

**Patterns to adopt:**
- Async/await throughout (mimic)
- Voice prompt caching (Voice-Clone-Studio)
- Multi-reference combination (qwen3-tts-enhanced)
- Audio validation (qwen3-tts-enhanced)
- Cross-platform audio (qwen3-tts-enhanced)
- Health endpoint (Qwen3-TTS_server)
- Graceful degradation (qwen3-tts-enhanced)

### Frontend (Tauri + TypeScript + React)

**Structure:**
```
frontend/
├── src/
│   ├── components/
│   │   ├── VoiceProfiles/
│   │   ├── Generation/
│   │   ├── AudioStudio/
│   │   └── History/
│   ├── lib/
│   │   ├── api.ts          # Backend API client
│   │   ├── audio.ts        # Audio utilities
│   │   └── store.ts        # State management
│   ├── types/
│   │   └── index.ts        # TypeScript types
│   └── App.tsx
└── src-tauri/
    ├── src/
    │   └── main.rs         # Tauri backend
    └── tauri.conf.json
```

**Avoid monolithic components:**
- Keep components under 300 lines
- Proper state management (Zustand or Jotai)
- TypeScript everywhere
- Component-based architecture

### Features Priority

**Phase 1 (MVP):**
1. Voice profile management
2. Single-reference voice cloning
3. Generation history (database)
4. Basic audio playback

**Phase 2:**
1. Multi-reference combination
2. Batch variation generation
3. M3GAN effect
4. Audio normalization

**Phase 3:**
1. Audio studio with timeline
2. Word-level timestamps
3. Project system
4. Export options

**Phase 4:**
1. Voice design
2. Preset voices
3. Conversation mode
4. Advanced effects

### Technology Stack

**Backend:**
- FastAPI (async REST API)
- SQLAlchemy (database ORM)
- Pydantic (validation)
- Qwen3-TTS (model)
- Whisper (transcription)
- librosa + soundfile (audio)

**Frontend:**
- Tauri (desktop framework)
- React (UI framework)
- TypeScript (type safety)
- Tailwind CSS (styling)
- Zustand (state management)
- WaveSurfer.js (audio visualization)

**Database:**
- SQLite (local storage)
- Alembic (migrations)

### Key Differentiators

What will make voicebox better:

1. **Clean architecture** - Avoid monolithic files from all projects
2. **TypeScript frontend** - Type safety unlike mimic
3. **Desktop-first** - Native feel via Tauri
4. **Voice prompt caching** - Fast generations like Voice-Clone-Studio
5. **Multi-reference** - Quality like qwen3-tts-enhanced
6. **Audio studio** - Timeline editing like mimic
7. **M3GAN effect** - Unique feature from voice
8. **Production code** - No amateur patterns
9. **Proper state management** - No global variables
10. **Modular from day one** - Easy to extend

---

## Conclusion

All five projects have valuable lessons:

- **voice**: Clean Rust/Python split, M3GAN effect
- **Voice-Clone-Studio**: Brilliant caching, feature-rich but poorly organized
- **Qwen3-TTS_server**: Best modular structure, API design
- **mimic**: Best backend architecture, great features, terrible frontend
- **qwen3-tts-enhanced**: Production patterns, quality focus, cross-platform

voicebox will cherry-pick the best patterns from each while avoiding their architectural mistakes.
