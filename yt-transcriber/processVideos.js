

import { config } from './config.js';
import fs from 'fs/promises';
import path from 'path';
import YtDlpWrapModule from 'yt-dlp-wrap';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import pLimit from 'p-limit';

const execPromise = promisify(exec);


import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ffmpeg = require('fluent-ffmpeg');



// --- Setup ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const baseTranscriptionDir = path.join(projectRoot, 'transcriptions');
const METADATA_PATH = path.join(baseTranscriptionDir, 'metadata.json');
const IMAGES_BASE_DIR = path.join(baseTranscriptionDir, 'images');
const TEMP_DIR = path.join(projectRoot, 'yt-transcriber', 'temp_processing');
const COMPARER_SCRIPT_PATH = path.join(__dirname, 'compare_images.cjs');

// Configure yt-dlp and ffmpeg with paths from config.js
const YtDlpWrap = YtDlpWrapModule.default || YtDlpWrapModule;
const ytDlp = new YtDlpWrap(config.ytDlpPath);
ffmpeg.setFfmpegPath(path.join(config.ffmpegPath, 'ffmpeg.exe'));
ffmpeg.setFfprobePath(path.join(config.ffmpegPath, 'ffprobe.exe'));

const ensureDir = (dirPath) => fs.mkdir(dirPath, { recursive: true });

async function cleanupDir(dirPath, maxRetries = 5, delay = 100) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await fs.rm(dirPath, { recursive: true, force: true });
            return;
        } catch (error) {
            if (error.code === 'EBUSY') {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
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
        console.error("Error executing image comparison script. It may have crashed.", error);
        return 0;
    }
}


async function extractStaticImages(videoPath, episodeImagesDir) {
    if (!config.imageExtraction.enabled) {
        return [];
    }
    const tempFramesDir = path.join(TEMP_DIR, 'frames', path.basename(videoPath));
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
        console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
        if (cropConfig.enabled) console.log(`Crop area for analysis:`, cropArea);
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
        console.warn(`Not enough frames extracted for image analysis. Found only ${frameFiles.length}.`);
        await cleanupDir(tempFramesDir);
        return [];
    }

    console.info(`Extracted ${frameFiles.length} frames. Starting image analysis...`);
    const concurrency = config.imageExtraction.maxConcurrency ? config.imageExtraction.maxConcurrency : os.cpus().length;
    const limit = pLimit(concurrency);
    console.log(`Starting analysis with a concurrency of ${concurrency}...`);

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
                    //console.log(`[${frameId}] [i=${currentIndex}] PASSED trigger check. Now checking stability... for ${nextFrameId} and ${nextNextFrameId}`);

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
        console.warn(`No candidate frames were found after parallel processing. Check the logs above for failures or errors.`);
    } else {
        for (const candidate of sortedCandidates) {
            if (!usedIndexes.has(candidate.index)) {
                candidateFramePaths.push(candidate.path);
                usedIndexes.add(candidate.index + 1);
                usedIndexes.add(candidate.index + 2);
            }
        }
    }

    console.log(`Analysis complete. Found ${candidateFramePaths.length} total candidate images.`);
    console.log(`Found ${candidateFramePaths.length} candidate images. De-duplicating...`);
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

    const finalRelativePaths = [];
    for (let i = 0; i < uniqueFramePaths.length; i++) {
        const sourcePath = uniqueFramePaths[i];
        const destPath = path.join(episodeImagesDir, `${String(i + 1).padStart(3, '0')}.png`);
        await fs.copyFile(sourcePath, destPath);
        finalRelativePaths.push(path.relative(baseTranscriptionDir, destPath).replace(/\\/g, '/'));
    }

    await cleanupDir(tempFramesDir);
    return finalRelativePaths;
}


/**
 * Main function to orchestrate the video processing workflow.
 */
async function main() {
    console.log("Starting video processing script...");
    await ensureDir(TEMP_DIR);

    const metadataRaw = await fs.readFile(METADATA_PATH, 'utf-8');
    const metadata = JSON.parse(metadataRaw);

    for (const key of Object.keys(metadata)) {
        metadata[key].sort((a, b) => Number(b.upload_date) - Number(a.upload_date));
    }

    for (const show of Object.keys(metadata)) {
        console.log(`\n--- Processing show: ${show} ---`);
        for (const episode of metadata[show]) {
            if (episode.scannedForImages || (Array.isArray(episode.images) && episode.images.length > 0)) {
                console.log(`Skipping "${episode.title}" (already scanned for images).`);
                continue;
            }

            console.log(`\nProcessing episode: "${episode.title}"`);
            const videoId = episode.id;
            const tempVideoDir = path.join(TEMP_DIR, videoId);
            const episodeImagesDir = path.join(IMAGES_BASE_DIR, show, videoId);

            await cleanupDir(tempVideoDir);
            await ensureDir(tempVideoDir);
            await ensureDir(episodeImagesDir);

            try {
                console.log(`Downloading video: ${videoId}...`);

                const ytDlpProcess = ytDlp.exec([
                    episode.url,
                    '--cookies-from-browser', 'firefox',
                    '-o', path.join(tempVideoDir, '%(id)s.%(ext)s'),
                    '-f', 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                    //'-f', 'bestvideo[ext=mp4]+bestaudio[ext=a]/best[ext=mp4]/best',

                ]);

                if (config.imageExtraction.debug) {
                    ytDlpProcess.on('stdout', (data) => console.log(`[yt-dlp stdout]: ${data.toString().trim()}`));
                    ytDlpProcess.on('stderr', (data) => console.error(`[yt-dlp stderr]: ${data.toString().trim()}`));
                }

                await new Promise((resolve, reject) => {
                    ytDlpProcess.on('close', resolve);
                    ytDlpProcess.on('error', reject);
                });

                const filesInTempDir = await fs.readdir(tempVideoDir);
                const videoFileName = filesInTempDir.find(f =>
                    f.includes(videoId) && ['.mp4', '.mkv', '.webm', '.mov'].some(ext => f.endsWith(ext))
                );

                if (!videoFileName) {
                    throw new Error(`Could not find downloaded video file in '${tempVideoDir}'. The download may have failed.`);
                }
                const videoPath = path.join(tempVideoDir, videoFileName);
                console.log(`Found downloaded video: ${videoPath}`);

                const newImagePaths = await extractStaticImages(videoPath, episodeImagesDir);

                if (newImagePaths.length > 0) {
                    episode.images = newImagePaths;
                    console.log(`Successfully extracted ${newImagePaths.length} images for "${episode.title}".`);
                } else {
                    console.log(`No significant static images found for "${episode.title}".`);
                    episode.images = [];
                }

                episode.scannedForImages = true;

                console.log(`\nSaving progress to metadata.json for "${episode.title}"...`);
                await fs.writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2));
                console.log("Metadata updated successfully.");

            } catch (error) {
                console.error(`\n[ERROR] Failed to process episode "${episode.title}":`, error.message || error);
            } finally {
                await cleanupDir(tempVideoDir);
            }
        }
    }

    console.log("\nScript has processed all scannable episodes.");
    await cleanupDir(TEMP_DIR);
    console.log("Script finished.");
}

main().catch(console.error);