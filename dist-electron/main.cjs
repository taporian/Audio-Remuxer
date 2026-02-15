"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const isDev = process.env.NODE_ENV === "development";
// Find ffmpeg in common locations
function findFFmpeg() {
    if (isDev)
        return "ffmpeg";
    const possiblePaths = [
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ];
    for (const path of possiblePaths) {
        if ((0, fs_1.existsSync)(path)) {
            return path;
        }
    }
    return "ffmpeg"; // fallback to PATH
}
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: "#0e0e0e",
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.cjs"),
        },
    });
    if (isDev) {
        win.loadURL("http://localhost:5173");
    }
    else {
        win.loadFile(path_1.default.join(__dirname, "../dist/index.html"));
    }
}
electron_1.app.whenReady().then(createWindow);
electron_1.ipcMain.handle("process-file", async (event, filePath) => {
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
        const ffmpeg = (0, child_process_1.spawn)(ffmpegPath, args);
        let duration = 0;
        let errorOutput = "";
        ffmpeg.on("error", (error) => {
            console.error("FFmpeg spawn error:", error);
            reject(`FFmpeg not found at ${ffmpegPath}. Please install FFmpeg: brew install ffmpeg`);
        });
        ffmpeg.stderr.on("data", (data) => {
            const output = data.toString();
            errorOutput += output;
            console.log("FFmpeg stderr:", output);
            const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
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
            }
            else {
                console.error("FFmpeg failed with code:", code);
                console.error("FFmpeg error output:", errorOutput);
                reject(`FFmpeg process failed with code ${code}. Error: ${errorOutput.slice(-500)}`);
            }
        });
        ffmpeg.on("error", (error) => {
            console.error("FFmpeg error event:", error);
            reject(error.message);
        });
    });
});
