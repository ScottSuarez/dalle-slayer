import blankWhite from "./images/blank-white.png";
import characterMask from "./images/character-mask.png";
import bigMask from "./images/mask-large.png";
import * as PIXI from "pixi.js";
import { addLogMessage } from "./game";

export async function getGameDesign() {
  try {
    // Make a GET request to the server's endpoint
    addLogMessage("fetching game-aesthetics");
    const response = await fetch("http://localhost:3001/game-design");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Parse the JSON response
    const gameDesign = await response.json();

    // Log the response or handle it as needed
    console.log("Game Design:", gameDesign);

    return gameDesign;

    // Here you can update the UI or logic based on the response
    // For example:
    // updateGameDesignUI(gameDesign);
  } catch (error) {
    console.error("Error fetching game design elements:", error);
  }
}

async function loadImage(url) {
  const proxyUrl = `http://localhost:3001/fetch-image?url=${encodeURIComponent(
    url
  )}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(blob);
  });
}

async function editImage(prompt, image, mask, retry = true) {
  try {
    const response = await fetch("http://localhost:3001/edit-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, image, mask }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(result.url);
    return result.url;
  } catch (error) {
    if (retry) {
      console.error("ECONNRESET error occurred, retrying once...");
      addLogMessage("server disconnect.. retrying");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // wait for 1 second
      return editImage(prompt, image, mask, false); // retry without the option to retry again
    } else {
      // if we already retried, throw the error
      throw error;
    }
  }
}

function createPixiTextureFromBlob(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) {
      reject("No blob provided");
    }

    const url = URL.createObjectURL(blob);
    const baseTexture = new PIXI.BaseTexture(url);
    const texture = new PIXI.Texture(baseTexture);

    baseTexture.on("loaded", () => {
      URL.revokeObjectURL(url); // Clean up the object URL
      resolve(texture);
    });

    baseTexture.on("error", (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    });
  });
}

export async function requestCharacter(subject, snesGame) {
  return await requestSprite(
    subject + " character",
    blankWhite,
    characterMask,
    "standing",
    snesGame
  );
}

export async function requestEnemy(subject, snesGame) {
  return await requestSprite(subject, blankWhite, bigMask, "scary", snesGame);
}

export async function requestItem(subject, snesGame) {
  return await requestSprite(
    subject,
    blankWhite,
    characterMask,
    "valuable",
    snesGame
  );
}

export async function requestSprite(
  subject,
  image,
  mask,
  adjective,
  snesGame = "castlevania"
) {
  try {
    const genericStyle =
      "Complete pixel sprite in style of '" + snesGame + "' SNES. ";

    addLogMessage("fetching sprite - " + adjective + " " + subject);

    var spriteUrl = await editImage(
      genericStyle + subject + " " + adjective + ".",
      image,
      mask
    );

    const spriteResponse = await fetch("http://localhost:3001" + spriteUrl);
    if (!spriteResponse.ok)
      throw new Error(`HTTP error! status: ${spriteResponse.status}`);

    const blob = await spriteResponse.blob();
    const texture = await createPixiTextureFromBlob(blob);

    return texture;
  } catch (error) {
    console.error("Error in requestCharacter:", error);
    throw error; // Rethrow the error if you want calling code to handle i
  }
}

window.requestCharacter = requestCharacter;
