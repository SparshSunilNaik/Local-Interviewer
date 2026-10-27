import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

describe('API client', () => {
  afterEach(() => vi.restoreAllMocks())
  it('surfaces actionable backend errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({detail:'Ollama unavailable'}), {status: 502, headers:{'Content-Type':'application/json'}}))
    await expect(api.testProvider('provider-id')).rejects.toThrow('Ollama unavailable')
  })
})
