const { Jimp } = require('jimp');
const { PNG } = require('pngjs');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;
const config = require('./config.js');

const [, , imgPath1, imgPath2, cropAreaBase64] = process.argv;

const cropAreaJson = Buffer.from(cropAreaBase64, 'base64').toString('utf8');
const cropArea = JSON.parse(cropAreaJson);

async function getSimilarity(imgPath1, imgPath2, cropArea) {
    try {
        const [img1, img2] = await Promise.all([Jimp.read(imgPath1), Jimp.read(imgPath2)]);
        const { width, height, left, top } = cropArea;

        img1.crop({ x: left, y: top, w: width, h: height });
        img2.crop({ x: left, y: top, w: width, h: height });
        

        // Create copies of the image data buffers to avoid modifying the originals.
        const data1 = Buffer.from(img1.bitmap.data);
        const data2 = Buffer.from(img2.bitmap.data);
        
        // Iterate through all pixels (4 bytes per pixel: R, G, B, A).
        for (let i = 0; i < data1.length; i += 4) {
            // Check if the pixel in the first image is pure white (R, G, and B are 255).
            const isWhite1 = data1[i] === 255 && data1[i + 1] === 255 && data1[i + 2] === 255;
            // Check if the pixel in the second image is pure white.
            const isWhite2 = data2[i] === 255 && data2[i + 1] === 255 && data2[i + 2] === 255;

            // If a pixel is white in *either* image, make it white in *both* buffers.
            // This ensures pixelmatch will see them as identical (0 difference).
            if (isWhite1 || isWhite2) {
                data1[i] = 255;
                data1[i + 1] = 255;
                data1[i + 2] = 255;
                
                data2[i] = 255;
                data2[i + 1] = 255;
                data2[i + 2] = 255;
            }
        }

        const diff = new PNG({ width, height });
        
        // Pass the modified data buffers to pixelmatch.
        const numDiffPixels = pixelmatch(
            data1, // Modified data
            data2, // Modified data
            diff.data,
            width,
            height,
            { threshold: config.imageExtraction.pixelMatchTreshold }
        );

        const totalPixels = width * height;
        return 1 - (numDiffPixels / totalPixels);
    } catch (error) {
        console.error("Error in compare_images.cjs:", error);
        return 0;
    }
}

getSimilarity(imgPath1, imgPath2, cropArea)
    .then(similarity => {
        process.stdout.write(similarity.toString());
    })
    .catch(err => {
        console.error("Fatal error in compare_images.cjs:", err);
        process.exit(1);
    });