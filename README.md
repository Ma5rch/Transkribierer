# Transkriptions-App

Die App bietet zwei Transkriptionsvarianten. **Standardmäßig ist AssemblyAI aktiviert.** Alternativ kann ein eigener WhisperX-Dienst verwendet werden.

## 1. Start mit AssemblyAI (Standard)

Voraussetzungen: Node.js 20 oder neuer.

1. Repository herunterladen bzw. im Codespace öffnen.
2. Umgebungsdatei erstellen:
   ```bash
   cp .env.example .env
   ```
3. Die Datei `.env` öffnen und Folgendes eintragen:
   ```env
   TRANSCRIBER=assemblyai
   ASSEMBLYAI_API_KEY=DEIN_API_KEY
   APP_PASSWORD=DEIN_EIGENES_PASSWORT
   ```
   Den persönlichen API-Key niemals in GitHub-Dateien oder in den Quellcode eintragen.
4. Abhängigkeiten installieren und App starten:
   ```bash
   npm install
   npm start
   ```
5. Im Browser `http://localhost:3000` öffnen.

AssemblyAI ist ein externer Dienst. Für die Nutzung gelten dessen aktuelle Preise, Kontobedingungen und Datenschutzbestimmungen. Die Audiodateien werden zur Transkription an AssemblyAI übermittelt.

## 2. Alternative: WhisperX selbst betreiben

WhisperX ist Open Source und kann auf eigener Hardware oder einem entsprechend ausgestatteten Server betrieben werden. Für die Verarbeitung können je nach Hardware erhebliche Rechenressourcen nötig sein.

Voraussetzungen: Node.js 20+, Python 3.10+ und ffmpeg.

1. Für die Sprechererkennung ein Konto bei Hugging Face erstellen, die Nutzungsbedingungen der Modelle `pyannote/speaker-diarization-3.1` und `pyannote/segmentation-3.0` akzeptieren und einen Zugriffstoken erstellen.
2. Den WhisperX-Dienst starten:
   ```bash
   cd whisperx_service
   pip install -r requirements.txt
   HF_TOKEN=DEIN_HUGGINGFACE_TOKEN WHISPER_MODEL=medium uvicorn service:app --host 0.0.0.0 --port 8000
   ```
3. In der App-Konfiguration in `.env` WhisperX aktivieren:
   ```env
   TRANSCRIBER=whisperx
   WHISPERX_URL=http://127.0.0.1:8000
   ```
4. Im Projektverzeichnis die Node-App starten:
   ```bash
   npm install
   npm start
   ```

Auf einer CPU kann die Verarbeitung langsam sein. Ein kleineres Modell ist meist schneller, kann aber ungenauer sein. Mit einer kompatiblen NVIDIA-GPU kann `DEVICE=cuda` verwendet werden.

## 3. Optionale KI-Zusammenfassung

Die Zusammenfassung verwendet standardmäßig einen lokalen Ollama-Dienst. Ollama installieren und anschließend das Modell laden:

```bash
ollama pull llama3.1
```

Der Dienst muss unter der in `OLLAMA_URL` eingestellten Adresse erreichbar sein.

## 4. Sicherheit und Datenschutz

- Geheimnisse wie `ASSEMBLYAI_API_KEY`, `HF_TOKEN` und `APP_PASSWORD` gehören ausschließlich in lokale Umgebungsvariablen bzw. eine nicht veröffentlichte `.env`-Datei.
- `.env`, hochgeladene Audiodateien und installierte Abhängigkeiten werden durch `.gitignore` vom Git-Commit ausgeschlossen.
- Die App löscht lokal gespeicherte Uploads standardmäßig nach 30 Tagen (`RETENTION_DAYS`); manuelles Löschen ist ebenfalls vorgesehen.
- Vor einer öffentlichen Veröffentlichung müssen Authentifizierung, dauerhafte Speicherung, HTTPS, Hosting-Konfiguration und Datenschutz für den konkreten Einsatz geprüft werden. Eine DSGVO-Konformität wird nicht zugesichert.
