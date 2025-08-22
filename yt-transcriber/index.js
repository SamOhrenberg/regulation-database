import YtDlpWrapModule from 'yt-dlp-wrap';
import { execa } from 'execa';
import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { config } from './config.js';

// --- Helper Functions (calculateShow, calculateCategory, etc. are unchanged) ---
function calculateShow(info, item) {
  if (!info?.channel) return "Unknown Show";
  if (info.channel === "Regulation Gameplay") return "Regulation Gameplay";
  if (info.channel === "Regulation Podcast") {
    const uploadDate = info.upload_date ? new Date(parseInt(info.upload_date.substring(0,4)), parseInt(info.upload_date.substring(4,6)), parseInt(info.upload_date.substring(6,8))) : null;
    return (uploadDate > new Date(2025,4,8)) ? "Regulation Podcast" : "F**kface Podcast"; 
  }
  return "No-Show-Found-Error";
}

function calculateCategory(info, item) {
  if (!info?.channel) return "Unknown Show";
  if (info.channel === "Regulation Gameplay") return "Gameplay";
  if (info.channel === "Regulation Podcast") {
      if (/\[\d+\]/.test(item.title)) return "Episode";
      if (item.title.includes("Sausage Talk")) return "Sausage Talk";
      if (item.title.includes("Draft")) return "Draft";
      if (item.title.includes("Watch Along")) return "Watch Along";
      if (item.title.includes("Does It Do? ")) return "Does It Do?";
      if (item.title.includes("Blindside")) return "Blindside";
      if (item.title.includes("Break Show")) return "Break Show";
      if (item.title.includes("Auction")) return "Auction";
      return "Supplemental";
  }
  return "Category-Not-Found-Error";
}

function parseEpisodeNumber(videoTitle) {
  if (!videoTitle) return null;
  const match = videoTitle.match(/\[(\d+)\]/);
  return (match && match[1]) ? parseInt(match[1], 10) : null;
}

function generateFilename({ show, episode_number, category, title }) {
  let identifier = (episode_number !== null && !isNaN(episode_number)) ? String(episode_number).padStart(3, '0') : category;
  const rawFilename = `${show} (${identifier}) ${title}`;
  return sanitizeFilename(rawFilename);
}

// --- Setup ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const git = simpleGit(path.resolve(__dirname, '..'));
const projectRoot = path.resolve(__dirname, '..');
const baseTranscriptionDir = path.join(projectRoot, 'transcriptions');
const metadataFilePath = path.join(baseTranscriptionDir, 'metadata.json');
const tempAudioDirPath = path.resolve(__dirname, config.tempAudioDir);

const YtDlpWrap = YtDlpWrapModule.default || YtDlpWrapModule;
const ytDlp = new YtDlpWrap(config.ytDlpPath);

const forceRetranscribe = process.argv.includes('--force');

