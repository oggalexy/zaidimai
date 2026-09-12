const itemsEl = document.getElementById("items");
const conveyor = document.getElementById("conveyor");
const pressHead = document.getElementById("pressHead");
const pressRod = document.getElementById("pressRod");

let money = 0;
let crushed = 0;
let totalEarned = 0;
let combo = 0;
let bestCombo = 0;
let comboTimer = 0;
let machineLevel = 1;
let powerLevel = 1;
let speedLevel = 1;
let pressSpeedLevel = 1;
let valueLevel = 1;
let varietyLevel = 1;
let worldVarietyLevels = Array(5).fill(1);
let luckLevel = 1;
let autoLevel = 1;
let paused = false;
let pressBusy = false;
let pressState = "up";
let conveyorBlocked = false;
let capturedItem = null;
let pressCycleTimers = [];
let pressJammed = false;
let pressJamStart = 0;
let pressJamDuration = 720;
let pressJamProgress = 0;

let speed = 75;
let itemValue = 10;
let pressPower = 1;
let spawnDelay = 1500;

let speedCost = 25;
let pressSpeedCost = 90;
let valueCost = 50;
let varietyCost = 75;
let powerCost = 120;
let luckCost = 180;
let autoCost = 300;
let machineCost = 1000;

const activeItems = [];
const milestones = new Set();

const moneyEl = document.getElementById("money");
const crushedEl = document.getElementById("crushed");

// =========================
// SOUND SYSTEM
// =========================
let audioCtx = null;
let masterGain = null;
let conveyorGain = null;
let crushGain = null;
let upgradeGain = null;
let conveyorHum = null;
let conveyorNoise = null;
let soundSettings = { master: 0.55, conveyor: 0.16, crush: 0.72, upgrade: 0.55 };

function loadSoundSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("pressSoundSettings"));
    if (saved) soundSettings = { ...soundSettings, ...saved };
  } catch (_) {}
}

function saveSoundSettings() {
  localStorage.setItem("pressSoundSettings", JSON.stringify(soundSettings));
}

function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  conveyorGain = audioCtx.createGain();
  crushGain = audioCtx.createGain();
  upgradeGain = audioCtx.createGain();
  masterGain.gain.value = soundSettings.master;
  conveyorGain.gain.value = soundSettings.conveyor;
  crushGain.gain.value = soundSettings.crush;
  upgradeGain.gain.value = soundSettings.upgrade;
  masterGain.connect(audioCtx.destination);
  conveyorGain.connect(masterGain);
  crushGain.connect(masterGain);
  upgradeGain.connect(masterGain);
  startConveyorSound();
  audioCtx.resume();
}

function makeNoiseBuffer(duration = 1) {
  const buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * duration), audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function startConveyorSound() {
  if (!audioCtx || conveyorHum) return;

  conveyorHum = audioCtx.createOscillator();
  const humFilter = audioCtx.createBiquadFilter();
  const humGain = audioCtx.createGain();
  conveyorHum.type = "triangle";
  conveyorHum.frequency.value = 42;
  humFilter.type = "lowpass";
  humFilter.frequency.value = 110;
  humGain.gain.value = 0.06;
  conveyorHum.connect(humFilter).connect(humGain).connect(conveyorGain);
  conveyorHum.start();

  conveyorNoise = audioCtx.createBufferSource();
  const noiseFilter = audioCtx.createBiquadFilter();
  const noiseGain = audioCtx.createGain();
  conveyorNoise.buffer = makeNoiseBuffer(2);
  conveyorNoise.loop = true;
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 190;
  noiseGain.gain.value = 0.035;
  conveyorNoise.connect(noiseFilter).connect(noiseGain).connect(conveyorGain);
  conveyorNoise.start();
}

function setSoundVolume(type, value) {
  soundSettings[type] = Number(value);
  if (!audioCtx) initAudio();
  const gains = { master: masterGain, conveyor: conveyorGain, crush: crushGain, upgrade: upgradeGain };
  if (gains[type]) gains[type].gain.setTargetAtTime(soundSettings[type], audioCtx.currentTime, 0.02);
  saveSoundSettings();
}

