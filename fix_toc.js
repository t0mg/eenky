const fs = require('fs');
const file = 'c:/Users/tomgr/dev/eenk/tools/eenky/app/renderer/public/documentation/window.html';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/onclick="openPath\(this\.id\)"/g, 'href="#" onclick="openPath(this.id); return false;"');
fs.writeFileSync(file, content);
