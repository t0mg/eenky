# eenky - the eenk Story Editor

A forked and heavily modified version of [inkle's Inky](https://github.com/inkle/inky) IDE for authoring, compiling, simulating, and flashing interactive fiction to Xteink e-ink devices running the [eenk firmware](https://github.com/t0mg/eenk).

> [!TIP]
> If you are interested in installing and using eenky rather than looking at its development, check out the [eenk website](https://t0mg.github.io/eenk/)!

## Download and install eenky

Eenky can be installed either by:
- Downloading the latest release from the [Releases page](https://github.com/t0mg/eenky/releases).
- Building it from source as described in the [Getting Started](#getting-started) section.

### Note for macOS Users ("Damaged App" Error)
Because eenky is currently distributed as an unsigned application, macOS Gatekeeper will automatically quarantine the downloaded `.dmg` or `.zip` and falsely report that *"eenky is damaged and can't be opened. You should move it to the Trash."*

To bypass this security feature:
1. Move the `eenky.app` to your Applications folder.
2. Open your Terminal.
3. Run `xattr -cr /Applications/eenky.app`
This removes the quarantine flag and allows macOS to open the app normally.

## Features & Differences from Original Inky

eenky started as a hack to help develop [eenk](https://github.com/t0mg/eenk), and evolved into a comprehensive authoring environment for e-ink devices:

- **Modernized UI Engine**: Built on **Vue 3** and **CodeMirror 6** with custom Ink language support.
- **Rich Authoring Tools**:
  - **Live Preview**: Real-time story playback with interactive choice testing.
  - **Knot Browser**: Categorizes Knots, Stitches, and Functions with dedicated iconography.
  - **Goto Anything (`Ctrl+P` / `Cmd+P`)**: Instant navigation across project files and symbols.
  - **Search & Includes**: Universal project search and include file management.
  - **View Controls & Themes**: Line wrap toggle and built-in Light/Dark themes.
  - **Embedded Documentation**: Searchable documentation window covering Ink syntax and eenk-specific authoring (metadata, fonts, image tags).
- **One-Click, eenk-specific Compilation Pipeline**: Converts `.ink` to `.json` via `inklecate`, then to binary via `inkcpp_cl` for hardware execution on eenk. Automatically converts `.ttf` fonts to `.epdfont` format, dithers and packs image assets into `.media`, and bundles everything into a single `.eenk` package file (also supports standard Web export).
- **Embedded Desktop Simulator**: Pixel-accurate e-ink preview of the 800×480 display compiled directly from the `eenk` firmware (SDL2 backend).
- **USB Device Manager**: Transfer stories, fonts, and save games directly to the device via Web Serial without removing the SD card.
- **Firmware Flasher**: Wizard-style firmware installer for updating hardware over USB.

## Prerequisites

To build and run eenky from source, ensure you have installed:

| Tool | Required For | Notes |
|------|-------------|-------|
| [Git](https://git-scm.com/) and [Git LFS](https://git-lfs.com/) | All | Must clone recursively (`--recurse-submodules`). Git LFS is required for binaries like `inklecate`. |
| [Node.js 18+](https://nodejs.org/) | IDE desktop app | LTS recommended (Note: cutting-edge Node versions like v26 may have bugs with `electron` installation scripts) |
| [Python 3.8+](https://www.python.org/) & [PlatformIO Core](https://docs.platformio.org/) | Desktop simulator | `pip install platformio` |
| [MinGW-w64 / g++](https://www.msys2.org/) (Windows) or GCC/Clang (macOS/Linux) | Simulator & compiler build | MSYS2 with SDL2 recommended on Windows |
| [CMake](https://cmake.org/) | `inkcpp_cl` binary compiler | Required by `npm run setup` |

### macOS Quick Setup (Fresh Install)

If you are setting up eenky on a fresh Mac, install the following via [Homebrew](https://brew.sh/):

```bash
# 1. Install required build dependencies and git-lfs
brew install cmake sdl2-compat git-lfs

# 2. Initialize Git LFS
git lfs install
```

> [!WARNING]
> If you cloned the repository *before* installing `git-lfs`, you must run `git lfs pull` inside the `eenky` directory to fetch the actual binaries (otherwise `inklecate` will fail to run with a system format error).

## Getting Started

```powershell
# 1. Clone with submodules
git clone --recurse-submodules https://github.com/t0mg/eenky.git
cd eenky/app

# 2. Install dependencies & run setup
#    npm run setup automatically pulls, compiles, and copies 
#    the eenk-sim and inkcpp_cl binaries into place
npm install
npm run setup

cd renderer
npm install

# 3. Launch eenky in development mode
cd ..
npm start
```

> [!TIP]
> **Submodule Development**: `npm run setup` pulls from `eenk` HEAD and compiles the binaries. If you have local uncommitted changes in the `eenk/` submodule that you want to test in the simulator, build the native target manually in `eenk/` and copy the binary directly to `app/main-process/ink/<platform>/eenk-sim.exe` (or `eenk-sim` on Linux/macOS):
> ```powershell
> cd ../eenk
> pio run -e native
> Copy-Item -Path ".pio\build\native\program.exe" -Destination "..\app\main-process\ink\win\eenk-sim.exe" -Force
> ```

### Development Mode

Starting the app in dev mode uses `concurrently` to run the Vite dev server for the renderer while launching Electron attached to `http://localhost:5173/`:

```powershell
cd app
npm start
```

### Running Unit Tests

eenky has test suites for both backend and frontend components:

- **Backend tests (Mocha)**, main process utilities and story compilation:
  ```powershell
  cd app
  npm run test
  ```
- **Frontend tests (Vitest)**, Vue 3 components and state stores:
  ```powershell
  cd app/renderer
  npm run test
  ```

## Packaging for Production

eenky uses `electron-builder` to create distributable installers and binaries.

```powershell
# 1. Build the Vue renderer
cd app/renderer
npm run build
cd ..

# 2. Package the app for your platform
npm run dist
```

Output installers are generated in the `dist-eenky/` directory at the project root.

## Submodule Architecture

eenk and eenky work in tandem:
- The primary firmware repository is [eenk](https://github.com/t0mg/eenk).
- `eenky` embeds `eenk` and `inkcpp` as submodules to compile the `eenk-sim` and `inkcpp_cl` binaries.

| Path | Repository | Purpose |
|------|-----------|---------|
| `eenk/` | [t0mg/eenk](https://github.com/t0mg/eenk) | Firmware source, compiled to produce the SDL simulator backend (`eenk-sim`) |
| `inkcpp/` | [t0mg/inkcpp](https://github.com/t0mg/inkcpp) | Custom C++ Ink runtime, compiled to produce the `inkcpp_cl` binary compiler |

## Binary Resolution

The Electron main process resolves platform-specific binaries from `app/main-process/ink/<platform>/`:

| Binary | Source | Purpose |
|--------|--------|---------|
| `inklecate_*` | Bundled (from Inky fork) | Compiles `.ink` source to `.json` |
| `inkcpp_cl` | Built from `inkcpp/` submodule | Compiles `.json` to compact binary `.bin` for hardware |
| `eenk-sim` | Built from `eenk/` submodule via PlatformIO (`pio run -e native`) | Pixel-accurate SDL e-ink simulator |

Running `npm run setup` automatically builds (if needed) and copies these binaries, as well as documentation assets and web tools, into their expected locations.

## Flashing Firmware

The Flash tab uses [ESP Web Tools](https://esphome.github.io/esp-web-tools/) to flash firmware directly over Web Serial. It uses factory merged binaries (`firmware-factory.bin`).

To build hardware firmware from the `eenk` submodule:
```powershell
cd eenk
pio run -e esp32c3        # For X3 / X4 hardware
pio run -e esp32s3        # For X4 Pro hardware
```

## Credits & Acknowledgments

eenky is built upon inkle's Inky IDE and numerous open-source tools and libraries. See [credits.md](credits.md) for details.

## License

MIT; see [LICENSE](LICENSE).  
Based on [inkle/inky](https://github.com/inkle/inky) © inkle Ltd (MIT).

