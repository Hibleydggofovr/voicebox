"""
Voice prompt caching utilities.
"""

import hashlib
import torch
from pathlib import Path
from typing import Optional, Tuple
import soundfile as sf


_cache_dir = Path("data/cache")
_cache_dir.mkdir(parents=True, exist_ok=True)

# In-memory cache
_memory_cache: dict[str, torch.Tensor] = {}


def get_cache_key(audio_path: str, reference_text: str) -> str:
    """
    Generate cache key from audio file and reference text.
    
    Args:
        audio_path: Path to audio file
        reference_text: Reference text
        
    Returns:
        Cache key (MD5 hash)
    """
    # Read audio file
    with open(audio_path, "rb") as f:
        audio_bytes = f.read()
    
    # Combine audio bytes and text
    combined = audio_bytes + reference_text.encode("utf-8")
    
    # Generate hash
    return hashlib.md5(combined).hexdigest()


def get_cached_voice_prompt(
    cache_key: str,
) -> Optional[torch.Tensor]:
    """
    Get cached voice prompt if available.
    
    Args:
        cache_key: Cache key
        
    Returns:
        Cached voice prompt tensor or None
    """
    # Check in-memory cache
    if cache_key in _memory_cache:
        return _memory_cache[cache_key]
    
    # Check disk cache
    cache_file = _cache_dir / f"{cache_key}.prompt"
    if cache_file.exists():
        try:
            prompt = torch.load(cache_file)
            _memory_cache[cache_key] = prompt
            return prompt
        except Exception:
            # Cache file corrupted, delete it
            cache_file.unlink()
    
    return None


def cache_voice_prompt(
    cache_key: str,
    voice_prompt: torch.Tensor,
) -> None:
    """
    Cache voice prompt to memory and disk.
    
    Args:
        cache_key: Cache key
        voice_prompt: Voice prompt tensor
    """
    # Store in memory
    _memory_cache[cache_key] = voice_prompt
    
    # Store on disk
    cache_file = _cache_dir / f"{cache_key}.prompt"
    torch.save(voice_prompt, cache_file)
