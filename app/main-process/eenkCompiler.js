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
const os = require('os');
const { packImages } = require('./imagePacker');

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

function getFontconvertScript() {
    const inkDir = getInkDir();
    return path.join(inkDir, 'fontconvert.py');
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

async function compileEenk(inkFilePath, onProgress = () => {}, options = {}) {
    const inkFile = path.resolve(inkFilePath);
    const inkDir = path.dirname(inkFile);
    const baseName = path.basename(inkFile, '.ink');

    if (!fs.existsSync(inkFile)) {
        throw new Error(`File not found: ${inkFile}`);
    }

    let buildDir = inkDir;
    if (options.outputDir) {
        buildDir = options.outputDir;
        if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir, { recursive: true });
        }
    } else if (options.isTemp) {
        const tempBase = path.join(os.tmpdir(), 'eenky-build');
        if (!fs.existsSync(tempBase)) {
            fs.mkdirSync(tempBase, { recursive: true });
        }
        buildDir = fs.mkdtempSync(path.join(tempBase, `${baseName}-`));
    }

    const jsonFile = path.join(buildDir, `${baseName}.json`);
    const binFile = path.join(buildDir, `${baseName}.bin`);
    const mediaFile = path.join(buildDir, `${baseName}.media`);
    const fontFiles = [];

    const inklecate = getInklecateBinary();
    const inkcpp = getInkcppBinary();

    onProgress(`── Starting eenk compilation for ${baseName}.ink ──`);

    // Step 1: inklecate → JSON
    onProgress(`Step 1/2  inklecate: ${path.basename(inkFile)} → ${path.basename(jsonFile)}`);
    await runProcess(inklecate, ['-o', jsonFile, inkFile], inkDir, onProgress);
    onProgress(`✔ JSON written: ${jsonFile}`);

    // Step 2: inkcpp_cl → BIN
    onProgress(`Step 2/2  inkcpp_cl: ${path.basename(jsonFile)} → ${path.basename(binFile)}`);
    await runProcess(inkcpp, [jsonFile], buildDir, onProgress);
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

    const coverMatch = headerText.match(/@cover(?::|\s)\s*([^\n\r*]+)/i);
    let coverFile = '';
    if (coverMatch) {
        coverFile = coverMatch[1].trim();
    }

    const thumbMatch = headerText.match(/@thumbnail(?::|\s)\s*([^\n\r*]+)/i);
    let thumbnailFile = '';
    if (thumbMatch) {
        thumbnailFile = thumbMatch[1].trim();
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
    let flags = 0;
    let hasMedia = false;
    
    // Step 2b: Process Images
    try {
        onProgress(`Step 2.5: Packing images to .media sidecar...`);
        const sidecarWritten = await packImages(inkDir, jsonFile, coverFile, thumbnailFile, mediaFile);
        if (sidecarWritten) {
            hasMedia = true;
            flags |= 1; // bit 0 = has_media_sidecar
            onProgress(`✔ Media sidecar packed successfully: ${path.basename(mediaFile)}`);
        } else {
            onProgress(`✔ No images found to pack.`);
        }
    } catch (e) {
        throw e;
    }
    
    header.writeUInt32LE(flags, 108);
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
        const magicStr = buffer.toString('ascii', offset, offset + 4);
        // INKB magic: 0x494E4B42 ('INKB' in LE) or 0x424B4E49 ('BKNI')
        if (magic === 0x424b4e49 || magic === 0x494e4b42 || magicStr === 'INKB' || magicStr === 'BKNI') {
            const containersBytes = buffer.readUInt32LE(offset + 36);
            numContainers = Math.floor(containersBytes / 16);
            heapRequirement = numContainers * 8; // 8 bytes per container (4 bytes visits + 4 bytes turns)
        }
    } catch (err) {
        onProgress(`[WARN] Failed to analyze memory budget: ${err.message}`);
    }

    const sizeKb = (totalFileSize / 1024).toFixed(1);
    const heapKb = (heapRequirement / 1024).toFixed(1);
    onProgress(`✔ Binary size: ${sizeKb} KB (${totalFileSize.toLocaleString()} bytes)`);
    onProgress(`✔ Story containers: ${numContainers} (State data heap budget: ~${heapKb} KB)`);
    onProgress(`── Compilation complete ──`);

    let warnings = [];

    // ── Font Conversion ──
    if (originalFont && originalFont.toLowerCase() !== 'sans' && originalFont.toLowerCase() !== 'serif') {
        const fontNameBase = originalFont.replace(/-(regular|regula|bold|italic|bolditalic|medium)$/i, '');
        const ttfPath = path.join(inkDir, `${originalFont}.ttf`);
        
        // Check for Bold / Italic usage
        const usesBold = /\*\*(.*?)\*\*|__(.*?)__/.test(inkContent);
        // Note: single * is used for choices in ink, so this regex is a heuristic.
        const usesItalic = /(?<!\S)\*(?!\s)(.*?)(?<!\s)\*(?!\S)|_(.*?)_/.test(inkContent);

        const hasRegular = fs.existsSync(ttfPath);
        const hasBold = usesBold && (fs.existsSync(path.join(inkDir, `${fontNameBase}-Bold.ttf`)) || fs.existsSync(path.join(inkDir, `${fontNameBase}-bold.ttf`)));
        const hasItalic = usesItalic && (fs.existsSync(path.join(inkDir, `${fontNameBase}-Italic.ttf`)) || fs.existsSync(path.join(inkDir, `${fontNameBase}-italic.ttf`)));

        if (hasRegular || hasBold || hasItalic) {
            let pythonCmd = null;
            let pythonOk = false;
            try {
                try {
                    await runProcess('python3', ['--version'], inkDir, () => {});
                    pythonCmd = 'python3';
                } catch (e1) {
                    try {
                        await runProcess('python', ['--version'], inkDir, () => {});
                        pythonCmd = 'python';
                    } catch (e2) {
                        throw new Error("Python 3 is not installed.");
                    }
                }

                try {
                    await runProcess(pythonCmd, ['-c', 'import freetype'], inkDir, () => {});
                    pythonOk = true;
                } catch (e) {
                    onProgress(`[Font] 'freetype-py' not found. Attempting to install it automatically...`);
                    await runProcess(pythonCmd, ['-m', 'pip', 'install', 'freetype-py'], inkDir, onProgress);
                    // verify it installed correctly
                    await runProcess(pythonCmd, ['-c', 'import freetype'], inkDir, () => {});
                    pythonOk = true;
                }
            } catch (err) {
                onProgress(`[WARN] Python dependencies missing. (Error: ${err.message})`);
                warnings.push(`Failed to convert fonts. Python 3 or 'freetype-py' is missing.\n\nPlease open your terminal and run:\n${pythonCmd ? pythonCmd + ' -m pip install freetype-py' : 'pip3 install freetype-py'}`);
            }

            if (pythonOk) {
                const fontConvertScript = getFontconvertScript();
                const outDir = path.join(buildDir, 'font_tmp_out');

                if (!fs.existsSync(fontConvertScript)) {
                    onProgress(`[WARN] fontconvert.py script not found at ${fontConvertScript}`);
                    warnings.push(`Compiler error: fontconvert.py script is missing.`);
                } else {
                    // Regular Font
                    if (hasRegular) {
                        onProgress(`[Font] Found side-loaded TTF: ${originalFont}.ttf`);
                        try {
                            onProgress(`[Font] Converting ${originalFont}.ttf to ${headerFont}.epdfont at size ${DEFAULT_FONT_SIZE}pt...`);
                            await runProcess(pythonCmd, [
                                fontConvertScript, originalFont, '-r', ttfPath,
                                '--size-opt', DEFAULT_FONT_SIZE.toString(), '--2bit', '-o', outDir
                            ], inkDir, onProgress);

                            const generatedEpdfont = path.join(outDir, originalFont, 'regular.epdfont');
                            if (fs.existsSync(generatedEpdfont)) {
                                const finalEpdfont = path.join(buildDir, `${headerFont}.epdfont`);
                                fs.copyFileSync(generatedEpdfont, finalEpdfont);
                                fontFiles.push(finalEpdfont);
                                onProgress(`✔ Font converted successfully: ${headerFont}.epdfont`);
                            } else {
                                onProgress(`[WARN] Font conversion completed but ${generatedEpdfont} was not found.`);
                                warnings.push(`Regular font ${originalFont}.ttf could not be converted.`);
                            }
                        } catch (err) {
                            onProgress(`[WARN] Could not convert TTF font. (Error: ${err.message})`);
                            warnings.push(`Failed to convert ${originalFont}.ttf.`);
                        } finally {
                            try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (e) { }
                        }
                    } else {
                        warnings.push(`Regular font ${originalFont}.ttf was not found.`);
                    }

                    // Variants
                    if (usesBold || usesItalic) {
                        onProgress(`[Font] Story uses bold/italic variants. Checking for variants of ${fontNameBase}...`);
                        
                        const tryConvertVariant = async (variantSuffix, epdfontSuffix) => {
                            const variantFileName = `${fontNameBase}-${variantSuffix}`;
                            const variantTtf = path.join(inkDir, `${variantFileName}.ttf`);
                            if (fs.existsSync(variantTtf)) {
                                onProgress(`[Font] Found variant ${variantFileName}.ttf`);
                                try {
                                    await runProcess(pythonCmd, [
                                        fontConvertScript, variantFileName, '-r', variantTtf,
                                        '--size-opt', DEFAULT_FONT_SIZE.toString(), '--2bit', '-o', outDir
                                    ], inkDir, onProgress);
                                    
                                    const generatedVariant = path.join(outDir, variantFileName, 'regular.epdfont');
                                    if (fs.existsSync(generatedVariant)) {
                                        const finalVariantEpdfont = path.join(buildDir, `${headerFont}-${epdfontSuffix}.epdfont`);
                                        fs.copyFileSync(generatedVariant, finalVariantEpdfont);
                                        fontFiles.push(finalVariantEpdfont);
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
                            const foundBold = await tryConvertVariant('Bold', 'bold') || await tryConvertVariant('bold', 'bold');
                            if (!foundBold) {
                                warnings.push(`Story uses bold text, but ${fontNameBase}-Bold.ttf was not provided (eenk will use faux bold).`);
                            }
                        }
                        if (usesItalic) {
                            const foundItalic = await tryConvertVariant('Italic', 'italic') || await tryConvertVariant('italic', 'italic');
                            if (!foundItalic) {
                                warnings.push(`Story uses italic text, but ${fontNameBase}-Italic.ttf was not provided (eenk will use faux italic).`);
                            }
                        }
                    }
                }
            }
        } else {
            // No TTF files exist at all
            warnings.push(`Regular font ${originalFont}.ttf was not found.`);
        }
    }

    return {
        jsonFile,
        binFile,
        mediaFile: hasMedia ? mediaFile : null,
        fontFiles,
        numContainers,
        heapRequirement,
        totalFileSize,
        warnings
    };
}

// ── IPC registration ─────────────────────────────────────────────────────────

ipcMain.handle('eenk:compile', async (event, inkFilePath, options = {}) => {
    return new Promise((resolve, reject) => {
        compileEenk(inkFilePath, msg => {
            if (!event.sender.isDestroyed()) {
                event.sender.send('eenk:compile-progress', msg);
            }
        }, options)
            .then(result => resolve(result))
            .catch(err => reject(err.message || String(err)));
    });
});

ipcMain.handle('eenk:check-inkcpp', async () => {
    const inkcpp = getInkcppBinary();
    return fs.existsSync(inkcpp);
});

module.exports = { compileEenk };
