#!/usr/bin/env node
/**
 * scripts/generate-icons.js
 *
 * Generates all application icons, favicons, ICO, ICNS, and PNG resources from
 * the 3 size-optimized SVGs in logo/:
 *   - eenky_vector_icon_64-.svg  (for sizes <= 64px: 16, 24, 32, 48, 64)
 *   - eenky_vector_icon_256.svg  (for sizes <= 256px: 128, 256)
 *   - eenky_vector_icon_512+.svg (for sizes >= 512px: 512, 1024)
 *
 * Uses Electron / Chromium headless rendering to rasterize SVGs at 100% vector accuracy.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// If invoked under regular Node, spawn via Electron runner
if (!process.versions.electron) {
    const electron = require('../app/node_modules/electron');
    const child = spawn(electron, [__filename], { stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code || 0));
    return;
}

const { app, BrowserWindow } = require('electron');

const ROOT = path.resolve(__dirname, '..');
const IMAGES = path.join(ROOT, 'logo');
const RESOURCES = path.join(ROOT, 'resources');
const RENDERER_PUBLIC = path.join(ROOT, 'app', 'renderer', 'public');
const EENK_DOCS_ASSETS = path.join(ROOT, 'eenk', 'docs', 'assets');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createIco(images) {
    const numImages = images.length;
    const headerSize = 6 + 16 * numImages;
    let totalSize = headerSize;
    for (const img of images) {
        totalSize += img.buffer.length;
    }

    const out = Buffer.alloc(totalSize);
    out.writeUInt16LE(0, 0); // reserved
    out.writeUInt16LE(1, 2); // type 1 = ICO
    out.writeUInt16LE(numImages, 4); // count

    let currentOffset = headerSize;
    for (let i = 0; i < numImages; i++) {
        const img = images[i];
        const entryOffset = 6 + i * 16;
        out.writeUInt8(img.width >= 256 ? 0 : img.width, entryOffset + 0);
        out.writeUInt8(img.height >= 256 ? 0 : img.height, entryOffset + 1);
        out.writeUInt8(0, entryOffset + 2); // color palette count
        out.writeUInt8(0, entryOffset + 3); // reserved
        out.writeUInt16LE(1, entryOffset + 4); // color planes
        out.writeUInt16LE(32, entryOffset + 6); // bits per pixel
        out.writeUInt32LE(img.buffer.length, entryOffset + 8); // size
        out.writeUInt32LE(currentOffset, entryOffset + 12); // offset

        img.buffer.copy(out, currentOffset);
        currentOffset += img.buffer.length;
    }
    return out;
}

function createIcns(entries) {
    let totalSize = 8;
    for (const entry of entries) {
        totalSize += 8 + entry.buffer.length;
    }

    const out = Buffer.alloc(totalSize);
    out.write('icns', 0, 4, 'ascii');
    out.writeUInt32BE(totalSize, 4);

    let offset = 8;
    for (const entry of entries) {
        out.write(entry.type, offset, 4, 'ascii');
        out.writeUInt32BE(8 + entry.buffer.length, offset + 4);
        entry.buffer.copy(out, offset + 8);
        offset += 8 + entry.buffer.length;
    }
    return out;
}

app.whenReady().then(async () => {
    try {
        console.log('Rendering SVG assets to icons...');

        const svg64Path = path.join(IMAGES, 'eenky_vector_icon_64-.svg');
        const svg256Path = path.join(IMAGES, 'eenky_vector_icon_256.svg');
        const svg512Path = path.join(IMAGES, 'eenky_vector_icon_512+.svg');

        if (!fs.existsSync(svg64Path) || !fs.existsSync(svg256Path) || !fs.existsSync(svg512Path)) {
            throw new Error('Source SVG files not found in ' + IMAGES);
        }

        const svg64DataUri = `data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(svg64Path, 'utf8')).toString('base64')}`;
        const svg256DataUri = `data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(svg256Path, 'utf8')).toString('base64')}`;
        const svg512DataUri = `data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(svg512Path, 'utf8')).toString('base64')}`;

        const win = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
        });

        await win.loadURL('about:blank');

        async function renderSvg(dataUri, size) {
            const pngBase64 = await win.webContents.executeJavaScript(`
                new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = ${size};
                        canvas.height = ${size};
                        const ctx = canvas.getContext('2d');
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.clearRect(0, 0, ${size}, ${size});
                        ctx.drawImage(img, 0, 0, ${size}, ${size});
                        resolve(canvas.toDataURL('image/png').split(',')[1]);
                    };
                    img.onerror = (e) => reject(new Error('Failed to load image for size ${size}'));
                    img.src = "${dataUri}";
                })
            `);
            return Buffer.from(pngBase64, 'base64');
        }

        // Render each required resolution using its specific SVG source
        console.log('  - Rendering 16x16, 24x24, 32x32, 48x48, 64x64 from 64- SVG...');
        const png16 = await renderSvg(svg64DataUri, 16);
        const png24 = await renderSvg(svg64DataUri, 24);
        const png32 = await renderSvg(svg64DataUri, 32);
        const png48 = await renderSvg(svg64DataUri, 48);
        const png64 = await renderSvg(svg64DataUri, 64);

        console.log('  - Rendering 128x128, 256x256 from 256 SVG...');
        const png128 = await renderSvg(svg256DataUri, 128);
        const png256 = await renderSvg(svg256DataUri, 256);

        console.log('  - Rendering 512x512, 1024x1024 from 512+ SVG...');
        const png512 = await renderSvg(svg512DataUri, 512);
        const png1024 = await renderSvg(svg512DataUri, 1024);

        // Build multi-resolution ICO (16, 24, 32, 48, 64, 128, 256)
        console.log('  - Generating multi-resolution ICO...');
        const icoBuffer = createIco([
            { width: 16, height: 16, buffer: png16 },
            { width: 24, height: 24, buffer: png24 },
            { width: 32, height: 32, buffer: png32 },
            { width: 48, height: 48, buffer: png48 },
            { width: 64, height: 64, buffer: png64 },
            { width: 128, height: 128, buffer: png128 },
            { width: 256, height: 256, buffer: png256 },
        ]);

        // Build macOS ICNS bundle
        console.log('  - Generating macOS ICNS bundle...');
        const icnsBuffer = createIcns([
            { type: 'icp4', buffer: png16 },       // 16x16
            { type: 'icp5', buffer: png32 },       // 32x32
            { type: 'icp6', buffer: png64 },       // 64x64
            { type: 'ic07', buffer: png128 },      // 128x128
            { type: 'ic08', buffer: png256 },      // 256x256
            { type: 'ic09', buffer: png512 },      // 512x512
            { type: 'ic10', buffer: png1024 },     // 1024x1024
            { type: 'ic11', buffer: png32 },       // 16x16@2x (32x32)
            { type: 'ic12', buffer: png64 },       // 32x32@2x (64x64)
            { type: 'ic13', buffer: png256 },      // 128x128@2x (256x256)
            { type: 'ic14', buffer: png512 },      // 256x256@2x (512x512)
        ]);

        // 1. Write resources/
        console.log('  - Updating resources/...');
        ensureDir(RESOURCES);
        fs.writeFileSync(path.join(RESOURCES, 'Icon1024.png'), png1024);
        fs.writeFileSync(path.join(RESOURCES, 'Icon512.png'), png512);
        fs.writeFileSync(path.join(RESOURCES, 'icon.png'), png512);
        fs.writeFileSync(path.join(RESOURCES, 'icon-small.png'), png64);
        fs.writeFileSync(path.join(RESOURCES, 'icon.ico'), icoBuffer);
        fs.writeFileSync(path.join(RESOURCES, 'Icon1024.png.ico'), icoBuffer);
        fs.writeFileSync(path.join(RESOURCES, 'Icon.icns'), icnsBuffer);

        // 2. Write app/renderer/public/about/
        console.log('  - Updating app/renderer/public/about/...');
        const aboutDir = path.join(RENDERER_PUBLIC, 'about');
        ensureDir(aboutDir);
        fs.writeFileSync(path.join(aboutDir, 'icon256.png'), png256);

        // 3. Write eenk/docs/assets/ (canonical web documentation assets)
        if (fs.existsSync(EENK_DOCS_ASSETS)) {
            console.log('  - Updating eenk/docs/assets/...');
            fs.writeFileSync(path.join(EENK_DOCS_ASSETS, 'apple-touch-icon.png'), png128);
            fs.writeFileSync(path.join(EENK_DOCS_ASSETS, 'favicon-16x16.png'), png16);
            fs.writeFileSync(path.join(EENK_DOCS_ASSETS, 'favicon-32x32.png'), png32);
            fs.writeFileSync(path.join(EENK_DOCS_ASSETS, 'favicon.png'), png64);
            fs.writeFileSync(path.join(EENK_DOCS_ASSETS, 'favicon.ico'), icoBuffer);
        }

        // 4. Write app/renderer/public/assets/
        console.log('  - Updating app/renderer/public/assets/...');
        const assetsDir = path.join(RENDERER_PUBLIC, 'assets');
        ensureDir(assetsDir);
        fs.writeFileSync(path.join(assetsDir, 'apple-touch-icon.png'), png128);
        fs.writeFileSync(path.join(assetsDir, 'favicon-16x16.png'), png16);
        fs.writeFileSync(path.join(assetsDir, 'favicon-32x32.png'), png32);
        fs.writeFileSync(path.join(assetsDir, 'favicon.png'), png64);
        fs.writeFileSync(path.join(assetsDir, 'favicon.ico'), icoBuffer);

        console.log('✓ All icons and favicons successfully updated!');
    } catch (err) {
        console.error('Error generating icons:', err);
        process.exitCode = 1;
    } finally {
        app.quit();
    }
});
