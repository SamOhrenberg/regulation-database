const sharp = require('sharp');
const { PNG } = require('pngjs');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;
const { config } = require('./config.js');

// --- Argument Parsing ---
const [, , imgPath1, imgPath2, cropAreaBase64] = process.argv;

const cropAreaJson = Buffer.from(cropAreaBase64, 'base64').toString('utf8');
const cropArea = JSON.parse(cropAreaJson);
const resizeWidth = config.imageExtraction.resizedWidth;

async function getSimilarity(imgPath1, imgPath2, cropArea) {
    try {
        // Define the image processing pipeline using sharp.
        const processImage = (path) => {
            let imageProcessor = sharp(path);

            const extractRegion = {
                left: Math.round(cropArea.left),
                top: Math.round(cropArea.top),
                width: Math.round(cropArea.width),
                height: Math.round(cropArea.height)
            };
            imageProcessor = imageProcessor.extract(extractRegion);

            if (resizeWidth) {
                const targetHeight = Math.round(resizeWidth * 9 / 16);
                imageProcessor = imageProcessor.resize({
                    width: resizeWidth,
                    height: targetHeight,
                    fit: 'fill'
                });
            }

            // *** THE FIX IS HERE ***
            // Ensure the output has an alpha channel, forcing it to be 4-channel RGBA.
            // This guarantees the buffer length will match what pixelmatch expects.
            return imageProcessor.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        };

        const [
            { data: data1, info: info1 },
            { data: data2, info: info2 }
        ] = await Promise.all([processImage(imgPath1), processImage(imgPath2)]);

        // This check should now be redundant, but it's good practice.
        if (data1.length !== data2.length) {
            throw new Error(`Buffer lengths still do not match after processing: ${data1.length} vs ${data2.length}`);
        }

        const { width, height } = info1;

        // Custom logic to treat white pixels as a match.
        for (let i = 0; i < data1.length; i += 4) {
            const isWhite1 = data1[i] === 255 && data1[i + 1] === 255 && data1[i + 2] === 255;
            const isWhite2 = data2[i] === 255 && data2[i + 1] === 255 && data2[i + 2] === 255;

            if (isWhite1 || isWhite2) {
                data1[i] = 255; data1[i + 1] = 255; data1[i + 2] = 255;
                data2[i] = 255; data2[i + 1] = 255; data2[i + 2] = 255;
            }
        }

        const diff = new PNG({ width, height });

        const numDiffPixels = pixelmatch(
            data1,
            data2,
            diff.data,
            width,
            height,
            { threshold: config.imageExtraction.pixelMatchThreshold }
        );

        const totalPixels = width * height;
        return 1 - (numDiffPixels / totalPixels);
    } catch (error) {
        console.error("Error in compare_images.js (sharp):", error);
        throw error;
    }
}

// --- Execution ---
getSimilarity(imgPath1, imgPath2, cropArea)
    .then(similarity => {
        process.stdout.write(similarity.toString());
    })
    .catch(err => {
        console.error("Fatal error in compare_images.js (sharp):", err);
        process.exit(1);
    });