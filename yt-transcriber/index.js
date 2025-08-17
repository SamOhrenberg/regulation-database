import YtDlpWrapModule from 'yt-dlp-wrap';
import { execa } from 'execa';
import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { config } from './config.js';

// --- METADATA HELPER FUNCTIONS ---
function calculateShow(info, item) {

  if (!info?.channel) {
    return "Unknown Show";
  }

  if (info.channel === "Regulation Gameplay") {
      return "Regulation Gameplay";
  }

  if (info.channel === "Regulation Podcast") {
    const uploadDate = info.upload_date ? new Date(parseInt(info.upload_date.substring(0,4)), parseInt(info.upload_date.substring(4,6)), parseInt(info.upload_date.substring(6,8))) : null;
    if (uploadDate > new Date(2025,4,8)) // last episode of f**kface was on may 8, 2025, JS is zero based month
      return "Regulation Podcast";
    else
      return "F**kface Podcast"; 
  }

  return "No-Show-Found-Error"; // Fallback for unexpected cases
}

function calculateCategory(info, item) {

  if (!info?.channel) {
    return "Unknown Show";
  }

  if (info.channel === "Regulation Gameplay") {
      return "Gameplay";
  }

  if (info.channel === "Regulation Podcast") {
      if (/\[\d+\]/.test(item.title)) {
        return "Episode";
      }
      if (item.title.includes("Sausage Talk")) {
        return "Sausage Talk";
      }
      if (item.title.includes("Draft")) {
        return "Draft";
      }
      if (item.title.includes("Watch Along")) {
        return "Watch Along";
      }
      if (item.title.includes("Does It Do? ")) {
        return "Does It Do?";
      }
      if (item.title.includes("Blindside")) {
        return "Blindside";
      }
      if (item.title.includes("Break Show")) {
        return "Break Show";
      }
      if (item.title.includes("Auction")) {
        return "Auction";
      }
      return "Supplemental"
  }

  return "Category-Not-Found-Error"; // Fallback for unexpected cases
}

function parseEpisodeNumber(videoTitle) {
  if (!videoTitle) return null;
  const match = videoTitle.match(/\[(\d+)\]/);
  return (match && match[1]) ? parseInt(match[1], 10) : null;
}

function generateFilename({ show, episode_number, category, title }) {
  let identifier = (episode_number !== null && !isNaN(episode_number))
    ? String(episode_number).padStart(3, '0')
    : category;
  const rawFilename = `${show} (${identifier}) ${title}`;
  return sanitizeFilename(rawFilename);
}

// --- Setup ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const git = simpleGit(path.resolve(__dirname, '..'));
const projectRoot = path.resolve(__dirname, '..');
const baseTranscriptionDir = path.join(projectRoot, 'transcriptions');
const metadataFilePath = path.join(baseTranscriptionDir, 'metadata.json');

const YtDlpWrap = YtDlpWrapModule.default || YtDlpWrapModule;
const ytDlp = new YtDlpWrap(config.ytDlpPath);

const forceRetranscribe = process.argv.includes('--force');

const sanitizeFilename = (name) => {
  const withSeparators = name.replace(/\s*[\\/|]+\s*/g, ' - ');
  const sanitized = withSeparators.replace(/[^a-zA-Z0-9\s\-_\[\]\(\)]/g, '');
  return sanitized.replace(/\s+/g, ' ').trim();
};

