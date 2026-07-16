# eenky — eenk Story Editor

A forked and heavily extended version of [inkle's Inky](https://github.com/inkle/inky) IDE for authoring, compiling, simulating, and flashing interactive fiction to the **Xteink X4** e-ink device via the **eenk** firmware.

## ✨ Features & Differences from original Inky

eenky completely overhauls the original Inky architecture to support modern development, better usability, and deep hardware integration:

- **Modernized UI Engine**: The entire frontend has been rewritten in **Vue 3** (replacing legacy Vanilla JS/jQuery), giving eenky a much snappier, reactive, and responsive interface.
- **Improved Authoring Tools**: 
  - An enhanced **Knot Browser** that distinctly categorizes Knots, Stitches, and Functions with unique iconography.
  - A fast **Goto Anything (`Ctrl+P` / `Cmd+P`)** popup for instantly jumping across project files and symbols.
  - Better view controls, including a Line Wrap toggle and refined Light/Dark themes.
- **Embedded SDL Simulator**: Contains a pixel-accurate e-ink preview of the Xteink X4 hardware, compiled directly from the eenk firmware.
- **One-Click Flashing**: Seamlessly flash compiled stories directly to your ESP32-based hardware via USB using the built-in Web Serial tool.
- **Hardware Compilation Pipeline**: Retains `inklecate` for compiling `.ink` to `.json`, but automatically passes the output to the custom `inkcpp_cl` compiler to produce the `.bin` format required by the hardware.

## What's included

| Tab | What it does |
|-----|-------------|
| **Editor** | Full-featured Ink script editor, overhauled with Vue 3 and CodeMirror |
| **Compile** | Compiles `.ink` → `.json` → `.bin` using inklecate + inkcpp_cl |
| **Simulate** | Runs the story in the native SDL simulator (pixel-accurate e-ink preview built from eenk) |
| **Flash** | Flashes the compiled firmware to the Xteink X4 via USB using ESP Web Tools |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [PlatformIO](https://platformio.org/) — for building the SDL simulator backend
- [MSYS2 / MinGW-w64](https://www.msys2.org/) with SDL2 — Windows only, for the simulator build

## Getting Started

> [!NOTE]  
> The instructions below are generally **platform-agnostic**, however building native backends (step 2 & 3) require different toolchains depending on your OS. The CMake `-G "MinGW Makefiles"` flag in step 3 is Windows-specific; on macOS or Linux, omit that flag.

```sh
# 1. Clone with submodules
git clone --recurse-submodules https://github.com/t0mg/eenky.git
cd eenky

# 2. Build the SDL simulator backend
#    (Windows: requires MSYS2/MinGW in PATH)
cd eenk
pio run -e native
cd ..

# 3. Build the inkcpp_cl compiler backend
#    (Mac/Linux: Omit the -G "MinGW Makefiles" flag)
cd inkcpp
cmake -B build -G "MinGW Makefiles" -DCMAKE_EXE_LINKER_FLAGS="-static"
cmake --build build --config Release
cd ..

# 4. Install Node dependencies
cd app
npm install
cd renderer
npm install
cd ..

# 5. Copy binaries into place & setup
npm run setup

# 6. Launch eenky
npm start
```

### Development Mode

```sh
cd app
npm start
```
*Note: `npm start` in the `app` folder uses `concurrently` to automatically start the Vite dev server and then open the Electron main process connected to it.*

### Running Unit Tests

eenky unit tests use `mocha` to verify core package structures and main process utilities (replacing the deprecated Spectron E2E tests). Run them from the `app` folder:
```sh
cd app
npm run test
```

## Packaging for Production

eenky uses `electron-builder` to create distributable installers and binaries. To build a production package:

```sh
# 1. Build the Vue renderer
cd app/renderer
npm run build
cd ..

# 2. Package the app
#    This creates the installer for your current operating system
npm run dist
```
The output installers will be placed in the `dist-eenky` folder located at the root level of the project.

## Submodule Architecture

eenk and eenky work in tandem:
- The parent project is `eenk` (the firmware).
- It embeds `eenky` as a submodule to provide an authoring IDE.
- `eenky` in turn embeds `eenk` and `inkcpp` as submodules to compile the `eenk-sim.exe` and `inkcpp_cl.exe` backends for the simulation and compile tabs.

| Path | Repository | Purpose |
|------|-----------|---------|
| `eenk/` | [t0mg/eenk](https://github.com/t0mg/eenk) | eenk firmware source — used to build the SDL simulator backend (`eenk-sim`) |
| `inkcpp/` | [t0mg/inkcpp](https://github.com/t0mg/inkcpp) | Custom C++ Ink runtime — used to build the `inkcpp_cl` compiler backend |

## Binary Resolution

The Electron main process looks for these binaries in `app/main-process/ink/<platform>/`:

| Binary | Source |
|--------|--------|
| `inklecate_*` | Bundled (from original Inky fork, converts `.ink` to `.json`) |
| `inkcpp_cl` | Built from `inkcpp/` submodule (converts `.json` to `.bin`) |
| `eenk-sim` | Built from `eenk/` submodule via PlatformIO (`pio run -e native`) |

Running `npm run setup` automatically builds (if needed) and copies these binaries into place.

## Flashing Firmware

The Flash tab uses [ESP Web Tools](https://esphome.github.io/esp-web-tools/) to flash the device directly from the browser/Electron app over Web Serial. It requires a merged factory binary produced by the `merge_firmware.py` post-build script in the `eenk` repo. 

To build the hardware firmware:
```sh
cd eenk
pio run -e esp32c3
```
This produces `eenk/.pio/build/esp32c3/firmware-factory.bin` which the Flash tab picks up.

## License

MIT — see [LICENSE](LICENSE).  
Based on [inkle/inky](https://github.com/inkle/inky) © inkle Ltd (MIT).
