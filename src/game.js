import * as PIXI from "pixi.js";
import * as open from "./openai";

const coinPickupSound = new Audio("./sound/pickupCoin.wav");
const laserShootSound = new Audio("./sound/laserShoot.wav");
const explosionSound = new Audio("./sound/explosion.wav");
const playerHitSound = new Audio("./sound/playerHitHurt.wav");
const winSound = new Audio("./sound/win.mp3");
const failSound = new Audio("./sound/fail.mp3");

laserShootSound.volume = 0.5; // 50% volume

// Function to play a specific sound
function playSound(sound) {
  if (sound && typeof sound.play === "function") {
    sound.play();
  }
}

const app = new PIXI.Application({
  background: "#ffffff",
  resizeTo: window,
});

const maxPlayerHealth = 3;
let ended = false;
let objectiveText;
let itemType;
let enemeyTexture;
let heroTexture;
let itemTexture;
let enemiesSpawned = 0;
let maxEnemies = 9;
let coinCount = 0;
let character, objectiveCountText;
let coins = []; // Array to hold multiple coins
let projectiles = []; // Array to hold the projectiles
let shootingInterval;
let playerHealth;
let healthText;
const particleContainer = new PIXI.ParticleContainer();
const enemies = [];
const enemySpeed = 0.3;

let targetPosition = { x: 0, y: 0 };
// Update target position on pointer move
app.renderer.view.addEventListener("pointermove", (event) => {
  const rect = app.renderer.view.getBoundingClientRect();
  targetPosition.x = event.clientX - rect.left;
  targetPosition.y = event.clientY - rect.top;
});
app.stage.addChild(particleContainer);

document.body.appendChild(app.view);
const particleContainerCoin = new PIXI.ParticleContainer(10000, {
  scale: true,
  position: true,
  rotation: true,
  uvs: true,
  alpha: true,
});
app.stage.addChild(particleContainerCoin);

const logStyle = new PIXI.TextStyle({
  fontFamily: "Arial",
  fontSize: 14,
  fill: "black", // assuming a white background for visibility
  align: "left",
});

const logContainer = new PIXI.Container();
logContainer.x = 10;
logContainer.y = app.renderer.height - 70; // Position adjusted to the bottom left
app.stage.addChild(logContainer);

async function addSpriteToStage() {
  try {
    character = new PIXI.Sprite(heroTexture);
    // character = PIXI.Sprite.from("https://pixijs.com/assets/bunny.png");
    character.x = app.renderer.width / 2;
    character.y = app.renderer.height / 2;
    character.anchor.set(0.5);

    app.stage.addChild(character);
    app.ticker.add(characterTicker);
  } catch (error) {
    console.error("Error adding sprite to stage:", error);
  }
}

async function setup() {
  resetGame();
  var design = await open.getGameDesign();

  addLogMessage("genre - " + design.genre);
  addLogMessage("inspired by - " + design.randomSnesGame);

  heroTexture = await open.requestCharacter(
    design.heroType,
    design.randomSnesGame
  );

  // collectItemHexColor = design.collectItemHexColor;
  // enemyExplosionColor = design.enemyExplosionColor;

  await addSpriteToStage();

  itemTexture = await open.requestItem(
    design.collectableItemType,
    design.randomSnesGame
  );

  enemeyTexture = await open.requestEnemy(
    design.enemyType,
    design.randomSnesGame
  );

  itemType = design.collectableItemType;
  objectiveCountText = new PIXI.Text(itemType + ": 0", {
    fill: "black",
    fontSize: 20,
  });
  objectiveCountText.x = 10; // Top left position
  objectiveCountText.y = 10;
  app.stage.addChild(objectiveCountText);

  updateHealthDisplay();

  startShooting();
  setObjective("Destroy the enemies!");

  enemiesSpawned = 0;

  let enemySpawner = setInterval(() => {
    spawnEnemy();
    enemiesSpawned++;
    if (enemiesSpawned === maxEnemies) {
      clearInterval(enemySpawner);
    }
  }, 2000); // Spawns an enemy every 2000 milliseconds (2 seconds)
  // break;

  app.ticker.add(gameLoop);
}

