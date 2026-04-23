"""Voicebox MCP tool implementations.

Thin wrappers over existing services/routes. Tools are registered with dotted
names (``voicebox.speak`` etc.) so they look natural in agent logs —
the Python function name stays snake_case.
"""

from __future__ import annotations

import asyncio
import base64 as b64
import logging
import tempfile
from pathlib import Path
from typing import Any, Literal

from fastmcp import FastMCP

from .. import models
from ..database import get_db
from ..services import captures as captures_service
from ..services import profiles as profiles_service
from . import events as mcp_events
from .context import current_client_id
from .resolve import resolve_profile


logger = logging.getLogger(__name__)

# Absolute-path transcribes are bounded to keep a bad client from
# asking us to ingest a 20 GB file.
MAX_TRANSCRIBE_BYTES = 200 * 1024 * 1024  # 200 MB


def register_tools(mcp: FastMCP) -> None:
    """Attach all Voicebox tools to the given FastMCP instance."""

    @mcp.tool(
        name="voicebox.speak",
        description=(
            "Speak text in a Voicebox voice profile. Returns a generation id "
            "the caller can poll at /generate/{id}/status. Audio plays on the "
            "user's speakers and is saved to the Captures / History tab."
        ),
    )
    async def voicebox_speak(
        text: str,
        profile: str | None = None,
        engine: str | None = None,
        intent: Literal["respond", "rewrite", "compose"] | None = None,
        language: str | None = None,
    ) -> dict[str, Any]:
        """Speak ``text`` in a voice profile.

        ``profile`` accepts a voice profile name (e.g. "Morgan") or id. If
        omitted, the server looks up the per-client binding for the calling
        MCP client, then falls back to the global default voice.

        ``intent`` only matters for profiles that have a personality prompt —
        when set, the text is first transformed by the LLM (respond to it,
        rewrite it in character, or compose a fresh utterance). Leave unset
        for plain TTS.
        """
        db = next(get_db())
        try:
            vp = resolve_profile(profile, current_client_id.get(), db)
            if vp is None:
                raise ValueError(
                    "No voice profile resolved. Pass `profile=` with a "
                    "voice profile name or id, or set a default voice in "
                    "Voicebox → Settings → MCP."
                )

            # Persona path if intent requested and personality present.
            if intent is not None and vp.personality:
                return await _speak_with_persona(
                    profile_id=vp.id,
                    profile_name=vp.name,
                    text=text,
                    engine=engine,
                    intent=intent,
                    language=language,
                    db=db,
                )

            return await _speak_plain(
                profile_id=vp.id,
                profile_name=vp.name,
                text=text,
                engine=engine,
                language=language,
                db=db,
            )
        finally:
            db.close()

    @mcp.tool(
        name="voicebox.transcribe",
        description=(
            "Transcribe an audio clip to text using Voicebox's local Whisper. "
            "Pass exactly one of `audio_base64` (bytes as base64) or "
            "`audio_path` (absolute local file path)."
        ),
    )
    async def voicebox_transcribe(
        audio_base64: str | None = None,
        audio_path: str | None = None,
        language: str | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        if bool(audio_base64) == bool(audio_path):
            raise ValueError(
                "Pass exactly one of `audio_base64` or `audio_path`."
            )

        # Absolute-path mode: validate and transcribe in place.
        if audio_path is not None:
            path = Path(audio_path)
            if not path.is_absolute():
                raise ValueError("`audio_path` must be absolute.")
            if not path.is_file():
                raise ValueError(f"File not found: {audio_path}")
            if path.stat().st_size > MAX_TRANSCRIBE_BYTES:
                raise ValueError(
                    f"File exceeds {MAX_TRANSCRIBE_BYTES // (1024 * 1024)} MB limit."
                )
            return await _transcribe_file(path, language, model)

        # Base64 mode: decode into a temp file, transcribe, clean up.
        try:
            raw = b64.b64decode(audio_base64, validate=True)
        except Exception as exc:
            raise ValueError(f"Invalid audio_base64: {exc}") from exc
        if len(raw) > MAX_TRANSCRIBE_BYTES:
            raise ValueError(
                f"Audio exceeds {MAX_TRANSCRIBE_BYTES // (1024 * 1024)} MB limit."
            )
        with tempfile.NamedTemporaryFile(
            suffix=".wav", delete=False
        ) as tmp:
            tmp.write(raw)
            tmp_path = Path(tmp.name)
        try:
            return await _transcribe_file(tmp_path, language, model)
        finally:
            tmp_path.unlink(missing_ok=True)

    @mcp.tool(
        name="voicebox.list_captures",
        description=(
            "List recent voice captures (dictations, recordings, uploads) "
            "with their transcripts. Most-recent first."
        ),
    )
    async def voicebox_list_captures(
        limit: int = 20, offset: int = 0
    ) -> dict[str, Any]:
        if not (1 <= limit <= 200):
            raise ValueError("`limit` must be between 1 and 200.")
        if offset < 0:
            raise ValueError("`offset` must be >= 0.")
        db = next(get_db())
        try:
            items, total = captures_service.list_captures(
                db, limit=limit, offset=offset
            )
            return {
                "captures": [
                    item.model_dump(mode="json") for item in items
                ],
                "total": total,
            }
        finally:
            db.close()

    @mcp.tool(
        name="voicebox.list_profiles",
        description=(
            "List available voice profiles (both cloned voices and presets). "
            "Use the returned `name` with voicebox.speak(profile=...)."
        ),
    )
    async def voicebox_list_profiles() -> dict[str, Any]:
        db = next(get_db())
        try:
            profiles = await profiles_service.list_profiles(db)
            return {
                "profiles": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "voice_type": p.voice_type,
                        "language": p.language,
                        "has_personality": bool(getattr(p, "personality", None)),
                    }
                    for p in profiles
                ]
            }
        finally:
            db.close()


