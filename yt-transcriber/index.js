import YtDlpWrapModule from 'yt-dlp-wrap';
import { execa } from 'execa';
import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import pLimit from 'p-limit';
import os from 'os';
import AWS from 'aws-sdk'; 

const require = createRequire(import.meta.url);
const ffmpeg = require('fluent-ffmpeg');
const execPromise = promisify(exec);

const BUCKET_NAME = 'regulatabase-images';
const AWS_REGION = 'us-east-1';

AWS.config.update({
    region: AWS_REGION,
});

const s3 = new AWS.S3();

// --- Helper Functions (calculateShow, calculateCategory, etc. are unchanged) ---
function calculateShow(info, item) {
  if (!info?.channel) {
    return "F**kface Podcast";
  }
  if (info.channel === "Regulation Gameplay") return "Regulation Gameplay";
  if (info.channel === "Regulation Podcast") {
    const uploadDate = info.upload_date ? new Date(parseInt(info.upload_date.substring(0, 4)), parseInt(info.upload_date.substring(4, 6)), parseInt(info.upload_date.substring(6, 8))) : null;
    return (uploadDate >= new Date(2024, 5, 23)) ? "Regulation Podcast" : "F**kface Podcast";
  }
  return "No-Show-Found-Error";
}

function calculateCategory(info, item) {
  if (info.channel === "Regulation Gameplay") return "Gameplay";
  if (/\[\d+\]/.test(item.title)) return "Episode";
  if (item.title.includes("Sausage Talk")) return "Sausage Talk";
  if (item.title.includes("Draft")) return "Draft";
  if (item.title.includes("Watch Along")) return "Watch Along";
  if (item.title.includes("Does It Do? ")) return "Does It Do?";
  if (item.title.includes("Blindside")) return "Blindside";
  if (item.title.includes("Break Show") || (item.title.toLowerCase().includes("break") && item.title.toLowerCase().includes("shit")) ) return "Break Show";
  if (item.title.includes("Auction")) return "Auction";
  return "Supplemental";
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
const tempProcessingPath = path.resolve(__dirname, 'temp_processing'); // --- MODIFIED --- More general temp dir

const COMPARER_SCRIPT_PATH = path.join(__dirname, 'compare_images.cjs');
ffmpeg.setFfmpegPath(path.join(config.ffmpegPath, 'ffmpeg.exe'));
ffmpeg.setFfprobePath(path.join(config.ffmpegPath, 'ffprobe.exe'));

const YtDlpWrap = YtDlpWrapModule.default || YtDlpWrapModule;
const ytDlp = new YtDlpWrap(config.ytDlpPath);
const forceRetranscribe = process.argv.includes('--force');

const sanitizeFilename = (name) => {
  const withSeparators = name.replace(/\s*[\\/|*]+\s*/g, ' - ');
  const sanitized = withSeparators.replace(/[^a-zA-Z0-9\s\-_\[\]\(\)]/g, '');
  return sanitized.replace(/\s+/g, ' ').trim();
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function uploadImageToS3(filePath, s3Key) {
    try {
        const fileContent = await fs.readFile(filePath);

        const params = {
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: fileContent,
        };

        await s3.upload(params).promise();

        // Manually construct the public URL, as we are using a bucket policy
        const publicUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
        
        console.log(`Successfully uploaded ${path.basename(filePath)} to ${publicUrl}`);
        return publicUrl;
    } catch (err) {
        console.error(`Error uploading ${path.basename(filePath)}:`, err);
        return null;
    }
}

async function main() {
  await fs.mkdir(tempProcessingPath, { recursive: true }); // --- MODIFIED ---
  let initialMetadata = {};
  try {
    initialMetadata = JSON.parse(await fs.readFile(metadataFilePath, 'utf-8'));
    console.log('Loaded existing metadata.json to determine queue.');
  } catch (error) {
    console.log('No existing metadata.json found. Starting fresh.');
  }

  const workQueue = [];
  const recoveredTitles = new Set();

  const tempFiles = await fs.readdir(tempProcessingPath); // --- MODIFIED ---
  const manifestFiles = tempFiles.filter(f => f.endsWith('.json'));
  if (manifestFiles.length > 0) {
    console.log(`Found ${manifestFiles.length} unprocessed item(s) from previous run. Recovering...`);
    for (const manifestFile of manifestFiles) {
      try {
        const workItem = JSON.parse(await fs.readFile(path.join(tempProcessingPath, manifestFile), 'utf-8')); // --- MODIFIED ---
        workQueue.push(workItem);
        recoveredTitles.add(workItem.finalTitle);
      } catch (e) {
        console.warn(`Could not recover from manifest ${manifestFile}. Deleting corrupt files.`);
        await fs.rm(path.join(tempProcessingPath, manifestFile)).catch(() => { }); // --- MODIFIED ---
        await fs.rm(path.join(tempProcessingPath, manifestFile.replace('.json', ''))).catch(() => { }); // --- MODIFIED ---
      }
    }
  }

  const itemsToProcess = await gatherAndFilterItems(initialMetadata, recoveredTitles);
  if (itemsToProcess.length === 0 && workQueue.length === 0) {
    console.log('No new content to process.');
    await fs.rm(tempProcessingPath, { recursive: true, force: true }); // --- MODIFIED ---
    return;
  }
  console.log(`Found ${itemsToProcess.length} new item(s) to download. Starting producer/consumer pipeline...`);

  const allTranscribedFiles = [];
  let downloadIsComplete = false;

  const producer = producerLoop(itemsToProcess, workQueue).then(() => {
    downloadIsComplete = true;
    console.log('--- All downloads complete. Producer finished. ---');
  });

  const consumer = consumerLoop(workQueue, () => downloadIsComplete, allTranscribedFiles);
  await Promise.all([producer, consumer]);

  if (allTranscribedFiles.length > 0) {
    console.log(`Successfully processed ${allTranscribedFiles.length} item(s).`);
    allTranscribedFiles.push(metadataFilePath);
    console.log('Committing all new and updated files to Git...');
    const filesToCommit = [...new Set(allTranscribedFiles)];
    await git.add(filesToCommit);
    await git.commit(`transcribe: Add/update ${allTranscribedFiles.length - 1} item(s)`);
    console.log(`Committed ${filesToCommit.length} file(s).`);
  } else {
    console.log("No new items were successfully transcribed in this run.");
  }

  await fs.rm(tempProcessingPath, { recursive: true, force: true }); // --- MODIFIED ---
  console.log('Cleaned up temporary directory.');
}


// --- PIPELINE STAGE 1: PRODUCER (Downloader) ---
async function producerLoop(items, queue) {
  for (const item of items) {
    const logPrefix = `[P-${item.title.substring(0, 20)}...]`;
    console.log(`${logPrefix} Preparing download...`);

    try {
      const execArgs = [
        item.sourceUrl,
        '--dump-json',
        '--cookies-from-browser', 'firefox'
      ];

      const { stdout } = await execa(config.ytDlpPath, execArgs);
      const itemInfo = JSON.parse(stdout);

      let finalTitle = itemInfo.title;
      if (!finalTitle || finalTitle.toLowerCase().startsWith(`${item.source.toLowerCase()} video`) || finalTitle.toLowerCase().startsWith(`rooster`)) {
        finalTitle = item.title;
      }

      if (itemInfo.duration <= config.minVideoDurationSeconds) {
        console.log(`${logPrefix} Skipping: Video duration ${itemInfo.duration}s is below minimum of ${config.minVideoDurationSeconds}s.`);
        continue;
      }

      const show = calculateShow(itemInfo, item);
      const episode_number = parseEpisodeNumber(finalTitle);
      const category = calculateCategory(itemInfo, { ...item, title: finalTitle });
      const baseFilename = generateFilename({ show, episode_number, category, title: finalTitle });

      // Determine if we need to download video for image extraction
      const isYouTubeForImageExtraction = item.source === 'YouTube' && config.imageExtraction.enabled;

      const mediaType = isYouTubeForImageExtraction ? 'video' : 'audio';
      const fileExtension = isYouTubeForImageExtraction ? 'mp4' : 'mp3';
      const tempMediaPath = path.join(tempProcessingPath, `${baseFilename}.${fileExtension}`);

      if (isYouTubeForImageExtraction) {
        await downloadYouTubeVideo(item.sourceUrl, tempMediaPath, logPrefix);
      } else {
        await downloadAudio(item.sourceUrl, tempMediaPath, logPrefix);
      }

      const workItem = {
        itemInfo, finalTitle, show, episode_number, category, baseFilename, tempMediaPath, source: item.source, mediaType
      };

      await fs.writeFile(`${tempMediaPath}.json`, JSON.stringify(workItem, null, 2));
      queue.push(workItem);

    } catch (error) {
      console.error(`${logPrefix} Failed to produce work item:`, error.message);
      if (error.stderr) console.error(`Stderr: ${error.stderr}`);
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
      console.log('--- Queue is empty and producer is finished. Consumer finished. ---');
      break;
    } else {
      await sleep(2000);
    }
  }
}


// --- CORE PROCESSING LOGIC ---
async function processDownloadedFile(workItem, logPrefix) {
  const { itemInfo, finalTitle, show, episode_number, category, baseFilename, tempMediaPath, source, mediaType } = workItem;

  const sanitizedShowName = sanitizeFilename(show);
  const showDir = path.join(baseTranscriptionDir, sanitizedShowName);
  await fs.mkdir(showDir, { recursive: true });

  const transcriptPath = path.join(showDir, `${baseFilename}.txt`);

  try {
    const newMetadataEntry = {
      id: itemInfo.id, source, title: finalTitle, description: itemInfo.description,
      duration: itemInfo.duration, duration_string: itemInfo.duration_string,
      upload_date: itemInfo.upload_date, url: itemInfo.webpage_url || itemInfo.original_url,
      thumbnail: itemInfo.thumbnail, transcript_path: path.relative(projectRoot, transcriptPath).replace(/\\/g, '/'),
      images: [], show, episode_number, category,
    };

    if (!finalTitle.toLowerCase().includes('compilation')) { // don't transcribe compilations
      console.log(`${logPrefix} Preparing to transcribe...`);
      if (mediaType === 'video' && category !== 'Gameplay') {
        console.log(`${logPrefix} Starting parallel transcription and image extraction...`);

        const transcriptionTask = transcribeMedia(tempMediaPath, showDir, transcriptPath, logPrefix);
        const imageExtractionTask = extractStaticImages(tempMediaPath, episodeImagesDir, logPrefix, sanitizedShowName, itemInfo.id);

        const [_, imageUrls] = await Promise.all([transcriptionTask, imageExtractionTask]);
        newMetadataEntry.images = imageUrls;
        console.log(`${logPrefix} Found ${imagePaths.length} static images.`);

      } else { // mediaType is 'audio'
        console.log(`${logPrefix} Starting transcription...`);
        await transcribeMedia(tempMediaPath, showDir, transcriptPath, logPrefix);
      }

      console.log(`${logPrefix} Applying corrections to transcript...`);
      let transcriptContent = await fs.readFile(transcriptPath, 'utf-8');
      for (const [wrong, correct] of Object.entries(config.commonTranscriptionErrors)) {
        transcriptContent = transcriptContent.replace(new RegExp(wrong, 'g'), correct);
      }
      await fs.writeFile(transcriptPath, transcriptContent);
    }

    console.log(`${logPrefix} Successfully processed.`);
    return { newMetadataEntry, transcribedPaths: [transcriptPath] };

  } catch (error) {
    console.error(`${logPrefix} An error occurred during processing:`, error.stderr || error.message || error);
    return null;
  } finally {
    // Cleanup the temp media file and its manifest
    await fs.rm(tempMediaPath, { force: true }).catch(() => { });
    await fs.rm(`${tempMediaPath}.json`, { force: true }).catch(() => { });
  }
}

async function transcribeMedia(mediaPath, outputDir, transcriptPath, logPrefix) {
  console.log(`${logPrefix} Transcribing...`);
  try {
    await execa(config.fasterWhisperPath, [
      '--model', 'large-v2', '--output_format', 'txt',
      '--output_dir', outputDir, '--language', 'en', mediaPath
    ]);
  } catch (error) {
    // Handle a specific crash code from faster-whisper where it might still succeed
    if (error.exitCode === 3221226505) {
      console.warn(`${logPrefix} faster-whisper crashed but may have succeeded. Checking for output file...`);
      await fs.access(transcriptPath); // This will throw if the file doesn't exist
      console.log(`${logPrefix} Transcript file exists, continuing.`);
    } else {
      throw error; // Re-throw other errors
    }
  }
}

async function extractStaticImages(videoPath, logPrefix, showName, episodeId) {
  console.log(`${logPrefix} Extracting frames...`);
  const tempFramesDir = path.join(tempProcessingPath, 'frames', path.basename(videoPath));
  await cleanupDir(tempFramesDir);
  await fs.mkdir(tempFramesDir, { recursive: true });

  const frameRate = 1;
  const videoMetadata = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });

  const videoStream = videoMetadata.streams.find(s => s.codec_type === 'video');
  const { width: videoWidth, height: videoHeight } = videoStream;

  const cropConfig = config.imageExtraction.cropDetection;
  const cropArea = cropConfig.enabled ? {
    width: Math.floor(videoWidth * cropConfig.width),
    height: Math.floor(videoHeight * cropConfig.height),
    left: Math.floor(videoWidth * cropConfig.left),
    top: Math.floor(videoHeight * cropConfig.top)
  } : { width: videoWidth, height: videoHeight, left: 0, top: 0 };

  if (config.imageExtraction.debug) {
    console.log(`${logPrefix} Video dimensions: ${videoWidth}x${videoHeight}`);
    if (cropConfig.enabled) console.log(`${logPrefix} Crop area for analysis:`, cropArea);
  }

  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(`-vf fps=${frameRate}`)
      .save(path.join(tempFramesDir, 'frame-%05d.png'))
      .on('end', resolve)
      .on('error', reject);
  });

  const frameFiles = (await fs.readdir(tempFramesDir)).sort();
  if (frameFiles.length < 4) {
    console.warn(`${logPrefix} Not enough frames extracted for image analysis. Found only ${frameFiles.length}.`);
    await cleanupDir(tempFramesDir);
    return [];
  }

  console.info(`${logPrefix} Extracted ${frameFiles.length} frames. Starting image analysis...`);
  const concurrency = config.imageExtraction.maxConcurrency ? config.imageExtraction.maxConcurrency : os.cpus().length;
  const limit = pLimit(concurrency);
  console.log(`${logPrefix} Starting analysis with a concurrency of ${concurrency}...`);

  const tasks = [];
  for (let i = 5; i < frameFiles.length - 2; i++) {
    const currentIndex = i;
    tasks.push(limit(async () => {
      // --- Enhanced Debugging ---
      const prevFrameId = frameFiles[currentIndex - 1]
      const frameId = frameFiles[currentIndex];
      const nextFrameId = frameFiles[currentIndex + 1];
      const nextNextFrameId = frameFiles[currentIndex + 2];
      try {
        const triggerSimilarity = await getSimilarity(
          path.join(tempFramesDir, prevFrameId),
          path.join(tempFramesDir, frameId),
          cropArea
        );

        // Log the first check's result
        //console.log(`[${frameId}] Trigger similarity: ${triggerSimilarity.toFixed(4)} (Threshold: < ${config.imageExtraction.similarityThreshold})`);

        if (triggerSimilarity < config.imageExtraction.similarityThreshold) {
          console.log(`[${frameId}] [i=${currentIndex}] PASSED trigger check. Now checking stability... for ${nextFrameId} and ${nextNextFrameId}`);

          const [stabilityCheck1, stabilityCheck2] = await Promise.all([
            getSimilarity(path.join(tempFramesDir, frameId), path.join(tempFramesDir, nextFrameId), cropArea),
            getSimilarity(path.join(tempFramesDir, nextFrameId), path.join(tempFramesDir, nextNextFrameId), cropArea)
          ]);

          // Log the stability checks' results
          console.log(`[${frameId}] Stability checks: ${nextFrameId}=${stabilityCheck1.toFixed(4)}, ${nextNextFrameId}=${stabilityCheck2.toFixed(4)} (Threshold: > ${config.imageExtraction.similarityThresholdUpperCheck})`);

          if (stabilityCheck1 > config.imageExtraction.similarityThresholdUpperCheck && stabilityCheck2 > config.imageExtraction.similarityThresholdUpperCheck) {
            console.log(`[${frameId}] !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
            console.log(`[${frameId}] PASSED stability checks. This is a candidate.`);
            console.log(`[${frameId}] !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
            const candidatePath = path.join(tempFramesDir, frameId);
            return { path: candidatePath, index: currentIndex };
          } else {
            console.log(`[${frameId}] FAILED stability checks.`);
          }
        }
      } catch (error) {
        // This is critical. If errors are happening, this will tell you.
        console.error(`[${frameId}] CRITICAL ERROR during processing:`, error);
      }
      return null; // Return null if any check fails or an error occurs
    }));
  }

  const results = await Promise.all(tasks);

  const candidateFramePaths = [];
  const usedIndexes = new Set();
  const sortedCandidates = results.filter(Boolean).sort((a, b) => a.index - b.index);

  // This part of the logic is likely correct, but it depends on sortedCandidates having items.
  if (sortedCandidates.length === 0) {
    console.warn(`${logPrefix} No candidate frames were found after parallel processing. Check the logs above for failures or errors.`);
  } else {
    for (const candidate of sortedCandidates) {
      if (!usedIndexes.has(candidate.index)) {
        candidateFramePaths.push(candidate.path);
        usedIndexes.add(candidate.index + 1);
        usedIndexes.add(candidate.index + 2);
      }
    }
  }

  console.log(`${logPrefix} Analysis complete. Found ${candidateFramePaths.length} total candidate images.`);
  console.log(`${logPrefix} Found ${candidateFramePaths.length} candidate images. De-duplicating...`);
  const uniqueFramePaths = [];
  if (candidateFramePaths.length > 0) {
    uniqueFramePaths.push(candidateFramePaths[0]);
    for (let i = 1; i < candidateFramePaths.length; i++) {
      let isDuplicate = false;
      for (const uniquePath of uniqueFramePaths) {
        if (await getSimilarity(candidateFramePaths[i], uniquePath, cropArea) > config.imageExtraction.similarityThreshold) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) uniqueFramePaths.push(candidateFramePaths[i]);
    }
  }
  
  console.log(`${logPrefix} Found ${uniqueFramePaths.length} unique images. Uploading to S3...`);
  const finalImageUrls = [];
  for (let i = 0; i < uniqueFramePaths.length; i++) {
    const sourcePath = uniqueFramePaths[i];
    const imageName = `${String(i + 1).padStart(3, '0')}.png`;
    const s3Key = path.join(showName, episodeId, imageName).replace(/\\/g, '/'); // S3 uses forward slashes

    const publicUrl = await uploadImageToS3(sourcePath, s3Key);
    if (publicUrl) {
      finalImageUrls.push(publicUrl);
    }
  }

  await cleanupDir(tempFramesDir);
  return finalImageUrls;
}


