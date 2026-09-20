const assert = require('assert');
const {
    cleanVersion,
    parseSemver,
    semverCompare
} = require('../main-process/updateChecker.js');

describe('updateChecker', function () {
    describe('cleanVersion', function () {
        it('should strip leading v and whitespace', function () {
            assert.strictEqual(cleanVersion('v0.2.2'), '0.2.2');
            assert.strictEqual(cleanVersion('V1.0.0 '), '1.0.0');
            assert.strictEqual(cleanVersion(' 0.2.2 '), '0.2.2');
            assert.strictEqual(cleanVersion(''), '');
            assert.strictEqual(cleanVersion(null), '');
        });
    });

    describe('parseSemver', function () {
        it('should parse standard versions', function () {
            const p = parseSemver('0.2.2');
            assert.strictEqual(p.major, 0);
            assert.strictEqual(p.minor, 2);
            assert.strictEqual(p.patch, 2);
            assert.strictEqual(p.prerelease, null);
        });

        it('should parse prerelease versions', function () {
            const p = parseSemver('v1.0.0-beta.1');
            assert.strictEqual(p.major, 1);
            assert.strictEqual(p.minor, 0);
            assert.strictEqual(p.patch, 0);
            assert.strictEqual(p.prerelease, 'beta.1');
        });

        it('should return null for invalid strings', function () {
            assert.strictEqual(parseSemver('invalid'), null);
            assert.strictEqual(parseSemver(''), null);
        });
    });

    describe('semverCompare', function () {
        it('should detect when newer patch version is greater', function () {
            assert.ok(semverCompare('0.2.3', '0.2.2') > 0);
            assert.ok(semverCompare('0.2.2', '0.2.3') < 0);
        });

        it('should detect when newer minor version is greater', function () {
            assert.ok(semverCompare('0.3.0', '0.2.9') > 0);
            assert.ok(semverCompare('0.2.9', '0.3.0') < 0);
        });

        it('should detect when newer major version is greater', function () {
            assert.ok(semverCompare('1.0.0', '0.9.9') > 0);
            assert.ok(semverCompare('0.9.9', '1.0.0') < 0);
        });

        it('should consider equal versions as 0', function () {
            assert.strictEqual(semverCompare('0.2.2', '0.2.2'), 0);
            assert.strictEqual(semverCompare('v0.2.2', '0.2.2'), 0);
            assert.strictEqual(semverCompare('0.2.2', 'v0.2.2'), 0);
        });

        it('should give standard release higher precedence than prerelease', function () {
            assert.ok(semverCompare('0.2.3', '0.2.3-beta.1') > 0);
            assert.ok(semverCompare('0.2.3-beta.1', '0.2.3') < 0);
        });

        it('should compare prereleases lexicographically', function () {
            assert.ok(semverCompare('0.2.3-beta.2', '0.2.3-beta.1') > 0);
            assert.ok(semverCompare('0.2.3-beta.1', '0.2.3-beta.2') < 0);
        });
    });

    describe('checkForUpdates', function () {
        const { checkForUpdates } = require('../main-process/updateChecker.js');

        it('should identify newer release and notify target window', async function () {
            let sentChannel = null;
            let sentPayload = null;
            const mockWin = {
                browserWindow: {
                    isDestroyed: () => false,
                    webContents: {
                        send: (channel, payload) => {
                            sentChannel = channel;
                            sentPayload = payload;
                        }
                    }
                }
            };

            const mockRelease = {
                tag_name: 'v99.0.0',
                name: 'eenky 99.0.0',
                body: 'Exciting new features',
                html_url: 'https://github.com/t0mg/eenky/releases/tag/v99.0.0',
                published_at: '2026-09-12T00:00:00Z'
            };

            const result = await checkForUpdates({
                isStartup: false,
                win: mockWin,
                fetchFn: async () => mockRelease
            });

            assert.strictEqual(result.hasUpdate, true);
            assert.strictEqual(result.updateInfo.latestVersion, '99.0.0');
            assert.strictEqual(sentChannel, 'update-available');
            assert.strictEqual(sentPayload.latestVersion, '99.0.0');
            assert.strictEqual(sentPayload.releaseNotes, 'Exciting new features');
        });

        it('should notify up-to-date if no newer release is found', async function () {
            let sentChannel = null;
            let sentPayload = null;
            const mockWin = {
                browserWindow: {
                    isDestroyed: () => false,
                    webContents: {
                        send: (channel, modalType, payload) => {
                            sentChannel = channel;
                            sentPayload = payload;
                        }
                    }
                }
            };

            const mockRelease = {
                tag_name: 'v0.0.1',
                name: 'eenky 0.0.1'
            };

            const result = await checkForUpdates({
                isStartup: false,
                win: mockWin,
                fetchFn: async () => mockRelease
            });

            assert.strictEqual(result.hasUpdate, false);
            assert.strictEqual(sentChannel, 'show-modal');
            assert.strictEqual(sentPayload.title, 'eenky is Up to Date');
        });

        it('should handle fetch failure gracefully during manual check', async function () {
            let sentChannel = null;
            let sentPayload = null;
            const mockWin = {
                browserWindow: {
                    isDestroyed: () => false,
                    webContents: {
                        send: (channel, modalType, payload) => {
                            sentChannel = channel;
                            sentPayload = payload;
                        }
                    }
                }
            };

            const result = await checkForUpdates({
                isStartup: false,
                win: mockWin,
                fetchFn: async () => { throw new Error('Network error'); }
            });

            assert.strictEqual(result.error, 'Network error');
            assert.strictEqual(sentChannel, 'show-modal');
            assert.strictEqual(sentPayload.title, 'Update Check Failed');
        });

        it('should prompt on startup if pendingUpdate is newer even if recently checked', async function () {
            let settingsStore = {
                lastUpdateCheck: Date.now(), // checked just now
                pendingUpdate: {
                    currentVersion: '0.2.2',
                    latestVersion: '0.2.4',
                    releaseName: 'v0.2.4',
                    releaseNotes: 'Some notes',
                    releaseUrl: 'https://github.com/t0mg/eenky/releases/tag/v0.2.4',
                    publishedAt: '2026-09-17T22:25:14Z'
                }
            };

            let sentChannel = null;
            let sentPayload = null;
            const mockWin = {
                browserWindow: {
                    isDestroyed: () => false,
                    webContents: {
                        send: (channel, payload) => {
                            sentChannel = channel;
                            sentPayload = payload;
                        }
                    }
                }
            };

            const result = await checkForUpdates({
                isStartup: true,
                win: mockWin,
                settings: settingsStore,
                updateSettingFn: (k, v) => { settingsStore[k] = v; }
            });

            assert.strictEqual(result.hasUpdate, true);
            assert.strictEqual(result.fromCache, true);
            assert.strictEqual(sentChannel, 'update-available');
            assert.strictEqual(sentPayload.latestVersion, '0.2.4');
        });

        it('should not prompt on startup if pendingUpdate version was skipped', async function () {
            let settingsStore = {
                lastUpdateCheck: Date.now(),
                skippedUpdateVersion: '0.2.4',
                pendingUpdate: {
                    currentVersion: '0.2.2',
                    latestVersion: '0.2.4'
                }
            };

            let sentChannel = null;
            const mockWin = {
                browserWindow: {
                    isDestroyed: () => false,
                    webContents: {
                        send: (channel) => { sentChannel = channel; }
                    }
                }
            };

            const result = await checkForUpdates({
                isStartup: true,
                win: mockWin,
                settings: settingsStore,
                updateSettingFn: (k, v) => { settingsStore[k] = v; }
            });

            assert.strictEqual(result.skipped, true);
            assert.strictEqual(sentChannel, null);
        });

        it('should clear pendingUpdate when app version matches or exceeds it', async function () {
            let settingsStore = {
                lastUpdateCheck: Date.now(),
                pendingUpdate: {
                    currentVersion: '0.2.2',
                    latestVersion: '0.2.2' // same as currentVersion fallback 0.2.2
                }
            };

            const result = await checkForUpdates({
                isStartup: true,
                settings: settingsStore,
                updateSettingFn: (k, v) => { settingsStore[k] = v; }
            });

            assert.strictEqual(result.skipped, true);
            assert.strictEqual(settingsStore.pendingUpdate, null);
        });

        it('should clear pendingUpdate when skipVersion is called for that version', function () {
            const { skipVersion } = require('../main-process/updateChecker.js');

            let settingsStore = {
                pendingUpdate: {
                    latestVersion: '0.2.4'
                }
            };

            skipVersion('v0.2.4', settingsStore, (k, v) => { settingsStore[k] = v; });
            assert.strictEqual(settingsStore.skippedUpdateVersion, '0.2.4');
            assert.strictEqual(settingsStore.pendingUpdate, null);
        });
    });
});