// --- MAIN SCRIPT ---
async function main() {
  // Read initial metadata once to determine what needs to be processed.
  let initialMetadata = {};
  try {
    initialMetadata = JSON.parse(await fs.readFile(metadataFilePath, 'utf-8'));
    console.log('Loaded existing metadata.json to determine queue.');
  } catch (error) {
    console.log('No existing metadata.json found. Starting fresh.');
  }

  const allMediaItems = [];

  // --- Step 1: Gather all items ---
  console.log('\nGathering items from YouTube...');
  for (const [groupName, channelUrl] of Object.entries(config.youtubeChannels)) {
    const videos = await fetchYouTubeVideoList(channelUrl);
    console.log(`  Found ${videos.length} videos from "${groupName}".`);
    videos.forEach(video => allMediaItems.push({ ...video, source: 'YouTube' }));
  }

  console.log('\nGathering items from RSS Feeds...');
  for (const [groupName, feedUrl] of Object.entries(config.rssFeeds)) {
    const items = await fetchRssFeedItems(feedUrl);
    console.log(`  Found ${items.length} items from "${groupName}".`);
    items.forEach(item => allMediaItems.push({ ...item, source: 'RSS' }));
  }

  // --- Step 2: Filter for items to process ---
  const titlesFromMetadata = new Set(Object.values(initialMetadata).flat().map(entry => entry.title));
  const uniqueTitles = new Set();
  const itemsToProcess = allMediaItems.filter(item => {
    if (uniqueTitles.has(item.title)) return false;
    uniqueTitles.add(item.title);
    return forceRetranscribe || !titlesFromMetadata.has(item.title);
  });

  if (itemsToProcess.length === 0) {
    console.log('\nNo new content to transcribe or commit.');
    return;
  }
  
  console.log(`\nFound ${itemsToProcess.length} new item(s) to process. Starting sequential processing...`);
  
  // --- Step 3: Process items sequentially and save metadata after each ---
  const allTranscribedFiles = [];
  
  for (const item of itemsToProcess) {
    const result = await processMediaItem(item);
    
    if (result) {
      const { newMetadataEntry, transcribedPaths } = result;

      // Atomically update metadata after each successful job
      let currentMetadata = {};
      try {
        currentMetadata = JSON.parse(await fs.readFile(metadataFilePath, 'utf-8'));
      } catch (e) { /* File doesn't exist, it will be created */ }

      const { show } = newMetadataEntry;
      if (!Array.isArray(currentMetadata[show])) currentMetadata[show] = [];
      
      const existingIndex = currentMetadata[show].findIndex(v => v.id === newMetadataEntry.id);
      if (existingIndex > -1) {
        currentMetadata[show][existingIndex] = newMetadataEntry;
      } else {
        currentMetadata[show].push(newMetadataEntry);
      }

      await fs.writeFile(metadataFilePath, JSON.stringify(currentMetadata, null, 2));
      console.log(`[${item.title.substring(0, 20)}...] Metadata.json updated and saved.`);

      allTranscribedFiles.push(...transcribedPaths);
    }
  }

  // --- Step 4: Finalize and commit ---
  if (allTranscribedFiles.length > 0) {
    console.log(`\nSuccessfully processed ${allTranscribedFiles.length} item(s).`);
    allTranscribedFiles.push(metadataFilePath);

    console.log('Committing all new and updated files to Git...');
    const filesToCommit = [...new Set(allTranscribedFiles)];
    await git.add(filesToCommit);
    await git.commit(`transcribe: Add/update ${allTranscribedFiles.length - 1} item(s)`);
    console.log(`Committed ${filesToCommit.length} file(s).`);
  } else {
    console.log("\nNo new items were successfully transcribed in this run.");
  }
}

// --- FETCHING FUNCTIONS ---
async function fetchYouTubeVideoList(channelUrl) {
    try {
        const args = ['--get-id', '--get-title', '--flat-playlist'];
        if (config.youtubeCookiePath) args.push('--cookies', config.youtubeCookiePath);
        if (config.minVideoDurationSeconds > 0) args.push('--match-filter', `duration > ${config.minVideoDurationSeconds}`);
        args.push(channelUrl);

        const { stdout } = await execa(config.ytDlpPath, args);
        const lines = stdout.trim().split('\n');
        const videos = [];
        for (let i = 0; i < lines.length; i += 2) {
            if (lines[i] && lines[i + 1]) {
                videos.push({ title: lines[i], id: lines[i + 1], sourceUrl: `https://www.youtube.com/watch?v=${lines[i+1]}` });
            }
        }
        return videos;
    } catch (error) {
        console.error(`Failed to fetch video list for ${channelUrl}:`, error.stderr || error.message);
        return [];
    }
}

async function fetchRssFeedItems(feedUrl) {
    try {
        const { stdout } = await execa(config.ytDlpPath, ['--dump-single-json', '--flat-playlist', feedUrl]);
        const data = JSON.parse(stdout);
        return (data.entries || []).map(item => ({
            id: item.id, title: item.title, sourceUrl: item.url, mediaUrl: item.url,
        }));
    } catch (error) {
        console.error(`Failed to fetch items for RSS feed ${feedUrl}:`, error.stderr || error.message);
        return [];
    }
}

