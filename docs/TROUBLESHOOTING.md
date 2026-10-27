# Troubleshooting

Run `./scripts/doctor.sh` first. Logs are in `run/backend.log` and `run/frontend.log`.

- **Ollama unavailable:** run `ollama serve`, then test the profile. Startup does not require Ollama.
- **Model missing:** run `ollama pull qwen3:8b`; verify with `ollama list`.
- **Remote timeout:** verify routing/firewall and increase the profile timeout. Redirects are intentionally blocked.
- **Microphone denied:** grant browser permission in OS settings, reload, and choose push-to-talk or text mode.
- **No speech detected:** check the live meter, speak longer, and verify FFmpeg and the configured STT package/model.
- **TTS fails:** use text mode or select the verified OS fallback. No cloud fallback occurs.
- **Migration/database error:** back up `backend/data/` and inspect the backend log. Never remove the database unless you intend to erase local history.
- **Port in use:** stop the owning process or adjust ports consistently; scripts never kill unrelated processes.
- **Interrupted interview:** reopen it from History. Persisted authoritative state is shown; contradictory automatic resumption is avoided.
