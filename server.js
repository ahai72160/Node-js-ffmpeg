const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const https = require("https");
const http = require("http");

const app = express();
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("FFmpeg Node.js Server is running!");
});

function downloadFile(fileUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = fileUrl.startsWith("https") ? https : http;
    const file = fs.createWriteStream(outputPath);
    protocol.get(fileUrl, response => {
      if (response.statusCode !== 200) {
        return reject(
          new Error("Download failed. Status: " + response.statusCode)
        );
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(outputPath)));
      file.on("error", err => reject(err));
    });
  });
}

app.post("/api", async (req, res) => {
  const { video_url, key } = req.body;
  if (!video_url || !key) {
    return res
      .status(400)
      .json({ error: "video_url and key are required" });
  }
  const outputFile = "video.mp4";
  try {
    console.log("Downloading:", video_url);
    await downloadFile(video_url, outputFile);
    console.log("Download complete. Starting FFmpeg stream...");
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
      //.output(`rtmp://a.rtmp.youtube.com/live2/${key}`)    // YouTube
      .output(`rtmp://live.twitch.tv/app/${key}`)            // Twitch
      .on("start", () => console.log("Streaming started!"))
      .on("error", e => console.error("FFmpeg error:", e))
      .run();
    res.json({ ok: true, message: "Stream started!" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.listen(3000, () => console.log("Server running on port 3000"));
