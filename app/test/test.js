const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