// --- HELPER & UTILITY FUNCTIONS ---
async function gatherAndFilterItems(initialMetadata, recoveredTitles) {
  const allMediaItems = [];

  console.log('Gathering items from YouTube...');
  for (const channelUrl of Object.values(config.youtubeChannels)) {
    const videos = await fetchYouTubeVideoList(channelUrl);
    videos.forEach(video => allMediaItems.push({ ...video, source: 'YouTube' }));
  }

  console.log('Gathering items from RSS Feeds...');
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
    if (forceRetranscribe || (!alreadyProcessed && !alreadyDownloaded)) {
      return true;
    }
    else {
      return false;
    }
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
    const args = [
      '--get-id',
      '--get-title',
      '--flat-playlist',
      '--restrict-filenames',
      '--encoding', 'utf-8'
    ];

    if (config.youtubeCookiePath) {
      args.push('--cookies', config.youtubeCookiePath);
    }

    // Build match-filter
    let filters = [];
    if (config.minVideoDurationSeconds > 0) {
      filters.push(`duration > ${config.minVideoDurationSeconds}`);
    }
    // Exclude YouTube Shorts (<= 60s)
    filters.push('duration > 60');

    args.push('--match-filter', filters.join(' & '));

    args.push(channelUrl);

    const { stdout } = await execa(config.ytDlpPath, args, {
      encoding: 'utf8',
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8'
      }
    });
    const lines = stdout.trim().split('\n');
    const videos = [];
    for (let i = 0; i < lines.length; i += 2) {
      if (lines[i] && lines[i + 1]) {
        videos.push({ title: lines[i], id: lines[i + 1], sourceUrl: `https://www.youtube.com/watch?v=${lines[i + 1]}` });
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
      id: item.title, title: item.title, sourceUrl: item.url, mediaUrl: item.url,
    }));
  } catch (error) {
    console.error(`Failed to fetch items for RSS feed ${feedUrl}:`, error.stderr || error.message);
    return [];
  }
}

