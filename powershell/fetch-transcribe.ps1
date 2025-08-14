# Configuration
$RootDir = $PSScriptRoot            # Use the directory where the script is located
$TranscriptionDir = Join-Path $RootDir "..\transcriptions"
$ModelExe = $env:FASTER_WHISPER_PATH  # Path from environment variable
$GitRepoDir = $RootDir
$LastCheckedFile = Join-Path $TranscriptionDir "last_checked.txt"
$FeedUrl = "https://feeds.megaphone.fm/fface"

if (-not $ModelExe) {
    Write-Error "Environment variable FASTER_WHISPER_PATH is not set. Please set this to the path of faster-whisper-xxl.exe."
    exit 1
}

# Ensure transcription dir exists
if (!(Test-Path $TranscriptionDir)) { mkdir $TranscriptionDir }

# Load RSS feed
[xml]$rss = Invoke-WebRequest -Uri $FeedUrl | Select-Object -ExpandProperty Content
$episodes = $rss.rss.channel.item

# Read last checked GUIDs
$lastChecked = @()
if (Test-Path $LastCheckedFile) {
  $lastChecked = Get-Content $LastCheckedFile
}

foreach ($ep in $episodes) {
  $guid = $ep.guid.'#text'
  if ($lastChecked -contains $guid) { continue }

  $title = $ep.title
  $audioUrl = $ep.enclosure.url
  $fileName = $title -replace '[^\w\d-]', '_'   # sanitize
  $audioPath = Join-Path $TranscriptionDir "$fileName.mp3"
  $transcriptPath = Join-Path $TranscriptionDir "$fileName.txt"

  Write-Host "Downloading $title..."
  Invoke-WebRequest -Uri $audioUrl -OutFile $audioPath

  Write-Host "Transcribing $title..."
  & $ModelExe --model-size large --input $audioPath --output $transcriptPath

  # Add to last checked
  Add-Content -Path $LastCheckedFile -Value $guid
  Remove-Item $audioPath  # optional: clean up audio after transcription

  # Git push
  Set-Location $GitRepoDir
  git add $transcriptPath $LastCheckedFile
  git commit -m "Add transcription for episode: $title"
  git push
}

Write-Host "Done checking for new episodes."