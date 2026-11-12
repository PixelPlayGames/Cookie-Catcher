
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreDisplay = document.getElementById("score");
const livesDisplay = document.getElementById("lives");
const startScreen = document.getElementById("startScreen");
const gameOver = document.getElementById("gameOver");
const finalScore = document.getElementById("finalScore");
const playButton = document.getElementById("playButton");

// GOOGLE ANALYTICS GAME TRACKING
function trackGameEvent(eventName, extraParams = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, {
      game_name: "cookie_catcher",
      ...extraParams
    });
  }
}

// GAME VARIABLES
let score = 0;
let lives = 3;
let level = 1;
let cookiesThisLevel = 0;
let cookiesRequired = 10;

let running = false;
let paused = false;
let items = [];
let spawnTimer = 0;
let lastTime = 0;
let keys = {};
let animationTime = 0;

let levelMessage = "";
let levelMessageTimer = 0;

// POWER-UPS
let shieldActive = false;

// SPECIAL BASKET POWERS
let oceanCooldown = 0;
let royalCooldown = 0;
let royalSlowTimer = 0;

// HIGH SCORE
let highScore =
  Number(localStorage.getItem("cookieCatcherHighScore")) || 0;

// GAME SHOP
const shopSkins = [
  {
    id: "classic",
    name: "Classic Basket",
    color: "#b66a32",
    cost: 0,
    description: "Normal gameplay."
  },
  {
    id: "strawberry",
    name: "Strawberry Basket",
    color: "#ff6594",
    cost: 250,
    description: "Earn 2 coins for every normal cookie!"
  },
  {
    id: "ocean",
    name: "Ocean Basket",
    color: "#299ed6",
    cost: 2500,
    description: "Automatically blocks one bomb every 30 seconds!"
  },
  {
    id: "gold",
    name: "Golden Basket",
    color: "#e4ae24",
    cost: 5000,
    description: "Earn DOUBLE coins!"
  },
  {
    id: "purple",
    name: "Royal Basket",
    color: "#8955c7",
    cost: 8000,
    description: "Slows falling objects for 5 seconds every 30 seconds!"
  }
];

let coins = Number(localStorage.getItem("cookieCatcherCoins")) || 0;
let unlockedSkins = ["classic"];
let selectedSkin = "classic";

try {
  const savedSkins = JSON.parse(
    localStorage.getItem("cookieCatcherUnlockedSkins") || '["classic"]'
  );

  if (Array.isArray(savedSkins)) {
    unlockedSkins = [...new Set(["classic", ...savedSkins])];
  }

  const savedSelection =
    localStorage.getItem("cookieCatcherSelectedSkin");

  if (
    shopSkins.some(skin => skin.id === savedSelection) &&
    unlockedSkins.includes(savedSelection)
  ) {
    selectedSkin = savedSelection;
  }
} catch (error) {
  unlockedSkins = ["classic"];
  selectedSkin = "classic";
}

function saveShopData() {
  localStorage.setItem("cookieCatcherCoins", coins);
  localStorage.setItem(
    "cookieCatcherUnlockedSkins",
    JSON.stringify(unlockedSkins)
  );
  localStorage.setItem("cookieCatcherSelectedSkin", selectedSkin);
}

function getSelectedSkin() {
  return shopSkins.find(skin => skin.id === selectedSkin) || shopSkins[0];
}

function addCoins(amount) {
  // Golden Basket doubles all coins earned.
  if (selectedSkin === "gold") {
    amount *= 2;
  }

  coins += amount;
  saveShopData();
  updateDisplays();
}

// ACHIEVEMENTS
const achievementDefinitions = [
  {
    id: "first_cookie",
    name: "First Cookie",
    description: "Catch your first cookie.",
    icon: "🍪"
  },
  {
    id: "score_100",
    name: "Cookie Collector",
    description: "Score 100 points in one game.",
    icon: "⭐"
  },
  {
    id: "score_500",
    name: "Cookie Champion",
    description: "Score 500 points in one game.",
    icon: "👑"
  },
  {
    id: "level_5",
    name: "Level Explorer",
    description: "Reach level 5.",
    icon: "🏆"
  },
  {
    id: "level_10",
    name: "Level Legend",
    description: "Reach level 10.",
    icon: "💎"
  },
  {
    id: "golden_cookie",
    name: "Golden Touch",
    description: "Catch a golden cookie.",
    icon: "🌟"
  },
  {
    id: "shield_save",
    name: "Bomb Dodger",
    description: "Block a bomb with your shield.",
    icon: "🛡️"
  },
  {
    id: "extra_life",
    name: "Extra Heart",
    description: "Collect an extra life power-up.",
    icon: "❤️"
  }
];

