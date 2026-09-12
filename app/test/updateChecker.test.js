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
    });
});
