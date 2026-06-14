# EENKY — EENK Story Editor

A forked and extended version of [inkle's Inky](https://github.com/inkle/inky) IDE for authoring, compiling, simulating, and flashing interactive fiction to the **Xteink X4** e-ink device.

## What's included

| Tab | What it does |
|-----|-------------|
| **Editor** | Full-featured Ink script editor (from Inky) |
| **Compile** | Compiles `.ink` → `.json` → `.bin` using inklecate + inkcpp_cl |
| **Simulate** | Runs the story in the native SDL simulator (pixel-accurate e-ink preview) |
| **Flash** | Flashes firmware to the Xteink X4 via USB using ESP Web Tools |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [PlatformIO](https://platformio.org/) — for building the SDL simulator
- [MSYS2 / MinGW-w64](https://www.msys2.org/) with SDL2 — Windows only, for the simulator build

## Getting started

```sh
# 1. Clone with submodules
git clone --recurse-submodules https://github.com/t0mg/eenky.git
cd eenky

# 2. Install Node dependencies
cd app && npm install

# 3. Build the SDL simulator from the eenk firmware submodule
#    (Windows: make sure C:\msys64\mingw64\bin is in your PATH first)
cd ../eenk
pio run -e native
cd ..

# 4. Copy binaries into place
npm run setup

# 5. Launch
npm start
```

## Submodules

| Path | Repository | Purpose |
|------|-----------|---------|
| `eenk/` | [t0mg/eenk](https://github.com/t0mg/eenk) | Firmware source — used to build the SDL simulator |
| `inkcpp/` | [JBenda/inkcpp](https://github.com/JBenda/inkcpp) | C++ Ink runtime — used to build `inkcpp_cl` |

## Binary resolution

The Electron main process looks for binaries in `app/main-process/ink/<platform>/`:

| Binary | Source |
|--------|--------|
| `inklecate_*` | Bundled (from original Inky fork) |
| `inkcpp_cl` | Built from `inkcpp/` submodule |
| `eenk-sim` | Built from `eenk/` submodule via PlatformIO |

Run `npm run setup` to copy the built binaries into place after building.

## Flashing firmware

The Flash tab uses [ESP Web Tools](https://esphome.github.io/esp-web-tools/) and requires a merged factory binary produced by the `merge_firmware.py` post-build script in the `eenk` repo. Build the firmware with:

```sh
cd eenk
pio run -e esp32c3
# Merged binary: eenk/.pio/build/esp32c3/firmware-factory.bin
```

## License

MIT — see [LICENSE](LICENSE).  
Based on [inkle/inky](https://github.com/inkle/inky) © inkle Ltd (MIT).