let unlockedAchievements = [];

try {
  unlockedAchievements = JSON.parse(
    localStorage.getItem("cookieCatcherAchievements") || "[]"
  );

  if (!Array.isArray(unlockedAchievements)) {
    unlockedAchievements = [];
  }
} catch (error) {
  unlockedAchievements = [];
}

let achievementMessage = "";
let achievementMessageTimer = 0;

// SOUND SYSTEM
let audioContext = null;
let soundEnabled = true;

function initializeAudio() {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(
  frequency,
  duration,
  type = "sine",
  volume = 0.12,
  slide = 0
) {
  if (!soundEnabled || !audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;

  oscillator.frequency.setValueAtTime(
    frequency,
    audioContext.currentTime
  );

  if (slide !== 0) {
    oscillator.frequency.linearRampToValueAtTime(
      frequency + slide,
      audioContext.currentTime + duration
    );
  }

  gain.gain.setValueAtTime(volume, audioContext.currentTime);

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playSound(name) {
  if (!soundEnabled || !audioContext) return;

  switch (name) {
    case "cookie":
      playTone(650, 0.09, "sine", 0.10, 350);
      break;

    case "golden":
      playTone(700, 0.12, "sine", 0.12, 400);
      setTimeout(() => {
        playTone(1000, 0.18, "sine", 0.12, 300);
      }, 100);
      break;

    case "shield":
      playTone(450, 0.15, "triangle", 0.12, 300);
      setTimeout(() => {
        playTone(850, 0.2, "sine", 0.12, 200);
      }, 120);
      break;

    case "shieldHit":
      playTone(900, 0.18, "triangle", 0.12, -300);
      break;

    case "extraLife":
      playTone(520, 0.12, "sine", 0.12, 180);
      setTimeout(() => {
        playTone(780, 0.18, "sine", 0.12, 160);
      }, 130);
      break;

    case "bomb":
      playTone(150, 0.35, "sawtooth", 0.16, -110);
      break;

    case "miss":
      playTone(260, 0.18, "triangle", 0.08, -100);
      break;

    case "level":
      playTone(500, 0.14, "sine", 0.12, 150);
      setTimeout(() => {
        playTone(700, 0.14, "sine", 0.12, 180);
      }, 150);
      setTimeout(() => {
        playTone(950, 0.25, "sine", 0.12, 200);
      }, 300);
      break;

    case "achievement":
      playTone(600, 0.15, "sine", 0.12, 200);
      setTimeout(() => {
        playTone(850, 0.2, "sine", 0.12, 250);
      }, 150);
      setTimeout(() => {
        playTone(1100, 0.25, "sine", 0.12, 200);
      }, 300);
      break;

    case "gameOver":
      playTone(330, 0.25, "triangle", 0.12, -100);
      setTimeout(() => {
        playTone(220, 0.4, "triangle", 0.12, -100);
      }, 250);
      break;

    case "click":
      playTone(450, 0.06, "sine", 0.06, 80);
      break;

    case "buy":
      playTone(650, 0.12, "sine", 0.12, 250);
      setTimeout(() => {
        playTone(900, 0.18, "sine", 0.12, 200);
      }, 120);
      break;
  }
}

// GAME STATS
const statsContainer = scoreDisplay.parentElement.parentElement;

function createStatDisplay() {
  const element = document.createElement("span");
  element.style.fontWeight = "bold";
  element.style.color = "#70452e";
  element.style.margin = "5px";
  return element;
}

const levelDisplay = createStatDisplay();
const progressDisplay = createStatDisplay();
const highScoreDisplay = createStatDisplay();
const shieldDisplay = createStatDisplay();
const coinDisplay = createStatDisplay();
const abilityDisplay = createStatDisplay();

statsContainer.appendChild(levelDisplay);
statsContainer.appendChild(progressDisplay);
statsContainer.appendChild(highScoreDisplay);
statsContainer.appendChild(shieldDisplay);
statsContainer.appendChild(coinDisplay);
statsContainer.appendChild(abilityDisplay);

// CREATE BUTTON
function createButton(label, background) {
  const button = document.createElement("button");

  button.textContent = label;
  button.style.padding = "10px 16px";
  button.style.borderRadius = "20px";
  button.style.border = "none";
  button.style.background = background;
  button.style.color = "white";
  button.style.fontWeight = "bold";
  button.style.cursor = "pointer";
  button.style.margin = "5px";

  statsContainer.appendChild(button);

  return button;
}

// SOUND BUTTON
const soundButton = createButton("🔊 Sound ON", "#269b79");

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;

  soundButton.textContent = soundEnabled
    ? "🔊 Sound ON"
    : "🔇 Sound OFF";

  soundButton.style.background = soundEnabled
    ? "#269b79"
    : "#888888";

  if (soundEnabled) {
    initializeAudio();
    playSound("click");
  }
});

// HOME BUTTON
const homeButton = createButton("🏠 Home", "#ffad32");
homeButton.style.display = "none";

// PAUSE BUTTON
const pauseButton = createButton("⏸ Pause", "#7956c8");
pauseButton.style.display = "none";

// SHOP BUTTON
const shopButton = createButton("🛒 Game Shop", "#e77b37");

// ACHIEVEMENT BUTTON
const achievementButton = createButton("🏆 Awards", "#d69b24");

// GAME SHOP PANEL
const shopPanel = document.createElement("div");

shopPanel.style.position = "fixed";
shopPanel.style.left = "50%";
shopPanel.style.top = "50%";
shopPanel.style.transform = "translate(-50%, -50%)";
shopPanel.style.width = "min(92vw, 460px)";
shopPanel.style.maxHeight = "80vh";
shopPanel.style.overflowY = "auto";
shopPanel.style.background = "#fff8e9";
shopPanel.style.color = "#70452e";
shopPanel.style.padding = "20px";
shopPanel.style.borderRadius = "18px";
shopPanel.style.boxShadow = "0 8px 30px rgba(0,0,0,0.35)";
shopPanel.style.zIndex = "1100";
shopPanel.style.display = "none";
shopPanel.style.boxSizing = "border-box";

document.body.appendChild(shopPanel);

let gameWasPausedBeforeShop = false;

function renderShop() {
  shopPanel.innerHTML = "";

  const heading = document.createElement("h2");
  heading.textContent = "🛒 Cookie Shop";
  heading.style.textAlign = "center";

  const balance = document.createElement("h3");
  balance.textContent = "🪙 Your Coins: " + coins;
  balance.style.textAlign = "center";
  balance.style.color = "#bd8213";

  const instructions = document.createElement("p");
  instructions.textContent =
    "Catch cookies to earn coins. Buy and choose your favourite basket!";
  instructions.style.textAlign = "center";

  shopPanel.appendChild(heading);
  shopPanel.appendChild(balance);
  shopPanel.appendChild(instructions);

  shopSkins.forEach(skin => {
    const unlocked = unlockedSkins.includes(skin.id);
    const selected = selectedSkin === skin.id;

    const card = document.createElement("div");
    card.style.display = "flex";
    card.style.alignItems = "center";
    card.style.gap = "12px";
    card.style.padding = "12px";
    card.style.margin = "10px 0";
    card.style.borderRadius = "12px";
    card.style.background = selected ? "#ffe2a3" : "#f0e8dc";
    card.style.border = selected
      ? "2px solid #d69b24"
      : "2px solid transparent";

    const preview = document.createElement("div");
    preview.textContent = "🧺";
    preview.style.fontSize = "35px";
    preview.style.width = "55px";
    preview.style.height = "55px";
    preview.style.display = "flex";
    preview.style.alignItems = "center";
    preview.style.justifyContent = "center";
    preview.style.background = skin.color;
    preview.style.borderRadius = "12px";

    const details = document.createElement("div");
    details.style.flex = "1";

    const name = document.createElement("strong");
    name.textContent = skin.name;

    const description = document.createElement("div");
    description.textContent = skin.description;
    description.style.fontSize = "12px";
    description.style.marginTop = "4px";

    const price = document.createElement("div");
    price.textContent = skin.cost === 0
      ? "FREE"
      : "🪙 " + skin.cost + " coins";
    price.style.fontSize = "13px";
    price.style.fontWeight = "bold";
    price.style.marginTop = "4px";

    details.appendChild(name);
    details.appendChild(description);
    details.appendChild(price);

    const action = document.createElement("button");
    action.style.padding = "9px 12px";
    action.style.border = "none";
    action.style.borderRadius = "12px";
    action.style.color = "white";
    action.style.fontWeight = "bold";
    action.style.cursor = "pointer";

    if (selected) {
      action.textContent = "Selected";
      action.style.background = "#269b79";
      action.disabled = true;
    } else if (unlocked) {
      action.textContent = "Choose";
      action.style.background = "#299ed6";

      action.addEventListener("click", () => {
        selectedSkin = skin.id;
        saveShopData();
        playSound("click");
        renderShop();
        updateDisplays();
      });
    } else {
      action.textContent = "Buy";
      action.style.background = "#e77b37";

      action.addEventListener("click", () => {
        if (coins < skin.cost) {
          alert("You need " + (skin.cost - coins) + " more coins!");
          return;
        }

        coins -= skin.cost;
        unlockedSkins.push(skin.id);
        selectedSkin = skin.id;

        saveShopData();
        playSound("buy");
        updateDisplays();
        renderShop();
      });
    }

    card.appendChild(preview);
    card.appendChild(details);
    card.appendChild(action);

    shopPanel.appendChild(card);
  });

  const closeButton = document.createElement("button");
  closeButton.textContent = "✖ Close Shop";
  closeButton.style.display = "block";
  closeButton.style.margin = "15px auto 0";
  closeButton.style.padding = "10px 22px";
  closeButton.style.border = "none";
  closeButton.style.borderRadius = "15px";
  closeButton.style.background = "#70452e";
  closeButton.style.color = "white";
  closeButton.style.cursor = "pointer";

  closeButton.addEventListener("click", closeShop);

  shopPanel.appendChild(closeButton);
}

function openShop() {
  playSound("click");

  gameWasPausedBeforeShop = paused;

  if (running) {
    paused = true;
    keys = {};
    pauseButton.textContent = "▶ Resume";
  }

  renderShop();
  shopPanel.style.display = "block";
}

function closeShop() {
  shopPanel.style.display = "none";

  if (running && !gameWasPausedBeforeShop) {
    paused = false;
    pauseButton.textContent = "⏸ Pause";
  }
}

shopButton.addEventListener("click", openShop);

// ACHIEVEMENT COLLECTION PANEL
const achievementPanel = document.createElement("div");

achievementPanel.style.position = "fixed";
achievementPanel.style.left = "50%";
achievementPanel.style.top = "50%";
achievementPanel.style.transform = "translate(-50%, -50%)";
achievementPanel.style.width = "min(90vw, 430px)";
achievementPanel.style.maxHeight = "75vh";
achievementPanel.style.overflowY = "auto";
achievementPanel.style.background = "#fff8e9";
achievementPanel.style.color = "#70452e";
achievementPanel.style.padding = "20px";
achievementPanel.style.borderRadius = "18px";
achievementPanel.style.boxShadow = "0 8px 30px rgba(0,0,0,0.35)";
achievementPanel.style.zIndex = "1000";
achievementPanel.style.display = "none";
achievementPanel.style.boxSizing = "border-box";

document.body.appendChild(achievementPanel);

function renderAchievements() {
  const unlockedCount = unlockedAchievements.filter(id =>
    achievementDefinitions.some(item => item.id === id)
  ).length;

  achievementPanel.innerHTML = "";

  const heading = document.createElement("h2");
  heading.textContent = "🏆 Achievement Collection";
  heading.style.textAlign = "center";

  const progress = document.createElement("p");
  progress.textContent =
    unlockedCount + " / " + achievementDefinitions.length +
    " achievements unlocked";
  progress.style.textAlign = "center";
  progress.style.fontWeight = "bold";

  const closeButton = document.createElement("button");
  closeButton.textContent = "✖ Close";
  closeButton.style.display = "block";
  closeButton.style.margin = "12px auto";
  closeButton.style.padding = "9px 20px";
  closeButton.style.border = "none";
  closeButton.style.borderRadius = "15px";
  closeButton.style.background = "#70452e";
  closeButton.style.color = "white";
  closeButton.style.cursor = "pointer";

  closeButton.addEventListener("click", () => {
    achievementPanel.style.display = "none";
  });

  achievementPanel.appendChild(heading);
  achievementPanel.appendChild(progress);

  achievementDefinitions.forEach(achievement => {
    const unlocked = unlockedAchievements.includes(achievement.id);

    const card = document.createElement("div");
    card.style.padding = "10px";
    card.style.margin = "8px 0";
    card.style.borderRadius = "12px";
    card.style.background = unlocked ? "#ffe2a3" : "#eeeeee";
    card.style.opacity = unlocked ? "1" : "0.65";

    const name = document.createElement("strong");
    name.textContent =
      (unlocked ? "✅ " : "🔒 ") +
      achievement.icon + " " + achievement.name;

    const description = document.createElement("div");
    description.textContent = achievement.description;
    description.style.fontSize = "13px";
    description.style.marginTop = "5px";

    card.appendChild(name);
    card.appendChild(description);
    achievementPanel.appendChild(card);
  });

  achievementPanel.appendChild(closeButton);
}

achievementButton.addEventListener("click", () => {
  playSound("click");
  renderAchievements();

  achievementPanel.style.display =
    achievementPanel.style.display === "none"
      ? "block"
      : "none";
});

// PLAYER
const player = {
  x: 400,
  y: 425,
  width: 65,
  speed: 420
};

// COOKIE TARGETS
function getCookiesRequired(levelNumber) {
  if (levelNumber <= 5) return 10;
  if (levelNumber <= 10) return 12;
  if (levelNumber <= 15) return 14;
  if (levelNumber <= 20) return 16;

  return 16 + Math.floor((levelNumber - 20) / 5) * 2;
}

// LEVEL DIFFICULTY
const milestones = [
  { level: 1, speed: 150, spawn: 0.95, bombs: 0.10 },
  { level: 2, speed: 165, spawn: 0.92, bombs: 0.12 },
  { level: 3, speed: 165, spawn: 0.84, bombs: 0.16 },
  { level: 5, speed: 180, spawn: 0.80, bombs: 0.18 },
  { level: 10, speed: 210, spawn: 0.62, bombs: 0.30 },
  { level: 15, speed: 230, spawn: 0.54, bombs: 0.36 },
  { level: 20, speed: 270, spawn: 0.45, bombs: 0.42 }
];

function getLevelSettings() {
  if (level > 20) {
    const extraLevels = level - 20;

    return {
      speed: Math.min(270 + extraLevels * 8, 650),
      spawn: Math.max(0.45 - extraLevels * 0.01, 0.22),
      bombs: Math.min(0.42 + extraLevels * 0.008, 0.65)
    };
  }

  let lower = milestones[0];
  let upper = milestones[milestones.length - 1];

  for (let i = 0; i < milestones.length - 1; i++) {
    if (
      level >= milestones[i].level &&
      level <= milestones[i + 1].level
    ) {
      lower = milestones[i];
      upper = milestones[i + 1];
      break;
    }
  }

  const progress =
    (level - lower.level) / (upper.level - lower.level || 1);

  return {
    speed: lower.speed + (upper.speed - lower.speed) * progress,
    spawn: lower.spawn + (upper.spawn - lower.spawn) * progress,
    bombs: lower.bombs + (upper.bombs - lower.bombs) * progress
  };
}

// MESSAGES
function showMessage(message) {
  levelMessage = message;
  levelMessageTimer = 2.5;
}

// UNLOCK ACHIEVEMENT
function unlockAchievement(id) {
  if (unlockedAchievements.includes(id)) return;

  const achievement = achievementDefinitions.find(
    item => item.id === id
  );

  if (!achievement) return;

  unlockedAchievements.push(id);

  localStorage.setItem(
    "cookieCatcherAchievements",
    JSON.stringify(unlockedAchievements)
  );

  achievementMessage = "🏆 UNLOCKED: " + achievement.name + "!";
  achievementMessageTimer = 3.5;

  playSound("achievement");
  renderAchievements();
}

// CHECK ACHIEVEMENTS
function checkAchievements() {
  if (score >= 100) unlockAchievement("score_100");
  if (score >= 500) unlockAchievement("score_500");
  if (level >= 5) unlockAchievement("level_5");
  if (level >= 10) unlockAchievement("level_10");
}

// REGISTER COOKIE CATCH
function registerCookieCatch() {
  score += 10;
  cookiesThisLevel++;

  // Strawberry Basket earns 2 coins per normal cookie.
  const cookieCoins = selectedSkin === "strawberry" ? 2 : 1;
  addCoins(cookieCoins);

  playSound("cookie");

  unlockAchievement("first_cookie");
  checkAchievements();
}

// UPDATE DISPLAY
function updateDisplays() {
  levelDisplay.textContent = "🏆 Level " + level;

  progressDisplay.textContent =
    "🍪 " + cookiesThisLevel + "/" + cookiesRequired;

  highScoreDisplay.textContent = "🏅 Best: " + highScore;

  shieldDisplay.textContent =
    shieldActive ? "🛡️ Shield READY" : "";

  coinDisplay.textContent = "🪙 Coins: " + coins;

  // Show the selected basket's special power status.
  if (selectedSkin === "strawberry") {
    abilityDisplay.textContent = "🍓 +2 coins per cookie";
  } else if (selectedSkin === "ocean") {
    abilityDisplay.textContent = oceanCooldown <= 0
      ? "🌊 Bomb block READY"
      : "🌊 Bomb block: " + Math.ceil(oceanCooldown) + "s";
  } else if (selectedSkin === "gold") {
    abilityDisplay.textContent = "✨ DOUBLE COINS";
  } else if (selectedSkin === "purple") {
    abilityDisplay.textContent = royalSlowTimer > 0
      ? "👑 Slow time: " + Math.ceil(royalSlowTimer) + "s"
      : "👑 Slow power: " + Math.ceil(royalCooldown) + "s";
  } else {
    abilityDisplay.textContent = "🧺 Classic power";
  }

  scoreDisplay.textContent = score;

  // Show lives as a number.
  livesDisplay.textContent = "Lives: " + lives;
}

// ADVANCE LEVEL
function advanceLevel() {
  const previousCookieTarget = cookiesRequired;

  level++;
  cookiesThisLevel = 0;
  cookiesRequired = getCookiesRequired(level);

  items = [];
  spawnTimer = 0;

  playSound("level");

  if (cookiesRequired > previousCookieTarget) {
    lives++;
    showMessage("LEVEL " + level + "! ❤️ EXTRA LIFE!");
    playSound("extraLife");
  } else {
    showMessage("LEVEL " + level + "! 🎉");
  }

  checkAchievements();
  updateDisplays();
}

// POWER-UP EFFECTS
function collectPowerUp(type) {
  if (type === "golden") {
    score += 50;
    cookiesThisLevel++;

    // Golden cookies give 5 coins, doubled by Golden Basket.
    addCoins(5);

    showMessage("🌟 GOLDEN COOKIE! +50 POINTS!");
    playSound("golden");

    unlockAchievement("golden_cookie");
  }

  if (type === "shield") {
    shieldActive = true;

    showMessage("🛡️ MAGIC SHIELD ACTIVATED!");
    playSound("shield");
  }

  if (type === "extraLife") {
    lives++;

    showMessage("❤️ EXTRA LIFE!");
    playSound("extraLife");

    unlockAchievement("extra_life");
  }

  checkAchievements();
  updateDisplays();
}

// OCEAN BASKET: BLOCK A BOMB
function blockBombWithOcean() {
  if (selectedSkin !== "ocean" || oceanCooldown > 0) {
    return false;
  }

  oceanCooldown = 30;

  showMessage("🌊 OCEAN POWER! BOMB BLOCKED!");
  playSound("shieldHit");

  return true;
}

// ROYAL BASKET: SLOW FALLING OBJECTS
function updateBasketPowers(delta) {
  if (selectedSkin === "ocean") {
    oceanCooldown = Math.max(0, oceanCooldown - delta);
  }

  if (selectedSkin === "purple") {
    if (royalSlowTimer > 0) {
      royalSlowTimer = Math.max(0, royalSlowTimer - delta);
    } else {
      royalCooldown -= delta;

      if (royalCooldown <= 0) {
        royalSlowTimer = 5;
        royalCooldown = 30;

        showMessage("👑 ROYAL POWER! SLOW MOTION!");
        playSound("shield");
      }
    }
  }
}

// HOME
function goHome() {
  playSound("click");

  running = false;
  paused = false;

  items = [];
  keys = {};
  shieldActive = false;

  gameOver.classList.remove("show");
  startScreen.style.display = "flex";

  homeButton.style.display = "none";
  pauseButton.style.display = "none";

  // Show Shop and Awards on the home screen.
  shopButton.style.display = "inline-block";
  achievementButton.style.display = "inline-block";

  achievementPanel.style.display = "none";
  shopPanel.style.display = "none";

  updateDisplays();
}

homeButton.addEventListener("click", goHome);

// PAUSE AND RESUME
function togglePause() {
  if (!running || shopPanel.style.display === "block") return;

  playSound("click");

  paused = !paused;
  keys = {};

  pauseButton.textContent = paused
    ? "▶ Resume"
    : "⏸ Pause";
}

pauseButton.addEventListener("click", togglePause);

// BACKGROUND
function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, 500);

  gradient.addColorStop(0, "#83ddff");
  gradient.addColorStop(1, "#d8f6ff");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 500);

  ctx.fillStyle = "white";

  for (let i = 0; i < 5; i++) {
    let x = ((i * 190 + animationTime * 12) % 950) - 70;
    let y = 55 + (i % 2) * 65;

    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 25, y - 10, 28, 0, Math.PI * 2);
    ctx.arc(x + 52, y, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#78d66b";
  ctx.fillRect(0, 475, 800, 25);

  ctx.fillStyle = "#a4ec83";
  ctx.fillRect(0, 475, 800, 7);
}

