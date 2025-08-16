# YT Transcriber

This is the engine room of the Regulation Database. It's a Node.js script responsible for automating the entire process of finding new podcast episodes, transcribing them, and committing them back to the repository so the webapp has fresh data.

It's designed to be robust, configurable, and adaptable enough to be used for other podcast projects, not just this one.

## ✨ Features

-   **Multi-Source Fetching:** Pulls content from both YouTube channels and RSS feeds.
-   **Smart De-duplication:** If an episode exists on both YouTube and an RSS feed, it processes it only once (YouTube is preferred). It also remembers what's already been transcribed to avoid re-doing work on subsequent runs.
-   **Rich Metadata Generation:** Creates a `metadata.json` file with detailed information for each episode, including title, description, duration, and URL.
-   **Local AI Transcription:** Uses a local instance of `faster-whisper` to perform high-quality transcription without relying on expensive, cloud-based APIs.
-   **Automated Git Commits:** Automatically adds, commits, and pushes new transcriptions and metadata, triggering the GitHub Action to update the live website.
-   **(Experimental) Image Extraction:** Can analyze video files to find and extract still images that are shown on screen for a certain duration.

---

## ⚙️ Setup and Configuration

Before you can run this script, you need a few things installed on your machine.

### 1. Requirements

You'll need the following command-line tools installed and accessible.

-   **[Node.js](https://nodejs.org/)**: (v18 or higher recommended)
-   **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**: The workhorse for downloading all media from YouTube and RSS feeds.
-   **[FFmpeg](https://ffmpeg.org/download.html)**: Required by `yt-dlp` for processing and converting audio/video files.
-   **[faster-whisper](https://github.com/Purfview/whisper-standalone-win)**: A standalone, high-performance version of OpenAI's Whisper model for transcription.

Make sure these are either in your system's `PATH` or you know the full path to their executables.

### 2. Configure the Script

All configuration is done in the `config.js` file. This is where you tell the script where to find your tools and what content to fetch.

```javascript
// config.js

export const config = {
  // --- REQUIRED PATHS ---
  // Make sure these point to the right executables on your system.
  fasterWhisperPath: "C:\\Apps\\Faster-Whisper-XXL\\faster-whisper-xxl.exe",
  ytDlpPath: "C:\\Apps\\yt-dlp\\yt-dlp.exe",
  ffmpegPath: "C:\\Apps\\ffmpeg\\bin",

  // --- CONTENT SOURCES ---
  // Add any YouTube channels or RSS feeds you want to scrape.
  youtubeChannels: {
    "Regulation Podcast": "https://www.youtube.com/@THEREGULATIONPOD",
    "Regulation Gameplay": "https://www.youtube.com/@TheRegulationPodcast",
  },
  rssFeeds: {
    "Regulation Podcast": "https://feeds.megaphone.fm/fface"
  },

  // --- TRANSCRIPTION CORRECTIONS ---
  // A simple map to automatically fix common transcription errors.
  commonTranscriptionErrors: {
    "Jeff": "Geoff",
    "Baddour": "Baudour",
  }
};
```

---

## 🚀 Usage

Once you've got your dependencies installed and your `config.js` dialed in, running the script is easy.

1.  **Install Node.js dependencies:**
    ```sh
    npm install
    ```
2.  **Run the transcriber:**
    ```sh
    node index.js
    ```
    The script will log its progress to the console as it fetches, processes, and transcribes new content.

### Forcing a Re-transcription

If you need to re-transcribe content that the script has already processed, you can use the `--force` flag.

```sh
node index.js --force
```

This will ignore the existing `metadata.json` and process all available media items again.

## 🛠️ How It Works

The logic is pretty straightforward but robust:

1.  **Gather:** The script first fetches a list of all available media (videos, audio episodes) from all sources defined in `config.js`.
2.  **De-duplicate:** It compiles a master list and removes any duplicates based on title. This ensures we only process each unique episode once. It also checks against the existing `metadata.json` to skip episodes that have already been successfully transcribed in previous runs.
3.  **Process:** It then iterates through the list of new content. For each item, it:
    a. Downloads the audio (or full video if image extraction is on).
    b. Passes the audio to `faster-whisper` for transcription.
    c. Runs any text corrections you've defined.
    d. Cleans up the temporary media files.
    e. Updates the `metadata.json` file.
4.  **Commit:** Once all new items are processed, it commits all the new transcription files and the updated `metadata.json` to your Git repository.

## 🙏 Contributing

Want to help improve the script? That's awesome! Please refer to the main **[CONTRIBUTING.md](../../CONTRIBUTING.md)** file for guidelines on how to submit issues and pull requests.