function playTone(frequency, duration, type = "sine", volume = 0.12, startTime = 0) {
  if (!audioCtx || !masterGain) return;
  const now = audioCtx.currentTime + startTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(upgradeGain);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playUpgradeSound() {
  initAudio();
  playTone(392, 0.11, "triangle", 0.08);
  playTone(494, 0.11, "triangle", 0.08, 0.06);
  playTone(587, 0.15, "triangle", 0.10, 0.12);
  playTone(784, 0.22, "sine", 0.06, 0.20);
}

function playCrushSound(item) {
  initAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const weight = item.type.weight;

  const hiss = audioCtx.createBufferSource();
  const hissFilter = audioCtx.createBiquadFilter();
  const hissGain = audioCtx.createGain();
  hiss.buffer = makeNoiseBuffer(0.45);
  hissFilter.type = "bandpass";
  hissFilter.frequency.value = 1300 + weight * 350;
  hissFilter.Q.value = 0.8;
  hissGain.gain.setValueAtTime(0.0001, now);
  hissGain.gain.linearRampToValueAtTime(0.045, now + 0.04);
  hissGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  hiss.connect(hissFilter).connect(hissGain).connect(crushGain);
  hiss.start(now);
  hiss.stop(now + 0.45);

  const impact = audioCtx.createOscillator();
  const impactGain = audioCtx.createGain();
  impact.type = "square";
  impact.frequency.setValueAtTime(75 + weight * 25, now + 0.15);
  impact.frequency.exponentialRampToValueAtTime(35, now + 0.38);
  impactGain.gain.setValueAtTime(0.0001, now + 0.15);
  impactGain.gain.exponentialRampToValueAtTime(Math.min(0.14, 0.075 + weight * 0.035), now + 0.17);
  impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  impact.connect(impactGain).connect(crushGain);
  impact.start(now + 0.15);
  impact.stop(now + 0.43);

  playCrushClank(170 + weight * 40);
}

function playCrushClank(frequency) {
  if (!audioCtx || !crushGain) return;
  const now = audioCtx.currentTime + 0.2;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  osc.connect(gain).connect(crushGain);
  osc.start(now);
  osc.stop(now + 0.15);
}

loadSoundSettings();
window.addEventListener("pointerdown", initAudio, { once: true });
window.addEventListener("keydown", initAudio, { once: true });

// =========================
// WORLDS / LEVELS / ITEMS
// =========================
const worlds = [
  {
    name: "SCRAP YARD",
    items: [
      { name: "can", label: "Soda can", weight: 1.0, value: 1.0, powerReq: 1, varietyReq: 1 },
      { name: "bottle", label: "Plastic bottle", weight: 0.7, value: 1.05, powerReq: 1, varietyReq: 1 },
      { name: "box", label: "Cardboard box", weight: 0.55, value: 1.15, powerReq: 1, varietyReq: 1 },
      { name: "brick", label: "Brick", weight: 1.35, value: 1.65, powerReq: 2, varietyReq: 2 },
      { name: "tire", label: "Rubber tire", weight: 1.2, value: 1.45, powerReq: 3, varietyReq: 2 },
      { name: "battery", label: "Car battery", weight: 2.0, value: 2.15, powerReq: 3, varietyReq: 3 },
      { name: "pipe", label: "Steel pipe", weight: 2.5, value: 2.7, powerReq: 4, varietyReq: 4 },
      { name: "engine", label: "Old engine", weight: 3.2, value: 3.5, powerReq: 5, varietyReq: 5 },
      { name: "safe", label: "Scrap safe", weight: 3.8, value: 4.4, powerReq: 6, varietyReq: 5 }
    ]
  },
  {
    name: "ALIEN RUINS",
    items: [
      { name: "alienOrb", label: "Alien orb", weight: 1.1, value: 3.0, powerReq: 2, varietyReq: 1 },
      { name: "alienCell", label: "Energy cell", weight: 0.8, value: 3.4, powerReq: 2, varietyReq: 1 },
      { name: "alienRelic", label: "Alien relic", weight: 1.8, value: 4.3, powerReq: 3, varietyReq: 2 },
      { name: "alienHelmet", label: "Alien helmet", weight: 1.5, value: 4.8, powerReq: 4, varietyReq: 3 },
      { name: "alienCore", label: "Quantum core", weight: 2.2, value: 6.0, powerReq: 5, varietyReq: 5 },
      { name: "alienDrone", label: "Alien drone", weight: 2.0, value: 6.5, powerReq: 4, varietyReq: 3 },
      { name: "alienTablet", label: "Ancient alien tablet", weight: 2.6, value: 7.4, powerReq: 5, varietyReq: 4 },
      { name: "alienPrism", label: "Void prism", weight: 2.9, value: 8.6, powerReq: 6, varietyReq: 5 },
      { name: "alienEngine", label: "Alien engine", weight: 3.5, value: 10.0, powerReq: 7, varietyReq: 5 }
    ]
  },
  {
    name: "MONSTER LAB",
    items: [
      { name: "monsterEye", label: "Monster eye", weight: 0.9, value: 4.0, powerReq: 3, varietyReq: 1 },
      { name: "monsterTooth", label: "Monster tooth", weight: 1.3, value: 4.6, powerReq: 3, varietyReq: 1 },
      { name: "monsterClaw", label: "Monster claw", weight: 1.5, value: 5.2, powerReq: 4, varietyReq: 2 },
      { name: "monsterHorn", label: "Monster horn", weight: 2.0, value: 6.0, powerReq: 5, varietyReq: 3 },
      { name: "monsterEgg", label: "Monster egg", weight: 2.4, value: 7.0, powerReq: 6, varietyReq: 5 },
      { name: "monsterSkull", label: "Monster skull", weight: 2.7, value: 7.8, powerReq: 5, varietyReq: 3 },
      { name: "monsterFang", label: "Titan fang", weight: 2.2, value: 8.8, powerReq: 6, varietyReq: 4 },
      { name: "monsterHeart", label: "Mutant heart", weight: 3.0, value: 10.2, powerReq: 7, varietyReq: 5 },
      { name: "monsterCore", label: "Beast core", weight: 3.5, value: 12.0, powerReq: 8, varietyReq: 5 }
    ]
  },
  {
    name: "DEEP SPACE",
    items: [
      { name: "starShard", label: "Star shard", weight: 1.4, value: 7.0, powerReq: 4, varietyReq: 1 },
      { name: "moonRock", label: "Moon rock", weight: 2.0, value: 8.0, powerReq: 4, varietyReq: 1 },
      { name: "spaceDrone", label: "Space drone", weight: 1.8, value: 9.0, powerReq: 5, varietyReq: 2 },
      { name: "plasmaCell", label: "Plasma cell", weight: 1.2, value: 10.0, powerReq: 6, varietyReq: 3 },
      { name: "blackCore", label: "Black core", weight: 3.0, value: 12.0, powerReq: 7, varietyReq: 5 },
      { name: "spaceBattery", label: "Fusion battery", weight: 2.1, value: 11.5, powerReq: 5, varietyReq: 3 },
      { name: "meteorChunk", label: "Meteor chunk", weight: 3.1, value: 14.0, powerReq: 7, varietyReq: 4 },
      { name: "satelliteCore", label: "Satellite core", weight: 3.6, value: 16.5, powerReq: 8, varietyReq: 5 },
      { name: "gravityCube", label: "Gravity cube", weight: 4.0, value: 19.0, powerReq: 9, varietyReq: 5 }
    ]
  },
  {
    name: "ANCIENT VAULT",
    items: [
      { name: "ancientCoin", label: "Ancient coin", weight: 0.8, value: 10.0, powerReq: 5, varietyReq: 1 },
      { name: "goldIdol", label: "Gold idol", weight: 2.0, value: 13.0, powerReq: 5, varietyReq: 1 },
      { name: "cursedMask", label: "Cursed mask", weight: 1.7, value: 15.0, powerReq: 6, varietyReq: 2 },
      { name: "vaultCrystal", label: "Vault crystal", weight: 2.3, value: 18.0, powerReq: 7, varietyReq: 3 },
      { name: "relicCore", label: "Relic core", weight: 3.2, value: 22.0, powerReq: 8, varietyReq: 5 },
      { name: "goldChest", label: "Golden chest", weight: 3.0, value: 24.0, powerReq: 7, varietyReq: 3 },
      { name: "ancientBlade", label: "Ancient blade", weight: 2.4, value: 27.0, powerReq: 8, varietyReq: 4 },
      { name: "royalRelic", label: "Royal relic", weight: 3.7, value: 31.0, powerReq: 9, varietyReq: 5 },
      { name: "vaultHeart", label: "Vault heart", weight: 4.2, value: 36.0, powerReq: 10, varietyReq: 5 }
    ]
  }
];

const LEVELS_PER_WORLD = 5;
const MAX_LEVEL = worlds.length * LEVELS_PER_WORLD;
let level = 1;
let worldIndex = 0;

function getWorldIndexForLevel(lvl) {
  return Math.min(worlds.length - 1, Math.floor((lvl - 1) / LEVELS_PER_WORLD));
}

function getWorldLevel(lvl) {
  return ((lvl - 1) % LEVELS_PER_WORLD) + 1;
}

function getLevelGoal(lvl) {
  // Cumulative milestones get substantially harder instead of being a flat grind.
  return Math.round(35 * Math.pow(lvl, 1.55));
}

function getCurrentLevelGoal() {
  return getLevelGoal(level);
}

function getNextUnlock(lvl) {
  const unlocks = {
    2: "Press Power",
    3: "Feeder Upgrade",
    4: "Scrap Luck",
    5: "Item Variety",
    6: "WORLD 2 · ALIEN RUINS + Alien items",
    7: "Upgrade Machine",
    8: "Press Power II · unlocks tougher objects",
    9: "Feeder Upgrade II",
    10: "Alien item bonus",
    11: "WORLD 3 · MONSTER LAB + Monster items",
    12: "Scrap Luck II",
    13: "Item Variety II",
    14: "Upgrade Machine II",
    15: "Monster item bonus",
    16: "WORLD 4 · DEEP SPACE + Space items",
    17: "Press Speed II",
    18: "Press Power III",
    19: "Feeder Upgrade III",
    20: "Deep Space item bonus",
    21: "WORLD 5 · ANCIENT VAULT + Ancient items",
    22: "Item Value II",
    23: "Scrap Luck III",
    24: "Upgrade Machine III",
    25: "Ancient item bonus"
  };
  return unlocks[lvl] || "Max level reached";
}

function syncLevelFromProgress() {
  let newLevel = 1;
  while (newLevel < MAX_LEVEL && crushed >= getLevelGoal(newLevel)) newLevel++;
  const oldWorld = worldIndex;
  const oldLevel = level;
  level = newLevel;
  worldIndex = getWorldIndexForLevel(level);
  syncWorldVarietyLevel();
  if (level > oldLevel) {
    for (let l = oldLevel + 1; l <= level; l++) {
      const worldChanged = getWorldIndexForLevel(l) !== getWorldIndexForLevel(l - 1);
      if (worldChanged || l > oldLevel) showToast(`LEVEL ${l} UNLOCKED · ${getNextUnlock(l)}`);
    }
  }
  if (worldIndex > oldWorld) {
    showToast(`WORLD ${worldIndex + 1} UNLOCKED · ${worlds[worldIndex].name}`);
  }
}

function getCurrentWorldItems() {
  return worlds[worldIndex].items;
}

const models = {
  can: `<div class="model can-model"><div class="can-top"><span class="pull-tab"></span></div><div class="can-body"><span class="can-shine"></span><span class="can-rings"></span></div><div class="can-bottom"></div></div>`,
  bottle: `<div class="model bottle-model"><div class="bottle-cap"></div><div class="bottle-neck"></div><div class="bottle-body"><span class="bottle-shine"></span><span class="bottle-label">WATER</span></div></div>`,
  box: `<div class="model box-model"><div class="box-top"></div><div class="box-front"><span class="box-tape"></span></div><div class="box-side"></div></div>`,
  tire: `<div class="model tire-model"><div class="tire-side"><div class="tire-hole"></div></div></div>`,
  brick: `<div class="model brick-model"><span></span><span></span><span></span><span></span></div>`,
  battery: `<div class="model battery-model"><div class="battery-cap"></div><div class="battery-body"><b>+</b><i>POWER</i></div></div>`,
  phone: `<div class="model phone-model"><div class="phone-screen"></div><div class="phone-button"></div></div>`,
  ball: `<div class="model ball-model"><span></span></div>`,
  engine: `<div class="model engine-model"><div class="engine-block"></div><div class="engine-cylinder c1"></div><div class="engine-cylinder c2"></div><div class="engine-pipe"></div></div>`,
  monitor: `<div class="model monitor-model"><div class="monitor-screen"></div><div class="monitor-base"></div></div>`,
  pipe: `<div class="model pipe-model"><div class="pipe-body"></div><div class="pipe-rim"></div></div>`,
  safe: `<div class="model safe-model"><div class="safe-door"><span class="safe-dial"></span><span class="safe-handle"></span></div></div>`,
  alienOrb: `<div class="world-model alien-orb"><span></span></div>`,
  alienCell: `<div class="world-model alien-cell"><span></span></div>`,
  alienRelic: `<div class="world-model alien-relic"><span></span></div>`,
  alienHelmet: `<div class="world-model alien-helmet"><span></span></div>`,
  alienCore: `<div class="world-model alien-core"><span></span></div>`,
  monsterEye: `<div class="world-model monster-eye"><span></span></div>`,
  monsterTooth: `<div class="world-model monster-tooth"><span></span></div>`,
  monsterClaw: `<div class="world-model monster-claw"><span></span></div>`,
  monsterHorn: `<div class="world-model monster-horn"><span></span></div>`,
  monsterEgg: `<div class="world-model monster-egg"><span></span></div>`,
  starShard: `<div class="world-model star-shard"><span></span></div>`,
  moonRock: `<div class="world-model moon-rock"><span></span></div>`,
  spaceDrone: `<div class="world-model space-drone"><span></span></div>`,
  plasmaCell: `<div class="world-model plasma-cell"><span></span></div>`,
  blackCore: `<div class="world-model black-core"><span></span></div>`,
  ancientCoin: `<div class="world-model ancient-coin"><span></span></div>`,
  goldIdol: `<div class="world-model gold-idol"><span></span></div>`,
  cursedMask: `<div class="world-model cursed-mask"><span></span></div>`,
  vaultCrystal: `<div class="world-model vault-crystal"><span></span></div>`,
  relicCore: `<div class="world-model relic-core"><span></span></div>`,
  alienDrone: `<div class="world-model alien-drone"><span></span></div>`,
  alienTablet: `<div class="world-model alien-tablet"><span></span></div>`,
  alienPrism: `<div class="world-model alien-prism"><span></span></div>`,
  alienEngine: `<div class="world-model alien-engine"><span></span></div>`,
  monsterSkull: `<div class="world-model monster-skull"><span></span></div>`,
  monsterFang: `<div class="world-model monster-fang"><span></span></div>`,
  monsterHeart: `<div class="world-model monster-heart"><span></span></div>`,
  monsterCore: `<div class="world-model monster-core"><span></span></div>`,
  spaceBattery: `<div class="world-model space-battery"><span></span></div>`,
  meteorChunk: `<div class="world-model meteor-chunk"><span></span></div>`,
  satelliteCore: `<div class="world-model satellite-core"><span></span></div>`,
  gravityCube: `<div class="world-model gravity-cube"><span></span></div>`,
  goldChest: `<div class="world-model gold-chest"><span></span></div>`,
  ancientBlade: `<div class="world-model ancient-blade"><span></span></div>`,
  royalRelic: `<div class="world-model royal-relic"><span></span></div>`,
  vaultHeart: `<div class="world-model vault-heart"><span></span></div>`,

};

function syncWorldVarietyLevel() {
  if (!Array.isArray(worldVarietyLevels) || worldVarietyLevels.length !== worlds.length) {
    worldVarietyLevels = Array(worlds.length).fill(1);
  }
  varietyLevel = Math.max(1, worldVarietyLevels[worldIndex] || 1);
}

function setWorldVarietyLevel(value) {
  if (!Array.isArray(worldVarietyLevels) || worldVarietyLevels.length !== worlds.length) {
    worldVarietyLevels = Array(worlds.length).fill(1);
  }
  worldVarietyLevels[worldIndex] = Math.max(1, value);
  varietyLevel = worldVarietyLevels[worldIndex];
}

function getAvailableWorldItems() {
  return getCurrentWorldItems().filter(type => (type.varietyReq || 1) <= varietyLevel);
}

function getWorldVarietyCap() {
  return Math.max(...getCurrentWorldItems().map(type => type.varietyReq || 1));
}

function getRandomItemType() {
  const pool = getAvailableWorldItems();
  if (!pool.length) return worlds[0].items[0];

  const luckyPool = [...pool];
  if (luckLevel > 1) {
    const rare = pool.filter(type => (type.varietyReq || 1) >= 3);
    for (const type of rare) {
      for (let i = 1; i < luckLevel; i++) luckyPool.push(type);
    }
  }

  return luckyPool[Math.floor(Math.random() * luckyPool.length)];
}

function getPressCycleDuration() {
  // Total cycle is still useful for the stats display.
  return Math.max(1800, 3600 - (pressSpeedLevel - 1) * 220 - (machineLevel - 1) * 60);
}

function getPressDownTime() {
  // Press Speed controls the actual downstroke speed.
  return Math.max(420, 1700 - (pressSpeedLevel - 1) * 180 - (machineLevel - 1) * 35);
}

function getPressTimings() {
  const downTime = getPressDownTime();
  const crushHold = 260;
  const upTime = 650;
  return {
    cycle: downTime + crushHold + upTime,
    downTime,
    crushHold,
    upTime
  };
}

function setPressGeometry() {
  if (!pressHead || !conveyor) return;
  const press = document.querySelector(".press");
  if (!press) return;

  const conveyorTop = conveyor.offsetTop;
  const pressTop = press.offsetTop;
  const targetBottom = conveyorTop + conveyor.clientHeight - 15;
  const targetTop = targetBottom - pressTop - pressHead.offsetHeight;
  pressHead.style.setProperty("--press-down-top", `${targetTop}px`);
}

function getPressPositions() {
  const press = document.querySelector(".press");
  if (!press || !pressHead || !conveyor) return { top: 68, bottom: 140 };

  const conveyorTop = conveyor.offsetTop;
  const pressTop = press.offsetTop;
  const targetBottom = conveyorTop + conveyor.clientHeight - 15;
  const targetTop = targetBottom - pressTop - pressHead.offsetHeight;
  return { top: 68, bottom: targetTop };
}

function getPressCenter() {
  return conveyor.clientWidth / 2;
}

function findItemsUnderPress() {
  const center = getPressCenter();
  const pressWidth = pressHead ? pressHead.offsetWidth : 150;
  const pressLeft = center - pressWidth / 2;
  const pressRight = center + pressWidth / 2;
  const targets = [];

  for (const item of activeItems) {
    if (item.crushed || item.jammedByPress || !item.el.isConnected) continue;

    const itemLeft = item.x;
    const itemRight = item.x + item.el.offsetWidth;

    // At the bottom of the stroke, crush every item whose horizontal
    // footprint overlaps the press head. The item does NOT need to have
    // been underneath the press when the downstroke started.
    if (itemRight >= pressLeft && itemLeft <= pressRight) {
      targets.push(item);
    }
  }

  return targets;
}

function updateConveyorLock() {
  // The conveyor must NEVER stop for the press.
  conveyorBlocked = false;
  if (conveyor) conveyor.classList.remove("stopped");
  return false;
}

function startPressCycle(now) {
  if (paused || pressState !== "up") return;

  const { downTime, crushHold, upTime } = getPressTimings();
  pressState = "down";
  pressCycleStart = now;
  pressCycleDownTime = downTime;
  pressCycleHoldTime = crushHold;
  pressCycleUpTime = upTime;

  setPressGeometry();
  pressHead.style.transitionDuration = "0ms";
  pressHead.classList.add("pressing");
}

function setPressVisual(progress) {
  const positions = getPressPositions();
  const p = Math.max(0, Math.min(1, progress));
  const headTop = positions.top + (positions.bottom - positions.top) * p;
  pressHead.style.top = `${headTop}px`;
  if (pressRod) pressRod.style.height = `${Math.max(18, headTop - 42)}px`;
}

function itemNeedsMorePower(item) {
  return item && (item.type.powerReq || 1) > powerLevel;
}

function getItemsInPressPath() {
  const center = getPressCenter();
  const pressWidth = pressHead ? pressHead.offsetWidth : 150;
  const pressLeft = center - pressWidth / 2;
  const pressRight = center + pressWidth / 2;
  return activeItems.filter(item => {
    if (item.crushed || item.jammedByPress || !item.el.isConnected) return false;
    const itemLeft = item.x;
    const itemRight = item.x + item.el.offsetWidth;
    return itemRight >= pressLeft && itemLeft <= pressRight;
  });
}

function triggerPressJam(now, progress, blocked) {
  if (pressJammed) return;
  pressJammed = true;
  if (blocked) blocked.jammedByPress = true;
  pressJamStart = now;
  pressJamProgress = progress;
  pressHead.classList.remove("pressing");
  pressHead.classList.add("press-jammed");
  setPressVisual(progress);
  playPressJamSound();
  spawnPressSparks();
}

function playPressJamSound() {
  initAudio();
  if (!audioCtx || !crushGain) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(95, now);
  osc.frequency.linearRampToValueAtTime(48, now + 0.45);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.10, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  osc.connect(gain).connect(crushGain);
  osc.start(now);
  osc.stop(now + 0.58);
}

function spawnPressSparks() {
  const press = document.querySelector(".press");
  if (!press) return;
  for (let i = 0; i < 14; i++) {
    const spark = document.createElement("span");
    spark.className = "press-spark";
    spark.style.left = `${92 + Math.random() * 86}px`;
    spark.style.top = `${120 + Math.random() * 34}px`;
    spark.style.setProperty("--sx", `${(Math.random() - 0.5) * 130}px`);
    spark.style.setProperty("--sy", `${Math.random() * 75 + 18}px`);
    spark.style.setProperty("--rot", `${Math.random() * 360}deg`);
    spark.style.setProperty("--delay", `${Math.random() * 90}ms`);
    press.appendChild(spark);
    setTimeout(() => spark.remove(), 900);
  }
}

function updatePress(now) {
  if (pressJammed) {
    setPressVisual(pressJamProgress);
    if (now - pressJamStart >= pressJamDuration) {
      pressJammed = false;
      pressHead.classList.remove("press-jammed");
      pressState = "down";
      pressCycleStart = now - pressCycleDownTime * pressJamProgress;
    }
    return;
  }

  if (pressState === "up") {
    setPressVisual(0);
    return;
  }

  if (pressState === "down") {
    const p = Math.min(1, (now - pressCycleStart) / pressCycleDownTime);
    setPressVisual(p);

    // Hard objects can stop the ram before it reaches the bottom. The
    // conveyor keeps moving, so the object eventually passes underneath.
    if (p >= 0.24 && p < 0.88) {
      const blocked = getItemsInPressPath().find(itemNeedsMorePower);
      if (blocked) {
        triggerPressJam(now, p, blocked);
        return;
      }
    }

    if (p >= 1) {
      // IMPORTANT: only inspect for an item at the bottom of the stroke.
      // Items never start, stop, or restart the press cycle.
      const targets = findItemsUnderPress();
      if (targets.length) {
        // An item that needs more Press Power must NEVER be passed to
        // crushItem(), even when a crushable item is beside it.
        const blocked = targets.find(itemNeedsMorePower);
        const crushable = targets.filter(item => !itemNeedsMorePower(item));

        // Crush valid items normally, but leave the too-strong item intact.
        // If the blocked item reached the ram too late for the normal path
        // check, jam the press here so it is still treated as uncrushable.
        for (const target of crushable) {
          crushItem(target);
        }

        if (blocked) {
          triggerPressJam(now, 1, blocked);
          return;
        }
      }

      pressState = "hold";
      pressCycleStart = now;
    }
    return;
  }

  if (pressState === "hold") {
    setPressVisual(1);
    if (now - pressCycleStart >= pressCycleHoldTime) {
      pressState = "returning";
      pressCycleStart = now;
    }
    return;
  }

  if (pressState === "returning") {
    const p = Math.max(0, 1 - (now - pressCycleStart) / pressCycleUpTime);
    setPressVisual(p);

    if (p <= 0) {
      pressState = "up";
      pressCycleStart = now;
      pressHead.classList.remove("pressing");
    }
  }
}

function getFeederCapacity() {
  // Feeder upgrades increase both delivery rate and how many items
  // the conveyor can hold. This keeps the upgrade useful at higher levels.
  return 4 + autoLevel * 2;
}

function createItem() {
  if (paused) return;

  // Capacity scales with the Feeder Upgrade instead of being hard capped at 3.
  if (activeItems.filter(item => !item.crushed).length >= getFeederCapacity()) return;

  // Keep a safe gap at the feeder entrance so faster feeders do not stack
  // multiple models directly on top of each other.
  const entranceGap = 105;
  if (activeItems.some(item => !item.crushed && item.x < -110 + entranceGap)) return;

  const el = document.createElement("div");
  const type = getRandomItemType();
  el.className = `item item-${type.name}`;
  el.innerHTML = models[type.name];
  el.title = `${type.label} · Press Power ${type.powerReq || 1} required`;
  el.dataset.powerReq = type.powerReq || 1;
  const item = { el, x: -110, crushed: false, type };
  itemsEl.appendChild(el);
  activeItems.push(item);
}
function makeDebris(item) {
  const rect = item.el.getBoundingClientRect();
  const conveyorRect = conveyor.getBoundingClientRect();
  const originX = rect.left - conveyorRect.left + rect.width / 2;
  const originY = rect.top - conveyorRect.top + rect.height / 2;
  const amount = item.type.name === "brick" || item.type.name === "safe" ? 9 : 12;

  for (let i = 0; i < amount; i++) {
    const piece = document.createElement("span");
    piece.className = `debris debris-${item.type.name}`;
    piece.style.left = `${originX}px`;
    piece.style.top = `${originY}px`;
    piece.style.setProperty("--dx", `${(Math.random() - 0.5) * 110}px`);
    piece.style.setProperty("--dy", `${-Math.random() * 55 - 8}px`);
    piece.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    piece.style.setProperty("--delay", `${Math.random() * 70}ms`);
    conveyor.appendChild(piece);
    setTimeout(() => piece.remove(), 780);
  }
}

function getItemPayout(item) {
  const comboMultiplier = 1 + Math.min(combo, 20) * 0.05;
  const machineMultiplier = 1 + (machineLevel - 1) * 0.12;
  const luckBonus = Math.random() < 0.03 * luckLevel ? 2 : 1;
  return Math.max(1, Math.round(itemValue * item.type.value * pressPower * comboMultiplier * machineMultiplier * luckBonus));
}

function crushItem(item) {
  if (item.crushed || paused) return;
  playCrushSound(item);
  item.crushed = true;
  combo++;
  comboTimer = 2600;
  bestCombo = Math.max(bestCombo, combo);
  item.el.classList.add("crushing");

  setTimeout(() => makeDebris(item), 180);
  setTimeout(() => item.el.classList.add("crushed-final"), 250);

  setTimeout(() => {
    const payout = getItemPayout(item);
    money += payout;
    totalEarned += payout;
    crushed++;
    item.el.remove();
    const index = activeItems.indexOf(item);
    if (index !== -1) activeItems.splice(index, 1);
    checkMilestones();
    syncLevelFromProgress();
    updateUI();
    saveGame();
  }, 720);
}

function gameLoop(timestamp) {
  if (!gameLoop.last) gameLoop.last = timestamp;
  const dt = Math.min(40, timestamp - gameLoop.last);
  gameLoop.last = timestamp;
  const width = conveyor.clientWidth;

  if (!paused) {
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        combo = 0;
        updateUI();
      }
    }

    // Conveyor is always moving while the game is running.
    for (const item of [...activeItems]) {
      if (item.crushed) continue;

      item.x += speed * dt / 1000;
      item.el.style.left = `${item.x}px`;

      if (item.jammedByPress && item.x > getPressCenter() + 95) {
        item.jammedByPress = false;
      }

      if (item.x > width + 120) {
        item.el.remove();
        const index = activeItems.indexOf(item);
        if (index !== -1) activeItems.splice(index, 1);
      }
    }

    // Fixed-rate press: it runs whether the conveyor has an item under it or not.
    if (pressState === "up") {
      startPressCycle(timestamp);
    }
    updatePress(timestamp);
  }

  requestAnimationFrame(gameLoop);
}

