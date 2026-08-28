/**
 * eenkPackage.js — Utility to pack eenk story files (.bin, .media, .epdfont)
 * into a single .eenk ZIP archive.
 *
 * Uses Node's built-in zlib with zero external native dependencies.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    CRC_TABLE[i] = c >>> 0;
}

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Convert Date to MS-DOS date and time format
function toDosTime(date) {
    const d = date || new Date();
    const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    const dateNum = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    return { time, date: dateNum };
}

/**
 * Creates a .eenk (ZIP) package from an array of files.
 * @param {string} outPath - Full destination path for the .eenk file.
 * @param {Array<{name: string, path?: string, content?: Buffer}>} files - Files to include.
 */
function createEenkPackage(outPath, files) {
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;
    const { time: dosTime, date: dosDate } = toDosTime(new Date());

    for (const file of files) {
        let content = file.content;
        if (!content && file.path && fs.existsSync(file.path)) {
            content = fs.readFileSync(file.path);
        }
        if (!content) continue;

        const nameBuf = Buffer.from(file.name.replace(/\\/g, '/'), 'utf8');
        const uncompressedSize = content.length;
        const crc = crc32(content);

        // Compress with raw DEFLATE
        let compressed = zlib.deflateRawSync(content, { level: 9 });
        let compMethod = 8; // DEFLATE
        let compressedSize = compressed.length;

        // If compression doesn't help, store uncompressed
        if (compressedSize >= uncompressedSize) {
            compressed = content;
            compMethod = 0; // STORE
            compressedSize = uncompressedSize;
        }

        // Local file header (30 bytes + nameBuf.length)
        const localHeader = Buffer.alloc(30 + nameBuf.length);
        localHeader.writeUInt32LE(0x04034B50, 0); // Local header signature
        localHeader.writeUInt16LE(20, 4);         // Version needed to extract (2.0)
        localHeader.writeUInt16LE(0x0800, 6);     // Flags: UTF-8 filename (bit 11)
        localHeader.writeUInt16LE(compMethod, 8); // Compression method
        localHeader.writeUInt16LE(dosTime, 10);   // File modification time
        localHeader.writeUInt16LE(dosDate, 12);   // File modification date
        localHeader.writeUInt32LE(crc, 14);       // CRC-32
        localHeader.writeUInt32LE(compressedSize, 18);   // Compressed size
        localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
        localHeader.writeUInt16LE(nameBuf.length, 26);   // Filename length
        localHeader.writeUInt16LE(0, 28);                // Extra field length
        nameBuf.copy(localHeader, 30);

        localHeaders.push(localHeader, compressed);

        // Central directory header (46 bytes + nameBuf.length)
        const centralHeader = Buffer.alloc(46 + nameBuf.length);
        centralHeader.writeUInt32LE(0x02014B50, 0); // Central directory signature
        centralHeader.writeUInt16LE(20, 4);         // Version made by
        centralHeader.writeUInt16LE(20, 6);         // Version needed to extract
        centralHeader.writeUInt16LE(0x0800, 8);     // Flags: UTF-8 filename (bit 11)
        centralHeader.writeUInt16LE(compMethod, 10);// Compression method
        centralHeader.writeUInt16LE(dosTime, 12);   // File modification time
        centralHeader.writeUInt16LE(dosDate, 14);   // File modification date
        centralHeader.writeUInt32LE(crc, 16);       // CRC-32
        centralHeader.writeUInt32LE(compressedSize, 20);   // Compressed size
        centralHeader.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
        centralHeader.writeUInt16LE(nameBuf.length, 28);   // Filename length
        centralHeader.writeUInt16LE(0, 30);                // Extra field length
        centralHeader.writeUInt16LE(0, 32);                // Comment length
        centralHeader.writeUInt16LE(0, 34);                // Disk number start
        centralHeader.writeUInt16LE(0, 36);                // Internal file attributes
        centralHeader.writeUInt32LE(0, 38);                // External file attributes
        centralHeader.writeUInt32LE(offset, 42);           // Relative offset of local header
        nameBuf.copy(centralHeader, 46);

        centralHeaders.push(centralHeader);

        offset += localHeader.length + compressed.length;
    }

    const centralDirOffset = offset;
    const centralDirBuffer = Buffer.concat(centralHeaders);
    const centralDirSize = centralDirBuffer.length;

    // End of central directory record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054B50, 0); // EOCD signature
    eocd.writeUInt16LE(0, 4);          // Disk number
    eocd.writeUInt16LE(0, 6);          // Disk where central directory starts
    eocd.writeUInt16LE(files.length, 8);  // Number of central directory records on this disk
    eocd.writeUInt16LE(files.length, 10); // Total number of central directory records
    eocd.writeUInt32LE(centralDirSize, 12);    // Size of central directory
    eocd.writeUInt32LE(centralDirOffset, 16);  // Offset of central directory
    eocd.writeUInt16LE(0, 20);         // Comment length

    const finalZipBuffer = Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
    fs.writeFileSync(outPath, finalZipBuffer);
    return outPath;
}

module.exports = { createEenkPackage, crc32 };
