# voicebox

A production-quality desktop app for Qwen3-TTS voice cloning and generation.

**Domain:** voicebox.sh

---

## Vision

Qwen3-TTS is a breakthrough model from Alibaba that achieves near-perfect voice cloning. The existing implementations (Voice-Clone-Studio, mimic, etc.) are either feature-rich but architecturally messy, or well-structured but limited in scope.

voicebox aims to build the definitive Qwen3-TTS application by combining the best patterns from existing projects while avoiding their architectural mistakes.

## Design Principles

1. **Clean architecture from day one** - No monolithic files, proper separation of concerns
2. **Desktop-first experience** - Native feel via Tauri, not a web app in disguise
3. **Production code quality** - Type safety, modularity, maintainability
4. **Performance and UX** - Smart caching, async operations, responsive UI
5. **Extensible design** - Easy to add new models, effects, and features
6. **Flexible deployment** - Run backend locally or connect to remote GPU machine with one click

## Technology Stack

### Backend (Python)
- **FastAPI** - Async REST API
- **SQLAlchemy** - Database ORM with migrations
- **Pydantic** - Request/response validation
- **Qwen3-TTS** - Voice cloning model
- **Whisper** - Speech-to-text transcription
- **librosa + soundfile** - Audio processing

### Frontend (Tauri + TypeScript)
- **Tauri** - Native desktop framework
- **React** - UI framework
- **TypeScript** - Type safety throughout
- **Bun** - Fast package manager and JavaScript runtime
- **React Query** - Server state management and API calls
- **OpenAPI (generated)** - Type-safe API client from FastAPI schema
- **Tailwind CSS** - Styling
- **Zustand** - Client-side state management
- **WaveSurfer.js** - Audio visualization

### Database
- **SQLite** - Local storage
- **Alembic** - Schema migrations

## Server/Client Mode

voicebox supports flexible deployment for users with multiple machines:

### Local Mode (Default)
- Backend runs locally alongside the Tauri app
- Best for users with GPU on their primary machine

### Remote Mode (One-Click Setup)
- **Use case:** Your laptop doesn't have a GPU, but your desktop does
- **Server:** Run voicebox on GPU machine, click "Start Server"
  - Starts FastAPI backend on local network
  - Shows connection URL (e.g., `http://192.168.1.100:8000`)
- **Client:** Run voicebox on laptop, enter server URL
  - Connects to remote backend
  - Full UI functionality, inference happens on GPU machine
- **Security:** Local network only for now (no internet exposure)

### How It Works
```
┌─────────────────┐          ┌─────────────────┐
│   Laptop        │          │   Desktop       │
│   (Client)      │          │   (Server)      │
│                 │          │                 │
│  Tauri App ────────────────▶  FastAPI        │
│  React UI       │  HTTP    │  Qwen3-TTS      │
│                 │          │  SQLite         │
│                 │          │  CUDA/GPU       │
└─────────────────┘          └─────────────────┘
```

**Benefits:**
- Use powerful GPU machine from lightweight laptop
- No complex setup - just click "Start Server"
- All data (history, profiles) lives on server
- Client is just a UI - no local storage needed in remote mode

## Core Features

### Phase 1 (MVP)
- Voice profile management
- Single-reference voice cloning
- Generation history with search
- Basic audio playback and preview
- Server/client mode (local network)
- One-click server startup

### Phase 2
- Multi-reference voice combination
- Batch variation generation
- Advanced audio normalization
- Export options and formats

### Phase 3
- Audio studio with timeline editing
- Word-level timestamps
- Project system (save/load sessions)
- Export options

### Phase 4
- Voice design (text-to-voice)
- Preset voices with style control
- Conversation mode (multi-speaker)
- Custom audio effects

## Key Differentiators

What makes voicebox better than existing implementations:

1. **Clean codebase** - Modular architecture, no 2,000+ line files
2. **Type safety end-to-end** - OpenAPI-generated TypeScript client, Pydantic backend, React Query
3. **Smart caching** - Voice prompt caching for instant re-generation
4. **Desktop UX** - Native performance, keyboard shortcuts, native dialogs
5. **Server/client mode** - One-click remote GPU access from any device
6. **Multi-reference** - Combine voice samples for higher quality
7. **Audio studio** - Timeline-based editing with word-level precision
8. **Production patterns** - Cross-platform, graceful degradation, error recovery
9. **Database-backed** - Searchable history, project persistence
10. **Extensible** - Clean plugin system for models and features