// =========================
// PROGRESSION
// =========================
function isUpgradeUnlocked(id) {
  const required = {
    speed: 1,
    pressSpeed: 1,
    value: 1,
    power: 2,
    auto: 1,
    luck: 1,
    variety: 1,
    machine: 7
  };
  return level >= (required[id] || 1);
}

function upgrade(id, canBuy, apply) {
  if (!isUpgradeUnlocked(id) || !canBuy()) return;
  apply();
  playUpgradeSound();
  updateUI();
  saveGame();
}

document.getElementById("speedUpgrade").addEventListener("click", () => upgrade("speed", () => money >= speedCost, () => {
  money -= speedCost; speedLevel++; speed += 25; speedCost = Math.ceil(speedCost * 1.65);
}));

document.getElementById("pressSpeedUpgrade").addEventListener("click", () => upgrade("pressSpeed", () => money >= pressSpeedCost, () => {
  money -= pressSpeedCost; pressSpeedLevel++; pressSpeedCost = Math.ceil(pressSpeedCost * 1.72);
}));

document.getElementById("valueUpgrade").addEventListener("click", () => upgrade("value", () => money >= valueCost, () => {
  money -= valueCost; valueLevel++; itemValue += 8; valueCost = Math.ceil(valueCost * 1.72);
}));

