"""
Entry point for PyInstaller-bundled voicebox server.

This module provides an entry point that works with PyInstaller by using
absolute imports instead of relative imports.
"""

import argparse
import uvicorn

# Import the FastAPI app from the backend package
from backend.main import app
from backend import config, database

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="voicebox backend server")
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (use 0.0.0.0 for remote access)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to",
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default=None,
        help="Data directory for database, profiles, and generated audio",
    )
    args = parser.parse_args()

    # Set data directory if provided
    if args.data_dir:
        config.set_data_dir(args.data_dir)

    # Initialize database after data directory is set
    database.init_db()

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="info",
    )
