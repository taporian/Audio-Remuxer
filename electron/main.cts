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

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#0e0e0e",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Allow opening dev tools in production with Cmd+Option+I (Mac) or Ctrl+Shift+I (Win)
  win.webContents.on("before-input-event", (event, input) => {
    if (
      (input.meta && input.alt && input.key === "i") ||
      (input.control && input.shift && input.key === "I")
    ) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

app.whenReady().then(createWindow);

ipcMain.handle("process-file", async (event, filePath: string) => {
  const output = filePath.replace(/\.(mkv|mp4|avi)$/i, "_FIXED.mkv");

  const ffmpegPath = findFFmpeg();

  // Best quality strategy:
  // - Keep original audio as backup
  // - Add AC3 5.1 at 640k (industry standard, max quality for AC3)
  // - If source is already 5.1, convert to AC3 for compatibility
  // - If source is stereo, properly copy it (don't fake 5.1)
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
    // Map first audio track and convert to AC3 5.1 at maximum quality
    "-map",
    "0:a:0",
    "-c:a:0",
    "ac3",
    "-b:a:0",
    "640k", // Maximum AC3 bitrate for best quality
    "-ac:a:0",
    "6", // 5.1 channels
    "-disposition:a:0",
    "default",
    // Keep original audio as track 2 (backup, lossless if possible)
    "-map",
    "0:a:0",
    "-c:a:1",
    "copy",
    "-disposition:a:1",
    "0",
    // Copy subtitles if any
    "-map",
    "0:s?",
    "-c:s",
    "copy",
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
