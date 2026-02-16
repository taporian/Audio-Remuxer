import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { spawn } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const isDev = process.env.NODE_ENV === "development";

// Get ffmpeg path from bundled binary
function findFFmpeg(): string {
  // The @ffmpeg-installer/ffmpeg package provides the correct binary for each platform
  let ffmpegPath = ffmpegInstaller.path;

  // In production, ffmpeg is unpacked from asar to app.asar.unpacked
  // We need to fix the path if it points to app.asar
  if (ffmpegPath.includes("app.asar")) {
    ffmpegPath = ffmpegPath.replace("app.asar", "app.asar.unpacked");
  }

  return ffmpegPath;
}

// Check audio channel count
async function getAudioChannels(filePath: string): Promise<number> {
  const ffmpegPath = findFFmpeg();
  
  return new Promise((resolve, reject) => {
    // Use ffmpeg (not ffprobe) with -i to get stream info
    const ffmpeg = spawn(ffmpegPath, [
      "-i",
      filePath,
      "-hide_banner"
    ]);

    let output = "";
    
    ffmpeg.stderr.on("data", (data) => {
      output += data.toString();
    });

    ffmpeg.on("close", () => {
      // Look for audio stream info in stderr
      // Example: "Stream #0:1(und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 317 kb/s"
      const channelMatch = output.match(/Audio:.*?(\d+)\s+channels?|Audio:.*?\b(mono|stereo|5\.1|7\.1|quad)/i);
      
      if (channelMatch) {
        // Check for named channel layouts
        const layout = channelMatch[2]?.toLowerCase();
        if (layout === 'mono') {
          resolve(1);
        } else if (layout === 'stereo') {
          resolve(2);
        } else if (layout === 'quad') {
          resolve(4);
        } else if (layout === '5.1') {
          resolve(6);
        } else if (layout === '7.1') {
          resolve(8);
        } else if (channelMatch[1]) {
          resolve(parseInt(channelMatch[1]));
        } else {
          resolve(0);
        }
      } else {
        console.log("Could not detect channels from output:", output);
        resolve(0);
      }
    });

    ffmpeg.on("error", (err) => {
      console.error("FFmpeg error:", err);
      reject("Failed to analyze audio");
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#0e0e0e",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      devTools: isDev, // Only allow dev tools in development
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

// Check audio information
ipcMain.handle("check-audio", async (event, filePath: string) => {
  try {
    const channels = await getAudioChannels(filePath);
    return { channels };
  } catch (error: any) {
    console.error("Failed to check audio:", error);
    return { channels: 0, error: error.message };
  }
});

ipcMain.handle("process-file", async (event, filePath: string) => {
  const output = filePath.replace(/\.(mkv|mp4|avi)$/i, "_FIXED.mkv");

  const ffmpegPath = findFFmpeg();

  // Strategy: Convert existing surround to AC3, preserve stereo as-is
  // - If source has 5.1+ channels: convert to AC3 5.1
  // - If source is stereo: keep it as stereo (don't fake surround)
  // - Always keep original audio as backup
  const args = [
    "-i",
    filePath,
    "-progress",
    "pipe:1",
    // Copy video losslessly
    "-map",
    "0:v",
    "-c:v",
    "copy",
    // Map first audio track and convert to AC3 (preserving channel count)
    "-map",
    "0:a:0",
    "-c:a:0",
    "ac3",
    "-b:a:0",
    "640k", // Maximum AC3 bitrate for best quality
    "-disposition:a:0",
    "default",
    // Keep original audio as track 2 (backup, lossless if possible)
    "-map",
    "0:a:0",
    "-c:a:1",
    "copy",
    "-disposition:a:1",
    "0",
    // Copy subtitles if any (only common formats compatible with MKV)
    "-map",
    "0:s?",
    "-c:s",
    "copy",
    // Strict mode to avoid issues
    "-strict",
    "-2",
    "-y",
    output,
  ];

  return new Promise((resolve, reject) => {
    console.log("Starting FFmpeg with path:", ffmpegPath);
    console.log("Input file:", filePath);
    console.log("Output file:", output);
    console.log("FFmpeg args:", args);

    try {
      const ffmpeg = spawn(ffmpegPath, args);
      let duration = 0;
      let errorOutput = "";

      ffmpeg.on("error", (error) => {
        console.error("FFmpeg spawn error:", error);
        reject(`Failed to start FFmpeg. Error: ${error.message}`);
      });

      ffmpeg.stderr.on("data", (data) => {
        const output = data.toString();
        errorOutput += output;
        console.log("FFmpeg stderr:", output);

        const durationMatch = output.match(
          /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/,
        );
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseInt(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
          console.log("Detected duration:", duration, "seconds");
        }
      });

      ffmpeg.stdout.on("data", (data) => {
        const output = data.toString();
        const timeMatch = output.match(/out_time_ms=(\d+)/);
        if (timeMatch && duration > 0) {
          const currentTime = parseInt(timeMatch[1]) / 1000000;
          const progress = Math.min((currentTime / duration) * 100, 100);
          event.sender.send("process-progress", Math.floor(progress));
        }
      });

      ffmpeg.on("close", (code) => {
        console.log("FFmpeg process closed with code:", code);
        if (code === 0) {
          console.log("Success! Output file:", output);
          resolve(output);
        } else {
          console.error("FFmpeg failed with code:", code);
          console.error("FFmpeg error output:", errorOutput);
          reject(
            `FFmpeg process failed with code ${code}. Error: ${errorOutput.slice(-500)}`,
          );
        }
      });

      ffmpeg.on("error", (error) => {
        console.error("FFmpeg error event:", error);
        reject(error.message);
      });
    } catch (spawnError: any) {
      console.error("Failed to spawn FFmpeg:", spawnError);
      reject(
        `Failed to start FFmpeg: ${spawnError.message}. Path: ${ffmpegPath}`,
      );
    }
  });
});
