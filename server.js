const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const https = require("https");
const http = require("http");

const app = express();

// Root route to confirm server is running
app.get("/", (req, res) => {
  res.send("FFmpeg Node.js Streaming Server is running!");
});

// Function: download video to local file
function downloadFile(fileUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = fileUrl.startsWith("https") ? https : http;
    const file = fs.createWriteStream(outputPath);
    protocol.get(fileUrl, response => {
      if (response.statusCode !== 200) {
        return reject(new Error("Download failed. Status: " + response.statusCode));
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(outputPath)));
      file.on("error", err => reject(err));
    });
  });
}

// GET API
app.get("/api", async (req, res) => {
  const { stream_key, video_url } = req.query;
  if (!stream_key || !video_url) {
    return res.status(400).json({
      error: "stream_key and video_url are required"
    });
  }
  const outputFile = "downloaded_video.mp4";
  try {
    console.log("Downloading video:", video_url);
    await downloadFile(video_url, outputFile);
    console.log("Download complete → starting FFmpeg streaming...");
    ffmpeg(outputFile)
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
      .output(`rtmp://live.twitch.tv/app/${stream_key}`)
      .on("start", cmd => console.log("FFmpeg started:", cmd))
      .on("stderr", line => console.log("[FFmpeg]", line))
      .on("error", err => console.error("FFmpeg error:", err))
      .on("end", () => console.log("Streaming finished"))
      .run();
    res.json({
      ok: true,
      message: "Video downloaded & streaming started"
    });
  } catch (err) {
    console.error("Processing error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.listen(3000, () => console.log("Server running on port 3000"));
