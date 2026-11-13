# Transkriptions-App (kostenlos, lokal)
Voraussetzungen: Node 20+, Python 3.10+, ffmpeg. Kostenlos: Whisper + pyannote laufen auf dem eigenen Rechner.
1. Sprechererkennung freischalten (kostenlos): Konto bei huggingface.co, Nutzungsbedingungen von `pyannote/speaker-diarization-3.1` und `pyannote/segmentation-3.0` akzeptieren, Token erstellen -> `HF_TOKEN`.
2. `cd whisperx_service && pip install -r requirements.txt && HF_TOKEN=... WHISPER_MODEL=medium uvicorn service:app` (CPU ist langsam; kleinere Modelle `small`/`medium` sind schneller, aber ungenauer; NVIDIA-GPU: `DEVICE=cuda`).
3. `cp .env.example .env && npm install && npm start`, dann http://localhost:3000 öffnen.
iPhone/iPad: Mikrofon in Safari nur über HTTPS (z. B. kostenloser Cloudflare Tunnel/Tailscale). `APP_PASSWORD` setzen!
Alternative (kostenpflichtig): `TRANSCRIBER=assemblyai` + Key.

## Zusammenfassung (kostenlos, lokal)
Ollama installieren (ollama.com), `ollama pull llama3.1`. Sehr lange Transkripte können das Kontextfenster (16k Tokens) überschreiten.
## Datenschutz
Audio wird nach `RETENTION_DAYS` (Standard 30) automatisch gelöscht; manuell über „Löschen“. Keine DSGVO-Konformität garantiert: bitte selbst prüfen.
