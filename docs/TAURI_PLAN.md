# Tauri App Plan

Plan for building voicebox as a Tauri 2.0 desktop app with shared frontend code for web deployment.

---

## Project Structure

```
voicebox/
├── app/                      # Shared React frontend (used by both web & desktop)
│   ├── src/
│   │   ├── components/
│   │   │   ├── VoiceProfiles/
│   │   │   ├── Generation/
│   │   │   ├── AudioStudio/
│   │   │   ├── History/
│   │   │   └── ServerSettings/
│   │   ├── lib/
│   │   │   ├── api/          # Generated OpenAPI client
│   │   │   ├── hooks/        # React Query hooks
│   │   │   └── utils/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── tauri/                    # Tauri desktop app
│   ├── src/                  # Thin wrapper, imports from ../app
│   │   └── main.tsx          # Entry point that renders App from ../app
│   ├── src-tauri/            # Rust backend
│   │   ├── src/
│   │   │   └── main.rs
│   │   ├── icons/
│   │   ├── binaries/         # Bundled Python server
│   │   │   ├── voicebox-server-x86_64-apple-darwin
│   │   │   ├── voicebox-server-aarch64-apple-darwin
│   │   │   ├── voicebox-server-x86_64-unknown-linux-gnu
│   │   │   └── voicebox-server-x86_64-pc-windows-msvc.exe
│   │   ├── capabilities/
│   │   │   └── default.json
│   │   ├── Cargo.toml
│   │   ├── Cargo.lock
│   │   ├── tauri.conf.json
│   │   └── build.rs
│   ├── package.json
│   └── vite.config.ts        # Points to ../app
│
├── web/                      # Web deployment
│   ├── src/
│   │   └── main.tsx          # Entry point that renders App from ../app
│   ├── package.json
│   └── vite.config.ts        # Points to ../app
│
├── backend/                  # Python FastAPI server
│   ├── main.py
│   ├── models.py
│   ├── tts.py
│   ├── transcribe.py
│   ├── profiles.py
│   ├── history.py
│   ├── studio.py
│   ├── database.py
│   ├── utils/
│   ├── requirements.txt
│   └── build_binary.py       # PyInstaller build script
│
├── scripts/
│   ├── build-server.sh       # Build Python server for all platforms
│   └── generate-api.sh       # Generate OpenAPI client
│
├── package.json              # Root workspace config (Bun workspaces)
└── bun.lockb                 # Bun lockfile
```

---

## Technology Stack

### Desktop App (Tauri 2.0)
- **Tauri 2.9.5+** - Latest stable version
- **Rust** - Tauri backend
- **React + TypeScript** - Frontend (shared with web)
- **Vite** - Build tool
- **Bun** - Fast package manager and JavaScript runtime

### Shared Frontend
- **React 18+** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Bun** - Package manager (faster than npm/yarn/pnpm)
- **React Query** - Server state management
- **Zustand** - Client state management
- **Tailwind CSS** - Styling
- **WaveSurfer.js** - Audio visualization

### Backend Bundling
- **PyInstaller** - Bundle Python server as standalone binary
- **FastAPI** - Python web framework
- **Tauri Sidecar** - Execute bundled Python server

---

## Bundling Python Server with Tauri

### 1. Build Python Server as Standalone Binary

**Using PyInstaller:**
```python
# backend/build_binary.py
import PyInstaller.__main__
import sys
import os

def build_server():
    PyInstaller.__main__.run([
        'main.py',
        '--onefile',
        '--name', 'voicebox-server',
        '--add-data', 'data:data',  # Include data files
        '--hidden-import', 'torch',
        '--hidden-import', 'transformers',
        '--hidden-import', 'fastapi',
        '--collect-all', 'qwen-tts',
        '--noconfirm',
    ])

if __name__ == '__main__':
    build_server()
```

**Build script for all platforms:**
```bash
#!/bin/bash
# scripts/build-server.sh

# Determine platform
PLATFORM=$(rustc --print host-tuple)

# Build Python binary
cd backend
python build_binary.py

# Rename with platform triple
cd dist
mv voicebox-server ../src-tauri/binaries/voicebox-server-${PLATFORM}

echo "Built voicebox-server-${PLATFORM}"
```

**Platform-specific binaries needed:**
- macOS Intel: `voicebox-server-x86_64-apple-darwin`
- macOS ARM: `voicebox-server-aarch64-apple-darwin`
- Linux: `voicebox-server-x86_64-unknown-linux-gnu`
- Windows: `voicebox-server-x86_64-pc-windows-msvc.exe`

