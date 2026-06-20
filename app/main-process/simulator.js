/**
 * simulator.js
 * Manages the lifecycle of the native SDL simulator child process.
 * The simulator is a pre-built PLATFORM_NATIVE binary of the EENK firmware
 * that accepts a .bin story path as argv[1] and opens its own SDL window.
 *
 * IPC channels:
 *   eenk:sim-launch  (invoke) { binPath } → launches sim, returns status
 *   eenk:sim-stop    (invoke)              → kills any running sim process
 *   eenk:sim-log     (send)   msg          → streamed stdout/stderr lines
 */

const { ipcMain } = require('electron');
const { spawn }   = require('child_process');
const path        = require('path');
const fs          = require('fs');

let simProcess    = null;
let senderRef     = null;   // keep a ref so we can push log lines

// ── Binary resolution ────────────────────────────────────────────────────────

function getInkDir() {
    const { app } = require('electron');
    return app.isPackaged 
        ? path.join(process.resourcesPath, 'ink')
        : path.join(__dirname, 'ink');
}

function getSimBinary() {
    const inkDir = getInkDir();
    if (process.platform === 'win32')  return path.join(inkDir, 'win',   'eenk-sim.exe');
    if (process.platform === 'darwin') return path.join(inkDir, 'mac',   'eenk-sim');
    return path.join(inkDir, 'linux', 'eenk-sim');
}

// ── Process management ───────────────────────────────────────────────────────

function stopSimulator() {
    if (simProcess) {
        try { simProcess.kill(); } catch (_) {}
        simProcess = null;
    }
}

function sendLog(msg) {
    if (senderRef && !senderRef.isDestroyed()) {
        senderRef.send('eenk:sim-log', msg);
    }
}

function launchSimulator(binPath, sender) {
    stopSimulator();
    senderRef = sender;

    const simExe = getSimBinary();

    if (!fs.existsSync(simExe)) {
        const rel = path.relative(path.join(__dirname, '..', '..'), simExe);
        throw new Error(
            `Simulator binary not found: ${rel}\n` +
            `Build it with: pio run -e native\n` +
            `Then copy the output to tools/eenky/bin/win/eenk-sim.exe`
        );
    }

    if (!fs.existsSync(binPath)) {
        throw new Error(`Story binary not found: ${binPath}`);
    }

    sendLog(`[sim] Launching: ${path.basename(simExe)} ${path.basename(binPath)}`);

    simProcess = spawn(simExe, [binPath], {
        cwd: path.dirname(binPath),
        env: { ...process.env }
    });

    simProcess.stdout.setEncoding('utf8');
    simProcess.stderr.setEncoding('utf8');

    simProcess.stdout.on('data', d => sendLog(d.trimEnd()));
    simProcess.stderr.on('data', d => sendLog(d.trimEnd()));

    simProcess.on('error', err => {
        sendLog(`[sim] ERROR: ${err.message}`);
        simProcess = null;
        if (senderRef && !senderRef.isDestroyed()) {
            senderRef.send('eenk:sim-exited', { code: -1, error: err.message });
        }
    });

    simProcess.on('close', code => {
        sendLog(`[sim] Exited (code ${code})`);
        simProcess = null;
        if (senderRef && !senderRef.isDestroyed()) {
            senderRef.send('eenk:sim-exited', { code });
        }
    });
}

// ── IPC registration ─────────────────────────────────────────────────────────

ipcMain.handle('eenk:sim-launch', async (event, binPath) => {
    try {
        launchSimulator(binPath, event.sender);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('eenk:sim-stop', async () => {
    stopSimulator();
    return { ok: true };
});

ipcMain.handle('eenk:sim-status', async () => {
    return { running: simProcess !== null };
});

ipcMain.handle('eenk:check-sim', async () => {
    return fs.existsSync(getSimBinary());
});

module.exports = { stopSimulator };