## Architecture Overview

```
voicebox/
├── app/                  # Shared React frontend (used by web & desktop)
│   ├── src/
│   │   ├── components/  # React components
│   │   │   ├── VoiceProfiles/
│   │   │   ├── Generation/
│   │   │   ├── AudioStudio/
│   │   │   ├── History/
│   │   │   └── ServerSettings/
│   │   ├── lib/
│   │   │   ├── api/     # Generated OpenAPI client
│   │   │   ├── hooks/   # React Query hooks
│   │   │   └── utils/
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── tauri/               # Tauri desktop app (thin wrapper)
│   ├── src/
│   │   └── main.tsx     # Entry point, imports from ../app
│   ├── src-tauri/       # Rust backend
│   │   ├── src/
│   │   │   └── main.rs  # Sidecar management, IPC
│   │   ├── binaries/    # Bundled Python server
│   │   │   └── voicebox-server-{platform}
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   └── package.json
│
├── web/                 # Web deployment (thin wrapper)
│   ├── src/
│   │   └── main.tsx     # Entry point, imports from ../app
│   ├── package.json
│   └── vite.config.ts
│
├── backend/             # Python FastAPI server
│   ├── main.py         # FastAPI app + server mode
│   ├── models.py       # Pydantic models
│   ├── tts.py         # TTS inference
│   ├── transcribe.py  # Whisper ASR
│   ├── profiles.py    # Voice profiles
│   ├── history.py     # Generation history
│   ├── studio.py      # Audio editing
│   ├── database.py    # SQLite ORM
│   ├── utils/
│   │   ├── audio.py   # Audio processing
│   │   ├── cache.py   # Prompt caching
│   │   └── validation.py
│   ├── requirements.txt
│   └── build_binary.py # PyInstaller build script
│
├── scripts/
│   ├── build-server.sh    # Build Python binary for all platforms
│   └── generate-api.sh    # Generate OpenAPI client
│
├── data/                  # User data
│   ├── profiles/
│   ├── generations/
│   ├── projects/
│   └── voicebox.db
│
├── package.json           # Root workspace config
└── docs/
    ├── ANALYSIS.md        # Analysis of existing projects
    ├── TAURI_PLAN.md      # Tauri app structure and bundling strategy
    └── ARCHITECTURE.md    # Detailed architecture docs
```

**Key architectural decisions:**
- **Shared frontend** - `app/` contains all React code, used by both desktop and web
- **Thin wrappers** - `tauri/` and `web/` just configure build tools and entry points
- **Bundled backend** - Python server packaged as sidecar binary with PyInstaller
- **Type-safe API** - OpenAPI schema generated from FastAPI, TypeScript client auto-generated

See [TAURI_PLAN.md](./docs/TAURI_PLAN.md) for detailed bundling strategy.

## Lessons from Existing Projects

voicebox learns from five existing Qwen3-TTS implementations:

### voice (Rust CLI)
- ✅ Clean Rust/Python IPC pattern
- ✅ M3GAN voice effect
- ✅ Voice profile abstraction
- ❌ No concurrent requests
- ❌ No generation history

### Voice-Clone-Studio
- ✅ Brilliant voice prompt caching
- ✅ Feature-rich (voice design, presets, conversations)
- ✅ VRAM-efficient model management
- ❌ 2,815-line single file
- ❌ Global state everywhere

### Qwen3-TTS_server
- ✅ Clean modular structure
- ✅ FastAPI REST API design
- ✅ Health endpoint for monitoring
- ❌ No authentication or rate limiting
- ❌ No caching or streaming
- ❌ No OpenAPI client generation

### mimic
- ✅ Excellent backend architecture (async, modular)
- ✅ Audio studio with timeline
- ✅ Database-backed history
- ✅ Multi-sample voice profiles
- ❌ 2,794-line app.js frontend
- ❌ Global state in UI

### qwen3-tts-enhanced
- ✅ Multi-reference combination
- ✅ Cross-platform graceful degradation
- ✅ Audio validation
- ✅ Production error handling
- ❌ Still monolithic (1,892 lines)
- ❌ No API layer

See [ANALYSIS.md](./docs/ANALYSIS.md) for detailed breakdown of each project.

## Development Roadmap

### Week 1: Foundation
- Project structure setup
- Backend skeleton (FastAPI + SQLite)
- OpenAPI schema generation
- Frontend skeleton (Tauri + React)
- TypeScript client generation from OpenAPI
- React Query setup
- Basic voice profile CRUD
- Server mode implementation
- Client connection UI