// PLAYER
function drawPlayer() {
  if (shieldActive) {
    ctx.save();

    ctx.beginPath();
    ctx.ellipse(
      player.x,
      player.y + 24,
      48,
      38,
      0,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle = "#26a8ff";
    ctx.lineWidth = 5;
    ctx.shadowColor = "#00aaff";
    ctx.shadowBlur = 18;
    ctx.stroke();

    ctx.restore();
  }

  const basketColor = getSelectedSkin().color;

  // Royal Basket gets a purple glow while its power is active.
  if (selectedSkin === "purple" && royalSlowTimer > 0) {
    ctx.save();
    ctx.shadowColor = "#b66cff";
    ctx.shadowBlur = 25;
  }

  ctx.fillStyle = basketColor;

  ctx.beginPath();
  ctx.roundRect(
    player.x - player.width / 2,
    player.y,
    player.width,
    48,
    12
  );
  ctx.fill();

  ctx.strokeStyle = "#78401f";
  ctx.lineWidth = 5;
  ctx.stroke();

  if (selectedSkin === "purple" && royalSlowTimer > 0) {
    ctx.restore();
  }

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(player.x - 12, player.y + 17, 5, 0, Math.PI * 2);
  ctx.arc(player.x + 12, player.y + 17, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#432719";
  ctx.beginPath();
  ctx.arc(player.x, player.y + 27, 7, 0, Math.PI);
  ctx.stroke();
}

// FALLING OBJECTS
function drawItem(item) {
  const symbols = {
    cookie: "🍪",
    bomb: "💣",
    golden: "🌟",
    shield: "🛡️",
    extraLife: "❤️"
  };

  ctx.save();
  ctx.font = "38px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (item.type === "golden") {
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 20;
  }

  if (item.type === "shield") {
    ctx.shadowColor = "#26a8ff";
    ctx.shadowBlur = 18;
  }

  if (item.type === "extraLife") {
    ctx.shadowColor = "#ff4b6e";
    ctx.shadowBlur = 18;
  }

  ctx.fillText(symbols[item.type], item.x, item.y);
  ctx.restore();
}

// SPAWN ITEMS
function spawnItem() {
  const settings = getLevelSettings();
  const roll = Math.random();

  let type;

  if (roll < settings.bombs) {
    type = "bomb";
  } else if (roll < settings.bombs + 0.035) {
    type = "golden";
  } else if (roll < settings.bombs + 0.065) {
    type = "shield";
  } else if (roll < settings.bombs + 0.09) {
    type = "extraLife";
  } else {
    type = "cookie";
  }

  items.push({
    x: 30 + Math.random() * 740,
    y: -30,
    speed: settings.speed + Math.random() * 80,
    type
  });
}

// START GAME
function startGame() {
  initializeAudio();
  playSound("click");

  score = 0;
  lives = 3;

  level = 1;
  cookiesThisLevel = 0;
  cookiesRequired = getCookiesRequired(level);

  items = [];
  spawnTimer = 0;

  player.x = 400;

  levelMessage = "";
  levelMessageTimer = 0;

  achievementMessage = "";
  achievementMessageTimer = 0;

  keys = {};
  paused = false;
  running = true;
  shieldActive = false;

  // Track every new game and restart.
  trackGameEvent("game_start");

  // Reset special basket powers at the start of each game.
  oceanCooldown = 0;
  royalCooldown = 0;
  royalSlowTimer = 0;

  startScreen.style.display = "none";
  gameOver.classList.remove("show");
  achievementPanel.style.display = "none";
  shopPanel.style.display = "none";

  homeButton.style.display = "inline-block";
  pauseButton.style.display = "inline-block";
  pauseButton.textContent = "⏸ Pause";

  // Hide Shop and Awards while playing.
  shopButton.style.display = "none";
  achievementButton.style.display = "none";

  updateDisplays();
}

// PLAY BUTTON
playButton.addEventListener("click", startGame);

// RESTART BUTTON
document.getElementById("restart")
  .addEventListener("click", startGame);

// GAME OVER
function endGame() {
  running = false;
  paused = false;

  homeButton.style.display = "none";
  pauseButton.style.display = "none";

  // Keep Shop and Awards hidden on the game-over screen.
  shopButton.style.display = "none";
  achievementButton.style.display = "none";

  const newRecord = score > highScore;

  if (newRecord) {
    highScore = score;

    localStorage.setItem(
      "cookieCatcherHighScore",
      highScore
    );
  }

  finalScore.textContent = score;

  // Track the completed game and its final score and level.
  trackGameEvent("game_over", {
    score: score,
    level: level
  });

  if (newRecord) {
    finalScore.textContent += " 🏆 NEW HIGH SCORE!";
  }

  updateDisplays();
  gameOver.classList.add("show");

  playSound("gameOver");
}

// UPDATE GAME
function update(delta) {
  if (!running || paused) return;

  // Update special basket powers.
  updateBasketPowers(delta);

  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) {
    player.x -= player.speed * delta;
  }

  if (keys["ArrowRight"] || keys["d"] || keys["D"]) {
    player.x += player.speed * delta;
  }

  player.x = Math.max(35, Math.min(765, player.x));

  const settings = getLevelSettings();

  spawnTimer += delta;

  if (spawnTimer > settings.spawn) {
    spawnItem();
    spawnTimer = 0;
  }

  // Royal Basket slows all falling objects by 50%.
  const fallingSpeedMultiplier =
    selectedSkin === "purple" && royalSlowTimer > 0
      ? 0.5
      : 1;

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];

    item.y += item.speed * delta * fallingSpeedMultiplier;

    const caught =
      Math.abs(item.x - player.x) < 48 &&
      item.y > player.y - 10 &&
      item.y < player.y + 45;

    if (caught) {
      if (item.type === "cookie") {
        registerCookieCatch();

      } else if (item.type === "bomb") {
        if (shieldActive) {
          shieldActive = false;

          showMessage("🛡️ SHIELD BLOCKED THE BOMB!");
          playSound("shieldHit");

          unlockAchievement("shield_save");

        } else if (blockBombWithOcean()) {
          // Ocean Basket used its automatic bomb protection.

        } else {
          lives--;
          playSound("bomb");
        }

      } else {
        collectPowerUp(item.type);
      }

      items.splice(i, 1);

      if (cookiesThisLevel >= cookiesRequired) {
        advanceLevel();
        break;
      }

      continue;
    }

    if (item.y > 510) {
      if (item.type === "cookie") {
        lives--;
        playSound("miss");
      }

      items.splice(i, 1);
    }
  }

  if (levelMessageTimer > 0) {
    levelMessageTimer -= delta;
  }

  if (achievementMessageTimer > 0) {
    achievementMessageTimer -= delta;
  }

  checkAchievements();
  updateDisplays();

  if (lives <= 0) {
    endGame();
  }
}