// --- CORE PROCESSING FUNCTION ---
async function processMediaItem(item) {
  const logPrefix = `[${item.title.substring(0, 40)}...]`;
  console.log(`\n--- ${logPrefix} Starting process ---`);
  
  let itemInfo;
  try {
    const args = config.youtubeCookiePath ? ['--cookies', config.youtubeCookiePath] : [];
    itemInfo = await ytDlp.getVideoInfo(item.sourceUrl, args);
  } catch (error) {
    console.error(`${logPrefix} Failed to fetch metadata:`, error.message);
    return null;
  }

  let finalTitle = itemInfo.title;
  if (!finalTitle || finalTitle.toLowerCase().startsWith(`${item.source.toLowerCase()} video`)) {
    console.warn(`${logPrefix} Detected generic title. Falling back to '${item.title}'.`);
    finalTitle = item.title;
  }

  const show = calculateShow(itemInfo, item);
  const episode_number = parseEpisodeNumber(finalTitle);
  const category = calculateCategory(itemInfo, { ...item, title: finalTitle });
  const baseFilename = generateFilename({ show, episode_number, category, title: finalTitle });
  
  const showDir = path.join(baseTranscriptionDir, show);
  await fs.mkdir(showDir, { recursive: true });
  const transcriptPath = path.join(showDir, `${baseFilename}.txt`);

  const newMetadataEntry = {
    id: itemInfo.id, source: item.source, title: finalTitle, description: itemInfo.description,
    duration: itemInfo.duration, duration_string: itemInfo.duration_string,
    upload_date: itemInfo.upload_date, url: itemInfo.webpage_url || itemInfo.original_url,
    thumbnail: itemInfo.thumbnail, transcript_path: path.relative(projectRoot, transcriptPath).replace(/\\/g, '/'),
    images: [], show, episode_number, category,
  };
  
  const audioPath = path.join(showDir, `${baseFilename}.mp3`);

  try {
    await downloadMedia(item.sourceUrl, audioPath, logPrefix);
    
    console.log(`${logPrefix} Transcribing...`);
    await execa(config.fasterWhisperPath, [
        '--model', 'large-v2', '--output_format', 'txt',
        '--output_dir', showDir, '--language', 'en', audioPath
    ]);

    console.log(`${logPrefix} Applying corrections...`);
    let transcriptContent = await fs.readFile(transcriptPath, 'utf-8');
    for (const [wrong, correct] of Object.entries(config.commonTranscriptionErrors)) {
        transcriptContent = transcriptContent.replace(new RegExp(wrong, 'g'), correct);
    }
    await fs.writeFile(transcriptPath, transcriptContent);

    console.log(`${logPrefix} Successfully processed.`);
    return { newMetadataEntry, transcribedPaths: [transcriptPath] };

  } catch (error) {
    console.error(`${logPrefix} An error occurred during processing:`, error.stderr || error.message || error);
    return null;
  } finally {
    await fs.rm(audioPath, { force: true }).catch(() => {});
  }
}

async function downloadMedia(url, outputPath, logPrefix = '') {
    console.log(`${logPrefix} Downloading audio...`);

    const args = ['--ffmpeg-location', config.ffmpegPath];
    if (config.youtubeCookiePath) args.push('--cookies', config.youtubeCookiePath);

    args.push('-x', '--audio-format', 'mp3');
    args.push('-o', outputPath, url);

    await new Promise((resolve, reject) => {
        const dlp = ytDlp.exec(args);
        dlp.on('progress', (progress) => {
            process.stdout.write(`\r${logPrefix} Download progress: ${progress.percent}% of ${progress.totalSize} at ${progress.speed} ETA ${progress.eta} `);
        });
        dlp.on('close', () => {
            process.stdout.write('\n');
            console.log(`${logPrefix} Download complete.`);
            resolve();
        });
        dlp.on('error', (err) => {
            process.stdout.write('\n');
            console.error(`${logPrefix} Error during download.`, err);
            reject(err);
        });
    });
}

// --- Main execution ---
main().catch(console.error);