import { create } from 'zustand';

interface PlayerState {
  currentAudioId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;

  setCurrentAudio: (audioId: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentAudioId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,

  setCurrentAudio: (audioId) => set({ currentAudioId: audioId, currentTime: 0, isPlaying: false }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  reset: () =>
    set({
      currentAudioId: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }),
}));