const sanitizeFilename = (name) => {
  const withSeparators = name.replace(/\s*[\\/|*]+\s*/g, ' - '); // Added * to sanitization
  const sanitized = withSeparators.replace(/[^a-zA-Z0-9\s\-_\[\]\(\)]/g, '');
  return sanitized.replace(/\s+/g, ' ').trim();
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  await fs.mkdir(tempAudioDirPath, { recursive: true });
  let initialMetadata = {};
  try {
    initialMetadata = JSON.parse(await fs.readFile(metadataFilePath, 'utf-8'));
    console.log('Loaded existing metadata.json to determine queue.');
  } catch (error) {
    console.log('No existing metadata.json found. Starting fresh.');
  }

  const workQueue = [];
  const recoveredTitles = new Set();
  
  const tempFiles = await fs.readdir(tempAudioDirPath);
  const manifestFiles = tempFiles.filter(f => f.endsWith('.json'));
  if (manifestFiles.length > 0) {
    console.log(`\nFound ${manifestFiles.length} unprocessed item(s) from previous run. Recovering...`);
    for (const manifestFile of manifestFiles) {
      try {
        const workItem = JSON.parse(await fs.readFile(path.join(tempAudioDirPath, manifestFile), 'utf-8'));
        workQueue.push(workItem);
        recoveredTitles.add(workItem.finalTitle);
      } catch (e) {
        console.warn(`Could not recover from manifest ${manifestFile}. Deleting corrupt files.`);
        await fs.rm(path.join(tempAudioDirPath, manifestFile)).catch(() => {});
        await fs.rm(path.join(tempAudioDirPath, manifestFile.replace('.json', ''))).catch(() => {});
      }
    }
  }

  const itemsToProcess = await gatherAndFilterItems(initialMetadata, recoveredTitles);
  if (itemsToProcess.length === 0 && workQueue.length === 0) {
    console.log('\nNo new content to process.');
    await fs.rm(tempAudioDirPath, { recursive: true, force: true });
    return;
  }
  console.log(`\nFound ${itemsToProcess.length} new item(s) to download. Starting producer/consumer pipeline...`);

  const allTranscribedFiles = [];
  let downloadIsComplete = false;

  const producer = producerLoop(itemsToProcess, workQueue).then(() => {
    downloadIsComplete = true;
    console.log('\n--- All downloads complete. Producer finished. ---');
  });

  const consumer = consumerLoop(workQueue, () => downloadIsComplete, allTranscribedFiles);

  await Promise.all([producer, consumer]);

  if (allTranscribedFiles.length > 0) {
    console.log(`\nSuccessfully processed ${allTranscribedFiles.length} item(s).`);
    allTranscribedFiles.push(metadataFilePath);
    console.log('Committing all new and updated files to Git...');
    const filesToCommit = [...new Set(allTranscribedFiles)];
    await git.add(filesToCommit);
    await git.commit(`transcribe: Add/update ${allTranscribedFiles.length} item(s)`);
    console.log(`Committed ${filesToCommit.length} file(s).`);
  } else {
    console.log("\nNo new items were successfully transcribed in this run.");
  }

  await fs.rm(tempAudioDirPath, { recursive: true, force: true });
  console.log('Cleaned up temporary audio directory.');
}

// --- PIPELINE STAGE 1: PRODUCER (Downloader) ---
async function producerLoop(items, queue) {
  for (const item of items) {
    const logPrefix = `[P-${item.title.substring(0, 20)}...]`;
    console.log(`${logPrefix} Preparing download...`);

    try {
      // Build the arguments array for the exec command.
      const execArgs = [
        item.sourceUrl,
        '--dump-json',
        '-f', 'best',
        '--cookies-from-browser', 'firefox'
        // If you want to use the file instead, uncomment the following lines and comment out the line above
        // '--cookies',
        // config.youtubeCookiePath
      ];

      console.log(`${logPrefix} Executing yt-dlp with args: ${execArgs.join(' ')}`);

      // Use the general .exec() method which accepts all arguments
      const { stdout } = await execa(config.ytDlpPath, execArgs);
      
      // Manually parse the JSON output from stdout
      const itemInfo = JSON.parse(stdout);

      let finalTitle = itemInfo.title;
      if (!finalTitle || finalTitle.toLowerCase().startsWith(`${item.source.toLowerCase()} video`)) {
        finalTitle = item.title;
      }
      
      const show = calculateShow(itemInfo, item);
      const episode_number = parseEpisodeNumber(finalTitle);
      const category = calculateCategory(itemInfo, { ...item, title: finalTitle });
      const baseFilename = generateFilename({ show, episode_number, category, title: finalTitle });
      
      const tempAudioPath = path.join(tempAudioDirPath, `${baseFilename}.mp3`);
      
      await downloadMedia(item.sourceUrl, tempAudioPath, logPrefix);
      
      const workItem = {
        itemInfo, finalTitle, show, episode_number, category, baseFilename, tempAudioPath, source: item.source
      };

      await fs.writeFile(`${tempAudioPath}.json`, JSON.stringify(workItem, null, 2));

      queue.push(workItem);

    } catch (error) {
      console.error(`${logPrefix} Failed to produce work item:`, error.message);
    }
  }
}

// --- PIPELINE STAGE 2: CONSUMER (Processor) ---
async function consumerLoop(queue, isProducerDone, results) {
  while (true) {
    if (queue.length > 0) {
      const workItem = queue.shift();
      const logPrefix = `[C-${workItem.finalTitle.substring(0, 20)}...]`;
      console.log(`${logPrefix} Starting processing...`);
      
      const result = await processDownloadedFile(workItem, logPrefix);
      
      if (result) {
        results.push(...result.transcribedPaths);
        await saveMetadata(result.newMetadataEntry);
        console.log(`${logPrefix} Metadata saved.`);
      }

    } else if (isProducerDone()) {
      console.log('\n--- Queue is empty and producer is finished. Consumer finished. ---');
      break;
    } else {
      await sleep(2000);
    }
  }
}

