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
      if (item.title.includes("Supplemental")) {
        return "Supplemental";
      }
      return "Misc Supplemental"
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

const quote = (arg) => (arg.includes(' ') ? `"${arg}"` : arg);

// --- MAIN SCRIPT ---
async function main() {
  await fs.mkdir(baseTranscriptionDir, { recursive: true });

  let metadata = {};
  try {
    metadata = JSON.parse(await fs.readFile(metadataFilePath, 'utf-8'));
    console.log('Loaded existing metadata.json.');
  } catch (error) {
    console.log('No existing metadata.json found. Starting fresh.');
  }

  const allMediaItems = [];

  // --- Step 1: Gather all items from all sources ---
  console.log('\nGathering items from YouTube...');
  for (const [groupName, channelUrl] of Object.entries(config.youtubeChannels)) {
    const videos = await fetchYouTubeVideoList(channelUrl);
    console.log(`  Found ${videos.length} videos from "${groupName}".`);
    videos.forEach(video => allMediaItems.push({ ...video, groupName, source: 'YouTube' }));
  }

  console.log('\nGathering items from RSS Feeds...');
  for (const [groupName, feedUrl] of Object.entries(config.rssFeeds)) {
    const items = await fetchRssFeedItems(feedUrl);
    console.log(`  Found ${items.length} items from "${groupName}".`);
    items.forEach(item => allMediaItems.push({ ...item, groupName, source: 'RSS' }));
  }

  // --- Step 2: De-duplicate and process the master list ---
  const transcribedFiles = [];
  const titlesFromMetadata = new Set(Object.values(metadata).flat().map(entry => entry.title));
  const titlesThisRun = new Set();
  
  console.log(`\nProcessing a total of ${allMediaItems.length} found items...`);
  
  for (const item of allMediaItems) {
    if (titlesFromMetadata.has(item.title) && !forceRetranscribe) {
      continue; // Already processed in a previous run
    }
    if (titlesThisRun.has(item.title)) {
      console.log(`- Skipping duplicate title: "${item.title}"`);
      continue; // Already processed from a different source in this run
    }

    const resultPaths = await processMediaItem(item, metadata);
    if (resultPaths) {
      transcribedFiles.push(...resultPaths);
      titlesThisRun.add(item.title);
      console.log('\nSaving updated metadata.json...');
      await fs.writeFile(metadataFilePath, JSON.stringify(metadata, null, 2));
    }
  }

  // --- Step 3: Finalize and commit ---
  if (transcribedFiles.length > 0) {
    console.log('Committing all new and updated files to Git...');
    const filesToCommit = [...new Set(transcribedFiles)];
    await git.add(filesToCommit);
    await git.commit(`transcribe: Add/update ${filesToCommit.length} file(s)`);
    // await git.push();
  } else {
    console.log('\nNo new content to transcribe or commit.');
  }
}

// --- FETCHING FUNCTIONS ---
async function fetchYouTubeVideoList(channelUrl) {
    try {
        const args = ['--get-id', '--get-title', '--flat-playlist'];
        if (config.minVideoDurationSeconds > 0) {
            args.push('--match-filter', `duration > ${config.minVideoDurationSeconds}`);
        }
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
            id: item.id,
            title: item.title,
            sourceUrl: item.url, // For RSS, the direct media URL is the source
            mediaUrl: item.url,
        }));
    } catch (error) {
        console.error(`Failed to fetch items for RSS feed ${feedUrl}:`, error.stderr || error.message);
        return [];
    }
}

