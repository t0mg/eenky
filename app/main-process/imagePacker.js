const fs = require('fs');
const path = require('path');
const { Jimp, intToRGBA } = require('jimp');

// FNV-1a hash function for 32-bit hashes
function fnv1a(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0; // force unsigned 32-bit
}

// Convert image to 1-bit raw bitmap format with Floyd-Steinberg dithering
async function processImage(imagePath) {
    const image = await Jimp.read(imagePath);
    
    // Scale image if wider than 440 (max device width minus margins) or taller than 760
    const MAX_W = 440;
    const MAX_H = 760;
    
    if (image.bitmap.width > MAX_W || image.bitmap.height > MAX_H) {
        image.scaleToFit({ w: MAX_W, h: MAX_H });
    }
    
    // Dithering (Floyd-Steinberg)
    image.greyscale();
    
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    
    // Width must be padded to a multiple of 8 for byte alignment
    const paddedW = Math.ceil(w / 8) * 8;
    const widthBytes = paddedW / 8;
    
    const outBuffer = Buffer.alloc(widthBytes * h, 0xFF); // Initialize with 1s (white)

    // Floyd-Steinberg error diffusion buffer
    const errors = new Float32Array(w * h);
    
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x);
            const color = intToRGBA(image.getPixelColor(x, y));
            
            // Simple grayscale calculation + accumulated error
            let oldPixel = color.r + errors[idx];
            
            // Threshold
            let newPixel = oldPixel < 128 ? 0 : 255;
            
            // Set bit in output buffer (1-bit BMP style: 0 = black, 1 = white)
            // MSB is leftmost pixel.
            if (newPixel === 0) {
                const outByteIdx = y * widthBytes + Math.floor(x / 8);
                const bitOffset = 7 - (x % 8);
                outBuffer[outByteIdx] &= ~(1 << bitOffset);
            }
            
            // Error diffusion
            const err = oldPixel - newPixel;
            
            if (x + 1 < w) errors[idx + 1] += err * 7 / 16;
            if (y + 1 < h) {
                if (x > 0) errors[idx + w - 1] += err * 3 / 16;
                errors[idx + w] += err * 5 / 16;
                if (x + 1 < w) errors[idx + w + 1] += err * 1 / 16;
            }
        }
    }
    
    return { buffer: outBuffer, width: paddedW, height: h };
}

/**
 * Packs images referenced in a compiled ink JSON file.
 * Returns true if media sidecar was generated, false otherwise.
 */
async function packImages(storyDir, jsonFile) {
    const jsonContent = fs.readFileSync(jsonFile, 'utf8');
    
    // Find all IMAGE tags. In ink JSON, tags are output inside the JSON string as "^IMAGE: path/to/image.png"
    // We match '^?IMAGE:' (case insensitive) followed by any non-whitespace/quote characters
    const imageRegex = /"\^?IMAGE:\s*([^"\\]+)"/gi;
    let match;
    const imagesToPack = new Set();
    
    while ((match = imageRegex.exec(jsonContent)) !== null) {
        imagesToPack.add(match[1].trim());
    }
    
    if (imagesToPack.size === 0) {
        return false;
    }
    
    console.log(`Found ${imagesToPack.size} images to pack.`);
    
    // Dictionary layout:
    // [Header]
    // 4 bytes: Magic "ENKM"
    // 4 bytes: Number of images (N)
    // [N * 20 bytes entries]
    // 4 bytes: Path Hash
    // 4 bytes: Offset
    // 4 bytes: Size
    // 4 bytes: Width
    // 4 bytes: Height
    // [Blobs]
    
    const entries = [];
    const blobs = [];
    let currentOffset = 8 + (imagesToPack.size * 20); // starting offset for first blob
    
    for (const imageRelPath of imagesToPack) {
        const isUrl = imageRelPath.startsWith('http://') || imageRelPath.startsWith('https://');
        const fullPath = isUrl ? imageRelPath : path.resolve(storyDir, imageRelPath);
        
        if (!isUrl && !fs.existsSync(fullPath)) {
            throw new Error(`Media sidecar compilation failed: Image not found '${fullPath}'`);
        }
        
        console.log(`Processing image: ${imageRelPath}`);
        const { buffer, width, height } = await processImage(fullPath);
        
        const pathHash = fnv1a(imageRelPath);
        
        entries.push({
            hash: pathHash,
            offset: currentOffset,
            size: buffer.length,
            width: width,
            height: height
        });
        
        blobs.push(buffer);
        currentOffset += buffer.length;
    }
    
    const headerSize = 8 + (entries.length * 20);
    const sidecarBuffer = Buffer.alloc(headerSize);
    
    sidecarBuffer.write("ENKM", 0, 4, 'ascii'); // Magic
    sidecarBuffer.writeUInt32LE(entries.length, 4);
    
    let dictOffset = 8;
    for (const entry of entries) {
        sidecarBuffer.writeUInt32LE(entry.hash, dictOffset);
        sidecarBuffer.writeUInt32LE(entry.offset, dictOffset + 4);
        sidecarBuffer.writeUInt32LE(entry.size, dictOffset + 8);
        sidecarBuffer.writeUInt32LE(entry.width, dictOffset + 12);
        sidecarBuffer.writeUInt32LE(entry.height, dictOffset + 16);
        dictOffset += 20;
    }
    
    const finalBuffer = Buffer.concat([sidecarBuffer, ...blobs]);
    
    const sidecarPath = path.join(storyDir, 'main.media');
    fs.writeFileSync(sidecarPath, finalBuffer);
    console.log(`Media sidecar created: ${sidecarPath} (${finalBuffer.length} bytes)`);
    
    return true;
}

module.exports = { packImages };
