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
});
