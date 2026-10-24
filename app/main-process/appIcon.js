const path = require('path');
const fs = require('fs');

/**
 * Resolves the application window icon path across development and packaged builds.
 * On Windows, returns a .ico if available; on Linux/macOS, returns a high-resolution PNG.
 */
const defaultIconPath = (() => {
    // 1. Windows: prefer .ico
    if (process.platform === 'win32') {
        const icoCandidates = [
            path.join(__dirname, '../../resources/icon.ico'),
            process.resourcesPath ? path.join(process.resourcesPath, 'icon.ico') : null,
            process.resourcesPath ? path.join(path.dirname(process.resourcesPath), 'icon.ico') : null,
        ].filter(Boolean);
        for (const candidate of icoCandidates) {
            try {
                if (fs.existsSync(candidate)) return candidate;
            } catch (e) {}
        }
    }

    // 2. High-resolution PNG candidates (Linux & Windows fallback)
    const pngCandidates = [
        // Development from repo root
        path.join(__dirname, '../../resources/icon.png'),
        path.join(__dirname, '../../resources/Icon512.png'),
        // Extra file in application root directory (packaged)
        process.resourcesPath ? path.join(path.dirname(process.resourcesPath), 'icon.png') : null,
        process.resourcesPath ? path.join(process.resourcesPath, 'icon.png') : null,
        // High-res icon always bundled in renderer (works inside app.asar)
        path.join(__dirname, '../renderer/public/about/icon256.png'),
        path.join(__dirname, '../renderer/dist/about/icon256.png'),
        // Favicon fallbacks
        path.join(__dirname, '../renderer/public/assets/favicon.png'),
        path.join(__dirname, '../renderer/dist/assets/favicon.png'),
    ].filter(Boolean);

    for (const candidate of pngCandidates) {
        try {
            if (fs.existsSync(candidate)) return candidate;
        } catch (e) {}
    }

    return undefined;
})();

module.exports = { defaultIconPath };
