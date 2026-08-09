# eenky IDE Credits

The **eenky** authoring environment and developer tools are built upon the following open-source software projects and tools:

## Editor

- **[Inky](https://github.com/inkle/inky)** - Created by [inkle Ltd.](https://www.inklestudios.com/). The original Ink editor upon which `eenky` is forked and extended. It all started here.
- **[CodeMirror 6](https://codemirror.net/)** - Developed by Marijn Haverbeke. Extensible code editor component powering the Ink syntax editing experience.
- **[codemirror-lang-ink](https://github.com/mavnn/codemirror-lang-ink)** - [Michael Newton](https://github.com/mavnn). Ink language support for CodeMirror, and the reason why I chose to modernize Inky with CodeMirror.

## Story compilation pipeline

- **[inklecate](https://github.com/inkle/ink)** - By [inkle Ltd](https://www.inklestudios.com/). Official Ink script compiler (`.ink` → `.json`).
- **[inkcpp_cl](https://github.com/JBenda/inkcpp)** - Developed by [JBenda](https://github.com/JBenda). Ink C++ runtime with `.json` → `.bin` compiler ([forked and lightly patched](https://github.com/t0mg/inkcpp) to accommodate project needs). This project made eenk possible, thank you!
- **[epdiy fontconvert](https://github.com/vroland/epdiy)** - Created by [Valentin Roland](https://github.com/vroland) & extended by [Pavel Liashkov](https://github.com/bigbag) for [Papyrix](https://github.com/bigbag/papyrix-reader). It's a font conversion script (`fontconvert.py`) that converts `.ttf`/`.otf` fonts into the binary `.epdfont` format used in the renderer.

## Other building blocks

- **[Electron](https://www.electronjs.org/)** - OpenJS Foundation / GitHub. Cross-platform desktop application framework.
- **[esptool-js](https://github.com/espressif/esptool-js)** - In-browser and Electron USB serial device manager and flasher.
- **[Vue.js 3](https://vuejs.org/)** - By Evan You and the Vue core team. Progressive reactive frontend framework powering the modernized UI.
- **[Vite](https://vitejs.dev/)** - Also by Evan You and the Vite core team. Fast frontend build tooling.
- **[Pinia](https://pinia.vuejs.org/)** - By Eduardo San Martin Morote. Intuitive state management store for Vue 3.
- **[Material Symbols Outlined](https://fonts.google.com/icons)** - Google. Icon font powering interface icons across the eenky IDE and web tools.
