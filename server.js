const express = require("express")
const ffmpeg = require("fluent-ffmpeg")

const app = express()
app.use(express.json())

app.get("/", (req, res) => {
  res.send("FFmpeg Node.js Server is running!");
});

app.post("/start", (req, res) => {
  const { input, key } = req.body

  ffmpeg(input)
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
    .output(`rtmp://a.rtmp.youtube.com/live2/${key}`)
    .on("start", () => console.log("Streaming started!"))
    .on("error", e => console.error(e))
    .run()

  res.json({ ok: true })
})

app.listen(3000, () => console.log("Server running"))
