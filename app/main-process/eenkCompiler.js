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
    const isPackaged = __dirname.includes('app.asar');
    const root = isPackaged 
        ? path.join(__dirname, '../../app.asar.unpacked/main-process')
        : __dirname;
    return path.join(root, 'ink');
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

    onProgress(`── Starting EENK compilation for ${baseName}.ink ──`);

    // Step 1: inklecate → JSON
    onProgress(`Step 1/2  inklecate: ${path.basename(inkFile)} → ${path.basename(jsonFile)}`);
    await runProcess(inklecate, ['-o', jsonFile, inkFile], inkDir, onProgress);
    onProgress(`✔ JSON written: ${jsonFile}`);

    // Step 2: inkcpp_cl → BIN
    onProgress(`Step 2/2  inkcpp_cl: ${path.basename(jsonFile)} → ${path.basename(binFile)}`);
    await runProcess(inkcpp, [jsonFile], inkDir, onProgress);
    onProgress(`✔ BIN written: ${binFile}`);

    onProgress(`── Compilation complete ──`);
    return { jsonFile, binFile };
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
