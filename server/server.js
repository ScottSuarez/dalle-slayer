const express = require("express");
const fetch = require("node-fetch");
const OpenAI = require("openai");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const port = 3001;
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware to handle JSON data
app.use(bodyParser.json());

// Enable CORS for all routes
app.use(cors());

const tempDirPath = path.join(__dirname, "temp");

// Check if the directory exists, if not, create it
if (!fs.existsSync(tempDirPath)) {
  fs.mkdirSync(tempDirPath, { recursive: true });
}

async function saveImageToFile(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const buffer = await response.buffer();
  fs.writeFileSync(filePath, buffer);
}

app.post("/edit-image", async (req, res) => {
  try {
    const { prompt, image: imageUrl, mask: maskUrl } = req.body;

    // Save images to files
    const imagePath = path.join(__dirname, "temp", "image.png");
    const maskPath = path.join(__dirname, "temp", "mask.png");
    await saveImageToFile(imageUrl, imagePath);
    await saveImageToFile(maskUrl, maskPath);

    // Execute OpenAI edit
    const result = await openai.images.edit({
      model: "dall-e-2",
      image: fs.createReadStream(imagePath),
      mask: fs.createReadStream(maskPath),
      prompt: prompt,
      size: "256x256",
    });

    const randomString = Math.random().toString(36).substring(2, 15);
    const editedImagePath = path.join(
      __dirname,
      "temp",
      `edited_image_${randomString}.png`
    );
    await saveImageToFile(result.data[0].url, editedImagePath);

    // Path for the output image
    const outputImagePath = path.join(
      __dirname,
      "temp",
      `output_image_${randomString}.png`
    );

    // Run Python script to extract sprite
    execFile(
      "python3",
      ["server/extract.py", editedImagePath, outputImagePath],
      (error, stdout, stderr) => {
        if (error) {
          console.error("Error executing Python script:", error);
          return res.status(500).send("Error processing image");
        }

        // Serve the extracted sprite image
        res.json({
          url: `/serve-image?path=${encodeURIComponent(outputImagePath)}`,
        });
      }
    );
  } catch (error) {
    console.error("Error editing image:", error);
    res.status(500).send("Error editing image");
  }
});

app.get("/serve-image", (req, res) => {
  const imagePath = req.query.path;
  res.sendFile(imagePath);
});

app.get("/fetch-image", async (req, res) => {
  try {
    const response = await fetch(req.query.url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    // Get the content type of the response
    const contentType = response.headers.get("content-type");
    if (contentType !== "image/png") {
      throw new Error("The image is not in PNG format.");
    }

    const buffer = await response.buffer();
    if (buffer.length >= 4 * 1024 * 1024) {
      throw new Error("The image exceeds the 4 MB size limit.");
    }

    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (error) {
    res.status(500).send("Error fetching image: " + error.message);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Endpoint to get a JSON object with game design elements from OpenAI
app.get("/game-design", async (req, res) => {
  try {
    // Construct the prompt for OpenAI with examples
    const prompt = `Generate a JSON object with specific fields for a game design concept. Here are some examples:
  
    don't use 'clock tower', 'clocktower', or 'zelda' as games

  Example 1:
  {
    "genre": "fantasy",
    "randomSnesGame": "Secret of Mana",
    "heroType": "Mage",
    "enemyType": "Goblin",
    "allyType": "Knight",
    "enemyExplosionColor": "#FF0000",
    "collectableItemType": "Elixir",
    "collectItemHexColor": "#7F00FF"
  }
  
  Example 2:
  {
    "genre": "sci-fi",
    "randomSnesGame": "Super Metroid",
    "heroType": "Space Marine",
    "enemyType": "Alien",
    "allyType": "AI Companion",
    "enemyExplosionColor": "#00FFFF",
    "collectableItemType": "Energy Cell",
    "collectItemHexColor": "#FFFF00"
  }
  
  Create a new object following the pattern of the examples above with creative and varied entries.`;

    // Query OpenAI with the prompt
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a game design expect designed to output JSON for creation of world.",
        },
        { role: "user", content: prompt },
      ],
      model: "gpt-3.5-turbo-1106",
      response_format: { type: "json_object" },
    });

    // Assume the OpenAI response is well-formed JSON content
    const gameDesignElements = JSON.parse(
      completion.choices[0].message.content
    );

    // Send the game design elements as JSON
    res.json(gameDesignElements);
  } catch (error) {
    console.error("Error fetching game design elements:", error);
    res.status(500).send("Error fetching game design elements");
  }
});
