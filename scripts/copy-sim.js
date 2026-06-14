/**
 * copy-sim.js
 * Helper script to copy the native SDL simulator binary (built by PlatformIO)
 * into the eenky app/main-process/ink/<platform>/ directory.
 *
 * Usage (from tools/eenky/):
 *   node scripts/copy-sim.js
 *
 * The PlatformIO native build output is expected in the `eenk` submodule:
 *   eenk/.pio/build/native/program.exe  (Windows)
 *   eenk/.pio/build/native/program      (macOS/Linux)
 *
 * If the eenk submodule is not present, falls back to looking two directories
 * up (for legacy in-monorepo usage).
 */

const fs   = require('fs');
const path = require('path');

// Prefer the eenk submodule, fall back to sibling repo layout
const submodulePath = path.resolve(__dirname, '..', 'eenk');
const repoRoot = fs.existsSync(path.join(submodulePath, '.git'))
    ? submodulePath
    : path.resolve(__dirname, '..', '..', '..');

const platformMap = {
    win32:  { src: 'program.exe', dstDir: 'win',   dst: 'eenk-sim.exe' },
    darwin: { src: 'program',     dstDir: 'mac',   dst: 'eenk-sim'     },
    linux:  { src: 'program',     dstDir: 'linux', dst: 'eenk-sim'     },
};

const plat = platformMap[process.platform];
if (!plat) {
    console.error(`Unsupported platform: ${process.platform}`);
    process.exit(1);
}

const srcPath = path.join(repoRoot, '.pio', 'build', 'native', plat.src);
const dstDir  = path.join(__dirname, '..', 'app', 'main-process', 'ink', plat.dstDir);
const dstPath = path.join(dstDir, plat.dst);

if (!fs.existsSync(srcPath)) {
    console.error(`\nSimulator binary not found: ${srcPath}`);
    console.error(`\nBuild it first:\n  pio run -e native\n  (from the eenk firmware repo root)\n`);
    process.exit(1);
}

fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(srcPath, dstPath);

// Make executable on macOS/Linux
if (process.platform !== 'win32') {
    fs.chmodSync(dstPath, 0o755);
}

console.log(`✔ Copied simulator binary:\n  ${srcPath}\n  → ${dstPath}`);