// --- CORE PROCESSING LOGIC ---
async function processDownloadedFile(workItem, logPrefix) {
  const { itemInfo, finalTitle, show, episode_number, category, baseFilename, tempAudioPath, source } = workItem;
  
  const sanitizedShowName = sanitizeFilename(show);
  const showDir = path.join(baseTranscriptionDir, sanitizedShowName);
  await fs.mkdir(showDir, { recursive: true });

  const transcriptPath = path.join(showDir, `${baseFilename}.txt`);
  
  const newMetadataEntry = {
    id: itemInfo.id, source, title: finalTitle, description: itemInfo.description,
    duration: itemInfo.duration, duration_string: itemInfo.duration_string,
    upload_date: itemInfo.upload_date, url: itemInfo.webpage_url || itemInfo.original_url,
    thumbnail: itemInfo.thumbnail, transcript_path: path.relative(projectRoot, transcriptPath).replace(/\\/g, '/'),
    images: [], show, episode_number, category,
  };
  
  try {
    console.log(`${logPrefix} Transcribing...`);
    try {
      await execa(config.fasterWhisperPath, [
          '--model', 'large-v2', '--output_format', 'txt',
          '--output_dir', showDir, '--language', 'en', tempAudioPath
      ]);
    } catch (error) {
      if (error.exitCode === 3221226505) {
        console.warn(`${logPrefix} faster-whisper crashed but may have succeeded.`);
        await fs.access(transcriptPath);
        console.log(`${logPrefix} File exists, continuing.`);
      } else { throw error; }
    }

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
    await fs.rm(tempAudioPath, { force: true }).catch(() => {});
    await fs.rm(`${tempAudioPath}.json`, { force: true }).catch(() => {});
  }
}

// --- HELPER & UTILITY FUNCTIONS ---
async function gatherAndFilterItems(initialMetadata, recoveredTitles) {
  const allMediaItems = [];

  console.log('\nGathering items from YouTube...');
  for (const channelUrl of Object.values(config.youtubeChannels)) {
    const videos = await fetchYouTubeVideoList(channelUrl);
    videos.forEach(video => allMediaItems.push({ ...video, source: 'YouTube' }));
  }

  console.log('\nGathering items from RSS Feeds...');
  for (const feedUrl of Object.values(config.rssFeeds)) {
    const items = await fetchRssFeedItems(feedUrl);
    items.forEach(item => allMediaItems.push({ ...item, source: 'RSS' }));
  }
  
  const titlesFromMetadata = new Set(Object.values(initialMetadata).flat().map(entry => entry.title));
  const uniqueItems = new Map();
  for (const item of allMediaItems) {
      if (!uniqueItems.has(item.title)) {
          uniqueItems.set(item.title, item);
      } else if (item.source === 'YouTube') {
          uniqueItems.set(item.title, item);
      }
  }

  return Array.from(uniqueItems.values()).filter(item => {
      const alreadyProcessed = titlesFromMetadata.has(item.title);
      const alreadyDownloaded = recoveredTitles.has(item.title);
      return forceRetranscribe || (!alreadyProcessed && !alreadyDownloaded);
  });
}

async function saveMetadata(newMetadataEntry) {
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
}

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

async function downloadMedia(url, outputPath, logPrefix = '') {
    console.log(`${logPrefix} Downloading...`);

    const args = ['--ffmpeg-location', config.ffmpegPath];
    //if (config.youtubeCookiePath) args.push('--cookies', config.youtubeCookiePath);

    args.push('--cookies-from-browser', 'firefox');
    args.push('-x', '--audio-format', 'mp3');
    args.push('-o', outputPath, url);

    await new Promise((resolve, reject) => {
        const dlp = ytDlp.exec(args);
        dlp.on('progress', (progress) => {
            process.stdout.write(`\r${logPrefix} Progress: ${progress.percent}%`);
        });
        dlp.on('close', () => {
            process.stdout.write('\n');
            console.log(`${logPrefix} Download complete.`);
            resolve();
        });
        dlp.on('error', (err) => {
            process.stdout.write('\n');
            reject(err);
        });
    });
}

// --- Main execution ---
main().catch(console.error);