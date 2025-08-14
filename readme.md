# Regulation Podcast Transcriptions

This repository collects and makes searchable transcriptions of the Regulation Podcast.

## Structure

- `transcriptions/` — Contains episode transcriptions as `.txt` files.
- `powershell/fetch-transcribe.ps1` — Script to automate retrieval and transcription of new episodes.
- `webapp/` — React app for searching transcriptions (hosted via GitHub Pages).

## Usage

### React Search App

See `/webapp/README.md` for setup and deployment instructions.

### PowerShell Automation

**Requirements:**
- Windows PowerShell
- [faster-whisper-xxl.exe](https://github.com/Purfview/whisper-standalone-win) (large model)
- Set the environment variable `FASTER_WHISPER_PATH` to the full path of your `faster-whisper-xxl.exe` binary before running:
  ```
  $env:FASTER_WHISPER_PATH="C:\path\to\faster-whisper-xxl.exe"
  ```
- Edit script paths as needed.
- Run periodically to keep transcriptions up to date.

## License

MIT