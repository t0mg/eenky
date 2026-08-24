#!/usr/bin/env node
/**
 * scripts/setup.js
 *
 * Copies the eenk-specific binaries into the places the Electron app expects:
 *   app/main-process/ink/<platform>/
 *
 * Binaries are sourced from two places:
 *   1. eenk-sim   — built from the `eenk` submodule via `pio run -e native`
 *   2. inkcpp_cl  — pre-built releases from the `inkcpp` submodule
 *   3. inklecate  — pre-built releases from inkle/ink (downloaded separately)
 *
 * Usage:
 *   node scripts/setup.js          # full setup
 *   node scripts/setup.js --check  # just check what's missing, no exit code
 *
 * This script is also invoked automatically by `npm run setup`.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const eenk = path.resolve(ROOT, 'eenk');
const INKCPP = path.resolve(ROOT, 'inkcpp');

const platformMap = {
    win32: { pioExe: 'program.exe', simName: 'eenk-sim.exe', inkDir: 'win', inkcppExe: 'inkcpp_cl.exe' },
    darwin: { pioExe: 'program', simName: 'eenk-sim', inkDir: 'mac', inkcppExe: 'inkcpp_cl' },
    linux: { pioExe: 'program', simName: 'eenk-sim', inkDir: 'linux', inkcppExe: 'inkcpp_cl' },
};

const plat = platformMap[process.platform];
if (!plat) {
    console.error(`Unsupported platform: ${process.platform}`);
    process.exit(1);
}

const DEST_DIR = path.join(ROOT, 'app', 'main-process', 'ink', plat.inkDir);
const checkOnly = process.argv.includes('--check');

let allOk = true;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyBin(src, dst, label) {
    if (!fs.existsSync(src)) {
        console.warn(`  ⚠  ${label} not found: ${src}`);
        allOk = false;
        return false;
    }
    if (!checkOnly) {
        ensureDir(path.dirname(dst));
        fs.copyFileSync(src, dst);
        if (process.platform !== 'win32') fs.chmodSync(dst, 0o755);
        console.log(`  ✔  ${label}`);
    } else {
        console.log(`  ✔  ${label} (found)`);
    }
    return true;
}

console.log('\neenky setup — copying binaries\n');

// ── 1. eenk-sim (from eenk PlatformIO native build) ────────────────────────
console.log('1. eenk-sim (SDL simulator)');

const submoduleCheck = path.join(eenk, '.git');
if (!fs.existsSync(submoduleCheck)) {
    console.warn('  ⚠  `eenk` submodule not initialised.');
    console.warn('     Run: git submodule update --init --recursive\n');
    allOk = false;
} else {
    if (!checkOnly) {
        try {
            console.log('  [build] Compiling eenk simulator...');
            if (process.platform === 'win32') {
                const linkFlags = path.join(eenk, 'link_flags.py');
                if (fs.existsSync(linkFlags)) {
                    let pyContent = fs.readFileSync(linkFlags, 'utf-8');
                    // Force the compiler paths so PlatformIO doesn't use Strawberry Perl GCC
                    pyContent = pyContent.replace('env.Append(LINKFLAGS=["-static"])', 'env["CC"] = "C:/msys64/mingw64/bin/gcc.exe"\n    env["CXX"] = "C:/msys64/mingw64/bin/g++.exe"\n    env.Append(LINKFLAGS=["-static"])');
                    fs.writeFileSync(linkFlags, pyContent);
                }
            }
            const { execSync } = require('child_process');
            execSync('pio run -e native -v', { cwd: eenk, stdio: 'inherit' });
        } catch (e) {
            console.warn(`  ⚠  Could not pull/build eenk simulator: ${e.message}`);
        }
    }

    const simSrc = path.join(eenk, '.pio', 'build', 'native', plat.pioExe);
    const simDst = path.join(DEST_DIR, plat.simName);

    if (!fs.existsSync(simSrc)) {
        console.warn(`  ⚠  Simulator binary not found. Build it first:`);
        console.warn(`       cd eenk`);
        if (process.platform === 'win32') {
            console.warn(`       $env:PATH = "C:\\msys64\\mingw64\\bin;" + $env:PATH`);
        }
        console.warn(`       pio run -e native\n`);
        allOk = false;
    } else {
        copyBin(simSrc, simDst, `eenk-sim  →  ${path.relative(ROOT, simDst)}`);

        // On macOS: bundle non-system dynamic libraries (e.g. Homebrew's libSDL2) using install_name_tool
        if (process.platform === 'darwin' && !checkOnly) {
            try {
                const { execSync } = require('child_process');
                const otoolOut = execSync(`otool -L "${simDst}"`).toString();
                const lines = otoolOut.split('\n').slice(1);
                for (const line of lines) {
                    const match = line.trim().match(/^(\S+)\s+\(/);
                    if (!match) continue;
                    const dylibPath = match[1];
                    // Match non-system dylibs (Homebrew, /usr/local, etc.)
                    if (dylibPath.startsWith('/opt/homebrew') || dylibPath.startsWith('/usr/local')) {
                        const realDylibPath = fs.existsSync(dylibPath) ? fs.realpathSync(dylibPath) : dylibPath;
                        if (fs.existsSync(realDylibPath)) {
                            const dylibName = path.basename(dylibPath);
                            const targetDylib = path.join(DEST_DIR, dylibName);
                            fs.copyFileSync(realDylibPath, targetDylib);
                            fs.chmodSync(targetDylib, 0o755);
                            execSync(`install_name_tool -id "@loader_path/${dylibName}" "${targetDylib}"`);
                            execSync(`install_name_tool -change "${dylibPath}" "@loader_path/${dylibName}" "${simDst}"`);
                            try {
                                execSync(`codesign -f -s - "${targetDylib}"`);
                                execSync(`codesign -f -s - "${simDst}"`);
                            } catch (_) {}
                            console.log(`  ✔  Bundled dylib: ${dylibName} (remapped to @loader_path/${dylibName})`);
                        }
                    }
                }
            } catch (e) {
                console.warn(`  ⚠  Could not bundle macOS dylibs: ${e.message}`);
            }
        }
    }
}

// ── 2. inkcpp_cl (from inkcpp submodule release build) ─────────────────────
console.log('\n2. inkcpp_cl (binary compiler)');

const inkcppCheck = path.join(INKCPP, '.git');
if (!fs.existsSync(inkcppCheck)) {
    console.warn('  ⚠  `inkcpp` submodule not initialised.');
    console.warn('     Run: git submodule update --init --recursive\n');
    allOk = false;
} else {
    if (!checkOnly) {
        try {
            console.log('  [build] Compiling inkcpp...');
            const { execSync } = require('child_process');

            let cmakeGen = '';
            if (process.platform === 'win32') {
                cmakeGen += '-DCMAKE_MSVC_RUNTIME_LIBRARY="MultiThreaded$<$<CONFIG:Debug>:Debug>" -DCMAKE_EXE_LINKER_FLAGS="-static" ';
            }

            execSync(`cmake ${cmakeGen}-B build && cmake --build build --config Release`, { cwd: INKCPP, stdio: 'inherit' });
        } catch (e) {
            console.warn(`  ⚠  Could not pull/build inkcpp: ${e.message}`);
        }
    }

    // inkcpp releases drop the binary at the repo root in its build/ dir
    const buildDir = path.join(INKCPP, 'build');
    const candidates = [
        path.join(buildDir, 'inkcpp_cl', plat.inkcppExe),
        path.join(buildDir, 'inkcpp_cl', 'Release', plat.inkcppExe),
        path.join(buildDir, plat.inkcppExe),
        path.join(INKCPP, plat.inkcppExe),
    ];
    const inkcppSrc = candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile());
    const inkcppDst = path.join(DEST_DIR, plat.inkcppExe);

    if (!inkcppSrc) {
        console.warn(`  ⚠  inkcpp_cl binary not found in inkcpp/build/.`);
        console.warn(`     Build it:`);
        console.warn(`       cd inkcpp && cmake -B build && cmake --build build --config Release\n`);
        allOk = false;
    } else {
        copyBin(inkcppSrc, inkcppDst, `inkcpp_cl  →  ${path.relative(ROOT, inkcppDst)}`);
    }
}

// ── 3. inklecate (bundled in app/main-process/ink/ from inky fork) ──────────
console.log('\n3. inklecate (ink → JSON compiler)');
const inklecatePath = path.join(ROOT, 'app', 'main-process', 'ink', `inklecate_${process.platform === 'win32' ? 'win.exe' : process.platform === 'darwin' ? 'mac' : 'linux'}`);
if (fs.existsSync(inklecatePath)) {
    console.log(`  ✔  inklecate already bundled`);
} else {
    console.warn(`  ⚠  inklecate not found. Download a release from:`);
    console.warn(`     https://github.com/inkle/ink/releases\n`);
    allOk = false;
}

// ── 4. Write eenk_version.txt ──────────────────────────────────────────────
console.log('\n4. Write eenk_version.txt');
try {
    const { execSync } = require('child_process');
    const hash = execSync('git rev-parse --short HEAD', { cwd: eenk }).toString().trim();
    const versionFile = path.join(ROOT, 'app', 'main-process', 'ink', 'eenk_version.txt');
    if (!checkOnly) fs.writeFileSync(versionFile, hash, 'utf8');
    console.log(`  ✔  eenk_version.txt -> ${hash}`);
} catch (e) {
    console.warn(`  ⚠  Could not get git hash for eenk: ${e.message}`);
}

// ── 5. Copy ink.js to export-for-web-template ───────────────────────────────
console.log('\n5. Copy ink.js to export-for-web-template');
try {
    const srcInk = path.join(ROOT, 'app', 'node_modules', 'inkjs', 'dist', 'ink.js');
    const dstInk = path.join(ROOT, 'app', 'export-for-web-template', 'ink.js');
    if (!checkOnly) fs.copyFileSync(srcInk, dstInk);
    console.log(`  ✔  ink.js copied to export-for-web-template`);
} catch (e) {
    console.warn(`  ⚠  Could not copy ink.js: ${e.message}`);
}

// ── 6. Copy WritingForEenk.md to Documentation ─────────────────────────────
console.log('\n6. Copy WritingForEenk.md to Documentation');
try {
    const srcEenk = path.join(eenk, 'WritingForEenk.md');
    const dstEenk = path.join(ROOT, 'app', 'resources', 'Documentation', 'WritingForEenk.md');
    if (!checkOnly) {
        ensureDir(path.dirname(dstEenk));
        fs.copyFileSync(srcEenk, dstEenk);
    }
    console.log(`  ✔  WritingForEenk.md copied to Documentation`);
} catch (e) {
    console.warn(`  ⚠  Could not copy WritingForEenk.md: ${e.message}`);
}

// ── 7. Copy flasher & device-manager web tools to renderer public/ ─────────
console.log('\n7. Copy flasher and device-manager tools to renderer/public/');
try {
    const flasherSrc = path.join(eenk, 'tools', 'flasher');
    const flasherDst = path.join(ROOT, 'app', 'renderer', 'public', 'flasher');
    const dmSrc = path.join(eenk, 'tools', 'device-manager');
    const dmDst = path.join(ROOT, 'app', 'renderer', 'public', 'device-manager');
    const assetsSrc = path.join(eenk, 'docs', 'assets');
    const assetsDst = path.join(ROOT, 'app', 'renderer', 'public', 'assets');

    if (fs.existsSync(flasherSrc)) {
        if (!checkOnly) {
            fs.mkdirSync(flasherDst, { recursive: true });
            fs.cpSync(flasherSrc, flasherDst, { recursive: true });
        }
        console.log(`  ✔  flasher copied to renderer/public/flasher`);
    } else {
        console.warn(`  ⚠  flasher tool source not found: ${flasherSrc}`);
    }

    if (fs.existsSync(dmSrc)) {
        if (!checkOnly) {
            fs.mkdirSync(dmDst, { recursive: true });
            fs.cpSync(dmSrc, dmDst, { recursive: true });
        }
        console.log(`  ✔  device-manager copied to renderer/public/device-manager`);
    } else {
        console.warn(`  ⚠  device-manager tool source not found: ${dmSrc}`);
    }

    if (fs.existsSync(assetsSrc)) {
        if (!checkOnly) {
            fs.mkdirSync(assetsDst, { recursive: true });
            fs.cpSync(assetsSrc, assetsDst, { recursive: true });
        }
        console.log(`  ✔  assets copied to renderer/public/assets`);
    } else {
        console.warn(`  ⚠  assets tool source not found: ${assetsSrc}`);
    }
} catch (e) {
    console.warn(`  ⚠  Could not copy web tools: ${e.message}`);
}

// ── 8. Copy fontconvert.py to ink/ ───────────────────────────────────────────
console.log('\n8. Copy fontconvert.py to app/main-process/ink/');
try {
    const srcFontConvert = path.join(eenk, 'scripts', 'fontconvert.py');
    const dstFontConvert = path.join(ROOT, 'app', 'main-process', 'ink', 'fontconvert.py');
    if (!checkOnly) {
        fs.copyFileSync(srcFontConvert, dstFontConvert);
    }
    console.log(`  ✔  fontconvert.py copied to ink/`);
} catch (e) {
    console.warn(`  ⚠  Could not copy fontconvert.py: ${e.message}`);
}

// ── Done ─────────────────────────────────────────────────────────────────────
console.log('');
if (allOk) {
    console.log('✔  All binaries ready. Run `npm start` to launch eenky.\n');
} else {
    console.log('⚠  Some binaries are missing. See warnings above.\n');
    if (!checkOnly) process.exit(1);
}