// --- CORE PROCESSING FUNCTION ---
async function processMediaItem(item, metadata) {
  const { groupName, source } = item;
  console.log(`\n--- Processing ${source} for "${groupName}": "${item.title}" ---`);
  
  let itemInfo;
  try {
    itemInfo = await ytDlp.getVideoInfo(item.sourceUrl);
  } catch (error) {
    console.error(`    Failed to fetch metadata:`, error);
    return null;
  }

  const show = calculateShow(itemInfo, item);
  const episode_number = parseEpisodeNumber(item.title);
  const category = calculateCategory(itemInfo, item);
  const baseFilename = generateFilename({ show, episode_number, category, title: itemInfo.title });
  
  const groupDir = path.join(baseTranscriptionDir, groupName);
  await fs.mkdir(groupDir, { recursive: true });
  const transcriptPath = path.join(groupDir, `${baseFilename}.txt`);

  if (!Array.isArray(metadata[groupName])) metadata[groupName] = [];
  
  const newMetadata = {
    id: itemInfo.id, source, title: itemInfo.title, description: itemInfo.description,
    duration: itemInfo.duration, duration_string: itemInfo.duration_string,
    upload_date: itemInfo.upload_date, url: itemInfo.webpage_url || itemInfo.original_url,
    thumbnail: itemInfo.thumbnail, transcript_path: null, images: [], show, episode_number, category,
  };
  
  const hasPublicMedia = item.mediaUrl || source === 'YouTube';
  const existingIndex = metadata[groupName].findIndex(v => v.id === newMetadata.id);

  if (existingIndex > -1) {
    metadata[groupName][existingIndex] = newMetadata;
  } else {
    metadata[groupName].push(newMetadata);
  }

  if (!hasPublicMedia) {
    console.log("  - No public media found. Adding metadata only.");
    return [metadataFilePath];
  }
  
  newMetadata.transcript_path = path.relative(projectRoot, transcriptPath).replace(/\\/g, '/');
  
  const videoPath = path.join(groupDir, `${baseFilename}.mp4`);
  const audioPath = path.join(groupDir, `${baseFilename}.mp3`);
  let transcribed = false;

  try {
    if (config.imageExtraction.enabled && source === 'YouTube') {
        console.log(`  - Downloading full video for image analysis...`);
        await downloadMedia(item.sourceUrl, videoPath);
        newMetadata.images = await extractSceneImages(videoPath, groupDir, baseFilename);
        console.log(`  - Extracting audio from video...`);
        await execa(path.join(config.ffmpegPath, 'ffmpeg'), ['-i', videoPath, '-vn', '-acodec', 'copy', audioPath]);
    } else {
        console.log(`  - Downloading audio only...`);
        await downloadMedia(item.sourceUrl, audioPath, true);
    }
    
    console.log(`  - Transcribing...`);
    const audioFilename = path.basename(audioPath);
    await execa(config.fasterWhisperPath, [
        '--model', 'large-v2', '--output_format', 'txt',
        '--output_dir', '.', '--language', 'en', audioFilename
    ], { cwd: groupDir });
    transcribed = true;

    console.log(`  - Applying corrections...`);
    let transcriptContent = await fs.readFile(transcriptPath, 'utf-8');
    for (const [wrong, correct] of Object.entries(config.commonTranscriptionErrors)) {
        transcriptContent = transcriptContent.replace(new RegExp(wrong, 'g'), correct);
    }
    await fs.writeFile(transcriptPath, transcriptContent);
    
    console.log(`  - Successfully processed "${item.title}".`);
    return [transcriptPath, ...newMetadata.images.map(p => path.join(projectRoot, p))];

  } catch (error) {
    console.error(`    An error occurred during processing:`, error.stderr || error.message || error);
    if (!transcribed) newMetadata.transcript_path = null;
    return null;
  } finally {
    await fs.rm(videoPath, { force: true, recursive: true }).catch(() => {});
    await fs.rm(audioPath, { force: true, recursive: true }).catch(() => {});
  }
}

async function downloadMedia(url, outputPath, audioOnly = false) {
    const args = ['--ffmpeg-location', config.ffmpegPath];
    if (audioOnly) {
        args.push('-x', '--audio-format', 'mp3');
    } else {
        args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
    }
    args.push('-o', outputPath, url);

    await new Promise((resolve, reject) => {
        const dlp = ytDlp.exec(args);
        dlp.on('close', resolve);
        dlp.on('error', reject);
    });
}

