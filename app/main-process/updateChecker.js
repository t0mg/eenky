const electron = require('electron');
const { app, net } = electron || {};
const https = require('https');
let ProjectWindowModule = null;
try {
    ProjectWindowModule = require('./projectWindow.js');
} catch (e) {}

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours between startup network checks

function cleanVersion(v) {
    if (typeof v !== 'string') return '';
    return v.trim().replace(/^[vV]/, '');
}

function parseSemver(v) {
    const cleaned = cleanVersion(v);
    const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/);
    if (!match) return null;
    return {
        major: parseInt(match[1], 10) || 0,
        minor: parseInt(match[2], 10) || 0,
        patch: parseInt(match[3], 10) || 0,
        prerelease: match[4] || null
    };
}

/**
 * Compares two semver strings (e.g. '0.2.2', 'v0.2.3', '1.0.0-beta.1').
 * Returns:
 *   > 0 if v1 > v2
 *   < 0 if v1 < v2
 *   0 if v1 === v2
 */
function semverCompare(v1, v2) {
    const p1 = parseSemver(v1);
    const p2 = parseSemver(v2);

    if (!p1 && !p2) return 0;
    if (!p1) return -1;
    if (!p2) return 1;

    if (p1.major !== p2.major) return p1.major - p2.major;
    if (p1.minor !== p2.minor) return p1.minor - p2.minor;
    if (p1.patch !== p2.patch) return p1.patch - p2.patch;

    if (p1.prerelease && !p2.prerelease) return -1;
    if (!p1.prerelease && p2.prerelease) return 1;
    if (p1.prerelease && p2.prerelease) {
        if (p1.prerelease < p2.prerelease) return -1;
        if (p1.prerelease > p2.prerelease) return 1;
    }

    return 0;
}

function getSettings() {
    const PW = ProjectWindowModule ? ProjectWindowModule.ProjectWindow : null;
    if (PW && PW.getViewSettings) {
        return PW.getViewSettings();
    }
    return {};
}

function updateSetting(key, val) {
    const PW = ProjectWindowModule ? ProjectWindowModule.ProjectWindow : null;
    if (PW && PW.addOrChangeViewSetting) {
        PW.addOrChangeViewSetting(key, val);
    }
}

function resolveTargetWindow(win) {
    if (win && win.browserWindow && !win.browserWindow.isDestroyed()) {
        return win;
    }
    const PW = ProjectWindowModule ? ProjectWindowModule.ProjectWindow : null;
    if (PW) {
        if (PW.focused && PW.focused() && PW.focused().browserWindow && !PW.focused().browserWindow.isDestroyed()) {
            return PW.focused();
        }
        if (PW.all && typeof PW.all === 'function') {
            const allWindows = PW.all();
            if (Array.isArray(allWindows)) {
                const candidate = allWindows.find(w => w && w.browserWindow && !w.browserWindow.isDestroyed());
                if (candidate) return candidate;
            }
        }
    }
    return null;
}

function sendToWindow(win, channel, ...args) {
    const targetWin = resolveTargetWindow(win);
    if (!targetWin || !targetWin.browserWindow || targetWin.browserWindow.isDestroyed()) {
        return false;
    }
    const contents = targetWin.browserWindow.webContents;
    const send = () => {
        if (!targetWin.browserWindow.isDestroyed()) {
            contents.send(channel, ...args);
        }
    };
    if (contents && typeof contents.isLoading === 'function' && contents.isLoading()) {
        contents.once('did-finish-load', send);
    } else if (contents && typeof contents.send === 'function') {
        send();
    }
    return true;
}

async function fetchLatestRelease(options = {}) {
    const endpoint = options.endpoint || 'https://api.github.com/repos/t0mg/eenky/releases/latest';
    const appVersion = (app && app.getVersion) ? app.getVersion() : '0.2.2';
    const headers = {
        'User-Agent': `eenky/${appVersion}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    if (net && typeof net.fetch === 'function') {
        const res = await net.fetch(endpoint, { headers });
        if (!res.ok) {
            throw new Error(`GitHub API responded with HTTP ${res.status}`);
        }
        return await res.json();
    }

    if (typeof fetch === 'function') {
        const res = await fetch(endpoint, { headers });
        if (!res.ok) {
            throw new Error(`GitHub API responded with HTTP ${res.status}`);
        }
        return await res.json();
    }

    return new Promise((resolve, reject) => {
        const req = https.get(endpoint, { headers }, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`GitHub API responded with HTTP ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(8000, () => {
            req.destroy(new Error('Request timeout'));
        });
    });
}

