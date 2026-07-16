/**
 * eenkCompiler.js
 * Registers IPC handler 'eenk:compile' which runs the two-step compilation:
 *   1. inklecate  .ink  →  .json
 *   2. inkcpp_cl  .json →  .bin
 *
 * Ported from tools/eenk-compiler/compiler.js and adapted to use
 * inky's existing inklecate binary location.
 */

const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── Binary resolution ────────────────────────────────────────────────────────

function getInkDir() {
    const { app } = require('electron');
    return app.isPackaged 
        ? path.join(process.resourcesPath, 'ink')
        : path.join(__dirname, 'ink');
}

function getInkcppBinary() {
    const inkDir = getInkDir();
    if (process.platform === 'win32')  return path.join(inkDir, 'win', 'inkcpp_cl.exe');
    if (process.platform === 'darwin') return path.join(inkDir, 'mac', 'inkcpp_cl');
    return path.join(inkDir, 'linux', 'inkcpp_cl');
}

// Use inky's existing inklecate path resolution
function getInklecateBinary() {
    const inkDir = getInkDir();
    if (process.platform === 'win32')  return path.join(inkDir, 'inklecate_win.exe');
    if (process.platform === 'darwin') return path.join(inkDir, 'inklecate_mac');
    return path.join(inkDir, 'inklecate_linux');
}

// ── Process runner ───────────────────────────────────────────────────────────

function runProcess(exePath, args, cwd, onProgress) {
    return new Promise((resolve, reject) => {
        const proc = spawn(exePath, args, { cwd });

        proc.stdout.on('data', d => {
            const msg = d.toString().trim();
            if (msg) onProgress(`[out] ${msg}`);
        });
        proc.stderr.on('data', d => {
            const msg = d.toString().trim();
            if (msg) onProgress(`[err] ${msg}`);
        });
        proc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`${path.basename(exePath)} exited with code ${code}`));
        });
        proc.on('error', reject);
    });
}

// ── Main export ──────────────────────────────────────────────────────────────

async function compileEenk(inkFilePath, onProgress) {
    const inkFile  = path.resolve(inkFilePath);
    const inkDir   = path.dirname(inkFile);
    const baseName = path.basename(inkFile, '.ink');
    const jsonFile = path.join(inkDir, `${baseName}.json`);
    const binFile  = path.join(inkDir, `${baseName}.bin`);

    if (!fs.existsSync(inkFile)) {
        throw new Error(`File not found: ${inkFile}`);
    }

    const inklecate = getInklecateBinary();
    const inkcpp    = getInkcppBinary();

    onProgress(`── Starting eenk compilation for ${baseName}.ink ──`);

    // Step 1: inklecate → JSON
    onProgress(`Step 1/2  inklecate: ${path.basename(inkFile)} → ${path.basename(jsonFile)}`);
    await runProcess(inklecate, ['-o', jsonFile, inkFile], inkDir, onProgress);
    onProgress(`✔ JSON written: ${jsonFile}`);

    // Step 2: inkcpp_cl → BIN
    onProgress(`Step 2/2  inkcpp_cl: ${path.basename(jsonFile)} → ${path.basename(binFile)}`);
    await runProcess(inkcpp, [jsonFile], inkDir, onProgress);
    onProgress(`✔ BIN written: ${binFile}`);

    // ── Generate eenk Metadata Header ──
    const inkContent = fs.readFileSync(inkFile, 'utf8');
    const headerText = inkContent.slice(0, 4000);
    let title = '';
    let author = '';
    let font = '';

    // Extract metadata from tags (typically inside /* */ block comments)
    const titleMatch = headerText.match(/@title(?::|\s)\s*([^\n\r*]+)/i);
    if (titleMatch) title = titleMatch[1].trim();

    const authorMatch = headerText.match(/@author(?::|\s)\s*([^\n\r*]+)/i);
    if (authorMatch) author = authorMatch[1].trim();

    const fontMatch = headerText.match(/@font(?::|\s)\s*([^\n\r*]+)/i);
    if (fontMatch) font = fontMatch[1].trim();

    const header = Buffer.alloc(128);
    // Magic "eenk" (0x6B6E6565)
    header.writeUInt32LE(0x6B6E6565, 0);
    // Version 1
    header.writeUInt16LE(1, 4);
    // Header Size 128
    header.writeUInt16LE(128, 6);
    // Title (max 63 bytes)
    header.write(title, 8, 63, 'utf8');
    // Author (max 31 bytes)
    header.write(author, 72, 31, 'utf8');
    // Timestamp
    header.writeUInt32LE(Math.floor(Date.now() / 1000), 104);
    // Flags (0 by default, can be extended for things like sidecar media files)
    header.writeUInt32LE(0, 108);
    // Font Name Length
    let fontLen = Buffer.byteLength(font, 'utf8');
    if (fontLen > 15) fontLen = 15;
    header.writeUInt8(fontLen, 112);
    // Font Name (max 15 bytes)
    header.write(font, 113, fontLen, 'utf8');


    const binContent = fs.readFileSync(binFile);
    fs.writeFileSync(binFile, Buffer.concat([header, binContent]));
    onProgress(`✔ Metadata Header prepended (Title: "${title || '(none)'}", Author: "${author || '(none)'}")`);

    // Analyze Memory Budget
    let numContainers = 0;
    let heapRequirement = 0;
    let totalFileSize = 0;
    
    try {
        const stats = fs.statSync(binFile);
        totalFileSize = stats.size;
        
        const fd = fs.openSync(binFile, 'r');
        const buffer = Buffer.alloc(168); // 128 header + 40 bytes for INKB check
        fs.readSync(fd, buffer, 0, 168, 0);
        fs.closeSync(fd);
        
        const eenkMagic = buffer.readUInt32LE(0);
        const offset = (eenkMagic === 0x6B6E6565) ? 128 : 0;

        const magic = buffer.readUInt32LE(offset);
        if (magic === 0x424b4e49) { // 'INKB'
            const containersBytes = buffer.readUInt32LE(offset + 36);
            numContainers = containersBytes / 16;
            heapRequirement = numContainers * 8;
        }
    } catch (err) {
        onProgress(`[WARN] Failed to analyze memory budget: ${err.message}`);
    }

    onProgress(`── Compilation complete ──`);
    return { jsonFile, binFile, numContainers, heapRequirement, totalFileSize };
}

// ── IPC registration ─────────────────────────────────────────────────────────

ipcMain.handle('eenk:compile', async (event, inkFilePath) => {
    return new Promise((resolve, reject) => {
        compileEenk(inkFilePath, msg => {
            if (!event.sender.isDestroyed()) {
                event.sender.send('eenk:compile-progress', msg);
            }
        })
        .then(result => resolve(result))
        .catch(err   => reject(err.message || String(err)));
    });
});

ipcMain.handle('eenk:check-inkcpp', async () => {
    const inkcpp = getInkcppBinary();
    return fs.existsSync(inkcpp);
});

module.exports = { compileEenk };
