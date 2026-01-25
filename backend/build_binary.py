"""
PyInstaller build script for creating standalone Python server binary.
"""

import PyInstaller.__main__
import sys
import os
from pathlib import Path


def build_server():
    """Build Python server as standalone binary."""
    backend_dir = Path(__file__).parent
    
    # PyInstaller arguments
    args = [
        'main.py',
        '--onefile',
        '--name', 'voicebox-server',
        '--add-data', f'utils{os.pathsep}utils',  # Include utils package
        '--hidden-import', 'torch',
        '--hidden-import', 'transformers',
        '--hidden-import', 'fastapi',
        '--hidden-import', 'uvicorn',
        '--hidden-import', 'sqlalchemy',
        '--hidden-import', 'librosa',
        '--hidden-import', 'soundfile',
        '--collect-all', 'qwen-tts',
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