// DRAW GAME
function draw() {
  drawBackground();

  if (running) {
    items.forEach(drawItem);
    drawPlayer();

    if (levelMessageTimer > 0 && !paused) {
      ctx.textAlign = "center";
      ctx.font = "bold 30px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#75421f";
      ctx.shadowBlur = 8;

      ctx.fillText(levelMessage, 400, 190);
      ctx.shadowBlur = 0;
    }

    if (achievementMessageTimer > 0 && !paused) {
      ctx.textAlign = "center";
      ctx.font = "bold 23px Arial";
      ctx.fillStyle = "#fff2a6";
      ctx.shadowColor = "#70452e";
      ctx.shadowBlur = 10;

      ctx.fillText(achievementMessage, 400, 240);
      ctx.shadowBlur = 0;
    }

    if (paused) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, 800, 500);

      ctx.textAlign = "center";
      ctx.fillStyle = "white";
      ctx.font = "bold 48px Arial";
      ctx.fillText("⏸ PAUSED", 400, 230);

      ctx.font = "22px Arial";
      ctx.fillText("Press Resume when you're ready!", 400, 275);
    }

  } else if (startScreen.style.display !== "none") {
    ctx.font = "60px Arial";
    ctx.textAlign = "center";
    ctx.fillText("🧺", 400, 440);
  }
}

// MAIN GAME LOOP
function gameLoop(timestamp) {
  const delta = lastTime
    ? Math.min((timestamp - lastTime) / 1000, 0.04)
    : 0;

  lastTime = timestamp;
  animationTime += delta;

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

// KEYBOARD CONTROLS
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && running) {
    if (shopPanel.style.display === "block") {
      closeShop();
    } else {
      togglePause();
    }
    return;
  }

  if (paused) return;

  keys[event.key] = true;

  if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", (event) => {
  keys[event.key] = false;
});

// MOUSE AND MOBILE CONTROLS
function movePlayer(event) {
  if (!running || paused) return;

  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;

  player.x = (event.clientX - rect.left) * scale;
  player.x = Math.max(35, Math.min(765, player.x));
}

canvas.addEventListener("pointerdown", (event) => {
  if (!running || paused) return;

  canvas.setPointerCapture(event.pointerId);
  movePlayer(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (event.buttons || event.pointerType === "touch") {
    movePlayer(event);
  }
});

// INITIALIZE
renderAchievements();
updateDisplays();
requestAnimationFrame(gameLoop);