async function gameLoop(delta) {
  // Check each coin for collision
  // Update existing particles
  particleContainerCoin.children.forEach(updateCoinParticle);

  updateProjectiles();
  updateEnemies();
  moveEnemiesTowardsPlayer();
  checkEndGameCondition();

  for (let i = coins.length - 1; i >= 0; i--) {
    if (!character) {
      return;
    }

    let coin = coins[i];
    if (isColliding(character, coin)) {
      coinCount++;
      objectiveCountText.text = itemType + ": " + coinCount;
      collectCoin(coin);

      // Remove the coin
      coin.visible = false;
      app.stage.removeChild(coin);
      coins.splice(i, 1); // Safe to remove while iterating backwards
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (isColliding(character, enemies[i])) {
      applyDamageToPlayer(1); // Player takes 1 damage
      knockBackEnemy(enemies[i]);
    }
  }
}

function applyDamageToPlayer(damage) {
  playSound(playerHitSound);
  playerHealth -= damage;
  setTimeout(() => (character.tint = 0xffffff), 100); // Then go back to normal color
  updateHealthDisplay();

  if (playerHealth <= 0) {
    endGame("Game Over!", true);
    // Stop the game or reset the player position etc.
  }
}

function updateHealthDisplay() {
  const heartSymbol = "♥";
  const emptyHeartSymbol = "✗";

  // Create a string that represents the player's health
  let healthString =
    "Health: " +
    heartSymbol.repeat(playerHealth) +
    emptyHeartSymbol.repeat(maxPlayerHealth - playerHealth);

  // If the healthText object already exists, just update the text
  if (healthText) {
    healthText.text = healthString;
  } else {
    // Create the healthText object if it doesn't exist
    healthText = new PIXI.Text(healthString, {
      fontFamily: "Arial",
      fontSize: 20,
      fill: "black",
      align: "left",
    });

    // Set the position underneath the coin count
    healthText.x = 10;
    healthText.y = objectiveCountText.y + objectiveCountText.height + 5; // Adjust the y offset as needed

    // Add the health text to the stage
    app.stage.addChild(healthText);
  }
}

function knockBackEnemy(enemy) {
  const knockBackDistance = 150; // Adjust as needed
  const angle = Math.atan2(enemy.y - character.y, enemy.x - character.x);
  enemy.x += Math.cos(angle) * knockBackDistance;
  enemy.y += Math.sin(angle) * knockBackDistance;
}

// --------- end game -------------
function displayEndGameMessage(mainMessage, endColor = "green") {
  let endGameText = new PIXI.Text(mainMessage, {
    fontFamily: "Arial",
    fontSize: 36,
    fill: endColor,
    align: "center",
  });
  endGameText.anchor.set(0.5);
  endGameText.x = app.renderer.width / 2;
  endGameText.y = app.renderer.height / 2 - 40; // Adjusted to make room for subtext
  app.stage.addChild(endGameText);

  // Subtext
  let subText = new PIXI.Text("Click to start again.", {
    fontFamily: "Arial",
    fontSize: 24,
    fill: "blue",
    align: "center",
  });
  subText.anchor.set(0.5);
  subText.x = app.renderer.width / 2;
  subText.y = app.renderer.height / 2 + 20; // Positioned below the main message
  app.stage.addChild(subText);
}

function resetGame() {
  // Stop any ongoing intervals or timeouts
  app.stage.off("pointerdown", setup);
  clearInterval(shootingInterval);

  // Reset game state variables
  ended = false;
  playerHealth = maxPlayerHealth;

  enemiesSpawned = 0;
  coinCount = 0;
  coins = [];
  projectiles = [];
  enemies.length = 0; // Clear the enemies array

  // Clear the stage of all objects
  app.ticker.remove(characterTicker);
  app.stage.removeChildren();

  // Re-add the containers to the stage
  app.stage.addChild(particleContainer);
  app.stage.addChild(particleContainerCoin);
  app.stage.addChild(logContainer);
}

function endGame(message, fail = false) {
  ended = true;
  stopShooting(); // Stop shooting projectiles

  if (fail) {
    playSound(failSound);
    if (character) {
      app.stage.removeChild(character);
      particleContainer.removeChildren();
      character = null;
    }

    app.ticker.remove(characterTicker);
    displayEndGameMessage(message, "red");
  } else {
    playSound(winSound);
    displayEndGameMessage(message);
  }
  // Make the entire stage clickable to restart the game
  app.stage.interactive = true;
  app.stage.buttonMode = true;
  app.stage.on("pointerdown", setup, false);
}

function checkEndGameCondition() {
  if (ended) {
    return;
  }

  if (enemies.length === 0 && maxEnemies == enemiesSpawned) {
    endGame("Congratulations, all enemies defeated!");
  }
}
// --------- -------------

function setObjective(objective) {
  // If the objectiveText already exists on the stage, remove it
  if (objectiveText) {
    app.stage.removeChild(objectiveText);
  }

  const objectiveTextStyle = new PIXI.TextStyle({
    fontFamily: "Arial",
    fontSize: 20,
    fill: "black",
  });

  // Create new objective text
  objectiveText = new PIXI.Text(objective, objectiveTextStyle);
  objectiveText.anchor.set(0.5); // Center the anchor point on the text
  objectiveText.x = app.renderer.width / 2; // Center the text on the screen
  objectiveText.y = 30; // A little bit down from the top of the screen
  app.stage.addChild(objectiveText);
}

// ---- character particle -----
function characterTicker() {
  const moveSpeed = 1; // Slower movement speed
  const stopDistance = 50; // Distance from the target where the sprite will stop

  particleContainer.children.forEach(updateParticle);

  const dx = targetPosition.x - character.x;
  const dy = targetPosition.y - character.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > stopDistance) {
    createParticle(character);

    // Stop if within stopDistance of the target
    character.x += (dx / distance) * moveSpeed;
    character.y += (dy / distance) * moveSpeed;
  }
}

