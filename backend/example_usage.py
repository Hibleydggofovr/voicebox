"""
Example usage of the voicebox backend API.

This script demonstrates how to:
1. Create a voice profile
2. Add samples to the profile
3. Generate speech
4. List history
"""

import requests
import time
from pathlib import Path

# API base URL
BASE_URL = "http://localhost:8000"


def check_health():
    """Check if the server is running."""
    response = requests.get(f"{BASE_URL}/health")
    data = response.json()
    print(f"Server status: {data['status']}")
    print(f"Model loaded: {data['model_loaded']}")
    print(f"GPU available: {data['gpu_available']}")
    print()
    return data


def create_profile(name: str, description: str = None, language: str = "en"):
    """Create a new voice profile."""
    response = requests.post(
        f"{BASE_URL}/profiles",
        json={
            "name": name,
            "description": description,
            "language": language,
        },
    )
    response.raise_for_status()
    profile = response.json()
    print(f"Created profile: {profile['name']} (ID: {profile['id']})")
    return profile


def add_sample(profile_id: str, audio_file: str, reference_text: str):
    """Add a sample to a voice profile."""
    with open(audio_file, "rb") as f:
        files = {"file": f}
        data = {"reference_text": reference_text}
        response = requests.post(
            f"{BASE_URL}/profiles/{profile_id}/samples",
            files=files,
            data=data,
        )
    response.raise_for_status()
    sample = response.json()
    print(f"Added sample: {sample['id']}")
    return sample


def generate_speech(profile_id: str, text: str, language: str = "en", seed: int = None):
    """Generate speech using a voice profile."""
    print(f"Generating speech: '{text[:50]}...'")
    start_time = time.time()
    
    response = requests.post(
        f"{BASE_URL}/generate",
        json={
            "profile_id": profile_id,
            "text": text,
            "language": language,
            "seed": seed,
        },
    )
    response.raise_for_status()
    generation = response.json()
    
    elapsed = time.time() - start_time
    print(f"Generated in {elapsed:.2f}s (duration: {generation['duration']:.2f}s)")
    print(f"Generation ID: {generation['id']}")
    return generation


def download_audio(generation_id: str, output_file: str):
    """Download generated audio."""
    response = requests.get(f"{BASE_URL}/audio/{generation_id}")
    response.raise_for_status()
    
    with open(output_file, "wb") as f:
        f.write(response.content)
    
    print(f"Saved audio to: {output_file}")


def list_profiles():
    """List all voice profiles."""
    response = requests.get(f"{BASE_URL}/profiles")
    response.raise_for_status()
    profiles = response.json()
    
    print(f"Found {len(profiles)} profiles:")
    for profile in profiles:
        print(f"  - {profile['name']} (ID: {profile['id']})")
    
    return profiles


def list_history(profile_id: str = None, limit: int = 10):
    """List generation history."""
    params = {"limit": limit}
    if profile_id:
        params["profile_id"] = profile_id
    
    response = requests.get(f"{BASE_URL}/history", params=params)
    response.raise_for_status()
    history = response.json()
    
    print(f"Found {len(history)} generations:")
    for gen in history:
        print(f"  - {gen['text'][:50]}... ({gen['duration']:.2f}s)")
    
    return history


def transcribe_audio(audio_file: str, language: str = None):
    """Transcribe audio file."""
    print(f"Transcribing: {audio_file}")
    
    with open(audio_file, "rb") as f:
        files = {"file": f}
        data = {}
        if language:
            data["language"] = language
        
        response = requests.post(
            f"{BASE_URL}/transcribe",
            files=files,
            data=data,
        )
    
    response.raise_for_status()
    result = response.json()
    
    print(f"Transcription: {result['text']}")
    print(f"Duration: {result['duration']:.2f}s")
    return result


def main():
    """Run example workflow."""
    print("=" * 60)
    print("voicebox Backend API Example")
    print("=" * 60)
    print()
    
    # 1. Check health
    print("1. Checking server health...")
    check_health()
    
    # 2. Create a profile
    print("2. Creating voice profile...")
    profile = create_profile(
        name="Example Voice",
        description="A test voice profile",
        language="en",
    )
    profile_id = profile["id"]
    print()
    
    # 3. Add samples (you'll need actual audio files)
    print("3. Adding samples...")
    print("   (Skipping - add your own audio files here)")
    # Uncomment and add your audio file:
    # sample = add_sample(
    #     profile_id,
    #     "path/to/your/sample.wav",
    #     "This is the transcript of the audio",
    # )
    print()
    
    # 4. Generate speech (requires samples to be added first)
    print("4. Generating speech...")
    print("   (Skipping - add samples first)")
    # Uncomment after adding samples:
    # generation = generate_speech(
    #     profile_id,
    #     "Hello, this is a test of the voice cloning system.",
    #     language="en",
    #     seed=42,
    # )
    # 
    # # 5. Download audio
    # print("\n5. Downloading audio...")
    # download_audio(generation["id"], "output.wav")
    print()
    
    # 6. List profiles
    print("6. Listing all profiles...")
    list_profiles()
    print()
    
    # 7. List history
    print("7. Listing generation history...")
    list_history(limit=5)
    print()
    
    # 8. Transcribe audio (you'll need an audio file)
    print("8. Transcribing audio...")
    print("   (Skipping - add your own audio file here)")
    # Uncomment and add your audio file:
    # transcribe_audio("path/to/audio.wav", language="en")
    print()
    
    print("=" * 60)
    print("Example complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
