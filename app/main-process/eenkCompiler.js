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

// ── Configuration ────────────────────────────────────────────────────────────
// Default font size used when converting side-loaded TTF fonts to .epdfont
const DEFAULT_FONT_SIZE = 14;

// ── Binary resolution ────────────────────────────────────────────────────────

function getInkDir() {
    const { app } = require('electron');
    return app.isPackaged
        ? path.join(process.resourcesPath, 'ink')
        : path.join(__dirname, 'ink');
}

function getInkcppBinary() {
    const inkDir = getInkDir();
    if (process.platform === 'win32') return path.join(inkDir, 'win', 'inkcpp_cl.exe');
    if (process.platform === 'darwin') return path.join(inkDir, 'mac', 'inkcpp_cl');
    return path.join(inkDir, 'linux', 'inkcpp_cl');
}

// Use inky's existing inklecate path resolution
function getInklecateBinary() {
    const inkDir = getInkDir();
    if (process.platform === 'win32') return path.join(inkDir, 'inklecate_win.exe');
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
    const inkFile = path.resolve(inkFilePath);
    const inkDir = path.dirname(inkFile);
    const baseName = path.basename(inkFile, '.ink');
    const jsonFile = path.join(inkDir, `${baseName}.json`);
    const binFile = path.join(inkDir, `${baseName}.bin`);

    if (!fs.existsSync(inkFile)) {
        throw new Error(`File not found: ${inkFile}`);
    }

    const inklecate = getInklecateBinary();
    const inkcpp = getInkcppBinary();

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
    let originalFont = '';
    let headerFont = '';
    if (fontMatch) {
        originalFont = fontMatch[1].trim();
        // Strip trailing style suffix to derive clean family stem for header
        headerFont = originalFont.replace(/-(regular|regula|bold|italic|bolditalic|medium)$/i, '');
    }

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
    let fontLen = Buffer.byteLength(headerFont, 'utf8');
    while (fontLen > 15) {
        headerFont = headerFont.slice(0, -1);
        fontLen = Buffer.byteLength(headerFont, 'utf8');
    }
    header.writeUInt8(fontLen, 112);
    // Font Name (max 15 bytes)
    if (fontLen > 0) {
        header.write(headerFont, 113, fontLen, 'utf8');
    }


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

    let warnings = [];

    // ── Font Conversion ──
    if (originalFont && originalFont.toLowerCase() !== 'sans' && originalFont.toLowerCase() !== 'serif') {
        const ttfPath = path.join(inkDir, `${originalFont}.ttf`);
        const fontNameBase = originalFont.replace(/-(regular|regula|bold|italic|bolditalic|medium)$/i, '');
        
        let regularConverted = false;

        if (fs.existsSync(ttfPath)) {
            onProgress(`[Font] Found side-loaded TTF: ${originalFont}.ttf`);
            try {
                // Check if Python and freetype are available
                await runProcess('python', ['-c', 'import freetype'], inkDir, () => {});

                // Paths
                const rootDir = path.resolve(__dirname, '../../../../'); // e.g. root/tools/eenky/app/main-process -> root
                const fontConvertScript = path.join(rootDir, 'scripts', 'fontconvert.py');
                const outDir = path.join(inkDir, 'font_tmp_out');

                if (fs.existsSync(fontConvertScript)) {
                    onProgress(`[Font] Converting ${originalFont}.ttf to ${headerFont}.epdfont at size ${DEFAULT_FONT_SIZE}pt...`);

                    // fontconvert.py <stem> -r <ttf> --size-opt <size> --2bit -o <outDir>
                    await runProcess('python', [
                        fontConvertScript,
                        originalFont,
                        '-r', ttfPath,
                        '--size-opt', DEFAULT_FONT_SIZE.toString(),
                        '--2bit',
                        '-o', outDir
                    ], inkDir, onProgress);

                    const generatedEpdfont = path.join(outDir, originalFont, 'regular.epdfont');
                    if (fs.existsSync(generatedEpdfont)) {
                        const finalEpdfont = path.join(inkDir, `${headerFont}.epdfont`);
                        fs.copyFileSync(generatedEpdfont, finalEpdfont);
                        onProgress(`✔ Font converted successfully: ${headerFont}.epdfont`);
                        regularConverted = true;
                    } else {
                        onProgress(`[WARN] Font conversion completed but ${generatedEpdfont} was not found.`);
                        warnings.push(`Regular font ${originalFont}.ttf could not be converted.`);
                    }

                    // Cleanup
                    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (e) { }
                } else {
                    onProgress(`[WARN] fontconvert.py script not found at ${fontConvertScript}`);
                }
            } catch (err) {
                onProgress(`[WARN] Could not convert TTF font. Please ensure Python 3 and 'freetype-py' are installed globally. (Error: ${err.message})`);
                warnings.push(`Failed to convert ${originalFont}.ttf: python or freetype missing.`);
            }
        } else {
            warnings.push(`Regular font ${originalFont}.ttf was not found.`);
        }

        // Check for Bold / Italic usage
        const usesBold = /\*\*(.*?)\*\*|__(.*?)__/.test(inkContent);
        // Note: single * is used for choices in ink, so this regex is a heuristic.
        const usesItalic = /(?<!\S)\*(?!\s)(.*?)(?<!\s)\*(?!\S)|_(.*?)_/.test(inkContent);

        if (usesBold || usesItalic) {
            onProgress(`[Font] Story uses bold/italic variants. Checking for variants of ${fontNameBase}...`);
            
            const tryConvertVariant = async (variantSuffix, epdfontSuffix) => {
                const variantFileName = `${fontNameBase}-${variantSuffix}`;
                const variantTtf = path.join(inkDir, `${variantFileName}.ttf`);
                if (fs.existsSync(variantTtf)) {
                    onProgress(`[Font] Found variant ${variantFileName}.ttf`);
                    const rootDir = path.resolve(__dirname, '../../../../');
                    const fontConvertScript = path.join(rootDir, 'scripts', 'fontconvert.py');
                    const outDir = path.join(inkDir, 'font_tmp_out');
                    try {
                        await runProcess('python', [
                            fontConvertScript, variantFileName, '-r', variantTtf,
                            '--size-opt', DEFAULT_FONT_SIZE.toString(), '--2bit', '-o', outDir
                        ], inkDir, onProgress);
                        
                        const generatedVariant = path.join(outDir, variantFileName, 'regular.epdfont');
                        if (fs.existsSync(generatedVariant)) {
                            const finalVariantEpdfont = path.join(inkDir, `${headerFont}-${epdfontSuffix}.epdfont`);
                            fs.copyFileSync(generatedVariant, finalVariantEpdfont);
                            onProgress(`✔ Variant converted successfully: ${headerFont}-${epdfontSuffix}.epdfont`);
                            return true;
                        }
                    } catch (e) {
                        onProgress(`[WARN] Failed to convert ${variantFileName}.ttf`);
                    } finally {
                        try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (e) { }
                    }
                }
                return false;
            };

            if (usesBold) {
                const hasBold = await tryConvertVariant('Bold', 'bold') || await tryConvertVariant('bold', 'bold');
                if (!hasBold) {
                    warnings.push(`Story uses bold text, but ${fontNameBase}-Bold.ttf was not provided (eenk will use faux bold).`);
                }
            }
            if (usesItalic) {
                const hasItalic = await tryConvertVariant('Italic', 'italic') || await tryConvertVariant('italic', 'italic');
                if (!hasItalic) {
                    warnings.push(`Story uses italic text, but ${fontNameBase}-Italic.ttf was not provided (eenk will use faux italic).`);
                }
            }
        }
    }

    return { jsonFile, binFile, numContainers, heapRequirement, totalFileSize, warnings };
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
            .catch(err => reject(err.message || String(err)));
    });
});

ipcMain.handle('eenk:check-inkcpp', async () => {
    const inkcpp = getInkcppBinary();
    return fs.existsSync(inkcpp);
});

module.exports = { compileEenk };