function startShooting() {
  shootingInterval = setInterval(shootProjectile, 1000);
}

function stopShooting() {
  clearInterval(shootingInterval);
}

function shootProjectile() {
  playSound(laserShootSound);
  let projectile = new PIXI.Sprite(PIXI.Texture.WHITE);
  projectile.position.set(character.x, character.y);
  projectile.scale.set(0.5); // Adjust size as needed
  projectile.tint = 0xff0000; // Color the projectile red, for example
  projectile.speed = 5; // The speed at which the projectile moves
  projectile.direction = Math.atan2(
    targetPosition.y - character.y,
    targetPosition.x - character.x
  ); // Calculate the direction towards the cursor
  projectiles.push(projectile);
  app.stage.addChild(projectile);
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let projectile = projectiles[i];
    projectile.x += Math.cos(projectile.direction) * projectile.speed;
    projectile.y += Math.sin(projectile.direction) * projectile.speed;

    // Remove the projectile if it goes off-screen
    if (
      projectile.x < 0 ||
      projectile.x > app.screen.width ||
      projectile.y < 0 ||
      projectile.y > app.screen.height
    ) {
      app.stage.removeChild(projectile);
      projectiles.splice(i, 1);
    }
  }
}

function createParticle(character) {
  const texture = PIXI.Texture.WHITE; // Use a white texture
  let particle = new PIXI.Sprite(texture);

  // Set the width and height of the particle
  const size = Math.random() * 5;
  particle.width = size;
  particle.height = size;

  // Random offset
  const offsetX = (Math.random() - 0.5) * 20;
  const offsetY = (Math.random() - 0.5) * 20;

  // Random color
  const color = Math.floor(Math.random() * 0xffffff);
  particle.tint = color; // Tint the sprite with the random color

  particle.x = character.x + offsetX;
  particle.y = character.y + offsetY;
  particle.alpha = 1;

  particleContainer.addChild(particle);
  return particle;
}

