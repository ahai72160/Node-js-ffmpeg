const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");

const app = express();
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("FFmpeg Node.js Server is running - OK!");
});

// Logging helper
function log(...args) {
  console.log(new Date().toISOString(), "-", ...args);
}

function downloadFile(fileUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = fileUrl.startsWith("https") ? https : http;

    log("Starting download from:", fileUrl);

    const file = fs.createWriteStream(outputPath);

    protocol.get(fileUrl, response => {
      log("Download status:", response.statusCode);

      if (response.statusCode !== 200) {
        return reject(
          new Error("Download failed. Status: " + response.statusCode)
        );
      }

      response.pipe(file);

      file.on("finish", () => {
        log("Download finished:", outputPath);
        file.close(() => resolve(outputPath));
      });

      file.on("error", err => {
        log("File write error:", err);
        reject(err);
      });
    }).on("error", err => {
      log("Request error:", err);
      reject(err);
    });
  });
}

app.post("/api", async (req, res) => {
  log("Received POST /api from", req.ip);
  log("Request body:", req.body);

  const { video_url, key } = req.body;

  if (!video_url || !key) {
    log("Missing parameters!");
    return res.status(400).json({
      error: "video_url and key are required"
    });
  }

  const outputFile = path.join(__dirname, "video.mp4");

  try {
    // Download file first
    log("Starting to download:", video_url);
    await downloadFile(video_url, outputFile);
    log("Download completed. Preparing FFmpeg stream...");

    // FFmpeg streaming
    const command = ffmpeg(outputFile)
      .addOptions([
        "-vcodec libx264",
        "-preset veryfast",
        "-maxrate 3000k",
        "-bufsize 6000k",
        "-g 60",
        "-acodec aac",
        "-ar 44100",
        "-b:a 128k",
        "-f flv"
      ])
      .output(`rtmp://live.twitch.tv/app/${key}`);

    command.on("start", cmd => {
      log("FFmpeg has started:");
      log(cmd);
    });

    command.on("progress", p => {
      log(`FFmpeg progress: ${p.percent ? p.percent.toFixed(2) : 0}%`);
    });

    command.on("error", err => {
      log("FFmpeg error:", err.message);
    });

    command.on("end", () => {
      log("FFmpeg finished streaming.");
    });

    command.run();

    res.json({ ok: true, message: "Stream started!" });

  } catch (err) {
    log("Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(3000, () => log("Server running on port 3000"));