/**
 * Checks for updates from GitHub releases.
 * @param {Object} opts
 * @param {boolean} opts.isStartup - whether this check is running automatically on app startup
 * @param {Object} opts.win - target ProjectWindow instance to send modal events to
 * @param {Function} [opts.fetchFn] - optional fetcher for testing
 */
async function checkForUpdates({ isStartup = false, win = null, fetchFn = null, settings: injectedSettings = null, updateSettingFn = null } = {}) {
    const settings = injectedSettings || getSettings();
    const setSetting = updateSettingFn || updateSetting;
    const currentVersion = cleanVersion((app && app.getVersion) ? app.getVersion() : '0.2.2');

    if (isStartup && settings.checkForUpdates === false) {
        return { skipped: true, reason: 'disabled' };
    }

    // Check if we already have a pending update that is newer than currentVersion
    const pending = settings.pendingUpdate;
    if (pending && pending.latestVersion) {
        const isStillNewer = semverCompare(pending.latestVersion, currentVersion) > 0;
        if (isStillNewer) {
            // Update is still valid and unapplied
            if (isStartup && settings.skippedUpdateVersion === pending.latestVersion) {
                // User explicitly skipped this version
            } else if (isStartup) {
                sendToWindow(win, 'update-available', pending);
                const lastCheck = settings.lastUpdateCheck || 0;
                const now = Date.now();
                if (now - lastCheck < CHECK_INTERVAL_MS) {
                    return { hasUpdate: true, updateInfo: pending, fromCache: true };
                }
            }
        } else {
            // The running app has caught up with or surpassed the pending update
            setSetting('pendingUpdate', null);
        }
    }

    if (isStartup) {
        const lastCheck = settings.lastUpdateCheck || 0;
        const now = Date.now();
        if (now - lastCheck < CHECK_INTERVAL_MS) {
            if (pending && semverCompare(pending.latestVersion, currentVersion) > 0 && settings.skippedUpdateVersion !== pending.latestVersion) {
                return { hasUpdate: true, updateInfo: pending, fromCache: true };
            }
            return { skipped: true, reason: 'recently_checked' };
        }
    }

    try {
        const release = fetchFn ? await fetchFn() : await fetchLatestRelease();
        setSetting('lastUpdateCheck', Date.now());

        const latestVersion = cleanVersion(release.tag_name || '');
        const hasUpdate = semverCompare(latestVersion, currentVersion) > 0;

        if (hasUpdate) {
            const updateInfo = {
                currentVersion,
                latestVersion,
                releaseName: release.name || `eenky v${latestVersion}`,
                releaseNotes: release.body || '',
                releaseUrl: release.html_url || `https://github.com/t0mg/eenky/releases/tag/v${latestVersion}`,
                publishedAt: release.published_at || ''
            };

            // Cache pending update for future startups
            setSetting('pendingUpdate', updateInfo);

            if (isStartup && settings.skippedUpdateVersion === latestVersion) {
                return { skipped: true, reason: 'version_skipped', latestVersion };
            }

            sendToWindow(win, 'update-available', updateInfo);
            return { hasUpdate: true, updateInfo };
        } else {
            // App is up to date: clear any pending update
            if (settings.pendingUpdate) {
                setSetting('pendingUpdate', null);
            }
            if (!isStartup) {
                sendToWindow(win, 'show-modal', 'alert', {
                    title: 'eenky is Up to Date',
                    message: `You are running the latest version of eenky (v${currentVersion}).`
                });
            }
            return { hasUpdate: false, currentVersion, latestVersion };
        }
    } catch (err) {
        console.warn('[UpdateChecker] Check failed:', err.message);
        if (!isStartup) {
            sendToWindow(win, 'show-modal', 'alert', {
                title: 'Update Check Failed',
                message: 'Unable to check for updates.\nPlease verify your network connection and try again.'
            });
        }
        return { error: err.message };
    }
}

function skipVersion(version, injectedSettings = null, updateSettingFn = null) {
    const cleaned = cleanVersion(version);
    const setSetting = updateSettingFn || updateSetting;
    const settings = injectedSettings || getSettings();
    setSetting('skippedUpdateVersion', cleaned);
    if (settings.pendingUpdate && cleanVersion(settings.pendingUpdate.latestVersion) === cleaned) {
        setSetting('pendingUpdate', null);
    }
}

function setCheckOnStartup(enabled) {
    updateSetting('checkForUpdates', !!enabled);
}

module.exports = {
    cleanVersion,
    parseSemver,
    semverCompare,
    fetchLatestRelease,
    checkForUpdates,
    skipVersion,
    setCheckOnStartup,
    resolveTargetWindow,
    sendToWindow,
    CHECK_INTERVAL_MS
};
