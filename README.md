# Audio Remuxer

A simple desktop app that fixes surround sound compatibility issues with video files. **Your video already has 5.1 surround audio, but your device won't play it in surround sound.**

## The Problem This Solves

**The Scenario:**
Your movie file has a beautiful 5.1 surround sound track (DTS, TrueHD, etc.), but when you play it on Apple TV or your smart TV, you only hear stereo (2.0 channel) sound - or worse, no sound at all. This happens because these devices don't support certain audio codecs, even though they CAN play surround sound.

**Why Your Device Downgrades to Stereo:**

- Your video: Has 5.1 surround (DTS, DTS-HD, TrueHD, FLAC, etc.)
- Your Apple TV/Smart TV: Doesn't support these codecs
- Result: Device falls back to stereo or shows "audio not supported"

**What This App Does:**
Converts your existing 5.1 audio into AC3 5.1 format, which IS universally supported by Apple TV, smart TVs, and media players. Your surround sound will finally work!

**⚠️ Important:** This does NOT convert stereo (2.0) to surround (5.1). It preserves your existing surround channels by converting them to a compatible format.

**Perfect for:**

- Movies with DTS or TrueHD that only play in stereo on Apple TV
- Videos showing "audio not supported" errors
- Plex libraries with incompatible surround formats
- Getting surround sound to actually work on your TV

## Features

- 🎬 **Simple drag & drop interface** - No command line needed
- 🔊 **Converts 5.1 to AC3 5.1** - Preserves all surround channels, just changes the codec
- 💾 **Keeps original audio** as backup track
- 📹 **No video re-encoding** - Fast processing, zero quality loss
- 📊 **Real-time progress** - See conversion status
- ✅ **Mac & Windows** - Intel, Apple Silicon, and Windows supported
- 🚀 **Zero setup** - FFmpeg bundled, no installation needed

## Download & Installation

### Mac Users

Download the appropriate DMG for your Mac:

- **Apple Silicon (M1/M2/M3)**: `Audio-Remuxer-*-arm64.dmg`
- **Intel Mac**: `Audio-Remuxer-*-x64.dmg`

Get them from [Releases](https://github.com/taporian/Audio-Remuxer/releases), open the DMG, and drag to Applications.

### Windows Users

Download `Audio-Remuxer-Setup-*.exe` from [Releases](https://github.com/taporian/Audio-Remuxer/releases) and run the installer.

## How to Use

1. Open the app
2. Drag and drop your video file (or click to browse)
3. Click "Convert Audio"
4. Wait for processing (usually 1-2 minutes)
5. Done! Your new file will be in the same folder with `_FIXED.mkv` suffix

## What It Actually Does

The app performs a smart remux operation:

1. **Video**: Copies without re-encoding (preserves 100% quality)
2. **Audio Track 1 (NEW)**: Converts your existing 5.1 surround to AC3 5.1 format at 640k bitrate
   - Takes all 6 channels from your original surround track
   - Converts them to AC3 codec (universally supported)
   - **This is the track your Apple TV/Smart TV will actually play in surround**
3. **Audio Track 2 (Backup)**: Keeps your original surround audio untouched
4. **Subtitles**: Preserves all subtitle tracks
5. **Output**: Creates a new MKV file with `_FIXED` suffix

**Processing time**: Usually 1-2 minutes (vs hours for full re-encoding)

**Why it's fast**: No video re-encoding. Only converts the audio codec while preserving all surround channels.

## Supported Formats

- **Input**: MKV, MP4, AVI
- **Output**: MKV with AC3 5.1 audio

## For Developers

### Setup

```bash
# Clone the repository
git clone https://github.com/taporian/Audio-Remuxer.git
cd Audio-Remuxer

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building

```bash
# Build for current platform
npm run build:mac:arm    # macOS Apple Silicon
npm run build:mac:intel  # macOS Intel
npm run build:win        # Windows
```

### Tech Stack

- **Electron** - Desktop app framework
- **React + TypeScript** - UI development
- **Vite** - Fast build tooling
- **FFmpeg** - Video/audio processing (bundled via @ffmpeg-installer/ffmpeg)

## License

MIT

## Contributing

Issues and pull requests welcome! For major changes, please open an issue first to discuss what you'd like to change.

```

```