document.getElementById("varietyUpgrade").addEventListener("click", () => upgrade("variety", () => money >= varietyCost && varietyLevel < getWorldVarietyCap(), () => {
  money -= varietyCost;
  setWorldVarietyLevel(Math.min(getWorldVarietyCap(), varietyLevel + 1));
  varietyCost = Math.ceil(varietyCost * 1.85);
}));

document.getElementById("powerUpgrade").addEventListener("click", () => upgrade("power", () => money >= powerCost, () => {
  money -= powerCost; powerLevel++; pressPower += 0.25; powerCost = Math.ceil(powerCost * 1.9);
}));

document.getElementById("luckUpgrade").addEventListener("click", () => upgrade("luck", () => money >= luckCost, () => {
  money -= luckCost; luckLevel++; luckCost = Math.ceil(luckCost * 2.05);
}));

document.getElementById("autoUpgrade").addEventListener("click", () => upgrade("auto", () => money >= autoCost && autoLevel < 5, () => {
  money -= autoCost;
  autoLevel++;
  autoCost = Math.ceil(autoCost * 2.2);
  spawnDelay = Math.max(600, spawnDelay - 120);
  restartSpawner();
}));

document.getElementById("machineUpgrade").addEventListener("click", () => upgrade("machine", () => money >= machineCost, () => {
  money -= machineCost; machineLevel++; machineCost = Math.ceil(machineCost * 3.0); speed += 15; pressPower += 0.5; setWorldVarietyLevel(Math.min(getWorldVarietyCap(), varietyLevel + 1));
}));

