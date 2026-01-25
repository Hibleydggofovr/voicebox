"""
PyInstaller build script for creating standalone Python server binary.
"""

import PyInstaller.__main__
import os
from pathlib import Path


def build_server():
    """Build Python server as standalone binary."""
    backend_dir = Path(__file__).parent

    # Find qwen_tts source directory (it's an editable install)
    qwen_tts_path = Path('/Users/jamespine/Projects/voice/Qwen3-TTS')

    # PyInstaller arguments
    args = [
        'server.py',  # Use server.py as entry point instead of main.py
        '--onefile',
        '--name', 'voicebox-server',
        '--paths', str(qwen_tts_path),  # Add qwen_tts source to paths
        '--hidden-import', 'backend',
        '--hidden-import', 'backend.main',
        '--hidden-import', 'backend.config',
        '--hidden-import', 'backend.database',
        '--hidden-import', 'backend.models',
        '--hidden-import', 'backend.profiles',
        '--hidden-import', 'backend.history',
        '--hidden-import', 'backend.tts',
        '--hidden-import', 'backend.transcribe',
        '--hidden-import', 'backend.utils.audio',
        '--hidden-import', 'backend.utils.cache',
        '--hidden-import', 'backend.utils.progress',
        '--hidden-import', 'backend.utils.hf_progress',
        '--hidden-import', 'backend.utils.validation',
        '--hidden-import', 'torch',
        '--hidden-import', 'transformers',
        '--hidden-import', 'fastapi',
        '--hidden-import', 'uvicorn',
        '--hidden-import', 'sqlalchemy',
        '--hidden-import', 'librosa',
        '--hidden-import', 'soundfile',
        '--hidden-import', 'qwen_tts',
        '--hidden-import', 'qwen_tts.inference',
        '--hidden-import', 'qwen_tts.inference.qwen3_tts_model',
        '--hidden-import', 'qwen_tts.inference.qwen3_tts_tokenizer',
        '--hidden-import', 'qwen_tts.core',
        '--hidden-import', 'qwen_tts.cli',
        '--copy-metadata', 'qwen-tts',
        '--collect-submodules', 'qwen_tts',
        '--collect-data', 'qwen_tts',
        '--noconfirm',
        '--clean',
    ]
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    # Run PyInstaller
    PyInstaller.__main__.run(args)
    
    print(f"Binary built in {backend_dir / 'dist' / 'voicebox-server'}")


if __name__ == '__main__':
    build_server()
