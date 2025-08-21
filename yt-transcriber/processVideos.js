

import { config } from './config.js';
import fs from 'fs/promises';
import path from 'path';
import YtDlpWrapModule from 'yt-dlp-wrap';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

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
    console.log(`Extracting frames from ${path.basename(videoPath)}...`);
    const tempFramesDir = path.join(TEMP_DIR, 'frames');
    await cleanupDir(tempFramesDir);
    await ensureDir(tempFramesDir);

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
        top: Math.floor(videoHeight * cropConfig.height)
    } : { width: videoWidth, height: videoHeight, left: 0, top: 0 };

    if (config.imageExtraction.debug) {
        console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
        if (cropConfig.enabled) console.log('Crop area for analysis:', cropArea);
    }

    await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .outputOptions(`-vf fps=${frameRate}`)
            .save(path.join(tempFramesDir, 'frame-%05d.png'))
            .on('end', resolve)
            .on('error', reject);
    });

    const frameFiles = (await fs.readdir(tempFramesDir)).sort();
    if (frameFiles.length === 0) return [];

    // --- STAGE 1: Candidate Discovery ---
    const candidateFramePaths = [];
    const skip = 1;

    for (let i = skip; i < frameFiles.length; i+=skip) {
        const triggerSimilarity  = await getSimilarity(
            path.join(tempFramesDir, frameFiles[i - skip]),
            path.join(tempFramesDir, frameFiles[i]),
            cropArea
        );

        
        if (config.imageExtraction.debug) {
            console.log(`Frame ${i} vs ${i-1} (Trigger Check): Similarity = ${triggerSimilarity.toFixed(4)}`);
        }

        // If the similarity drops, a potential new scene has appeared at frame 'i'.
        if (triggerSimilarity < config.imageExtraction.similarityThreshold) {
            if (config.imageExtraction.debug) {
                console.log(`  - Potential change detected at Frame ${i}. Checking for stability...`);
            }
            
            // 2. STABILITY CHECK 1: Compare the new frame 'i' to the next frame 'i+1'.
            const stabilityCheck1 = await getSimilarity(
                path.join(tempFramesDir, frameFiles[i]),
                path.join(tempFramesDir, frameFiles[i + skip]),
                cropArea
            );

            if (stabilityCheck1 > config.imageExtraction.similarityThresholdUpperCheck) {
                // First check passed. The scene is stable for at least one frame.
                
                // 3. STABILITY CHECK 2: Compare frame 'i+1' to 'i+2'.
                const stabilityCheck2 = await getSimilarity(
                    path.join(tempFramesDir, frameFiles[i + skip]),
                    path.join(tempFramesDir, frameFiles[i + (skip * 2)]),
                    cropArea
                );

                if (stabilityCheck2 > config.imageExtraction.similarityThresholdUpperCheck) {
                    const frameToSave = frameFiles[i];
                    candidateFramePaths.push(path.join(tempFramesDir, frameToSave));
                    if (config.imageExtraction.debug) {
                        console.log(`    - STABILITY CONFIRMED. Frame ${i} is a candidate.`);
                    }
                    
                    i += (skip * 2);
                } else {
                    if (config.imageExtraction.debug) {
                        console.log(`    - Stability check 2 FAILED (Similarity: ${stabilityCheck2.toFixed(4)})`);
                    }
                }
            } else {
                if (config.imageExtraction.debug) {
                    console.log(`    - Stability check 1 FAILED (Similarity: ${stabilityCheck1.toFixed(4)})`);
                }
            }
        }
    }

    console.log(`Found ${candidateFramePaths.length} candidate images. Starting de-duplication...`);

    // --- STAGE 2: try to remove duplicates ---
    const uniqueFramePaths = [];
    if (candidateFramePaths.length > 0) {
        // The first candidate is always unique.
        uniqueFramePaths.push(candidateFramePaths[0]);

        for (let i = 1; i < candidateFramePaths.length; i++) {
            const currentCandidatePath = candidateFramePaths[i];
            let isDuplicate = false;
            for (const uniquePath of uniqueFramePaths) {
                const similarity = await getSimilarity(currentCandidatePath, uniquePath, cropArea);
                // A high similarity means it's a duplicate of an existing unique image.
                if (similarity > config.imageExtraction.similarityThreshold) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                uniqueFramePaths.push(currentCandidatePath);
            }
        }
    }

    if (config.imageExtraction.debug) {
        console.log(`Found ${uniqueFramePaths.length} unique images after de-duplication.`);
    }

    // --- STAGE 3: Final Save ---
    const finalRelativePaths = [];
    console.log('Copying unique images to final directory...');
    for (let i = 0; i < uniqueFramePaths.length; i++) {
        const sourcePath = uniqueFramePaths[i];
        const imageIndex = (i + 1).toString().padStart(3, '0');
        const destPath = path.join(episodeImagesDir, `${imageIndex}.png`);
        const relativePath = path.relative(baseTranscriptionDir, destPath).replace(/\\/g, '/');

        await fs.copyFile(sourcePath, destPath);
        finalRelativePaths.push(relativePath);
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

    for (const show of Object.keys(metadata)) {
        console.log(`\n--- Processing show: ${show} ---`);
        for (const episode of metadata[show]) {
            if (episode.scannedForImages) {
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
                    '--no-cookies-from-browser',
                    '--cookies', config.youtubeCookiePath,
                    '-o', path.join(tempVideoDir, '%(id)s.%(ext)s'),
                    '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
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