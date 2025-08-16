    
export const config = {
  // Path to the faster-whisper executable. Use forward slashes.
  fasterWhisperPath: "C:\\Apps\\Faster-Whisper-XXL\\faster-whisper-xxl.exe",
  
  // Path to the yt-dlp executable.
  ytDlpPath: "C:\\Apps\\yt-dlp\\yt-dlp.exe",
  
  ffmpegPath: "C:\\Apps\\ffmpeg\\bin", 


  // --- Content Filtering ---
  // Videos shorter than this duration (in seconds) will be skipped.
  // YouTube Shorts are 60 seconds or less. Set to 0 to include all videos.
  minVideoDurationSeconds: 60,

  // --- Similarity-Based Image Extraction ---
  imageExtraction: {
    enabled: false,
    minSceneDurationSeconds: 10,
    similarityThreshold: 0.95, 
    debug: true, 
    
    cropDetection: {
      enabled: true, // Set to true to only analyze the center of the video
      width: 0.6,    // Analyze the middle 60% of the video's width
      left: 0.2,     // Start the analysis 20% from the left edge
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
  }
};

  