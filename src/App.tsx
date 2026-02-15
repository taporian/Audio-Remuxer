import { useEffect, useState } from "react";

declare global {
  interface Window {
    api: {
      processFile: (filePath: string) => Promise<string>;
      getFilePath: (file: File) => string;
      onProgress: (callback: (progress: number) => void) => void;
    };
  }
}

function App() {
  const [file, setFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState("Drop a movie file");
  const [progress, setProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [outputPath, setOutputPath] = useState<string>("");

  useEffect(() => {
    console.log("API:", window.api);
    window.api.onProgress((prog) => {
      setProgress(prog);
    });
  }, []);

  const handleFileSelection = async (file: File) => {
    // Only allow mkv, mp4, or avi
    if (!file.name.match(/\.(mkv|mp4|avi)$/i)) {
      setStatus("Only MKV, MP4, or AVI files allowed");
      return;
    }

    // Get file path using Electron's webUtils
    try {
      const filePath = window.api.getFilePath(file);

      if (!filePath) {
        setStatus("File path not available (run inside Electron)");
        return;
      }

      setFile(filePath);
      setFileName(file.name);
      setStatus("Ready to process");
    } catch (err) {
      setStatus("Error getting file path");
      console.error(err);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    const files = e.dataTransfer.files;

    if (!files || files.length === 0) {
      setStatus("No file detected");
      return;
    }

    const file = files[0];
    await handleFileSelection(file);
  };

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mkv,.mp4,.avi";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await handleFileSelection(file);
      }
    };
    input.click();
  };

  const processFile = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(0);
    setStatus("Processing...");

    try {
      const result = await window.api.processFile(file);
      setOutputPath(result);
      setStatus("Complete!");
      setIsComplete(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setStatus("Error: " + err);
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setFileName(null);
    setStatus("Drop a movie file");
    setProgress(0);
    setIsProcessing(false);
    setIsComplete(false);
    setOutputPath("");
  };

  return (
    <div className="container">
      <h1>🎧 Audio Remuxer</h1>

      {!isComplete ? (
        <>
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={handleClick}
          >
            <div className="dropzone-content">
              <div>{fileName ?? "Drag & Drop or Click to Select"}</div>
              <div className="dropzone-hint">
                Supports MKV, MP4, and AVI files
              </div>
            </div>
          </div>

          <div className="actions-area">
            {file && !isProcessing && (
              <div className="file-actions">
                <button className="button primary" onClick={processFile}>
                  Convert Video
                </button>
                <button className="button secondary" onClick={reset}>
                  Clear
                </button>
              </div>
            )}

            {isProcessing && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                  <span className="progress-text">{progress}%</span>
                </div>
                <p className="status">{status}</p>
              </div>
            )}

            {!isProcessing && status && (
              <div className={`status ${status.startsWith('Error') ? 'error' : ''}`}>{status}</div>
            )}
          </div>
        </>
      ) : (
        <div className="completion-card">
          <div className="success-icon">✓</div>
          <h2>Processing Complete!</h2>
          <p className="output-path">{outputPath}</p>
          <button className="button primary large" onClick={reset}>
            Process Another File
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