let spawner = null;
function restartSpawner() {
  if (spawner) clearInterval(spawner);
  spawner = setInterval(createItem, spawnDelay);
}

// =========================
// UI / SETTINGS
// =========================
function percent(value) { return `${Math.round(value * 100)}%`; }

function updateUI() {
  worldIndex = getWorldIndexForLevel(level);
  const worldLevel = getWorldLevel(level);
  const goal = getCurrentLevelGoal();
  const prevGoal = level === 1 ? 0 : getLevelGoal(level - 1);
  const progress = Math.max(0, Math.min(1, (crushed - prevGoal) / Math.max(1, goal - prevGoal)));
  const world = worlds[worldIndex];
  document.getElementById("worldName").textContent = `WORLD ${worldIndex + 1} · ${world.name}`;
  document.getElementById("levelName").textContent = `LEVEL ${worldLevel}`;
  document.getElementById("levelProgressFill").style.width = `${progress * 100}%`;
  document.getElementById("levelProgressText").textContent = `${Math.min(crushed, goal)} / ${goal} crushed`;
  document.getElementById("nextUnlock").textContent = level >= MAX_LEVEL ? "Max level reached" : `Next level: ${getNextUnlock(level + 1)}`;

  moneyEl.textContent = Math.floor(money);
  crushedEl.textContent = crushed;
  document.getElementById("speedLevel").textContent = speedLevel;
  document.getElementById("pressSpeedLevel").textContent = pressSpeedLevel;
  document.getElementById("valueLevel").textContent = valueLevel;
  document.getElementById("varietyLevel").textContent = varietyLevel;
  document.getElementById("powerLevel").textContent = powerLevel;
  document.getElementById("luckLevel").textContent = luckLevel;
  document.getElementById("autoLevel").textContent = autoLevel;
  document.getElementById("machineLevel").textContent = machineLevel;
  document.getElementById("statSpeed").textContent = speedLevel;
  document.getElementById("statPressSpeed").textContent = pressSpeedLevel;
  document.getElementById("statPressTime").textContent = `${(getPressCycleDuration() / 1000).toFixed(1)}s`;
  document.getElementById("statValue").textContent = valueLevel;
  document.getElementById("statVariety").textContent = varietyLevel;
  document.getElementById("statPower").textContent = powerLevel;
  document.getElementById("statLuck").textContent = luckLevel;
  document.getElementById("statMachine").textContent = machineLevel;
  document.getElementById("statCombo").textContent = combo > 1 ? `x${(1 + Math.min(combo, 20) * 0.05).toFixed(2)}` : "x1.00";
  document.getElementById("statBestCombo").textContent = bestCombo;
  document.getElementById("modalMoney").textContent = Math.floor(money);
  document.getElementById("modalEarned").textContent = Math.floor(totalEarned);
  document.getElementById("modalCrushed").textContent = crushed;
  document.getElementById("statAuto").textContent = autoLevel;
  document.getElementById("statSpawn").textContent = `${(spawnDelay / 1000).toFixed(1)}s · ${getFeederCapacity()} capacity`;

  document.getElementById("speedCost").textContent = speedCost;
  document.getElementById("pressSpeedCost").textContent = pressSpeedCost;
  document.getElementById("valueCost").textContent = valueCost;
  document.getElementById("varietyCost").textContent = varietyCost;
  document.getElementById("powerCost").textContent = powerCost;
  document.getElementById("luckCost").textContent = luckCost;
  document.getElementById("autoCost").textContent = autoCost;
  document.getElementById("machineCost").textContent = machineCost;

  document.getElementById("speedUpgrade").disabled = money < speedCost || !isUpgradeUnlocked("speed");
  document.getElementById("pressSpeedUpgrade").disabled = money < pressSpeedCost || !isUpgradeUnlocked("pressSpeed");
  document.getElementById("valueUpgrade").disabled = money < valueCost || !isUpgradeUnlocked("value");
  const varietyMaxed = varietyLevel >= getWorldVarietyCap();
  const varietyButton = document.getElementById("varietyUpgrade");
  varietyButton.disabled = money < varietyCost || varietyMaxed || !isUpgradeUnlocked("variety");
  varietyButton.querySelector("small").innerHTML = varietyMaxed ? "MAX · Every item in this world unlocked" : `Unlocks more objects · Cost: <span id="varietyCost">${varietyCost}</span> 💰`;
  document.getElementById("powerUpgrade").disabled = money < powerCost || !isUpgradeUnlocked("power");
  document.getElementById("luckUpgrade").disabled = money < luckCost || !isUpgradeUnlocked("luck");
  document.getElementById("autoUpgrade").disabled = money < autoCost || autoLevel >= 5 || !isUpgradeUnlocked("auto");
  document.getElementById("machineUpgrade").disabled = money < machineCost || !isUpgradeUnlocked("machine");
  const availableItems = getAvailableWorldItems();
  document.getElementById("unlockedItems").textContent = `${availableItems.length}/${getCurrentWorldItems().length} items available`;
  document.getElementById("comboDisplay").textContent = combo > 1 ? `COMBO x${combo}` : "READY";
  document.getElementById("comboDisplay").classList.toggle("active", combo > 1);
  document.getElementById("pauseButton").textContent = paused ? "Resume factory" : "Pause factory";
}