// --- IMAGE EXTRACTION FUNCTION ---
// This will eventually grab the different photos that are shared in the video
// to provide the user interface the ability to look at the shared photos.
async function extractSceneImages(videoPath, outputDir, baseFilename) {
    if (!config.imageExtraction.enabled) {
        return [];
    }
    console.log(`  - Analyzing video for visually distinct scenes...`);

    const imagePaths = [];
    const videoFilename = path.basename(videoPath);
    const referenceImageFilename = `_reference_temp.jpg`;
    const ssimLogFilename = `_ssim_temp.log`;
    
    const referenceImagePath = path.join(outputDir, referenceImageFilename);
    const ssimLogPath = path.join(outputDir, ssimLogFilename);

    try {
        console.log(`    - Extracting reference scenery frame...`);
        await execa(path.join(config.ffmpegPath, 'ffmpeg'), [
            '-y', '-ss', '00:00:05', '-i', videoFilename, '-vframes', '1', referenceImageFilename
        ], { cwd: outputDir });

        console.log(`    - Generating similarity log (this may take a while)...`);
        
        const cropFilter = `crop=${config.imageExtraction.cropDetection.width}*iw:ih:${config.imageExtraction.cropDetection.left}*iw:0`;
        const complexFilter = `[0:v]${cropFilter}[main];[1:v]${cropFilter}[ref];[main][ref]ssim=stats_file=${ssimLogFilename}`;

        // --- KEY CHANGE: Add stderr: 'inherit' to show live progress ---
        await execa(path.join(config.ffmpegPath, 'ffmpeg'), [
            '-y',
            '-i', videoFilename,
            '-stream_loop', '-1',
            '-i', referenceImageFilename,
            '-lavfi', complexFilter,
            '-f', 'null', '-'
        ], { 
            cwd: outputDir,
            stderr: 'inherit' // This will pipe FFmpeg's progress to your console
        });
        // --- END KEY CHANGE ---

        const logContent = await fs.readFile(ssimLogPath, 'utf-8');
        const frameData = logContent.split('\n')
            .map(line => {
                const match = line.match(/pts_time:(\d+\.?\d*).*ssim_y:([0-9.]+)/);
                if (!match) return null;
                return { time: parseFloat(match[1]), ssim: parseFloat(match[2]) };
            })
            .filter(Boolean);

        if (frameData.length > 0) {
            const allSsimScores = frameData.map(f => f.ssim);
            const minSsim = Math.min(...allSsimScores);
            const maxSsim = Math.max(...allSsimScores);
            console.log(`    - Analysis complete. Cropped SSIM scores range from ${minSsim.toFixed(4)} to ${maxSsim.toFixed(4)}.`);
            console.log(`    - Current similarityThreshold is ${config.imageExtraction.similarityThreshold}. Scenes are captured if their score is BELOW this value.`);
        }

        const overlayScenes = [];
        let currentScene = null;

        for (const frame of frameData) {
            const isDifferent = frame.ssim < config.imageExtraction.similarityThreshold;
            if (isDifferent && !currentScene) {
                currentScene = { start: frame.time };
            } else if (!isDifferent && currentScene) {
                currentScene.end = frame.time;
                currentScene.duration = currentScene.end - currentScene.start;
                if (currentScene.duration >= config.imageExtraction.minSceneDurationSeconds) {
                    overlayScenes.push(currentScene);
                }
                currentScene = null;
            }
        }
        
        if (currentScene && frameData.length > 0) {
             currentScene.end = frameData[frameData.length - 1].time;
             currentScene.duration = currentScene.end - currentScene.start;
             if (currentScene.duration >= config.imageExtraction.minSceneDurationSeconds) {
                 overlayScenes.push(currentScene);
             }
        }

        if (overlayScenes.length > 0) {
            console.log(`    Found ${overlayScenes.length} valid image overlay scenes. Extracting frames...`);
            for (const [index, scene] of overlayScenes.entries()) {
                const captureTimestamp = scene.start + (scene.duration / 2);
                const imageName = `${baseFilename}_scene_${index + 1}.jpg`;
                await execa(path.join(config.ffmpegPath, 'ffmpeg'), ['-y', '-ss', String(captureTimestamp), '-i', videoFilename, '-vframes', '1', '-q:v', '2', imageName], { cwd: outputDir });
                const fullImagePath = path.join(outputDir, imageName);
                imagePaths.push(path.relative(projectRoot, fullImagePath).replace(/\\/g, '/'));
            }
        } else {
            console.log(`    No distinct image overlay scenes found meeting the criteria.`);
        }
    } catch (error) {
        console.error('    Error during image extraction:', error.stderr || error.message);
    } finally {
        if (!config.imageExtraction.debug) {
            await fs.rm(referenceImagePath, { force: true }).catch(() => {});
            await fs.rm(ssimLogPath, { force: true }).catch(() => {});
        }
    }
    
    return imagePaths;
}

main()
  .then(() => console.log('\nAll sources processed successfully.'))
  .catch(console.error);