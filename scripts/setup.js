#!/usr/bin/env node
/**
 * scripts/setup.js
 *
 * Copies the EENK-specific binaries into the places the Electron app expects:
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

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const EENK    = path.resolve(ROOT, 'eenk');
const INKCPP  = path.resolve(ROOT, 'inkcpp');

const platformMap = {
    win32:  { pioExe: 'program.exe', simName: 'eenk-sim.exe', inkDir: 'win',   inkcppExe: 'inkcpp_cl.exe'  },
    darwin: { pioExe: 'program',     simName: 'eenk-sim',     inkDir: 'mac',   inkcppExe: 'inkcpp_cl'      },
    linux:  { pioExe: 'program',     simName: 'eenk-sim',     inkDir: 'linux', inkcppExe: 'inkcpp_cl'      },
};

const plat = platformMap[process.platform];
if (!plat) {
    console.error(`Unsupported platform: ${process.platform}`);
    process.exit(1);
}

const DEST_DIR   = path.join(ROOT, 'app', 'main-process', 'ink', plat.inkDir);
const checkOnly  = process.argv.includes('--check');

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

console.log('\nEENKY setup — copying binaries\n');

// ── 1. eenk-sim (from eenk PlatformIO native build) ────────────────────────
console.log('1. eenk-sim (SDL simulator)');

const submoduleCheck = path.join(EENK, '.git');
if (!fs.existsSync(submoduleCheck)) {
    console.warn('  ⚠  `eenk` submodule not initialised.');
    console.warn('     Run: git submodule update --init --recursive\n');
    allOk = false;
} else {
    const simSrc = path.join(EENK, '.pio', 'build', 'native', plat.pioExe);
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
    // inkcpp releases drop the binary at the repo root in its build/ dir
    const buildDir = path.join(INKCPP, 'build');
    const candidates = [
        path.join(buildDir, 'inkcpp_cl', plat.inkcppExe),
        path.join(buildDir, plat.inkcppExe),
        path.join(INKCPP, plat.inkcppExe),
    ];
    const inkcppSrc = candidates.find(p => fs.existsSync(p));
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

// ── Done ─────────────────────────────────────────────────────────────────────
console.log('');
if (allOk) {
    console.log('✔  All binaries ready. Run `npm start` to launch EENKY.\n');
} else {
    console.log('⚠  Some binaries are missing. See warnings above.\n');
    if (!checkOnly) process.exit(1);
}