# ─── Speak helpers ─────────────────────────────────────────────────────────


async def _speak_plain(
    *,
    profile_id: str,
    profile_name: str,
    text: str,
    engine: str | None,
    language: str | None,
    db,
) -> dict[str, Any]:
    """Plain TTS path — mirrors POST /generate. No LLM transform."""
    from ..routes.generations import generate_speech

    req = models.GenerationRequest(
        profile_id=profile_id,
        text=text,
        language=language or "en",
        engine=engine or "qwen",
    )
    generation = await generate_speech(req, db)
    return _speak_response(generation, profile_name, source="mcp")


async def _speak_with_persona(
    *,
    profile_id: str,
    profile_name: str,
    text: str,
    engine: str | None,
    intent: str,
    language: str | None,
    db,
) -> dict[str, Any]:
    """LLM-transformed path — reuses POST /profiles/{id}/speak."""
    from ..routes.profiles import speak_in_character

    req = models.PersonalitySpeakRequest(
        text=text,
        persist=True,
        language=language,
        engine=engine,
        intent=intent,
    )
    generation = await speak_in_character(profile_id, req, db)
    return _speak_response(generation, profile_name, source="mcp")


def _speak_response(
    generation, profile_name: str, *, source: str
) -> dict[str, Any]:
    """Normalize a GenerationResponse into the MCP tool's return shape.

    Also fires a speak-start event so the DictateWindow pill surfaces
    the agent's speech. Speak-end is fired from run_generation's
    completion hook.
    """
    payload = generation.model_dump(mode="json") if hasattr(
        generation, "model_dump"
    ) else dict(generation)
    generation_id = payload.get("id")
    mcp_events.publish(
        "speak-start",
        {
            "generation_id": generation_id,
            "profile_name": profile_name,
            "source": source,
            "client_id": current_client_id.get(),
        },
    )
    return {
        "generation_id": generation_id,
        "status": payload.get("status"),
        "profile": profile_name,
        "source": source,
        "poll_url": f"/generate/{generation_id}/status"
        if generation_id
        else None,
    }


# ─── Transcribe helper ─────────────────────────────────────────────────────


async def _transcribe_file(
    path: Path, language: str | None, model: str | None
) -> dict[str, Any]:
    from ..backends import WHISPER_HF_REPOS
    from ..services import transcribe as transcribe_service
    from ..utils.audio import load_audio

    whisper = transcribe_service.get_whisper_model()
    model_size = model or whisper.model_size
    valid = list(WHISPER_HF_REPOS.keys())
    if model_size not in valid:
        raise ValueError(
            f"Invalid STT model '{model_size}'. Must be one of: {', '.join(valid)}"
        )

    # load_audio is sync; keep the event loop responsive.
    audio, sr = await asyncio.to_thread(load_audio, str(path))
    duration = len(audio) / sr

    if (
        not whisper.is_loaded() or whisper.model_size != model_size
    ) and not whisper._is_model_cached(model_size):
        raise ValueError(
            f"Whisper model '{model_size}' is not yet downloaded. Open "
            "Voicebox → Settings → Models to download it first."
        )

    text = await whisper.transcribe(str(path), language, model_size)
    return {
        "text": text,
        "duration": duration,
        "language": language,
        "model": model_size,
    }