async function downloadAudio(url, outputPath, logPrefix = '') {
  console.log(`${logPrefix} Downloading audio...`);
  const args = [
    url,
    '--ffmpeg-location', config.ffmpegPath,
    '--cookies-from-browser', 'firefox',
    '-x', '--audio-format', 'mp3',
    '-o', outputPath,
  ];
  await execa(config.ytDlpPath, args);
  console.log(`${logPrefix} Audio download complete.`);
}

async function downloadYouTubeVideo(url, outputPath, logPrefix = '') {
  console.log(`${logPrefix} Downloading video for image extraction...`);
  const args = [
    url,
    '--ffmpeg-location', config.ffmpegPath,
    '--cookies-from-browser', 'firefox',
    '-f', 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '-o', outputPath,
  ];
  await execa(config.ytDlpPath, args);
  console.log(`${logPrefix} Video download complete.`);
}


async function cleanupDir(dirPath, maxRetries = 5, delay = 100) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error.code === 'EBUSY' || error.code === 'ENOTEMPTY') { // Handle both common errors on Windows
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      } else if (error.code === 'ENOENT') {
        return; // Directory doesn't exist, which is fine
      } else {
        throw error;
      }
    }
  }
}

async function getSimilarity(imgPath1, imgPath2, cropArea) {
  const cropAreaJson = JSON.stringify(cropArea);
  const cropAreaBase64 = Buffer.from(cropAreaJson).toString('base64');
  const command = `node "${COMPARER_SCRIPT_PATH}" "${imgPath1}" "${imgPath2}" ${cropAreaBase64}`;

  try {
    const { stdout } = await execPromise(command);
    return parseFloat(stdout);
  } catch (error) {
    console.error("Error executing image comparison script:", error);
    return 0; // Return 0 on error to prevent false positives
  }
}


// --- Main execution ---
main().catch(console.error);