"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("api", {
    processFile: (filePath) => electron_1.ipcRenderer.invoke("process-file", filePath),
    getFilePath: (file) => electron_1.webUtils.getPathForFile(file),
    onProgress: (callback) => {
        electron_1.ipcRenderer.on("process-progress", (_, progress) => callback(progress));
    },
});
