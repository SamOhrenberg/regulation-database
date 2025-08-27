const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// --- AWS S3 Configuration ---
const BUCKET_NAME = 'regulatabase-images';
const AWS_REGION = 'us-east-1'; // <--- IMPORTANT: Change this to your bucket's region

AWS.config.update({
    region: AWS_REGION,
});

const s3 = new AWS.S3();

// --- File Paths ---
const rootDir = process.cwd();
const metadataPath = path.join(rootDir, 'transcriptions', 'metadata.json');
const transcriptionsDir = path.join(rootDir, 'transcriptions');


async function uploadImage(filePath, s3Key) {
    try {
        const fileContent = fs.readFileSync(filePath);

        const params = {
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: fileContent,
            // ACL: 'public-read'  <-- REMOVED THIS LINE
        };

        // We still await the upload to confirm it was successful
        await s3.upload(params).promise();

        // Manually construct the public URL
        const publicUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
        
        console.log(`Successfully uploaded ${filePath} to ${publicUrl}`);
        return publicUrl; // Returns the newly constructed public URL
    } catch (err) {
        console.error(`Error uploading ${filePath}:`, err);
        return null;
    }
}

async function processMetadata() {
    let metadata;
    try {
        const rawData = fs.readFileSync(metadataPath, 'utf8');
        metadata = JSON.parse(rawData);
    } catch (err) {
        console.error(`Failed to read or parse metadata.json at '${metadataPath}':`, err);
        return;
    }

    for (const showName in metadata) {
        if (Object.hasOwnProperty.call(metadata, showName)) {
            const episodes = metadata[showName];
            console.log(`\nProcessing show: ${showName}`);

            for (const episode of episodes) {
                if (episode.images && episode.images.length > 0) {
                    console.log(`-- Found images for episode: ${episode.title}`);
                    const newImageUrls = [];

                    for (const imagePath of episode.images) {
                        const localImagePath = path.join(transcriptionsDir, imagePath).replace("transcriptions\\transcriptions", "transcriptions");

                        if (fs.existsSync(localImagePath)) {
                            const s3Key = path.join(showName, episode.id, path.basename(imagePath)).replace(/\\/g, "/");
                            const publicUrl = await uploadImage(localImagePath, s3Key);

                            if (publicUrl) {
                                newImageUrls.push(publicUrl);
                            } else {
                                newImageUrls.push(imagePath);
                            }
                        } else {
                            console.warn(`---- Image not found at local path: ${localImagePath}`);
                            newImageUrls.push(imagePath);
                        }
                    }
                    episode.images = newImageUrls;
                }
            }
        }
    }

    try {
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        console.log('\nSuccessfully updated metadata.json with new S3 URLs.');
    } catch (err) {
        console.error('Failed to write updated metadata.json:', err);
    }
}

// --- Run the script ---
processMetadata();