const soundInputs = ["master", "conveyor", "crush", "upgrade"];
for (const type of soundInputs) {
  const input = document.getElementById(`${type}Volume`);
  const value = document.getElementById(`${type}VolumeValue`);
  input.value = soundSettings[type] * 100;
  value.textContent = percent(soundSettings[type]);
  input.addEventListener("input", () => {
    soundSettings[type] = Number(input.value) / 100;
    value.textContent = percent(soundSettings[type]);
    setSoundVolume(type, soundSettings[type]);
  });
}

document.getElementById("pauseButton").addEventListener("click", () => {
  paused = !paused;
  if (paused) {
    pressHead.classList.remove("pressing", "press-jammed");
    pressJammed = false;
    pressState = "up";
    pressCycleStart = 0;
    setPressVisual(0);
    updateConveyorLock();
  } else {
    updateConveyorLock();
  }
  updateUI();
});

document.getElementById("statsButton").addEventListener("click", () => {
  updateUI();
  document.getElementById("statsModal").classList.add("open");
});

document.getElementById("closeStats").addEventListener("click", () => {
  document.getElementById("statsModal").classList.remove("open");
});

document.getElementById("statsModal").addEventListener("click", (event) => {
  if (event.target.id === "statsModal") event.currentTarget.classList.remove("open");
});