### Week 2: Core Features
- TTS integration
- Voice cloning pipeline
- Voice prompt caching
- Generation history

### Week 3: UX Polish
- Audio playback and preview
- Profile management UI
- History search and filters
- Error handling and validation

### Week 4: Advanced Features
- Multi-reference combination
- Batch generation
- Audio normalization
- M3GAN effect

### Week 5+: Studio Features
- Timeline editor
- Word-level timestamps
- Project system
- Export pipeline

## Technical Decisions

### Why Tauri over Electron?
- Smaller bundle size (Rust vs. Node.js)
- Better performance (native vs. V8)
- Lower memory usage
- Rust for system-level operations

### Why FastAPI over Flask?
- Native async/await support
- Automatic OpenAPI schema generation
- Pydantic validation built-in
- Better performance

### Why OpenAPI + React Query?
- **Type safety end-to-end** - FastAPI generates OpenAPI schema, we generate TypeScript client
- **No manual API code** - Client generated from `openapi.json` using openapi-typescript-codegen
- **Automatic caching** - React Query handles request deduplication and background refetching
- **Optimistic updates** - Update UI immediately, rollback on error
- **DevX** - Full autocomplete and type checking for all API calls

**Example workflow:**
```bash
# Backend generates OpenAPI schema
python backend/main.py --openapi > openapi.json

# Frontend generates TypeScript client
bun run generate-client

# Use type-safe hooks in React
import { useQuery } from '@tanstack/react-query';
import { ProfilesService } from '@/lib/api';

const { data: profiles } = useQuery({
  queryKey: ['profiles'],
  queryFn: () => ProfilesService.listProfiles()
});
```

### Why Bun over npm/yarn/pnpm?
- **Speed** - 20-30x faster than npm for install operations
- **Drop-in replacement** - Compatible with npm ecosystem, no migration needed
- **Built-in tooling** - Bundler, test runner, and package manager in one
- **Performance** - Faster script execution than Node.js
- **Developer experience** - Better error messages, workspaces support

### Why SQLite over file-based storage?
- Full-text search
- Transactions and integrity
- Migrations via Alembic
- Easy to backup/restore

### Why React over Vue/Svelte?
- Larger ecosystem
- Better TypeScript support
- Familiar to most developers
- Mature tooling

### Why bundle Python server with PyInstaller?
- **No Python installation required** - Users don't need Python on their system
- **Consistent environment** - Exact dependencies bundled, no version conflicts
- **Single-click install** - One installer includes everything
- **Tauri sidecar pattern** - Rust spawns/manages Python process lifecycle
- **Platform-specific binaries** - PyInstaller creates native executables for each platform

**Tradeoffs:**
- Larger bundle size (~500MB with models vs ~50MB without backend)
- Need separate build for each platform (macOS Intel/ARM, Windows, Linux)
- First launch slower (model loading time)

**Alternative considered:** Require users to install Python and run `pip install` - rejected for poor UX

### Why no Docker initially?
- Desktop app, not server deployment
- Users install locally
- Can add later for server mode

## Performance Targets

- **First generation:** < 10 seconds (cold start)
- **Cached generation:** < 2 seconds (warm start)
- **UI responsiveness:** 60 FPS at all times
- **Memory usage:** < 4GB VRAM for small models
- **Startup time:** < 3 seconds to UI
- **Database queries:** < 100ms for history search

## Quality Standards

- **No files over 500 lines** (except auto-generated)
- **Type hints on all Python functions**
- **TypeScript strict mode enabled**
- **OpenAPI client auto-generated from schema**
- **ESLint + Prettier for frontend**
- **Black + isort for backend**
- **All user-facing errors have context**
- **No global mutable state**
- **React Query for all server state**

## Project Status

**Current phase:** Planning and analysis

**Documentation:**
- [ANALYSIS.md](./docs/ANALYSIS.md) - Comprehensive analysis of existing implementations
- [TAURI_PLAN.md](./docs/TAURI_PLAN.md) - Tauri app architecture and Python server bundling strategy

## License

TBD

## Credits

Built by analyzing and learning from:
- voice (Rust CLI)
- Voice-Clone-Studio
- Qwen3-TTS_server
- mimic
- qwen3-tts-enhanced

Powered by Alibaba's Qwen3-TTS model.