function updateParticle(particle) {
  particle.alpha -= 0.01; // Fade out
  particle.y += 0.1; // Particle movement logic, customize as needed

  // Remove particle if it's faded out
  if (particle.alpha <= 0) {
    particleContainer.removeChild(particle);
  }
}
// ---------------------------

function isColliding(spriteA, spriteB) {
  const boundsA = spriteA.getBounds();
  const boundsB = spriteB.getBounds();
  return (
    boundsA.x < boundsB.x + boundsB.width &&
    boundsA.x + boundsA.width > boundsB.x &&
    boundsA.y < boundsB.y + boundsB.height &&
    boundsA.y + boundsA.height > boundsB.y
  );
}
// create a new Sprite from an image path

// ----- coin collection ------

function createCoinParticle(x, y) {
  const particle = new PIXI.Sprite(PIXI.Texture.WHITE);
  const size = Math.random() * 5 + 2;
  particle.width = size;
  particle.height = size;
  particle.tint = 0xffcc00; // Gold color for the coin particles
  particle.x = x;
  particle.y = y;
  particle.alpha = 1;
  particleContainerCoin.addChild(particle);
  return particle;
}

function updateCoinParticle(particle) {
  particle.alpha -= 0.01; // Faster fade out
  particle.scale.x *= 0.95;
  particle.scale.y *= 0.95;
  if (particle.alpha <= 0) {
    particleContainerCoin.removeChild(particle);
  }
}

function collectCoin(coin) {
  playSound(coinPickupSound);
  // Create particles for visual effect
  applyDamageToAllEnemies(1);
  for (let j = 0; j < 10; j++) {
    const particle = createCoinParticle(coin.x, coin.y);
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 1;
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed;
    app.ticker.add(() => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.97;
      particle.vy *= 0.97;
    });
  }
}
// --------------------------

function spawnEnemy() {
  // let enemy = PIXI.Sprite.from(
  //   "https://pixijs.io/examples/examples/assets/eggHead.png"
  // );
  let enemy = new PIXI.Sprite(enemeyTexture);
  enemy.anchor.set(0.5);

  // Randomize spawn position off-screen
  let side = Math.floor(Math.random() * 4);
  switch (side) {
    case 0: // Top
      enemy.x = Math.random() * app.renderer.width;
      enemy.y = -enemy.height;
      break;
    case 1: // Right
      enemy.x = app.renderer.width + enemy.width;
      enemy.y = Math.random() * app.renderer.height;
      break;
    case 2: // Bottom
      enemy.x = Math.random() * app.renderer.width;
      enemy.y = app.renderer.height + enemy.height;
      break;
    case 3: // Left
      enemy.x = -enemy.width;
      enemy.y = Math.random() * app.renderer.height;
      break;
  }

  enemies.push(enemy);
  app.stage.addChild(enemy);
}

function updateEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    let enemy = enemies[i];
    // Check collision with projectiles
    for (let j = projectiles.length - 1; j >= 0; j--) {
      let projectile = projectiles[j];
      if (isColliding(projectile, enemy)) {
        // Flash the enemy and push it back
        enemy.tint = 0xff0000; // Flash red
        setTimeout(() => (enemy.tint = 0xffffff), 100); // Then go back to normal color

        // Push the enemy back
        enemy.x += Math.cos(projectile.direction) * 15;
        enemy.y += Math.sin(projectile.direction) * 15;

        // Decrease enemy health or handle it being hit
        enemy.hits = (enemy.hits || 0) + 1;
        if (enemy.hits >= 3) {
          createEnemyExplosion(enemy.x, enemy.y);

          app.stage.removeChild(enemy);
          enemies.splice(i, 1);
        }

        // Remove the projectile
        app.stage.removeChild(projectile);
        projectiles.splice(j, 1);
        break; // Break because the projectile can only hit one enemy
      }
    }
  }
}

