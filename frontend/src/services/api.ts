import type { Interview, Provider } from '../types'

export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: options?.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(body.detail || 'Request failed')
  }
  return response.status === 204 ? undefined as T : response.json()
}

export const api = {
  health: () => request<{status: string}>('/health'),
  diagnostics: () => request<Record<string, unknown>>('/diagnostics'),
  providers: () => request<Provider[]>('/providers'),
  createProvider: (provider: Omit<Provider, 'id'>) => request<Provider>('/providers', { method: 'POST', body: JSON.stringify(provider) }),
  updateProvider: (id: string, provider: Omit<Provider, 'id'>) => request<Provider>(`/providers/${id}`, { method: 'PUT', body: JSON.stringify(provider) }),
  testProvider: (id: string) => request<{ok: boolean; latency_ms?: number; models?: string[]; error?: string}>(`/providers/${id}/test`, { method: 'POST' }),
  models: (id: string) => request<{models: Array<{name: string}>}>(`/providers/${id}/models`),
  history: () => request<Interview[]>('/interviews'),
  interview: (id: string) => request<Interview>(`/interviews/${id}`),
  createInterview: (body: Record<string, unknown>) => request<Interview>('/interviews', { method: 'POST', body: JSON.stringify(body) }),
  answer: (id: string, content: string) => request<Interview>(`/interviews/${id}/answers`, { method: 'POST', body: JSON.stringify({ content, message_id: crypto.randomUUID() }) }),
  action: (id: string, action: 'pause'|'resume'|'end') => request<Interview>(`/interviews/${id}/${action}`, { method: 'POST' }),
  evaluate: (id: string) => request(`/interviews/${id}/evaluation`, { method: 'POST' }),
  deleteInterview: (id: string) => request<void>(`/interviews/${id}`, { method: 'DELETE' }),
  transcribe: async (blob: Blob) => {
    const form = new FormData(); form.append('file', blob, `answer.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`); form.append('backend', 'mlx-whisper'); form.append('model', 'mlx-community/whisper-small-mlx')
    return request<{text: string; confidence: number|null; latency_ms: number}>('/stt/transcribe', { method: 'POST', body: form })
  },
  speak: async (text: string, voice = 'Samantha', speed = 1) => {
    const response = await fetch(`${API_URL}/tts/synthesize`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text, provider: 'auto', voice, speed }) })
    if (!response.ok) throw new Error((await response.json()).detail || 'Speech synthesis failed')
    return response.blob()
  },
  extract: async (file: File) => { const form = new FormData(); form.append('file', file); return request<{text: string}>('/documents/extract', {method:'POST', body:form}) },
}
