    
export const config = {
  // A temporary directory for the downloader to place files for the transcriber.
  tempAudioDir: "./temp_audio",

  // Path to your cookies.txt file to handle age-restricted content.
  // Place the file in this directory and use "./cookies.txt".
  // Leave as "" to disable.
  youtubeCookiePath: "./cookies.txt",

  // Path to the faster-whisper executable. Use forward slashes.
  fasterWhisperPath: "C:\\Apps\\Faster-Whisper-XXL\\faster-whisper-xxl.exe",
  
  // Path to the yt-dlp executable.
  ytDlpPath: "C:\\Apps\\yt-dlp\\yt-dlp.exe",
  
  ffmpegPath: "C:\\Apps\\ffmpeg\\bin", 


  // --- Content Filtering ---
  // Videos shorter than this duration (in seconds) will be skipped.
  minVideoDurationSeconds: 90,

  // --- Similarity-Based Image Extraction ---
  imageExtraction: {
    enabled: true,
    similarityThreshold: 0.7, 
    similarityThresholdUpperCheck: 0.95,
    debug: true, 

    pixelMatchThreshold: 0.25, // Tolerance for pixel differences (0 to 1). Lower is more strict.

    // Set to null to have the script automatically determine the write number of concurrent threads to use based on CPU cores.
    // Or set to 1 to disable concurrency (easier debugging).
    maxConcurrency: 6,
    
    cropDetection: { 
      enabled: true, // Set to true to only analyze the center of the video
      width: 0.8,    
      left: 0.2,     
      height: 0.3,
      top: 0.4,
    }
  },

  // --- Content Sources ---
  // RSS Feeds are used as a backup to find content that isn't posted on YouTube.
  // If a video is found on both YouTube and RSS, the YouTube version is preferred.
  youtubeChannels: {
    "Regulation Podcast": "https://www.youtube.com/@THEREGULATIONPOD",
    "Regulation Gameplay": "https://www.youtube.com/@TheRegulationPodcast",
  },
  
  rssFeeds: {
    "Regulation Podcast": "https://feeds.megaphone.fm/fface"
  },

  // A map of common transcription errors (key: wrong word, value: correct word).
  // The 'g' flag makes the replacement global for the entire file.
  // The replacement is case-sensitive.
  commonTranscriptionErrors: {
    "Jeff": "Geoff",
    "Gurbler": "Gurpler",
    "Baddour": "Baudour",
    "Gerbler": "Gurpler",
    "Andrew Patton": "Andrew Panton",
    "Andrew Banton": "Andrew Panton",
    "Gavin Freed": "Gavin Free",
    "goopless": "Gurpler",
    "Salt Right": "Slot Right",
    "Pi A": "paella"
  }
};

  