function applyDamageToAllEnemies(damageAmount) {
  const knockBackDistance = 20; // The distance enemies are pushed back
  const flashDuration = 100; // Duration in milliseconds of the flash effect

  for (let i = enemies.length - 1; i >= 0; i--) {
    let enemy = enemies[i];
    // Apply damage
    enemy.hits = (enemy.hits || 0) + damageAmount;

    // Flash the enemy red
    enemy.tint = 0xff0000;
    setTimeout(() => {
      enemy.tint = 0xffffff; // Reset tint after the flash duration
    }, flashDuration);

    // Knock the enemy back away from the character
    const angle = Math.atan2(enemy.y - character.y, enemy.x - character.x);
    enemy.x += Math.cos(angle) * knockBackDistance;
    enemy.y += Math.sin(angle) * knockBackDistance;

    // Check if the enemy is defeated
    if (enemy.hits >= 3) {
      createEnemyExplosion(enemy.x, enemy.y);
      app.stage.removeChild(enemy);
      enemies.splice(i, 1);
    }
  }
}

function createEnemyExplosion(x, y) {
  playSound(explosionSound);
  const numberOfParticles = 20; // Number of particles in the explosion
  const explosionContainer = new PIXI.ParticleContainer(numberOfParticles, {
    scale: true,
    position: true,
    alpha: true,
  });
  app.stage.addChild(explosionContainer);

  let coin = new PIXI.Sprite(itemTexture);
  coin.x = x; // Random position
  coin.y = y;
  app.stage.addChild(coin);
  coins.push(coin);

  for (let i = 0; i < numberOfParticles; i++) {
    let particle = new PIXI.Sprite(PIXI.Texture.WHITE);
    particle.position.set(x, y);
    particle.scale.set(0.2); // Small size for explosion particles
    particle.tint = 0xff0000; // Red color for enemy particles
    particle.speed = Math.random() * 2 + 1; // Random speed
    particle.direction = Math.random() * Math.PI * 2; // Random direction

    explosionContainer.addChild(particle);

    // Give the particle some life properties
    particle.life = 60; // life in frames

    // Update function for the particles in the explosion
    app.ticker.add((delta) => {
      if (particle.life > 0) {
        particle.life -= delta;
        particle.x += Math.cos(particle.direction) * particle.speed;
        particle.y += Math.sin(particle.direction) * particle.speed;
        particle.alpha = particle.life / 60; // Fade out
      } else {
        explosionContainer.removeChild(particle);
        if (explosionContainer.children.length === 0) {
          app.stage.removeChild(explosionContainer);
        }
      }
    });
  }
}

function moveEnemiesTowardsPlayer() {
  enemies.forEach((enemy) => {
    let dx = character.x - enemy.x;
    let dy = character.y - enemy.y;
    let angle = Math.atan2(dy, dx);
    enemy.x += Math.cos(angle) * enemySpeed;
    enemy.y += Math.sin(angle) * enemySpeed;
  });
}

// ------ --- - -- - - -- --

// Log setup ---- --- -- -- --
export function addLogMessage(message) {
  // Shift existing messages up
  logContainer.children.forEach((child) => {
    child.y -= 20;
  });

  // Create a new text object for the message
  let logText = new PIXI.Text(message, logStyle);
  logText.y = 0; // Start at the bottom
  logContainer.addChild(logText);

  // Fade out over 5 seconds
  app.ticker.add((delta) => {
    if (logText.alpha > 0) {
      logText.alpha -= 0.001 * delta;
    } else {
      logContainer.removeChild(logText);
    }
  });
}

window.addLogMessage = addLogMessage;

///

setup();
