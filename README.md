# EENKY — EENK Story Editor

A forked and extended version of [inkle's Inky](https://github.com/inkle/inky) IDE for authoring, compiling, simulating, and flashing interactive fiction to the **Xteink X4** e-ink device via the **EENK** firmware.

## What's included

| Tab | What it does |
|-----|-------------|
| **Editor** | Full-featured Ink script editor (from Inky) |
| **Compile** | Compiles `.ink` → `.json` → `.bin` using inklecate + inkcpp_cl |
| **Simulate** | Runs the story in the native SDL simulator (pixel-accurate e-ink preview built from EENK) |
| **Flash** | Flashes the compiled firmware to the Xteink X4 via USB using ESP Web Tools |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [PlatformIO](https://platformio.org/) — for building the SDL simulator backend
- [MSYS2 / MinGW-w64](https://www.msys2.org/) with SDL2 — Windows only, for the simulator build

## Getting Started

```sh
# 1. Clone with submodules
git clone --recurse-submodules https://github.com/t0mg/eenky.git
cd eenky

# 2. Install Node dependencies
cd app && npm install

# 3. Build the SDL simulator backend
#    (Windows: make sure C:\msys64\mingw64\bin is in your PATH first for the native build)
cd ../eenk
pio run -e native
cd ..

# 4. Build the inkcpp_cl compiler backend
cd inkcpp
cmake -B build -G "MinGW Makefiles"
cmake --build build --config Release
cd ..

# 5. Copy binaries into place
cd app
npm run setup

# 6. Launch EENKY
npm start
```

## Submodule Architecture

EENK and EENKY work in tandem:
- The parent project is `eenk` (the firmware).
- It embeds `eenky` as a submodule to provide an authoring IDE.
- `eenky` in turn embeds `eenk` and `inkcpp` as submodules to compile the `eenk-sim.exe` and `inkcpp_cl.exe` backends for the simulation and compile tabs.

| Path | Repository | Purpose |
|------|-----------|---------|
| `eenk/` | [t0mg/eenk](https://github.com/t0mg/eenk) | EENK firmware source — used to build the SDL simulator backend (`eenk-sim`) |
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
