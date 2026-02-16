import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("api", {
  processFile: (filePath: string) =>
    ipcRenderer.invoke("process-file", filePath),

  checkAudio: (filePath: string) => ipcRenderer.invoke("check-audio", filePath),

  getFilePath: (file: File) => webUtils.getPathForFile(file),

  onProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on("process-progress", (_, progress) => callback(progress));
  },
});
