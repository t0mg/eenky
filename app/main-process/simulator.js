/**
 * simulator.js
 * Manages the lifecycle of the native SDL simulator child process.
 * The simulator is a pre-built PLATFORM_NATIVE binary of the eenk firmware
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
    console.log(msg); // Print to main-process console (npm start output)
    if (senderRef && !senderRef.isDestroyed()) {
        senderRef.send('eenk:sim-log', msg);
    }
}

function launchSimulator(binPath, sender) {
    return new Promise((resolve, reject) => {
        stopSimulator();
        senderRef = sender;

        const simExe = getSimBinary();

        if (!fs.existsSync(simExe)) {
            const rel = path.relative(path.join(__dirname, '..', '..'), simExe);
            return reject(new Error(
                `Simulator binary not found: ${rel}\n` +
                `Build it with: pio run -e native\n` +
                `Then copy the output to tools/eenky/bin/win/eenk-sim.exe`
            ));
        }

        if (!fs.existsSync(binPath)) {
            return reject(new Error(`Story binary not found: ${binPath}`));
        }

        // Ensure executable permissions on POSIX systems
        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(simExe, 0o755);
            } catch (e) {
                console.warn(`[sim] Warning: Could not chmod simulator binary: ${e.message}`);
            }
        }

        sendLog(`[sim] Launching: ${path.basename(simExe)} ${path.basename(binPath)}`);

        let earlyStderr = [];
        let earlyStdout = [];
        let hasSettled = false;

        const simDir = path.dirname(simExe);
        const simEnv = { ...process.env };
        if (process.platform === 'darwin') {
            simEnv.DYLD_LIBRARY_PATH = simDir + (simEnv.DYLD_LIBRARY_PATH ? `:${simEnv.DYLD_LIBRARY_PATH}` : '');
            simEnv.DYLD_FALLBACK_LIBRARY_PATH = simDir + (simEnv.DYLD_FALLBACK_LIBRARY_PATH ? `:${simEnv.DYLD_FALLBACK_LIBRARY_PATH}` : '');
        }

        const proc = spawn(simExe, [binPath], {
            cwd: path.dirname(binPath),
            env: simEnv
        });
        simProcess = proc;

        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');

        proc.stdout.on('data', d => {
            const str = d.trimEnd();
            sendLog(str);
            if (!hasSettled) earlyStdout.push(str);
        });

        proc.stderr.on('data', d => {
            const str = d.trimEnd();
            sendLog(str);
            if (!hasSettled) earlyStderr.push(str);
        });

        proc.on('error', err => {
            sendLog(`[sim] ERROR: ${err.message}`);
            if (simProcess === proc) simProcess = null;
            if (!hasSettled) {
                hasSettled = true;
                clearTimeout(startupTimer);
                reject(new Error(`Failed to launch simulator: ${err.message}`));
            }
            if (senderRef && !senderRef.isDestroyed()) {
                senderRef.send('eenk:sim-exited', { code: -1, error: err.message });
            }
        });

        proc.on('close', (code, signal) => {
            sendLog(`[sim] Exited (code ${code}${signal ? `, signal ${signal}` : ''})`);
            if (simProcess === proc) simProcess = null;
            if (!hasSettled) {
                hasSettled = true;
                clearTimeout(startupTimer);
                const errMsg = earlyStderr.join('\n') || earlyStdout.join('\n') || `Process exited unexpectedly (code ${code}${signal ? `, signal ${signal}` : ''})`;
                reject(new Error(errMsg));
            }
            if (senderRef && !senderRef.isDestroyed()) {
                senderRef.send('eenk:sim-exited', { code, signal });
            }
        });

        // Give the simulator 400ms to fail early (e.g. dynamic link failure, missing library, missing permission)
        const startupTimer = setTimeout(() => {
            if (!hasSettled) {
                hasSettled = true;
                resolve({ ok: true });
            }
        }, 400);
    });
}

// ── IPC registration ─────────────────────────────────────────────────────────

ipcMain.handle('eenk:sim-launch', async (event, binPath) => {
    try {
        await launchSimulator(binPath, event.sender);
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
