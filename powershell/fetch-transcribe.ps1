#
# Transcribes new podcast episodes from an RSS feed using faster-whisper.
#
# Usage:
#   .\transcribe_podcast.ps1
#   .\transcribe_podcast.ps1 -ForceRetranscribe
#

param(
    # If specified, the script will re-download and re-transcribe an episode
    # even if the transcription file already exists on disk.
    [switch]$ForceRetranscribe
)

# Configuration
$RootDir = $PSScriptRoot            # Use the directory where the script is located
$TranscriptionDir = Join-Path $RootDir "..\transcriptions"
$ModelExe = $env:FASTER_WHISPER_PATH  # Path from environment variable
$GitRepoDir = $RootDir
$LastCheckedFile = Join-Path $TranscriptionDir "last_checked.txt"
$FeedUrl = "https://feeds.megaphone.fm/fface"

if (-not $ModelExe) {
    Write-Error "Environment variable FASTER_WHISPER_PATH is not set. Please set this to the path of your faster-whisper executable (e.g., faster-whisper-xxl.exe)."
    exit 1
}

# Ensure transcription dir exists
if (!(Test-Path $TranscriptionDir)) { 
    Write-Host "Creating transcription directory at: $TranscriptionDir"
    mkdir $TranscriptionDir 
}

# Load RSS feed
$wc = New-Object System.Net.WebClient
try {
    [xml]$rss = Invoke-WebRequest -Uri $FeedUrl | Select-Object -ExpandProperty Content
}
catch {
    Write-Error "Failed to download or parse the RSS feed from $FeedUrl. Please check the URL and your internet connection."
    exit 1
}
$episodes = $rss.rss.channel.item

# Read last checked GUIDs
$lastChecked = @()
if (Test-Path $LastCheckedFile) {
  $lastChecked = Get-Content $LastCheckedFile
}

foreach ($ep in $episodes) {
  $guid = $ep.guid.'#text'
  # Skip if we've already successfully processed this episode's GUID
  if ($lastChecked -contains $guid) { continue }

  $title = $ep.title
  $audioUrl = $ep.enclosure.url
  $fileName = $title -replace '[^\w\d-]', '_'   # sanitize
  $audioPath = Join-Path $TranscriptionDir "$fileName.mp3"
  $transcriptPath = Join-Path $TranscriptionDir "$fileName.txt"

  # Check if the transcription file already exists.
  # If it exists AND the -ForceRetranscribe switch is NOT used, skip this episode.
  if ((Test-Path $transcriptPath) -and (-not $ForceRetranscribe.IsPresent)) {
      Write-Host "Skipping '$title' because transcription already exists at '$transcriptPath'. Use -ForceRetranscribe to override."
      # We still add the GUID to last_checked to avoid re-evaluating it next time.
      if (-not ($lastChecked -contains $guid)) {
          Add-Content -Path $LastCheckedFile -Value $guid
      }
      continue
  }

  Write-Host "Downloading $title..."
  try {
      $wc.DownloadFile($audioUrl, $audioPath)
  }
  catch {
      Write-Warning "Failed to download audio for '$title' from URL: $audioUrl"
      continue # Skip to the next episode
  }


  Write-Host "Transcribing $title..."
  & $ModelExe --model large-v2 $audioPath --output_format txt --output_dir $TranscriptionDir --language en

  # Add to last checked
  Add-Content -Path $LastCheckedFile -Value $guid
  
  if (Test-Path $audioPath) {
      Remove-Item $audioPath
  }

  # Git push
  Write-Host "Committing transcription for '$title' to Git..."
  Set-Location $GitRepoDir
  git add $transcriptPath, $LastCheckedFile
  git commit -m "Add transcription for episode: $title"
  git push
}

Write-Host "Done checking for new episodes."