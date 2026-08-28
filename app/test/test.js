const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { generateNavigationEntries, initializeNavigation } = require('../../build/createDocumentnavigation.js');

describe('eenk Editor basic tests', function () {
  it('should have a package.json with correct name', function () {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.strictEqual(pkg.name, 'eenky');
  });

  it('should have a main entry point', function () {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const mainPath = path.join(__dirname, '..', pkg.main);
    assert.strictEqual(fs.existsSync(mainPath), true);
  });

  it('should include @cover and @thumbnail in eenk metadata snippet', function () {
    const snippets = require('../main-process/inkSnippets.js').snippets;
    const eenkCategory = snippets.find(c => c.categoryName === 'eenk' || (c.snippets && c.snippets.some(s => s.name && s.name.includes('Metadata'))));
    assert.ok(eenkCategory, 'eenk category found');
    const metadataSnippet = eenkCategory.snippets.find(s => s.name && s.name.includes('Metadata'));
    assert.ok(metadataSnippet, 'Metadata snippet found');
    assert.ok(metadataSnippet.ink.includes('@cover'), 'includes @cover');
    assert.ok(metadataSnippet.ink.includes('@thumbnail'), 'includes @thumbnail');
    assert.ok(metadataSnippet.ink.includes('@title'), 'includes @title');
    assert.ok(metadataSnippet.ink.includes('@author'), 'includes @author');
    assert.ok(metadataSnippet.ink.includes('@font'), 'includes @font');
  });
});

describe('Documentation navigation parser', function () {
  it('should correctly parse headings with backquoted # and determine level from leading #', function () {
    const md = `
# Main Header
## Section One
### Checkpoints (\`# CHECKPOINT\`)
### Chapters (\`# CHECKPOINT: <Title>\`)
#### Sub-item with \`#tag\` and \`#another\`
`;
    const entries = generateNavigationEntries(md);
    assert.strictEqual(entries.length, 5);

    assert.strictEqual(entries[0].level, 1);
    assert.strictEqual(entries[0].id, 'main-header');

    assert.strictEqual(entries[1].level, 2);
    assert.strictEqual(entries[1].id, 'section-one');

    assert.strictEqual(entries[2].level, 3);
    assert.strictEqual(entries[2].id, 'checkpoints-checkpoint-');
    assert.ok(entries[2].text.includes('<code># CHECKPOINT</code>'));

    assert.strictEqual(entries[3].level, 3);
    assert.strictEqual(entries[3].id, 'chapters-checkpoint-title-');
    assert.ok(entries[3].text.includes('&lt;Title&gt;'));

    assert.strictEqual(entries[4].level, 4);
  });

  it('should ignore headings inside code blocks', function () {
    const md = `
## Real Heading
\`\`\`ink
# CHECKPOINT
### Not a real heading
\`\`\`
### Another Real Heading
`;
    const entries = generateNavigationEntries(md);
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].text, 'Real Heading');
    assert.strictEqual(entries[1].text, 'Another Real Heading');
  });

  it('should match all window.html navigation IDs with embedded.html anchors', function () {
    const windowHtmlPath = path.join(__dirname, '..', 'renderer', 'public', 'documentation', 'window.html');
    const embeddedHtmlPath = path.join(__dirname, '..', 'renderer', 'public', 'documentation', 'embedded.html');

    assert.ok(fs.existsSync(windowHtmlPath), 'window.html exists');
    assert.ok(fs.existsSync(embeddedHtmlPath), 'embedded.html exists');

    const windowHtml = fs.readFileSync(windowHtmlPath, 'utf8');
    const embeddedHtml = fs.readFileSync(embeddedHtmlPath, 'utf8');

    // Extract all a id="#..." from window.html
    const idRegex = /<a id="#([^"]+)"[^>]*class="nav-h(\d+)"/g;
    let match;
    let count = 0;

    while ((match = idRegex.exec(windowHtml)) !== null) {
      const id = match[1];
      const level = match[2];
      count++;

      // Each ID must exist in embedded.html as <hX id="...">
      const expectedAnchor = `id="${id}"`;
      assert.ok(
        embeddedHtml.includes(expectedAnchor),
        `Anchor id="${id}" from window.html (level ${level}) not found in embedded.html`
      );
    }

    assert.ok(count > 100, `Expected > 100 navigation items, found ${count}`);
  });
});

describe('eenk Package (.eenk ZIP) creation', function () {
  const { createEenkPackage, crc32 } = require('../main-process/eenkPackage.js');
  const os = require('os');

  it('should calculate crc32 correctly', function () {
    const data = Buffer.from('hello eenk', 'utf8');
    const crc = crc32(data);
    assert.strictEqual(typeof crc, 'number');
    assert.ok(crc > 0);
  });

  it('should create a valid .eenk ZIP package containing binary and sidecars', function () {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eenk-test-'));
    const pkgPath = path.join(tmpDir, 'test_story.eenk');

    const fakeBin = Buffer.alloc(128 + 50);
    fakeBin.write('eenk', 0, 4, 'ascii'); // magic
    fakeBin.writeUInt16LE(1, 4); // version
    fakeBin.write('Test Title', 8, 63, 'utf8');
    fakeBin.write('Test Author', 72, 31, 'utf8');

    const fakeMedia = Buffer.from('ENKM\x01\x00\x00\x00', 'binary');

    const files = [
      { name: 'test_story.bin', content: fakeBin },
      { name: 'test_story.media', content: fakeMedia }
    ];

    createEenkPackage(pkgPath, files);
    assert.ok(fs.existsSync(pkgPath), 'package file exists');
    assert.ok(fs.statSync(pkgPath).size > 100, 'package file has non-trivial size');

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