document.getElementById("resetButton").addEventListener("click", () => {
  if (!confirm("Reset the factory and lose all progress?")) return;
  localStorage.removeItem("hydraulicPressSave");
  location.reload();
});

function checkMilestones() {
  const goals = [
    [10, "10 items crushed"], [50, "50 items crushed"], [100, "100 items crushed"], [250, "250 items crushed"],
    [500, "500 items crushed"], [1000, "1000 items crushed"]
  ];
  for (const [goal, label] of goals) {
    if (crushed >= goal && !milestones.has(goal)) {
      milestones.add(goal);
      money += Math.ceil(goal * 1.5);
      showToast(`${label}! Bonus +${Math.ceil(goal * 1.5)} coins`);
    }
  }
}

function showToast(text) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => toast.remove(), 2600);
}

function saveGame() {
  localStorage.setItem("hydraulicPressSave", JSON.stringify({
    money, crushed, totalEarned, bestCombo, level, worldIndex, machineLevel, powerLevel, speedLevel, pressSpeedLevel, valueLevel, varietyLevel, luckLevel, autoLevel,
    speed, itemValue, pressPower, spawnDelay, speedCost, pressSpeedCost, valueCost, varietyCost, powerCost, luckCost, autoCost, machineCost, worldVarietyLevels,
    milestones: [...milestones]
  }));
}

