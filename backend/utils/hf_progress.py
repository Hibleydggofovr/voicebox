"""
HuggingFace Hub download progress tracking.
"""

from typing import Optional, Callable
from contextlib import contextmanager
import threading


class HFProgressTracker:
    """Tracks HuggingFace Hub download progress by intercepting hf_hub_download."""
    
    def __init__(self, progress_callback: Optional[Callable] = None):
        self.progress_callback = progress_callback
        self._original_hf_hub_download = None
        self._lock = threading.Lock()
        self._total_downloaded = 0
        self._total_size = 0
    
    def _tracked_hf_hub_download(self, *args, **kwargs):
        """Wrapper for hf_hub_download with progress tracking."""
        import huggingface_hub
        
        # Get original callback if present
        original_resume_callback = kwargs.get("resume_download", None)
        
        def combined_callback(downloaded: int, total: int):
            """Combined callback that tracks progress."""
            # Update totals
            with self._lock:
                # Estimate: assume each file contributes equally
                # This is a simplification - in reality we'd track per-file
                if total > 0:
                    self._total_size = max(self._total_size, total)
                    self._total_downloaded = downloaded
            
            # Call original callback if present
            if original_resume_callback:
                original_resume_callback(downloaded, total)
            
            # Call our progress callback
            if self.progress_callback:
                with self._lock:
                    self.progress_callback(self._total_downloaded, self._total_size)
        
        # Replace callback
        kwargs["resume_download"] = combined_callback
        
        # Call original download
        return self._original_hf_hub_download(*args, **kwargs)
    
    @contextmanager
    def patch_download(self):
        """Context manager to patch hf_hub_download for progress tracking."""
        try:
            import huggingface_hub
            self._original_hf_hub_download = huggingface_hub.hf_hub_download
            
            # Reset totals
            with self._lock:
                self._total_downloaded = 0
                self._total_size = 0
            
            # Patch the function
            huggingface_hub.hf_hub_download = self._tracked_hf_hub_download
            
            yield
        except ImportError:
            # If huggingface_hub not available, just yield without patching
            yield
        finally:
            # Restore original
            if self._original_hf_hub_download:
                try:
                    import huggingface_hub
                    huggingface_hub.hf_hub_download = self._original_hf_hub_download
                except ImportError:
                    pass


def create_hf_progress_callback(model_name: str, progress_manager):
    """Create a progress callback for HuggingFace downloads."""
    def callback(downloaded: int, total: int):
        """Progress callback."""
        if total > 0:
            progress_manager.update_progress(
                model_name=model_name,
                current=downloaded,
                total=total,
                filename="",
                status="downloading",
            )
    return callback