### 2. Configure Tauri to Bundle Binary

**tauri/src-tauri/tauri.conf.json:**
```json
{
  "bundle": {
    "identifier": "sh.voicebox.app",
    "externalBin": [
      "binaries/voicebox-server"
    ],
    "resources": [
      "binaries/*"
    ]
  },
  "build": {
    "beforeBuildCommand": "bun run build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  }
}
```

**Capabilities (src-tauri/capabilities/default.json):**
```json
{
  "identifier": "default",
  "description": "Default permissions",
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "shell:allow-spawn",
    "fs:default"
  ]
}
```

### 3. Launch Python Server from Tauri

**tauri/src-tauri/src/main.rs:**
```rust
use tauri::{command, Manager};
use tauri_plugin_shell::ShellExt;
use std::sync::Mutex;

struct ServerState {
    child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
}

#[command]
async fn start_server(app: tauri::AppHandle, state: tauri::State<'_, ServerState>) -> Result<String, String> {
    let sidecar = app.shell()
        .sidecar("voicebox-server")
        .map_err(|e| format!("Failed to get sidecar: {}", e))?;

    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn: {}", e))?;

    // Store child process
    *state.child.lock().unwrap() = Some(child);

    // Wait for server to be ready (listen for startup log)
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let tauri_plugin_shell::process::CommandEvent::Stdout(line) = event {
                if String::from_utf8_lossy(&line).contains("Uvicorn running") {
                    break;
                }
            }
        }
    });

    Ok("Server started on http://localhost:8000".to_string())
}

#[command]
async fn stop_server(state: tauri::State<'_, ServerState>) -> Result<(), String> {
    if let Some(child) = state.child.lock().unwrap().take() {
        child.kill().map_err(|e| format!("Failed to kill: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerState {
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![start_server, stop_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4. Call from Frontend

**app/src/lib/hooks/useServer.ts:**
```typescript
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';