// Primitive let variables are lexical, so use a safer explicit restore block.
function restoreGame() {
  try {
    const s = JSON.parse(localStorage.getItem("hydraulicPressSave"));
    if (!s) return;
    if (s.money !== undefined) money = s.money;
    if (s.crushed !== undefined) crushed = s.crushed;
    if (s.totalEarned !== undefined) totalEarned = s.totalEarned;
    if (s.bestCombo !== undefined) bestCombo = s.bestCombo;
    if (s.level !== undefined) level = Math.max(1, Math.min(MAX_LEVEL, s.level));
    if (s.machineLevel !== undefined) machineLevel = s.machineLevel;
    if (s.powerLevel !== undefined) powerLevel = s.powerLevel;
    if (s.speedLevel !== undefined) speedLevel = s.speedLevel;
    if (s.pressSpeedLevel !== undefined) pressSpeedLevel = s.pressSpeedLevel;
    if (s.valueLevel !== undefined) valueLevel = s.valueLevel;
    let hadWorldVarietyLevels = false;
    if (s.varietyLevel !== undefined) varietyLevel = Math.max(1, Number(s.varietyLevel) || 1);
    if (Array.isArray(s.worldVarietyLevels) && s.worldVarietyLevels.length === worlds.length) {
      worldVarietyLevels = s.worldVarietyLevels.map(v => Math.max(1, Number(v) || 1));
      hadWorldVarietyLevels = true;
    } else {
      // Migrate older saves that only had one global Item Variety level.
      worldVarietyLevels = Array(worlds.length).fill(varietyLevel);
    }
    if (s.luckLevel !== undefined) luckLevel = Math.max(1, Number(s.luckLevel) || 1);
    if (s.autoLevel !== undefined) autoLevel = Math.max(1, Number(s.autoLevel) || 1);
    if (s.speed !== undefined) speed = s.speed;
    if (s.itemValue !== undefined) itemValue = s.itemValue;
    if (s.pressPower !== undefined) pressPower = s.pressPower;
    if (s.spawnDelay !== undefined) spawnDelay = s.spawnDelay;
    if (s.speedCost !== undefined) speedCost = s.speedCost;
    if (s.pressSpeedCost !== undefined) pressSpeedCost = s.pressSpeedCost;
    if (s.valueCost !== undefined) valueCost = s.valueCost;
    if (s.varietyCost !== undefined) varietyCost = s.varietyCost;
    if (!hadWorldVarietyLevels && varietyLevel <= 1) varietyCost = 75;
    if (s.powerCost !== undefined) powerCost = s.powerCost;
    if (s.luckCost !== undefined) luckCost = s.luckCost;
    if (s.autoCost !== undefined) autoCost = s.autoCost;
    if (s.machineCost !== undefined) machineCost = s.machineCost;
    if (Array.isArray(s.milestones)) s.milestones.forEach(v => milestones.add(Number(v)));
  } catch (_) {}
}

restoreGame();
syncLevelFromProgress();
window.addEventListener("resize", setPressGeometry);
restartSpawner();
setPressGeometry();
updateConveyorLock();
syncWorldVarietyLevel();
updateUI();
requestAnimationFrame(gameLoop);
