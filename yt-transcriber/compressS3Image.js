import fs from 'fs/promises';
import AWS from 'aws-sdk';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

//  CONFIGURATION 
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const baseTranscriptionDir = path.join(projectRoot, 'transcriptions');
const METADATA_PATH = path.join(baseTranscriptionDir, 'metadata.json');
const BUCKET_NAME = 'regulatabase-images';
const AWS_REGION = 'us-east-1';
AWS.config.update({
    region: AWS_REGION,
});

const s3 = new AWS.S3();

function getKeyFromUrl(url) {
    try {
        const urlObject = new URL(url);
        return decodeURIComponent(urlObject.pathname.substring(1));
    } catch (error) {
        console.error(`  - Invalid URL format: ${url}`);
        return null;
    }
}

async function downloadImage(key) {
    const params = {
        Bucket: BUCKET_NAME,
        Key: key,
    };
    const { Body } = await s3.getObject(params).promise();
    return Body;
}

async function compressImage(inputBuffer) {
    // Sharp can convert to various formats. JPEG is excellent for photographic content.
    // - quality: 85 is a great balance between size and visual fidelity.
    // - progressive: Makes the JPEG load progressively in browsers, improving user experience.
    // return sharp(inputBuffer)
    //     .jpeg({
    //         quality: 85,
    //         progressive: true,
    //         optimizeScans: true,
    //     })
    //     .toBuffer();

    return sharp(inputBuffer).png({ quality: 90, compressionLevel: 9 }).toBuffer();
}

async function uploadCompressedImage(key, buffer) {
    const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
    };
    await s3.putObject(params).promise();
}


async function processAllImages() {
    console.log('--- Starting Image Compression Script ---');

    // 1. Load and parse the metadata JSON file
    let metadata;
    try {
        const fileContent = await fs.readFile(METADATA_PATH, 'utf8');
        metadata = JSON.parse(fileContent);
        console.log(`✅ Successfully loaded metadata for ${Object.keys(metadata).length} shows.`);
    } catch (error) {
        console.error(`❌ Fatal Error: Could not read or parse ${METADATA_PATH}.`, error);
        return; // Exit if the file can't be read
    }

    // 2. Loop through each show
    for (const showName in metadata) {
        console.log(`\n▶️ Processing show: "${showName}"`);
        const episodes = metadata[showName];

        if (!episodes || episodes.length === 0) {
            console.log('  - No episodes found for this show. Skipping.');
            continue;
        }

        // 3. Loop through each episode in the show
        for (const episode of episodes) {
            console.log(`  ▶️ Processing episode: "${episode.title}" (ID: ${episode.id})`);

            // 4. Check if the 'images' array exists and is not empty
            if (!episode.images || episode.images.length === 0) {
                console.log('    - No images found for this episode. Skipping.');
                continue;
            }

            // 5. Loop through each image URL
            for (const imageUrl of episode.images) {
                const s3Key = getKeyFromUrl(imageUrl);
                if (!s3Key) continue; // Skip if URL was invalid

                console.log(`    - Processing image: ${s3Key}`);

                try {
                    // Download the original image from S3
                    const originalBuffer = await downloadImage(s3Key);
                    const originalSize = (originalBuffer.length / 1024).toFixed(2);

                    // Compress the image
                    const compressedBuffer = await compressImage(originalBuffer);
                    const compressedSize = (compressedBuffer.length / 1024).toFixed(2);
                    const reduction = (((originalSize - compressedSize) / originalSize) * 100).toFixed(1);

                    console.log(`      Size: ${originalSize} KB -> ${compressedSize} KB (Reduction: ${reduction}%)`);

                    // Only upload if the compressed version is smaller
                    if (compressedBuffer.length < originalBuffer.length) {
                        await uploadCompressedImage(s3Key, compressedBuffer);
                        console.log('      ✅ Successfully compressed and uploaded back to S3.');
                    } else {
                        console.log('      ⚠️ Compressed image is not smaller. Skipping upload.');
                    }
                } catch (error) {
                    console.error(`      ❌ Error processing image ${s3Key}:`, error.message);
                    // Continue to the next image even if one fails
                }
            }
        }
    }

    console.log('\n--- Script Finished ---');
}

// Run the main function
processAllImages();