export function useServer() {
  const [serverUrl, setServerUrl] = useState<string>('http://localhost:8000');
  const [isRunning, setIsRunning] = useState(false);

  const startServer = async () => {
    try {
      const url = await invoke<string>('start_server');
      setServerUrl(url);
      setIsRunning(true);
      return url;
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  };

  const stopServer = async () => {
    try {
      await invoke('stop_server');
      setIsRunning(false);
    } catch (error) {
      console.error('Failed to stop server:', error);
      throw error;
    }
  };

  return { serverUrl, isRunning, startServer, stopServer };
}
```

---

## Shared Frontend Approach

### App Package Structure

The `app/` directory contains all React code that's shared between desktop and web.

**app/vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.tsx'),
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
});
```

### Tauri Wrapper

**tauri/src/main.tsx:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../app/src/App';
import '../app/src/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**tauri/vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../app/src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2021',
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: 'dist',
  },
});
```

**tauri/package.json:**
```json
{
  "name": "@voicebox/tauri",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

### Web Wrapper

**web/src/main.tsx:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../../app/src/App';
import '../../app/src/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**web/vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../app/src'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

---

## Development Workflow

### 1. Initial Setup

```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Create Tauri app with official CLI
cd voicebox
bunx create-tauri-app tauri

# Move app code to shared directory
mkdir app
# Move tauri/src/* to app/src/

# Create web directory
mkdir web
cd web
bunx create-vite . --template react-ts

# Setup Bun workspace in root package.json
cat > package.json << 'EOF'
{
  "name": "voicebox",
  "private": true,
  "workspaces": ["app", "tauri", "web"]
}
EOF

# Install all dependencies
bun install
```

### 2. Development

**Terminal 1 - Backend (Python FastAPI):**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend (Tauri dev mode):**
```bash
cd tauri
bun run tauri dev
```

This will:
1. Start Vite dev server on port 5173
2. Launch Tauri window pointing to localhost:5173
3. Hot reload on code changes

**For web development:**
```bash
cd web
bun run dev
```

### 3. Building for Production

**Build Python server:**
```bash
./scripts/build-server.sh
```

**Build Tauri app:**
```bash
cd tauri
bun run tauri build
```

This will:
1. Build React frontend with Vite
2. Bundle Python server binary
3. Create platform-specific installers:
   - macOS: `.app`, `.dmg`
   - Windows: `.exe`, `.msi`
   - Linux: `.deb`, `.AppImage`

**Build web app:**
```bash
cd web
bun run build
```

---

## Platform-Specific Considerations

### macOS
- Need both Intel and ARM builds
- Sign and notarize for distribution outside App Store
- Request permissions for microphone access (audio recording)

**tauri.conf.json additions:**
```json
{
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "10.15",
      "entitlements": "src-tauri/Entitlements.plist"
    }
  }
}
```

**Entitlements.plist:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.device.audio-input</key>
    <true/>
</dict>
</plist>
```

### Windows
- Build with NSIS or WiX installer
- Consider code signing for SmartScreen

### Linux
- Provide multiple formats: .deb, .AppImage, .rpm
- Consider Flatpak for broader distribution

---

## OpenAPI Client Generation

**scripts/generate-api.sh:**
```bash
#!/bin/bash

# Start backend if not running
if ! curl -s http://localhost:8000/openapi.json > /dev/null; then
    echo "Starting backend..."
    cd backend
    uvicorn main:app --port 8000 &
    BACKEND_PID=$!
    sleep 5
fi

# Download OpenAPI schema
curl http://localhost:8000/openapi.json > app/openapi.json

# Generate TypeScript client
cd app
bunx openapi-typescript-codegen \
    --input openapi.json \
    --output src/lib/api \
    --client fetch

echo "API client generated in app/src/lib/api"

# Kill backend if we started it
if [ ! -z "$BACKEND_PID" ]; then
    kill $BACKEND_PID
fi
```

**Add to package.json:**
```json
{
  "scripts": {
    "generate:api": "./scripts/generate-api.sh"
  }
}
```

---

## Server Mode Architecture

### Local Mode (Default)
1. Tauri app starts
2. App invokes `start_server` command
3. Rust spawns bundled Python binary as sidecar
4. Frontend connects to `http://localhost:8000`
5. All features work locally

### Remote Mode (One-Click)
1. User clicks "Start Server" on GPU machine
2. Tauri invokes `start_server` with `--host 0.0.0.0` flag
3. Server displays connection URL (e.g., `http://192.168.1.100:8000`)
4. User enters URL in client app
5. Client connects to remote server
6. All API calls go to remote machine

**Rust command with args:**
```rust
#[command]
async fn start_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, ServerState>,
    remote: bool,
) -> Result<String, String> {
    let mut sidecar = app.shell().sidecar("voicebox-server")
        .map_err(|e| format!("Failed to get sidecar: {}", e))?;

    if remote {
        sidecar = sidecar.args(["--host", "0.0.0.0"]);
    }

    // ... rest of spawn logic
}
```

---

## CI/CD for Multi-Platform Builds

**GitHub Actions workflow:**
```yaml
name: Build
on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd tauri
          bun install

      - name: Build Python server
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pyinstaller
          python build_binary.py

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          projectPath: tauri
          tagName: v__VERSION__
          releaseName: 'voicebox v__VERSION__'
```

---

## Key Decisions

### Why This Structure?

1. **Shared `app/` directory** - Single source of truth for UI code
2. **Thin wrappers** - `tauri/` and `web/` just configure build tools
3. **Sidecar pattern** - Bundle Python server without modifying Tauri core
4. **PyInstaller** - Creates standalone Python binary with all dependencies
5. **Platform-specific binaries** - Tauri automatically selects correct binary per platform

### Benefits

- ✅ No code duplication between web and desktop
- ✅ Python server bundled - users don't install Python
- ✅ Single command to build everything
- ✅ Type-safe API calls via OpenAPI generation
- ✅ Native performance with Tauri
- ✅ Web fallback for unsupported platforms
- ✅ Fast development with Bun (20-30x faster installs than npm)

### Tradeoffs

- ⚠️ Large bundle size (Python runtime + ML models + Tauri)
- ⚠️ Need to build Python binary for each platform
- ⚠️ First launch slow (model loading)
- ⚠️ Separate web build doesn't include server (requires separate backend deployment)

---

## Next Steps

1. Set up monorepo structure
2. Initialize Tauri app with `bunx create-tauri-app`
3. Create shared `app/` directory
4. Configure Vite to share code
5. Build Python server with PyInstaller
6. Configure Tauri sidecar
7. Test on macOS, Windows, Linux
8. Set up CI/CD for multi-platform builds

---

## Resources

- [Tauri 2.0 Documentation](https://v2.tauri.app/)
- [Tauri Sidecar Guide](https://v2.tauri.app/develop/sidecar/)
- [Bun Documentation](https://bun.sh/docs)
- [Bun Workspaces](https://bun.sh/docs/install/workspaces)
- [PyInstaller Documentation](https://pyinstaller.org/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [OpenAPI TypeScript Codegen](https://github.com/ferdikoomen/openapi-typescript-codegen)
