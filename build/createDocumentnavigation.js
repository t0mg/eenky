const fs = require('fs');
const path = require('path');
const marked = require('../app/node_modules/marked');

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'app', 'resources', 'Documentation');
const PUBLIC_DOCS_DIR = path.join(ROOT_DIR, 'app', 'renderer', 'public', 'documentation');

const PREFAB_PATH = path.join(DOCS_DIR, 'documentationWindowPrefab.html');
const EENK_MD_PATH = path.join(DOCS_DIR, 'WritingForEenk.md');
const INK_MD_PATH = path.join(DOCS_DIR, 'WritingWithInk.md');
const COMBINED_MD_PATH = path.join(DOCS_DIR, 'CombinedDocumentation.md');
const OUTPUT_HTML_PATH = path.join(PUBLIC_DOCS_DIR, 'window.html');
const CSS_SRC_PATH = path.join(DOCS_DIR, 'documentationWindow.css');
const CSS_DEST_PATH = path.join(PUBLIC_DOCS_DIR, 'documentationWindow.css');

function generateNavigationEntries(markdownContent) {
    const tokens = marked.lexer(markdownContent);
    const renderer = new marked.Renderer();
    const navEntries = [];

    renderer.heading = function (text, level, raw) {
        const id = raw.toLowerCase().replace(/[^\w]+/g, '-');
        navEntries.push({ text, level, raw, id });
        return '';
    };

    marked.parser(tokens, { renderer });
    return navEntries;
}

function initializeNavigation() {
    try {
        const prefabHtml = fs.readFileSync(PREFAB_PATH, 'utf8');
        const [navPrefix, navSuffix] = prefabHtml.split("<!--navigationentries-->");

        const eenkData = fs.readFileSync(EENK_MD_PATH, 'utf8');
        const inkData = fs.readFileSync(INK_MD_PATH, 'utf8');
        const combinedData = eenkData + '\n\n' + inkData;

        // Write the combined markdown to a file for markdown-html to use
        fs.writeFileSync(COMBINED_MD_PATH, combinedData, 'utf8');

        const navEntries = generateNavigationEntries(combinedData);

        let navHtml = '';
        for (const entry of navEntries) {
            navHtml += ` <li><a id="#${entry.id}" href="#" onclick="openPath(this.id); return false;" class="nav-h${entry.level}">${entry.text}</a></li>\n`;
        }

        const fullHtml = navPrefix + navHtml + navSuffix;

        fs.mkdirSync(PUBLIC_DOCS_DIR, { recursive: true });
        fs.writeFileSync(OUTPUT_HTML_PATH, fullHtml, 'utf8');

        if (fs.existsSync(CSS_SRC_PATH)) {
            fs.copyFileSync(CSS_SRC_PATH, CSS_DEST_PATH);
        }

        console.log('Documentation was created');
        return { navEntries, fullHtml };
    } catch (err) {
        console.error('Error generating documentation navigation:', err);
        throw err;
    }
}

if (require.main === module) {
    initializeNavigation();
}

module.exports = {
    generateNavigationEntries,
    initializeNavigation
};