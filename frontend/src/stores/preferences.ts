import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Preferences {
  muted: boolean; volume: number; voice: string; speed: number; transcriptOpen: boolean
  sttModel: string; echoCancellation: boolean; noiseSuppression: boolean; autoGainControl: boolean
  set: (values: Partial<Omit<Preferences, 'set'>>) => void
}
export const usePreferences = create<Preferences>()(persist((set) => ({
  muted: false, volume: 0.9, voice: 'Samantha', speed: 1, transcriptOpen: true,
  sttModel: 'mlx-community/whisper-small.en-mlx', echoCancellation: true,
  noiseSuppression: true, autoGainControl: true,
  set: (values) => set(values),
}), { name: 'local-interviewer-preferences' }))
