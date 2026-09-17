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

let adminUnlocked = false;

let adminUpgradeUnlocks = {
  speed: false,
  pressSpeed: false,
  value: false,
  variety: false,
  power: false,
  luck: false,
  auto: false,
  machine: false
};

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
let resettingProgress = false;

const pressProcessedItems = new Set();

let pressCycleStart = 0;
let pressCycleDownTime = 1700;
let pressCycleHoldTime = 260;
let pressCycleUpTime = 650;

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

const SAVE_KEY = "hydraulicPressSave";
const SAVE_VERSION = 2;

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
let crushNoiseBuffer = null;
let conveyorNoiseBuffer = null;

let soundSettings = {
  master: 0.55,
  conveyor: 0.16,
  crush: 0.72,
  upgrade: 0.55
};

function loadSoundSettings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("pressSoundSettings")
    );

    if (saved && typeof saved === "object") {
      soundSettings = {
        ...soundSettings,
        ...saved
      };
    }
  } catch (_) {}
}

function saveSoundSettings() {
  try {
    localStorage.setItem(
      "pressSoundSettings",
      JSON.stringify(soundSettings)
    );
  } catch (_) {}
}

function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    return;
  }

  const AudioContext =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContext) return;

  audioCtx = new AudioContext();

  masterGain = audioCtx.createGain();
  conveyorGain = audioCtx.createGain();
  crushGain = audioCtx.createGain();
  upgradeGain = audioCtx.createGain();

  masterGain.gain.value =
    soundSettings.master;

  conveyorGain.gain.value =
    soundSettings.conveyor;

  crushGain.gain.value =
    soundSettings.crush;

  upgradeGain.gain.value =
    soundSettings.upgrade;

  masterGain.connect(
    audioCtx.destination
  );

  conveyorGain.connect(
    masterGain
  );

  crushGain.connect(
    masterGain
  );

  upgradeGain.connect(
    masterGain
  );

  startConveyorSound();

  audioCtx.resume().catch(() => {});
}

function makeNoiseBuffer(duration = 1) {
  if (!audioCtx) return null;

  const buffer =
    audioCtx.createBuffer(
      1,
      Math.floor(
        audioCtx.sampleRate *
          duration
      ),
      audioCtx.sampleRate
    );

  const data =
    buffer.getChannelData(0);

  for (
    let i = 0;
    i < data.length;
    i++
  ) {
    data[i] =
      Math.random() * 2 - 1;
  }

  return buffer;
}

function getCrushNoiseBuffer() {
  if (!audioCtx) return null;

  if (!crushNoiseBuffer) {
    crushNoiseBuffer =
      makeNoiseBuffer(0.45);
  }

  return crushNoiseBuffer;
}

function startConveyorSound() {
  if (
    !audioCtx ||
    conveyorHum
  ) {
    return;
  }

  conveyorHum =
    audioCtx.createOscillator();

  const humFilter =
    audioCtx.createBiquadFilter();

  const humGain =
    audioCtx.createGain();

  conveyorHum.type =
    "triangle";

  conveyorHum.frequency.value =
    42;

  humFilter.type =
    "lowpass";

  humFilter.frequency.value =
    110;

  humGain.gain.value =
    0.06;

  conveyorHum
    .connect(humFilter)
    .connect(humGain)
    .connect(conveyorGain);

  conveyorHum.start();

  conveyorNoise =
    audioCtx.createBufferSource();

  const noiseFilter =
    audioCtx.createBiquadFilter();

  const noiseGain =
    audioCtx.createGain();

  conveyorNoiseBuffer =
    makeNoiseBuffer(2);

  conveyorNoise.buffer =
    conveyorNoiseBuffer;

  conveyorNoise.loop =
    true;

  noiseFilter.type =
    "lowpass";

  noiseFilter.frequency.value =
    190;

  noiseGain.gain.value =
    0.035;

  conveyorNoise
    .connect(noiseFilter)
    .connect(noiseGain)
    .connect(conveyorGain);

  conveyorNoise.start();
}

function setSoundVolume(
  type,
  value
) {
  soundSettings[type] =
    Number(value);

  if (!audioCtx) {
    initAudio();
  }

  const gains = {
    master: masterGain,
    conveyor: conveyorGain,
    crush: crushGain,
    upgrade: upgradeGain
  };

  if (
    gains[type] &&
    audioCtx
  ) {
    gains[type].gain.setTargetAtTime(
      soundSettings[type],
      audioCtx.currentTime,
      0.02
    );
  }

  saveSoundSettings();
}

function playTone(
  frequency,
  duration,
  type = "sine",
  volume = 0.12,
  startTime = 0
) {
  if (
    !audioCtx ||
    !upgradeGain
  ) {
    return;
  }

  const now =
    audioCtx.currentTime +
    startTime;

  const osc =
    audioCtx.createOscillator();

  const gain =
    audioCtx.createGain();

  osc.type = type;

  osc.frequency.setValueAtTime(
    frequency,
    now
  );

  gain.gain.setValueAtTime(
    0.0001,
    now
  );

  gain.gain.exponentialRampToValueAtTime(
    volume,
    now + 0.012
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration
  );

  osc
    .connect(gain)
    .connect(upgradeGain);

  osc.start(now);

  osc.stop(
    now +
      duration +
      0.02
  );
}

function playUpgradeSound() {
  initAudio();

  playTone(
    392,
    0.11,
    "triangle",
    0.08
  );

  playTone(
    494,
    0.11,
    "triangle",
    0.08,
    0.06
  );

  playTone(
    587,
    0.15,
    "triangle",
    0.10,
    0.12
  );

  playTone(
    784,
    0.22,
    "sine",
    0.06,
    0.20
  );
}

function playCrushSound(item) {
  initAudio();

  if (
    !audioCtx ||
    !item ||
    !item.type ||
    !crushGain
  ) {
    return;
  }

  const now =
    audioCtx.currentTime;

  const weight =
    Number(item.type.weight) || 1;

  const hiss =
    audioCtx.createBufferSource();

  const hissFilter =
    audioCtx.createBiquadFilter();

  const hissGain =
    audioCtx.createGain();

  hiss.buffer =
    getCrushNoiseBuffer();

  if (!hiss.buffer) return;

  hissFilter.type =
    "bandpass";

  hissFilter.frequency.value =
    1300 +
    weight * 350;

  hissFilter.Q.value =
    0.8;

  hissGain.gain.setValueAtTime(
    0.0001,
    now
  );

  hissGain.gain.linearRampToValueAtTime(
    0.045,
    now + 0.04
  );

  hissGain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.4
  );

  hiss
    .connect(hissFilter)
    .connect(hissGain)
    .connect(crushGain);

  hiss.start(now);

  hiss.stop(
    now + 0.45
  );

  const impact =
    audioCtx.createOscillator();

  const impactGain =
    audioCtx.createGain();

  impact.type =
    "square";

  impact.frequency.setValueAtTime(
    75 +
      weight * 25,
    now + 0.15
  );

  impact.frequency.exponentialRampToValueAtTime(
    35,
    now + 0.38
  );

  impactGain.gain.setValueAtTime(
    0.0001,
    now + 0.15
  );

  impactGain.gain.exponentialRampToValueAtTime(
    Math.min(
      0.14,
      0.075 +
        weight * 0.035
    ),
    now + 0.17
  );

  impactGain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.4
  );

  impact
    .connect(impactGain)
    .connect(crushGain);

  impact.start(
    now + 0.15
  );

  impact.stop(
    now + 0.43
  );

  playCrushClank(
    170 +
      weight * 40
  );
}

function playCrushClank(
  frequency
) {
  if (
    !audioCtx ||
    !crushGain
  ) {
    return;
  }

  const now =
    audioCtx.currentTime +
    0.2;

  const osc =
    audioCtx.createOscillator();

  const gain =
    audioCtx.createGain();

  osc.type =
    "triangle";

  osc.frequency.setValueAtTime(
    frequency,
    now
  );

  osc.frequency.exponentialRampToValueAtTime(
    frequency * 0.55,
    now + 0.12
  );

  gain.gain.setValueAtTime(
    0.0001,
    now
  );

  gain.gain.exponentialRampToValueAtTime(
    0.045,
    now + 0.012
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.13
  );

  osc
    .connect(gain)
    .connect(crushGain);

  osc.start(now);

  osc.stop(
    now + 0.15
  );
}

loadSoundSettings();

window.addEventListener(
  "pointerdown",
  initAudio,
  { once: true }
);

window.addEventListener(
  "keydown",
  initAudio,
  { once: true }
);

// =========================
// WORLDS / LEVELS / ITEMS
// =========================
const worlds = [
  {
    name: "SCRAP YARD",
    items: [
      {
        name: "can",
        label: "Soda can",
        weight: 1.0,
        value: 1.0,
        powerReq: 1,
        varietyReq: 1
      },
      {
        name: "bottle",
        label: "Plastic bottle",
        weight: 0.7,
        value: 1.05,
        powerReq: 1,
        varietyReq: 1
      },
      {
        name: "box",
        label: "Cardboard box",
        weight: 0.55,
        value: 1.15,
        powerReq: 1,
        varietyReq: 1
      },
      {
        name: "brick",
        label: "Brick",
        weight: 1.35,
        value: 1.65,
        powerReq: 2,
        varietyReq: 2
      },
      {
        name: "tire",
        label: "Rubber tire",
        weight: 1.2,
        value: 1.45,
        powerReq: 3,
        varietyReq: 2
      },
      {
        name: "battery",
        label: "Car battery",
        weight: 2.0,
        value: 2.15,
        powerReq: 3,
        varietyReq: 3
      },
      {
        name: "pipe",
        label: "Steel pipe",
        weight: 2.5,
        value: 2.7,
        powerReq: 4,
        varietyReq: 4
      },
      {
        name: "engine",
        label: "Old engine",
        weight: 3.2,
        value: 3.5,
        powerReq: 5,
        varietyReq: 5
      },
      {
        name: "safe",
        label: "Scrap safe",
        weight: 3.8,
        value: 4.4,
        powerReq: 6,
        varietyReq: 5
      }
    ]
  },

  {
    name: "ALIEN RUINS",
    items: [
      {
        name: "alienOrb",
        label: "Alien orb",
        weight: 1.1,
        value: 3.0,
        powerReq: 2,
        varietyReq: 1
      },
      {
        name: "alienCell",
        label: "Energy cell",
        weight: 0.8,
        value: 3.4,
        powerReq: 2,
        varietyReq: 1
      },
      {
        name: "alienRelic",
        label: "Alien relic",
        weight: 1.8,
        value: 4.3,
        powerReq: 3,
        varietyReq: 2
      },
      {
        name: "alienHelmet",
        label: "Alien helmet",
        weight: 1.5,
        value: 4.8,
        powerReq: 4,
        varietyReq: 3
      },
      {
        name: "alienCore",
        label: "Quantum core",
        weight: 2.2,
        value: 6.0,
        powerReq: 5,
        varietyReq: 5
      },
      {
        name: "alienDrone",
        label: "Alien drone",
        weight: 2.0,
        value: 6.5,
        powerReq: 4,
        varietyReq: 3
      },
      {
        name: "alienTablet",
        label: "Ancient alien tablet",
        weight: 2.6,
        value: 7.4,
        powerReq: 5,
        varietyReq: 4
      },
      {
        name: "alienPrism",
        label: "Void prism",
        weight: 2.9,
        value: 8.6,
        powerReq: 6,
        varietyReq: 5
      },
      {
        name: "alienEngine",
        label: "Alien engine",
        weight: 3.5,
        value: 10.0,
        powerReq: 7,
        varietyReq: 5
      }
    ]
  },

  {
    name: "MONSTER LAB",
    items: [
      {
        name: "monsterEye",
        label: "Monster eye",
        weight: 0.9,
        value: 4.0,
        powerReq: 3,
        varietyReq: 1
      },
      {
        name: "monsterTooth",
        label: "Monster tooth",
        weight: 1.3,
        value: 4.6,
        powerReq: 3,
        varietyReq: 1
      },
      {
        name: "monsterClaw",
        label: "Monster claw",
        weight: 1.5,
        value: 5.2,
        powerReq: 4,
        varietyReq: 2
      },
      {
        name: "monsterHorn",
        label: "Monster horn",
        weight: 2.0,
        value: 6.0,
        powerReq: 5,
        varietyReq: 3
      },
      {
        name: "monsterEgg",
        label: "Monster egg",
        weight: 2.4,
        value: 7.0,
        powerReq: 6,
        varietyReq: 5
      },
      {
        name: "monsterSkull",
        label: "Monster skull",
        weight: 2.7,
        value: 7.8,
        powerReq: 5,
        varietyReq: 3
      },
      {
        name: "monsterFang",
        label: "Titan fang",
        weight: 2.2,
        value: 8.8,
        powerReq: 6,
        varietyReq: 4
      },
      {
        name: "monsterHeart",
        label: "Mutant heart",
        weight: 3.0,
        value: 10.2,
        powerReq: 7,
        varietyReq: 5
      },
      {
        name: "monsterCore",
        label: "Beast core",
        weight: 3.5,
        value: 12.0,
        powerReq: 8,
        varietyReq: 5
      }
    ]
  },

  {
    name: "DEEP SPACE",
    items: [
      {
        name: "starShard",
        label: "Star shard",
        weight: 1.4,
        value: 7.0,
        powerReq: 4,
        varietyReq: 1
      },
      {
        name: "moonRock",
        label: "Moon rock",
        weight: 2.0,
        value: 8.0,
        powerReq: 4,
        varietyReq: 1
      },
      {
        name: "spaceDrone",
        label: "Space drone",
        weight: 1.8,
        value: 9.0,
        powerReq: 5,
        varietyReq: 2
      },
      {
        name: "plasmaCell",
        label: "Plasma cell",
        weight: 1.2,
        value: 10.0,
        powerReq: 6,
        varietyReq: 3
      },
      {
        name: "blackCore",
        label: "Black core",
        weight: 3.0,
        value: 12.0,
        powerReq: 7,
        varietyReq: 5
      },
      {
        name: "spaceBattery",
        label: "Fusion battery",
        weight: 2.1,
        value: 11.5,
        powerReq: 5,
        varietyReq: 3
      },
      {
        name: "meteorChunk",
        label: "Meteor chunk",
        weight: 3.1,
        value: 14.0,
        powerReq: 7,
        varietyReq: 4
      },
      {
        name: "satelliteCore",
        label: "Satellite core",
        weight: 3.6,
        value: 16.5,
        powerReq: 8,
        varietyReq: 5
      },
      {
        name: "gravityCube",
        label: "Gravity cube",
        weight: 4.0,
        value: 19.0,
        powerReq: 9,
        varietyReq: 5
      }
    ]
  },

  {
    name: "ANCIENT VAULT",
    items: [
      {
        name: "ancientCoin",
        label: "Ancient coin",
        weight: 0.8,
        value: 10.0,
        powerReq: 5,
        varietyReq: 1
      },
      {
        name: "goldIdol",
        label: "Gold idol",
        weight: 2.0,
        value: 13.0,
        powerReq: 5,
        varietyReq: 1
      },
      {
        name: "cursedMask",
        label: "Cursed mask",
        weight: 1.7,
        value: 15.0,
        powerReq: 6,
        varietyReq: 2
      },
      {
        name: "vaultCrystal",
        label: "Vault crystal",
        weight: 2.3,
        value: 18.0,
        powerReq: 7,
        varietyReq: 3
      },
      {
        name: "relicCore",
        label: "Relic core",
        weight: 3.2,
        value: 22.0,
        powerReq: 8,
        varietyReq: 5
      },
      {
        name: "goldChest",
        label: "Golden chest",
        weight: 3.0,
        value: 24.0,
        powerReq: 7,
        varietyReq: 3
      },
      {
        name: "ancientBlade",
        label: "Ancient blade",
        weight: 2.4,
        value: 27.0,
        powerReq: 8,
        varietyReq: 4
      },
      {
        name: "royalRelic",
        label: "Royal relic",
        weight: 3.7,
        value: 31.0,
        powerReq: 9,
        varietyReq: 5
      },
      {
        name: "vaultHeart",
        label: "Vault heart",
        weight: 4.2,
        value: 36.0,
        powerReq: 10,
        varietyReq: 5
      }
    ]
  }
];

const LEVELS_PER_WORLD = 5;

const MAX_LEVEL =
  worlds.length *
  LEVELS_PER_WORLD;

let level = 1;
let worldIndex = 0;

function getWorldIndexForLevel(
  lvl
) {
  return Math.min(
    worlds.length - 1,
    Math.floor(
      (lvl - 1) /
        LEVELS_PER_WORLD
    )
  );
}

function getWorldLevel(lvl) {
  return (
    ((lvl - 1) %
      LEVELS_PER_WORLD) +
    1
  );
}

function getLevelGoal(lvl) {
  return Math.round(
    35 *
      Math.pow(
        lvl,
        1.55
      )
  );
}

function getCurrentLevelGoal() {
  return getLevelGoal(
    level
  );
}

function getNextUnlock(lvl) {
  const unlocks = {
    2: "Press Power + Item Variety",
    3: "Feeder Upgrade",
    4: "Scrap Luck",
    5: "More advanced objects",
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

  return (
    unlocks[lvl] ||
    "Max level reached"
  );
}

function syncLevelFromProgress() {
  let newLevel = 1;

  while (
    newLevel < MAX_LEVEL &&
    crushed >=
      getLevelGoal(
        newLevel
      )
  ) {
    newLevel++;
  }

  const oldWorld =
    worldIndex;

  const oldLevel =
    level;

  level = newLevel;

  worldIndex =
    getWorldIndexForLevel(
      level
    );

  syncWorldVarietyLevel();

  if (level > oldLevel) {
    for (
      let l =
        oldLevel + 1;
      l <= level;
      l++
    ) {
      const worldChanged =
        getWorldIndexForLevel(
          l
        ) !==
        getWorldIndexForLevel(
          l - 1
        );

      if (
        worldChanged ||
        l > oldLevel
      ) {
        showToast(
          `LEVEL ${l} UNLOCKED · ${getNextUnlock(l)}`
        );
      }
    }
  }

  if (
    worldIndex >
    oldWorld
  ) {
    showToast(
      `WORLD ${worldIndex + 1} UNLOCKED · ${worlds[worldIndex].name}`
    );
  }

  updateUI();
}

function getCurrentWorldItems() {
  return worlds[
    worldIndex
  ].items;
}

// =========================
// MODELS
// =========================
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
  vaultHeart: `<div class="world-model vault-heart"><span></span></div>`
};

// =========================
// VARIETY
// =========================
function syncWorldVarietyLevel() {
  if (
    !Array.isArray(
      worldVarietyLevels
    ) ||
    worldVarietyLevels.length !==
      worlds.length
  ) {
    worldVarietyLevels =
      Array(
        worlds.length
      ).fill(1);
  }

  for (
    let i = 0;
    i < worlds.length;
    i++
  ) {
    worldVarietyLevels[i] =
      Math.max(
        1,
        Math.min(
          5,
          Number(
            worldVarietyLevels[i]
          ) || 1
        )
      );
  }

  varietyLevel =
    Math.max(
      1,
      Math.min(
        getWorldVarietyCap(),
        Number(
          worldVarietyLevels[
            worldIndex
          ]
        ) || 1
      )
    );

  worldVarietyLevels[
    worldIndex
  ] =
    varietyLevel;
}

function setWorldVarietyLevel(
  value
) {
  if (
    !Array.isArray(
      worldVarietyLevels
    ) ||
    worldVarietyLevels.length !==
      worlds.length
  ) {
    worldVarietyLevels =
      Array(
        worlds.length
      ).fill(1);
  }

  const cap =
    getWorldVarietyCap();

  const safeValue =
    Math.max(
      1,
      Math.min(
        cap,
        Number(value) || 1
      )
    );

  worldVarietyLevels[
    worldIndex
  ] =
    safeValue;

  varietyLevel =
    safeValue;
}

function getAvailableWorldItems() {
  const items =
    getCurrentWorldItems();

  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(
    type =>
      type &&
      (Number(
        type.varietyReq
      ) || 1) <=
        varietyLevel
  );
}

function getWorldVarietyCap() {
  const items =
    getCurrentWorldItems();

  if (!Array.isArray(items) || !items.length) {
    return 1;
  }

  return Math.max(
    1,
    ...items.map(
      type =>
        Number(
          type?.varietyReq
        ) || 1
    )
  );
}

function getRandomItemType() {
  const pool =
    getAvailableWorldItems();

  if (!pool.length) {
    return worlds[0].items[0];
  }

  const luckyPool =
    [...pool];

  if (luckLevel > 1) {
    const rare =
      pool.filter(
        type =>
          (Number(
            type.varietyReq
          ) || 1) >= 3
      );

    for (
      const type of rare
    ) {
      for (
        let i = 1;
        i < luckLevel;
        i++
      ) {
        luckyPool.push(
          type
        );
      }
    }
  }

  return luckyPool[
    Math.floor(
      Math.random() *
        luckyPool.length
    )
  ];
}

// =========================
// PRESS
// =========================
function getPressCycleDuration() {
  /*
    Press Speed used to have a hard minimum:
      Math.max(1800, ...)

    That meant higher upgrades eventually
    stopped changing the speed.

    Now every upgrade multiplies the timing,
    so every level makes the press faster.
  */
  const base =
    Math.max(
      1200,
      3600 -
        (machineLevel - 1) *
          60
    );

  const speedMultiplier =
    Math.pow(
      0.92,
      Math.max(
        0,
        pressSpeedLevel - 1
      )
    );

  return Math.max(
    700,
    base *
      speedMultiplier
  );
}

function getPressDownTime() {
  /*
    This is the actual movement speed of
    the downward press.

    Multiplicative scaling means Level 20,
    30, 40, etc. still make it faster instead
    of hitting the old 420ms wall.
  */
  const base =
    Math.max(
      650,
      1700 -
        (machineLevel - 1) *
          35
    );

  const speedMultiplier =
    Math.pow(
      0.90,
      Math.max(
        0,
        pressSpeedLevel - 1
      )
    );

  return Math.max(
    220,
    base *
      speedMultiplier
  );
}

function getPressTimings() {
  const downTime =
    getPressDownTime();

  /*
    Faster upgrades also slightly reduce
    the hold/return portions so the entire
    machine cycle actually becomes faster.
  */
  const speedMultiplier =
    Math.pow(
      0.96,
      Math.max(
        0,
        pressSpeedLevel - 1
      )
    );

  const crushHold =
    Math.max(
      120,
      260 *
        speedMultiplier
    );

  const upTime =
    Math.max(
      280,
      650 *
        speedMultiplier
    );

  return {
    cycle:
      downTime +
      crushHold +
      upTime,

    downTime,
    crushHold,
    upTime
  };
}

function setPressGeometry() {
  if (
    !pressHead ||
    !conveyor
  ) {
    return;
  }

  const press =
    document.querySelector(
      ".press"
    );

  if (!press) return;

  const conveyorTop =
    conveyor.offsetTop;

  const pressTop =
    press.offsetTop;

  const targetBottom =
    conveyorTop +
    conveyor.clientHeight -
    15;

  const targetTop =
    targetBottom -
    pressTop -
    pressHead.offsetHeight;

  pressHead.style.setProperty(
    "--press-down-top",
    `${targetTop}px`
  );
}

function getPressPositions() {
  const press =
    document.querySelector(
      ".press"
    );

  if (
    !press ||
    !pressHead ||
    !conveyor
  ) {
    return {
      top: 68,
      bottom: 140
    };
  }

  const conveyorTop =
    conveyor.offsetTop;

  const pressTop =
    press.offsetTop;

  const targetBottom =
    conveyorTop +
    conveyor.clientHeight -
    15;

  const targetTop =
    targetBottom -
    pressTop -
    pressHead.offsetHeight;

  return {
    top: 68,
    bottom: targetTop
  };
}

function getPressCenter() {
  if (!conveyor) {
    return 0;
  }

  return (
    conveyor.clientWidth /
    2
  );
}

function findItemsUnderPress() {
  const center =
    getPressCenter();

  const pressWidth =
    pressHead
      ? pressHead.offsetWidth
      : 150;

  const pressLeft =
    center -
    pressWidth / 2;

  const pressRight =
    center +
    pressWidth / 2;

  const targets = [];

  for (
    const item of activeItems
  ) {
    if (
      !item ||
      item.crushed ||
      !item.el ||
      !item.el.isConnected
    ) {
      continue;
    }

    const itemLeft =
      Number.isFinite(item.x)
        ? item.x
        : -110;

    const itemWidth =
      item.el.offsetWidth || 0;

    const itemRight =
      itemLeft +
      itemWidth;

    if (
      itemRight >= pressLeft &&
      itemLeft <= pressRight
    ) {
      targets.push(
        item
      );
    }
  }

  return targets;
}

function updateConveyorLock() {
  conveyorBlocked = false;

  if (conveyor) {
    conveyor.classList.remove(
      "stopped"
    );
  }

  return false;
}

function startPressCycle(now) {
  if (
    paused ||
    pressState !== "up"
  ) {
    return;
  }

  const {
    downTime,
    crushHold,
    upTime
  } = getPressTimings();

  pressProcessedItems.clear();

  pressJammed = false;
  pressJamStart = 0;
  pressJamProgress = 0;

  if (pressHead) {
    pressHead.classList.remove(
      "press-jammed"
    );
  }

  pressState =
    "down";

  pressCycleStart =
    now;

  pressCycleDownTime =
    downTime;

  pressCycleHoldTime =
    crushHold;

  pressCycleUpTime =
    upTime;

  setPressGeometry();

  if (pressHead) {
    pressHead.style.transitionDuration =
      "0ms";

    pressHead.classList.add(
      "pressing"
    );
  }
}

function setPressVisual(
  progress
) {
  if (!pressHead) return;

  const positions =
    getPressPositions();

  const p =
    Math.max(
      0,
      Math.min(
        1,
        progress
      )
    );

  const headTop =
    positions.top +
    (positions.bottom -
      positions.top) *
      p;

  pressHead.style.top =
    `${headTop}px`;

  if (pressRod) {
    pressRod.style.height =
      `${Math.max(
        18,
        headTop - 42
      )}px`;
  }
}

function itemNeedsMorePower(
  item
) {
  if (
    !item ||
    !item.type
  ) {
    return false;
  }

  return (
    (Number(
      item.type.powerReq
    ) || 1) >
    powerLevel
  );
}

function getItemsInPressPath() {
  const center =
    getPressCenter();

  const pressWidth =
    pressHead
      ? pressHead.offsetWidth
      : 150;

  const pressLeft =
    center -
    pressWidth / 2;

  const pressRight =
    center +
    pressWidth / 2;

  return activeItems.filter(
    item => {
      if (
        !item ||
        item.crushed ||
        !item.el ||
        !item.el.isConnected
      ) {
        return false;
      }

      const itemLeft =
        Number.isFinite(item.x)
          ? item.x
          : -110;

      const itemRight =
        itemLeft +
        (item.el.offsetWidth || 0);

      return (
        itemRight >=
          pressLeft &&
        itemLeft <=
          pressRight
      );
    }
  );
}

function triggerPressJam(
  now,
  progress,
  blocked
) {
  if (
    pressJammed ||
    paused ||
    pressState === "jammed"
  ) {
    return;
  }

  pressJammed = true;

  pressJamStart =
    now;

  pressJamProgress =
    0;

  pressState =
    "jammed";

  setPressVisual(
    1
  );

  if (pressHead) {
    pressHead.classList.add(
      "press-jammed"
    );
  }

  try {
    playPressJamSound();
  } catch (error) {
    console.error(
      "Press jam sound error:",
      error
    );
  }

  try {
    spawnPressSparks();
  } catch (error) {
    console.error(
      "Press sparks error:",
      error
    );
  }
}

function playPressJamSound() {
  initAudio();

  if (
    !audioCtx ||
    !crushGain
  ) {
    return;
  }

  const now =
    audioCtx.currentTime;

  const osc =
    audioCtx.createOscillator();

  const gain =
    audioCtx.createGain();

  osc.type =
    "sawtooth";

  osc.frequency.setValueAtTime(
    95,
    now
  );

  osc.frequency.linearRampToValueAtTime(
    48,
    now + 0.45
  );

  gain.gain.setValueAtTime(
    0.0001,
    now
  );

  gain.gain.exponentialRampToValueAtTime(
    0.10,
    now + 0.03
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.55
  );

  osc
    .connect(gain)
    .connect(crushGain);

  osc.start(now);

  osc.stop(
    now + 0.58
  );
}

function spawnPressSparks() {
  const press =
    document.querySelector(
      ".press"
    );

  if (!press) return;

  const existingSparks =
    press.querySelectorAll(
      ".press-spark"
    ).length;

  const sparkAmount =
    Math.min(
      8,
      Math.max(
        0,
        24 -
          existingSparks
      )
    );

  for (
    let i = 0;
    i < sparkAmount;
    i++
  ) {
    const spark =
      document.createElement(
        "span"
      );

    spark.className =
      "press-spark";

    spark.style.left =
      `${92 + Math.random() * 86}px`;

    spark.style.top =
      `${120 + Math.random() * 34}px`;

    spark.style.setProperty(
      "--sx",
      `${(Math.random() - 0.5) * 130}px`
    );

    spark.style.setProperty(
      "--sy",
      `${Math.random() * 75 + 18}px`
    );

    spark.style.setProperty(
      "--rot",
      `${Math.random() * 360}deg`
    );

    spark.style.setProperty(
      "--delay",
      `${Math.random() * 90}ms`
    );

    press.appendChild(
      spark
    );

    setTimeout(
      () => {
        if (
          spark &&
          spark.isConnected
        ) {
          spark.remove();
        }
      },
      900
    );
  }
}

function processPressTargets(now) {
  const targets =
    findItemsUnderPress().filter(
      target =>
        target &&
        !target.crushed &&
        target.el &&
        target.el.isConnected &&
        !pressProcessedItems.has(
          target
        )
    );

  if (!targets.length) {
    return false;
  }

  const blocked =
    targets.find(
      target =>
        itemNeedsMorePower(
          target
        )
    );

  if (blocked) {
    pressProcessedItems.add(
      blocked
    );

    triggerPressJam(
      now,
      1,
      blocked
    );

    return true;
  }

  for (
    const target of targets
  ) {
    if (
      !target ||
      target.crushed ||
      !target.el ||
      !target.el.isConnected
    ) {
      continue;
    }

    pressProcessedItems.add(
      target
    );

    crushItem(
      target
    );
  }

  return false;
}

function updatePress(now) {
  if (!pressHead) return;

  if (
    pressState === "up"
  ) {
    pressJammed = false;

    pressHead.classList.remove(
      "press-jammed"
    );

    setPressVisual(0);

    return;
  }

  if (
    pressState === "down"
  ) {
    const p =
      Math.min(
        1,
        (now -
          pressCycleStart) /
          Math.max(
            1,
            pressCycleDownTime
          )
      );

    setPressVisual(p);

    if (p >= 1) {
      const jammed =
        processPressTargets(
          now
        );

      if (!jammed) {
        pressState =
          "hold";

        pressCycleStart =
          now;
      }
    }

    return;
  }

  if (
    pressState === "hold"
  ) {
    setPressVisual(1);

    const jammed =
      processPressTargets(
        now
      );

    if (jammed) {
      return;
    }

    if (
      now -
        pressCycleStart >=
      pressCycleHoldTime
    ) {
      pressState =
        "returning";

      pressCycleStart =
        now;
    }

    return;
  }

  if (
    pressState === "jammed"
  ) {
    setPressVisual(1);

    pressJamProgress =
      Math.min(
        1,
        (now -
          pressJamStart) /
          Math.max(
            1,
            pressJamDuration
          )
      );

    if (
      now -
        pressJamStart >=
      pressJamDuration
    ) {
      pressJammed =
        false;

      pressJamProgress =
        0;

      pressHead.classList.remove(
        "press-jammed"
      );

      pressState =
        "returning";

      pressCycleStart =
        now;
    }

    return;
  }

  if (
    pressState ===
    "returning"
  ) {
    const p =
      Math.max(
        0,
        1 -
          (now -
            pressCycleStart) /
            Math.max(
              1,
              pressCycleUpTime
            )
      );

    setPressVisual(p);

    if (p <= 0) {
      pressState =
        "up";

      pressCycleStart =
        now;

      pressJammed =
        false;

      pressJamProgress =
        0;

      pressHead.classList.remove(
        "pressing",
        "press-jammed"
      );

      pressProcessedItems.clear();
    }
  }
}

// =========================
// FEEDER
// =========================
function getFeederCapacity() {
  return (
    4 +
    autoLevel * 2
  );
}

function createItem() {
  if (
    paused ||
    !itemsEl
  ) {
    return;
  }

  if (
    activeItems.filter(
      item =>
        item &&
        !item.crushed
    ).length >=
    getFeederCapacity()
  ) {
    return;
  }

  const entranceGap =
    105;

  if (
    activeItems.some(
      item =>
        item &&
        !item.crushed &&
        Number.isFinite(item.x) &&
        item.x <
          -110 +
            entranceGap
    )
  ) {
    return;
  }

  const el =
    document.createElement(
      "div"
    );

  const type =
    getRandomItemType();

  if (
    !type ||
    !models[type.name]
  ) {
    return;
  }

  el.className =
    `item item-${type.name}`;

  el.innerHTML =
    models[type.name];

  el.title =
    `${type.label} · Press Power ${type.powerReq || 1} required`;

  el.dataset.powerReq =
    type.powerReq || 1;

  const item = {
    el,
    x: -110,
    crushed: false,
    type
  };

  itemsEl.appendChild(
    el
  );

  activeItems.push(
    item
  );
}

function makeDebris(item) {
  if (
    !item ||
    !item.el ||
    !item.type ||
    !conveyor
  ) {
    return;
  }

  if (!item.el.isConnected) {
    return;
  }

  const rect =
    item.el.getBoundingClientRect();

  const conveyorRect =
    conveyor.getBoundingClientRect();

  const originX =
    rect.left -
    conveyorRect.left +
    rect.width / 2;

  const originY =
    rect.top -
    conveyorRect.top +
    rect.height / 2;

  const existingDebris =
    conveyor.querySelectorAll(
      ".debris"
    ).length;

  if (
    existingDebris >= 60
  ) {
    return;
  }

  const amount =
    item.type.name ===
      "brick" ||
    item.type.name ===
      "safe"
      ? 6
      : 7;

  const spawnAmount =
    Math.min(
      amount,
      60 -
        existingDebris
    );

  for (
    let i = 0;
    i < spawnAmount;
    i++
  ) {
    const piece =
      document.createElement(
        "span"
      );

    piece.className =
      `debris debris-${item.type.name}`;

    piece.style.left =
      `${originX}px`;

    piece.style.top =
      `${originY}px`;

    piece.style.setProperty(
      "--dx",
      `${(Math.random() - 0.5) * 110}px`
    );

    piece.style.setProperty(
      "--dy",
      `${-Math.random() * 55 - 8}px`
    );

    piece.style.setProperty(
      "--rot",
      `${Math.random() * 720 - 360}deg`
    );

    piece.style.setProperty(
      "--delay",
      `${Math.random() * 70}ms`
    );

    conveyor.appendChild(
      piece
    );

    setTimeout(
      () => {
        if (
          piece &&
          piece.isConnected
        ) {
          piece.remove();
        }
      },
      780
    );
  }
}

function getItemPayout(item) {
  if (
    !item ||
    !item.type
  ) {
    return 1;
  }

  const comboMultiplier =
    1 +
    Math.min(
      combo,
      20
    ) *
      0.05;

  const machineMultiplier =
    1 +
    (machineLevel - 1) *
      0.12;

  const luckBonus =
    Math.random() <
    0.03 * luckLevel
      ? 2
      : 1;

  return Math.max(
    1,
    Math.round(
      itemValue *
        item.type.value *
        pressPower *
        comboMultiplier *
        machineMultiplier *
        luckBonus
    )
  );
}

function crushItem(item) {
  if (
    !item ||
    !item.el ||
    !item.type ||
    item.crushed ||
    paused
  ) {
    return;
  }

  if (
    itemNeedsMorePower(item)
  ) {
    return;
  }

  /*
    Mark as crushed BEFORE any animation/timers.
    This prevents the same object from being
    processed again if the press loop runs.
  */
  item.crushed =
    true;

  pressProcessedItems.delete(
    item
  );

  try {
    playCrushSound(item);
  } catch (error) {
    console.error(
      "Crush sound error:",
      error
    );
  }

  combo++;

  comboTimer =
    2600;

  bestCombo =
    Math.max(
      bestCombo,
      combo
    );

  if (
    item.el &&
    item.el.isConnected
  ) {
    item.el.classList.add(
      "crushing"
    );
  }

  setTimeout(
    () => {
      try {
        if (
          item &&
          item.el &&
          item.el.isConnected
        ) {
          makeDebris(item);
        }
      } catch (error) {
        console.error(
          "Debris error:",
          error
        );
      }
    },
    180
  );

  setTimeout(
    () => {
      try {
        if (
          item &&
          item.el &&
          item.el.isConnected
        ) {
          item.el.classList.add(
            "crushed-final"
          );
        }
      } catch (error) {
        console.error(
          "Crush animation error:",
          error
        );
      }
    },
    250
  );

  setTimeout(
    () => {
      try {
        const payout =
          getItemPayout(
            item
          );

        money += payout;

        totalEarned +=
          payout;

        crushed++;

        if (
          item.el &&
          item.el.isConnected
        ) {
          item.el.remove();
        }

        const index =
          activeItems.indexOf(
            item
          );

        if (index !== -1) {
          activeItems.splice(
            index,
            1
          );
        }

        pressProcessedItems.delete(
          item
        );

        checkMilestones();

        syncLevelFromProgress();

        updateUI();

        saveGame();
      } catch (error) {
        console.error(
          "Crush payout error:",
          error
        );

        const index =
          activeItems.indexOf(
            item
          );

        if (index !== -1) {
          activeItems.splice(
            index,
            1
          );
        }

        pressProcessedItems.delete(
          item
        );
      }
    },
    720
  );
}

// =========================
// GAME LOOP
// =========================
function gameLoop(timestamp) {
  /*
    IMPORTANT:
    Schedule the next frame FIRST.

    Even if something below throws an error,
    the factory will not permanently freeze.
  */
  requestAnimationFrame(
    gameLoop
  );

  try {
    if (!gameLoop.last) {
      gameLoop.last =
        timestamp;
    }

    const dt =
      Math.min(
        40,
        Math.max(
          0,
          timestamp -
            gameLoop.last
        )
      );

    gameLoop.last =
      timestamp;

    if (!conveyor) {
      return;
    }

    const width =
      conveyor.clientWidth;

    if (!paused) {
      if (
        comboTimer > 0
      ) {
        comboTimer -= dt;

        if (
          comboTimer <= 0
        ) {
          combo = 0;

          try {
            updateUI();
          } catch (error) {
            console.error(
              "UI update error:",
              error
            );
          }
        }
      }

      for (
        const item of [
          ...activeItems
        ]
      ) {
        if (
          !item ||
          !item.el
        ) {
          const invalidIndex =
            activeItems.indexOf(
              item
            );

          if (
            invalidIndex !== -1
          ) {
            activeItems.splice(
              invalidIndex,
              1
            );
          }

          continue;
        }

        if (
          item.crushed
        ) {
          continue;
        }

        if (
          !item.el.isConnected
        ) {
          const disconnectedIndex =
            activeItems.indexOf(
              item
            );

          if (
            disconnectedIndex !==
            -1
          ) {
            activeItems.splice(
              disconnectedIndex,
              1
            );
          }

          pressProcessedItems.delete(
            item
          );

          continue;
        }

        if (
          !Number.isFinite(
            item.x
          )
        ) {
          item.x = -110;
        }

        item.x +=
          speed *
          dt /
          1000;

        item.el.style.left =
          `${item.x}px`;

        if (
          item.x >
          width + 120
        ) {
          item.el.remove();

          const index =
            activeItems.indexOf(
              item
            );

          if (index !== -1) {
            activeItems.splice(
              index,
              1
            );
          }

          pressProcessedItems.delete(
            item
          );
        }
      }

      if (
        pressState === "up"
      ) {
        startPressCycle(
          timestamp
        );
      }

      updatePress(
        timestamp
      );
    }
  } catch (error) {
    console.error(
      "GAME LOOP ERROR:",
      error
    );
  }
}

// =========================
// PROGRESSION / UPGRADES
// =========================
function isUpgradeUnlocked(id) {
  if (adminUpgradeUnlocks[id]) return true;

  const required = {
    speed: 1,
    pressSpeed: 1,
    value: 1,
    variety: 2,
    power: 2,
    auto: 3,
    luck: 4,
    machine: 7
  };

  return level >= (required[id] || 1);
}

function getUpgradeUnlockLevel(id) {
  const required = {
    speed: 1,
    pressSpeed: 1,
    value: 1,
    variety: 2,
    power: 2,
    auto: 3,
    luck: 4,
    machine: 7
  };

  return required[id] || 1;
}

function getUpgradeDescription(id) {
  const descriptions = {
    speed: "Makes the conveyor move faster.",
    pressSpeed: "Makes the press cycle faster.",
    value: "Increases the money earned from crushed items.",
    variety: "Unlocks more items to crush.",
    power: "Allows the press to crush harder items.",
    auto: "Increases the feeder capacity and spawning speed.",
    luck: "Improves the chance of getting valuable items.",
    machine: "Improves the overall machine performance."
  };

  return descriptions[id] || "";
}

function isFeederUnlocked() {
  return (
    adminUpgradeUnlocks.auto ||
    level >= 3
  );
}

function recalculateDerivedStats() {
  speed =
    75 +
    (speedLevel - 1) *
      25 +
    (machineLevel - 1) *
      15;

  itemValue =
    10 +
    (valueLevel - 1) *
      8;

  pressPower =
    1 +
    (powerLevel - 1) *
      0.25 +
    (machineLevel - 1) *
      0.5;

  spawnDelay =
    Math.max(
      600,
      1500 -
        (autoLevel - 1) *
          120
    );
}

function upgrade(
  id,
  canBuy,
  apply
) {
  const unlocked =
    id === "auto"
      ? isFeederUnlocked()
      : isUpgradeUnlocked(id);

  if (
    !unlocked ||
    !canBuy()
  ) {
    return;
  }

  apply();

  recalculateDerivedStats();

  playUpgradeSound();

  updateUI();

  /*
    Save immediately after the upgrade.
    Variety 5 is therefore persisted immediately.
  */
  saveGame();
}

document
  .getElementById(
    "speedUpgrade"
  )
  .addEventListener(
    "click",
    () =>
      upgrade(
        "speed",
        () =>
          money >=
          speedCost,
        () => {
          money -=
            speedCost;

          speedLevel++;

          speedCost =
            Math.ceil(
              speedCost *
                1.65
            );
        }
      )
  );

document
  .getElementById(
    "pressSpeedUpgrade"
  )
  .addEventListener(
    "click",
    () =>
      upgrade(
        "pressSpeed",
        () =>
          money >=
          pressSpeedCost,
        () => {
          money -=
            pressSpeedCost;

          pressSpeedLevel++;

          pressSpeedCost =
            Math.ceil(
              pressSpeedCost *
                1.72
            );
        }
      )
  );

document
  .getElementById(
    "valueUpgrade"
  )
  .addEventListener(
    "click",
    () =>
      upgrade(
        "value",
        () =>
          money >=
          valueCost,
        () => {
          money -=
            valueCost;

          valueLevel++;

          valueCost =
            Math.ceil(
              valueCost *
                1.72
            );
        }
      )
  );

document
  .getElementById(
    "varietyUpgrade"
  )
  .addEventListener(
    "click",
    () =>
      upgrade(
        "variety",
        () =>
          money >=
            varietyCost &&
          varietyLevel <
            getWorldVarietyCap(),
        () => {
          money -=
            varietyCost;

          const nextVariety =
            Math.min(
              getWorldVarietyCap(),
              varietyLevel +
                1
            );

          setWorldVarietyLevel(
            nextVariety
          );

          varietyCost =
            Math.ceil(
              varietyCost *
                1.85
            );

          /*
            Force the current world's variety
            into the saved state immediately.
          */
          worldVarietyLevels[
            worldIndex
          ] =
            varietyLevel;
        }
      )
  );

document
  .getElementById(
    "powerUpgrade"
  )
  .addEventListener(
    "click",
    () =>
      upgrade(
        "power",
        () =>
          money >=
          powerCost,
        () => {
          money -=
            powerCost;

          powerLevel++;

          powerCost =
            Math.ceil(
              powerCost *
                1.9
            );
        }
      )
  );

document
  .getElementById(
    "luckUpgrade"
  )
  .addEventListener(
    "click",
    () =>
      upgrade(
        "luck",
        () =>
          money >=
          luckCost,
        () => {
          money -=
            luckCost;

          luckLevel++;

          luckCost =
            Math.ceil(
              luckCost *
                2.05
            );
        }
      )
  );

document
  .getElementById(
    "autoUpgrade"
  )
  .addEventListener(
    "click",
    () =>
      upgrade(
        "auto",
        () =>
          money >=
          autoCost,
        () => {
          money -=
            autoCost;

          autoLevel++;

          autoCost =
            Math.ceil(
              autoCost *
                2.2
            );

          restartSpawner();
        }
      )
  );

document
  .getElementById(
    "machineUpgrade"
  )
  .addEventListener(
    "click",
    () =>
      upgrade(
        "machine",
        () =>
          money >=
          machineCost,
        () => {
          money -=
            machineCost;

          machineLevel++;

          machineCost =
            Math.ceil(
              machineCost *
                3.0
            );

          setWorldVarietyLevel(
            Math.min(
              getWorldVarietyCap(),
              varietyLevel +
                1
            )
          );
        }
      )
  );

// =========================
// SPAWNER
// =========================
let spawner = null;

function restartSpawner() {
  if (spawner) {
    clearInterval(
      spawner
    );
  }

  spawner =
    setInterval(
      createItem,
      Math.max(
        250,
        spawnDelay
      )
    );
}

// =========================
// UI / SETTINGS
// =========================
function percent(value) {
  return `${Math.round(
    value * 100
  )}%`;
}

function updateUI() {
  worldIndex =
    getWorldIndexForLevel(
      level
    );

  syncWorldVarietyLevel();

  const worldLevel =
    getWorldLevel(
      level
    );

  const goal =
    getCurrentLevelGoal();

  const prevGoal =
    level === 1
      ? 0
      : getLevelGoal(
          level - 1
        );

  const progress =
    Math.max(
      0,
      Math.min(
        1,
        (crushed -
          prevGoal) /
          Math.max(
            1,
            goal -
              prevGoal
          )
      )
    );

  const world =
    worlds[worldIndex];

  document.getElementById(
    "worldName"
  ).textContent =
    `WORLD ${worldIndex + 1} · ${world.name}`;

  document.getElementById(
    "levelName"
  ).textContent =
    `LEVEL ${worldLevel}`;

  document.getElementById(
    "levelProgressFill"
  ).style.width =
    `${progress * 100}%`;

  document.getElementById(
    "levelProgressText"
  ).textContent =
    `${Math.min(
      crushed,
      goal
    )} / ${goal} crushed`;

  document.getElementById(
    "nextUnlock"
  ).textContent =
    level >= MAX_LEVEL
      ? "Max level reached"
      : `Next level: ${getNextUnlock(
          level + 1
        )}`;

  moneyEl.textContent =
    Math.floor(money);

  crushedEl.textContent =
    crushed;

  document.getElementById(
    "speedLevel"
  ).textContent =
    speedLevel;

  document.getElementById(
    "pressSpeedLevel"
  ).textContent =
    pressSpeedLevel;

  document.getElementById(
    "valueLevel"
  ).textContent =
    valueLevel;

  document.getElementById(
    "varietyLevel"
  ).textContent =
    varietyLevel;

  document.getElementById(
    "powerLevel"
  ).textContent =
    powerLevel;

  document.getElementById(
    "luckLevel"
  ).textContent =
    luckLevel;

  document.getElementById(
    "autoLevel"
  ).textContent =
    autoLevel;

  document.getElementById(
    "machineLevel"
  ).textContent =
    machineLevel;

  document.getElementById(
    "statSpeed"
  ).textContent =
    speedLevel;

  document.getElementById(
    "statPressSpeed"
  ).textContent =
    pressSpeedLevel;

  document.getElementById(
    "statPressTime"
  ).textContent =
    `${(
      getPressCycleDuration() /
      1000
    ).toFixed(1)}s`;

  document.getElementById(
    "statValue"
  ).textContent =
    valueLevel;

  document.getElementById(
    "statVariety"
  ).textContent =
    varietyLevel;

  document.getElementById(
    "statPower"
  ).textContent =
    powerLevel;

  document.getElementById(
    "statLuck"
  ).textContent =
    luckLevel;

  document.getElementById(
    "statMachine"
  ).textContent =
    machineLevel;

  document.getElementById(
    "statCombo"
  ).textContent =
    combo > 1
      ? `x${(
          1 +
          Math.min(
            combo,
            20
          ) *
            0.05
        ).toFixed(2)}`
      : "x1.00";

  document.getElementById(
    "statBestCombo"
  ).textContent =
    bestCombo;

  document.getElementById(
    "modalMoney"
  ).textContent =
    Math.floor(money);

  document.getElementById(
    "modalEarned"
  ).textContent =
    Math.floor(
      totalEarned
    );

  document.getElementById(
    "modalCrushed"
  ).textContent =
    crushed;

  document.getElementById(
    "statAuto"
  ).textContent =
    autoLevel;

  document.getElementById(
    "statSpawn"
  ).textContent =
    `${(
      spawnDelay /
      1000
    ).toFixed(1)}s · ${getFeederCapacity()} capacity`;

  document.getElementById(
    "speedCost"
  ).textContent =
    speedCost;

  document.getElementById(
    "pressSpeedCost"
  ).textContent =
    pressSpeedCost;

  document.getElementById(
    "valueCost"
  ).textContent =
    valueCost;

  document.getElementById(
    "varietyCost"
  ).textContent =
    varietyCost;

  document.getElementById(
    "powerCost"
  ).textContent =
    powerCost;

  document.getElementById(
    "luckCost"
  ).textContent =
    luckCost;

  document.getElementById(
    "autoCost"
  ).textContent =
    autoCost;

  document.getElementById(
    "machineCost"
  ).textContent =
    machineCost;

  document.getElementById(
    "speedUpgrade"
  ).disabled =
    money < speedCost ||
    !isUpgradeUnlocked(
      "speed"
    );

  document.getElementById(
    "pressSpeedUpgrade"
  ).disabled =
    money <
      pressSpeedCost ||
    !isUpgradeUnlocked(
      "pressSpeed"
    );

  document.getElementById(
    "valueUpgrade"
  ).disabled =
    money < valueCost ||
    !isUpgradeUnlocked(
      "value"
    );

  document.getElementById(
    "powerUpgrade"
  ).disabled =
    money < powerCost ||
    !isUpgradeUnlocked(
      "power"
    );

  document.getElementById(
    "luckUpgrade"
  ).disabled =
    money < luckCost ||
    !isUpgradeUnlocked(
      "luck"
    );

  document.getElementById(
    "machineUpgrade"
  ).disabled =
    money < machineCost ||
    !isUpgradeUnlocked(
      "machine"
    );

  // =========================
  // UPGRADE SUBTEXT
  // =========================

  function setUpgradeUI(
    id,
    unlockLevel,
    description,
    cost
  ) {
    const button =
      document.getElementById(
        `${id}Upgrade`
      );

    if (!button) return;

    const small =
      button.querySelector(
        "small"
      );

    if (!small) return;

    const unlocked =
      isUpgradeUnlocked(id);

    // Locked / unlocked appearance
    button.style.opacity =
      unlocked ? "1" : "0.45";

    button.style.filter =
      unlocked
        ? "none"
        : "grayscale(1)";

    button.style.cursor =
      unlocked
        ? ""
        : "not-allowed";

    // Button can only be used when unlocked
    // AND there is enough money.
    button.disabled =
      !unlocked ||
      money < cost;

    // Keep the cost visible.
    small.innerHTML = unlocked
      ? `${description} · Cost: <span id="${id}Cost">${cost}</span> 💰`
      : `Unlocks at Level ${unlockLevel} · Cost: <span id="${id}Cost">${cost}</span> 💰`;
  }

  setUpgradeUI(
    "speed",
    1,
    "Makes the conveyor move faster.",
    speedCost
  );

  setUpgradeUI(
    "pressSpeed",
    1,
    "Makes the press cycle faster.",
    pressSpeedCost
  );

  setUpgradeUI(
    "value",
    1,
    "Increases the money earned from crushed items.",
    valueCost
  );

  setUpgradeUI(
    "power",
    2,
    "Allows the press to crush harder items.",
    powerCost
  );

  setUpgradeUI(
    "luck",
    4,
    "Improves the chance of getting valuable items.",
    luckCost
  );

  setUpgradeUI(
    "machine",
    7,
    "Improves the overall machine performance.",
    machineCost
  );

  // =========================
  // ITEM VARIETY
  // =========================

  const varietyButton =
    document.getElementById(
      "varietyUpgrade"
    );

  const varietySmall =
    varietyButton.querySelector(
      "small"
    );

  const varietyUnlocked =
    isUpgradeUnlocked(
      "variety"
    );

  const varietyMaxed =
    varietyLevel >=
    getWorldVarietyCap();

  varietyButton.disabled =
    !varietyUnlocked ||
    money < varietyCost ||
    varietyMaxed;

  varietyButton.style.opacity =
    varietyUnlocked
      ? "1"
      : "0.45";

  varietyButton.style.filter =
    varietyUnlocked
      ? "none"
      : "grayscale(1)";

  varietyButton.style.cursor =
    varietyUnlocked
      ? ""
      : "not-allowed";

  if (varietySmall) {
    if (!varietyUnlocked) {
      varietySmall.innerHTML =
        `Unlocks at Level 2 · Cost: <span id="varietyCost">${varietyCost}</span> 💰`;
    } else if (varietyMaxed) {
      varietySmall.innerHTML =
        `MAX · Every item in this world unlocked · Cost: <span id="varietyCost">${varietyCost}</span> 💰`;
    } else {
      varietySmall.innerHTML =
        `Unlocks more items to crush · Cost: <span id="varietyCost">${varietyCost}</span> 💰`;
    }
  }

  // =========================
  // FEEDER
  // =========================

  const autoButton =
    document.getElementById(
      "autoUpgrade"
    );

  const autoSmall =
    autoButton.querySelector(
      "small"
    );

  const feederUnlocked =
    isFeederUnlocked();

  autoButton.disabled =
    !feederUnlocked ||
    money < autoCost;

  autoButton.style.opacity =
    feederUnlocked
      ? "1"
      : "0.45";

  autoButton.style.filter =
    feederUnlocked
      ? "none"
      : "grayscale(1)";

  autoButton.style.cursor =
    feederUnlocked
      ? ""
      : "not-allowed";

  if (autoSmall) {
    if (!feederUnlocked) {
      autoSmall.innerHTML =
        `Unlocks at Level 3 · Cost: <span id="autoCost">${autoCost}</span> 💰`;
    } else {
      autoSmall.innerHTML =
        `Increases the feeder capacity and spawning speed. · Cost: <span id="autoCost">${autoCost}</span> 💰`;
    }
  }

  const availableItems =
    getAvailableWorldItems();

  document.getElementById(
    "unlockedItems"
  ).textContent =
    `${availableItems.length}/${getCurrentWorldItems().length} items available`;

  document.getElementById(
    "comboDisplay"
  ).textContent =
    combo > 1
      ? `COMBO x${combo}`
      : "READY";

  document.getElementById(
    "comboDisplay"
  ).classList.toggle(
    "active",
    combo > 1
  );

  document.getElementById(
    "pauseButton"
  ).textContent =
    paused
      ? "Resume factory"
      : "Pause factory";

  updateAdminUpgradeButtons();
}

// =========================
// SOUND UI
// =========================
const soundInputs = [
  "master",
  "conveyor",
  "crush",
  "upgrade"
];

for (
  const type of soundInputs
) {
  const input =
    document.getElementById(
      `${type}Volume`
    );

  const value =
    document.getElementById(
      `${type}VolumeValue`
    );

  if (!input || !value) {
    continue;
  }

  input.value =
    soundSettings[type] *
    100;

  value.textContent =
    percent(
      soundSettings[type]
    );

  input.addEventListener(
    "input",
    () => {
      soundSettings[type] =
        Number(
          input.value
        ) / 100;

      value.textContent =
        percent(
          soundSettings[type]
        );

      setSoundVolume(
        type,
        soundSettings[type]
      );
    }
  );
}

// =========================
// PAUSE
// =========================
document
  .getElementById(
    "pauseButton"
  )
  .addEventListener(
    "click",
    () => {
      paused = !paused;

      if (paused) {
        pressHead.classList.remove(
          "pressing",
          "press-jammed"
        );

        pressJammed =
          false;

        pressState =
          "up";

        pressCycleStart =
          0;

        pressProcessedItems.clear();

        setPressVisual(0);

        updateConveyorLock();
      } else {
        updateConveyorLock();
      }

      updateUI();
    }
  );

// =========================
// SECRET ADMIN MENU
// =========================
const adminConsole =
  document.getElementById(
    "adminConsole"
  );

const adminCommandInput =
  document.getElementById(
    "adminCommandInput"
  );

const adminMenu =
  document.getElementById(
    "adminMenu"
  );

const adminMoneyInput =
  document.getElementById(
    "adminMoneyInput"
  );

const adminStatus =
  document.getElementById(
    "adminStatus"
  );

const adminUpgradeNames = {
  speed: "Conveyor Speed",
  pressSpeed: "Press Speed",
  value: "Item Value",
  variety: "Item Variety",
  power: "Press Power",
  luck: "Scrap Luck",
  auto: "Feeder Upgrade",
  machine: "Upgrade Machine"
};

function openAdminConsole() {
  if (adminUnlocked) {
    adminMenu.classList.add(
      "open"
    );

    adminMenu.setAttribute(
      "aria-hidden",
      "false"
    );

    createAdminUpgradeControls();

    updateAdminUpgradeButtons();

    adminMoneyInput.focus();

    return;
  }

  adminConsole.classList.add(
    "open"
  );

  adminConsole.setAttribute(
    "aria-hidden",
    "false"
  );

  adminCommandInput.value =
    "";

  setTimeout(
    () =>
      adminCommandInput.focus(),
    0
  );
}

function closeAdminConsole() {
  adminConsole.classList.remove(
    "open"
  );

  adminConsole.setAttribute(
    "aria-hidden",
    "true"
  );
}

function unlockAdmin() {
  adminUnlocked =
    true;

  closeAdminConsole();

  adminMenu.classList.add(
    "open"
  );

  adminMenu.setAttribute(
    "aria-hidden",
    "false"
  );

  adminStatus.textContent =
    "Admin access enabled for this session.";

  adminMoneyInput.value =
    Math.floor(money);

  createAdminUpgradeControls();

  updateAdminUpgradeButtons();

  adminMoneyInput.focus();
}

adminCommandInput.addEventListener(
  "keydown",
  event => {
    if (
      event.key ===
      "Enter"
    ) {
      if (
        adminCommandInput.value
          .trim()
          .toLowerCase() ===
        "/admin zhulikai"
      ) {
        unlockAdmin();
      } else {
        adminStatus.textContent =
          "Invalid command.";

        adminCommandInput.select();
      }
    } else if (
      event.key ===
      "Escape"
    ) {
      closeAdminConsole();
    }
  }
);

document
  .getElementById(
    "closeAdmin"
  )
  .addEventListener(
    "click",
    () => {
      adminMenu.classList.remove(
        "open"
      );

      adminMenu.setAttribute(
        "aria-hidden",
        "true"
      );
    }
  );

adminMenu.addEventListener(
  "click",
  event => {
    if (
      event.target ===
      adminMenu
    ) {
      adminMenu.classList.remove(
        "open"
      );

      adminMenu.setAttribute(
        "aria-hidden",
        "true"
      );
    }
  }
);

function getAdminAmount() {
  const amount =
    Number(
      adminMoneyInput.value
    );

  if (
    !Number.isFinite(
      amount
    ) ||
    amount < 0
  ) {
    return null;
  }

  return Math.floor(
    amount
  );
}

// =========================
// ADMIN MONEY
// =========================
document
  .getElementById(
    "setAdminMoney"
  )
  .addEventListener(
    "click",
    () => {
      if (!adminUnlocked)
        return;

      const amount =
        getAdminAmount();

      if (
        amount === null
      ) {
        adminStatus.textContent =
          "Enter a valid amount.";

        return;
      }

      money = amount;

      saveGame();

      updateUI();

      adminStatus.textContent =
        `Money set to ${amount}.`;
    }
  );

document
  .getElementById(
    "addAdminMoney"
  )
  .addEventListener(
    "click",
    () => {
      if (!adminUnlocked)
        return;

      const amount =
        getAdminAmount();

      if (
        amount === null
      ) {
        adminStatus.textContent =
          "Enter a valid amount.";

        return;
      }

      money += amount;

      saveGame();

      updateUI();

      adminStatus.textContent =
        `Added ${amount}.`;
    }
  );

document
  .getElementById(
    "removeAdminMoney"
  )
  .addEventListener(
    "click",
    () => {
      if (!adminUnlocked)
        return;

      const amount =
        getAdminAmount();

      if (
        amount === null
      ) {
        adminStatus.textContent =
          "Enter a valid amount.";

        return;
      }

      money =
        Math.max(
          0,
          money - amount
        );

      saveGame();

      updateUI();

      adminStatus.textContent =
        `Removed ${amount}.`;
    }
  );

// =========================
// ADMIN UPGRADE CONTROLS
// =========================
function createAdminUpgradeControls() {
  if (
    document.getElementById(
      "adminUpgradeControls"
    )
  ) {
    return;
  }

  const container =
    document.createElement(
      "div"
    );

  container.id =
    "adminUpgradeControls";

  container.style.marginTop =
    "14px";

  container.style.display =
    "flex";

  container.style.flexDirection =
    "column";

  container.style.gap =
    "6px";

  const title =
    document.createElement(
      "div"
    );

  title.textContent =
    "UPGRADE CONTROLS";

  title.style.fontWeight =
    "700";

  title.style.marginBottom =
    "4px";

  container.appendChild(
    title
  );

  const info =
    document.createElement(
      "small"
    );

  info.textContent =
    "Unlock bypasses the normal level requirement. Reset returns the upgrade to level 1.";

  info.style.opacity =
    "0.7";

  container.appendChild(
    info
  );

  for (
    const id of Object.keys(
      adminUpgradeNames
    )
  ) {
    const row =
      document.createElement(
        "div"
      );

    row.style.display =
      "flex";

    row.style.gap =
      "6px";

    row.style.flexWrap =
      "wrap";

    const unlockButton =
      document.createElement(
        "button"
      );

    unlockButton.dataset.adminUnlock =
      id;

    unlockButton.addEventListener(
      "click",
      () => {
        toggleAdminUpgradeUnlock(
          id
        );
      }
    );

    const resetButton =
      document.createElement(
        "button"
      );

    resetButton.textContent =
      `Reset ${adminUpgradeNames[id]}`;

    resetButton.addEventListener(
      "click",
      () => {
        resetAdminUpgrade(
          id
        );
      }
    );

    row.appendChild(
      unlockButton
    );

    row.appendChild(
      resetButton
    );

    container.appendChild(
      row
    );
  }

  adminMenu.appendChild(
    container
  );

  updateAdminUpgradeButtons();
}

function toggleAdminUpgradeUnlock(
  id
) {
  if (
    !Object.prototype.hasOwnProperty.call(
      adminUpgradeUnlocks,
      id
    )
  ) {
    return;
  }

  adminUpgradeUnlocks[id] =
    !adminUpgradeUnlocks[id];

  updateAdminUpgradeButtons();

  updateUI();

  saveGame();

  adminStatus.textContent =
    adminUpgradeUnlocks[id]
      ? `${adminUpgradeNames[id]} unlocked by admin.`
      : `${adminUpgradeNames[id]} returned to normal level requirement.`;
}

function updateAdminUpgradeButtons() {
  const container =
    document.getElementById(
      "adminUpgradeControls"
    );

  if (!container)
    return;

  for (
    const id of Object.keys(
      adminUpgradeNames
    )
  ) {
    const unlockButton =
      container.querySelector(
        `[data-admin-unlock="${id}"]`
      );

    if (!unlockButton)
      continue;

    unlockButton.textContent =
      adminUpgradeUnlocks[id]
        ? `Lock ${adminUpgradeNames[id]}`
        : `Unlock ${adminUpgradeNames[id]}`;
  }
}

function resetAdminUpgrade(
  id
) {
  if (!adminUnlocked)
    return;

  switch (id) {
    case "speed":
      speedLevel = 1;
      speedCost = 25;
      break;

    case "pressSpeed":
      pressSpeedLevel = 1;
      pressSpeedCost = 90;
      break;

    case "value":
      valueLevel = 1;
      valueCost = 50;
      break;

    case "variety":
      setWorldVarietyLevel(
        1
      );

      varietyCost = 75;
      break;

    case "power":
      powerLevel = 1;
      powerCost = 120;
      break;

    case "luck":
      luckLevel = 1;
      luckCost = 180;
      break;

    case "auto":
      autoLevel = 1;
      autoCost = 300;
      break;

    case "machine":
      machineLevel = 1;
      machineCost = 1000;
      break;

    default:
      return;
  }

  adminUpgradeUnlocks[id] =
    false;

  recalculateDerivedStats();

  if (
    id === "auto"
  ) {
    restartSpawner();
  }

  updateUI();

  saveGame();

  adminStatus.textContent =
    `${adminUpgradeNames[id]} reset to level 1.`;
}

// =========================
// ADMIN HOTKEY
// =========================
window.addEventListener(
  "keydown",
  event => {
    if (
      event.key !== "\\" ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return;
    }

    const tag =
      document.activeElement
        ?.tagName;

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    ) {
      return;
    }

    event.preventDefault();

    openAdminConsole();
  }
);

// =========================
// STATS
// =========================
document
  .getElementById(
    "statsButton"
  )
  .addEventListener(
    "click",
    () => {
      updateUI();

      document
        .getElementById(
          "statsModal"
        )
        .classList.add(
          "open"
        );
    }
  );

document
  .getElementById(
    "closeStats"
  )
  .addEventListener(
    "click",
    () => {
      document
        .getElementById(
          "statsModal"
        )
        .classList.remove(
          "open"
        );
    }
  );

document
  .getElementById(
    "statsModal"
  )
  .addEventListener(
    "click",
    event => {
      if (
        event.target.id ===
        "statsModal"
      ) {
        event.currentTarget.classList.remove(
          "open"
        );
      }
    }
  );

// =========================
// FACTORY RESET
// =========================
document
  .getElementById(
    "resetButton"
  )
  .addEventListener(
    "click",
    () => {
      if (
        !confirm(
          "Reset the factory and lose all progress?"
        )
      ) {
        return;
      }

      /*
        Prevent beforeunload/pagehide/visibilitychange
        from saving the old progress back after reset.
      */
      resettingProgress = true;

      localStorage.removeItem(
        SAVE_KEY
      );

      location.reload();
    }
  );

// =========================
// MILESTONES
// =========================
function checkMilestones() {
  const goals = [
    [10, "10 items crushed"],
    [50, "50 items crushed"],
    [100, "100 items crushed"],
    [250, "250 items crushed"],
    [500, "500 items crushed"],
    [1000, "1000 items crushed"]
  ];

  for (
    const [goal, label] of goals
  ) {
    if (
      crushed >= goal &&
      !milestones.has(
        goal
      )
    ) {
      milestones.add(
        goal
      );

      money +=
        Math.ceil(
          goal * 1.5
        );

      showToast(
        `${label}! Bonus +${Math.ceil(
          goal * 1.5
        )} coins`
      );
    }
  }
}

// =========================
// TOASTS
// =========================
function showToast(text) {
  const toast =
    document.createElement(
      "div"
    );

  toast.className =
    "toast";

  toast.textContent =
    text;

  document.body.appendChild(
    toast
  );

  setTimeout(
    () =>
      toast.classList.add(
        "show"
      ),
    10
  );

  setTimeout(
    () =>
      toast.remove(),
    2600
  );
}

// =========================
// SAVE
// =========================
function safeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function safeLevel(
  value,
  fallback = 1
) {
  return Math.max(
    1,
    Math.floor(
      safeNumber(
        value,
        fallback
      )
    )
  );
}

function saveGame() {
  try {
    /*
      Variety is stored per-world.

      This is important because varietyLevel
      alone can be changed when the current
      world changes.
    */
    syncWorldVarietyLevel();

    const saveData = {
      version: SAVE_VERSION,

      money: safeNumber(
        money
      ),

      crushed: Math.max(
        0,
        Math.floor(
          safeNumber(
            crushed
          )
        )
      ),

      totalEarned:
        safeNumber(
          totalEarned
        ),

      bestCombo: Math.max(
        0,
        Math.floor(
          safeNumber(
            bestCombo
          )
        )
      ),

      level: Math.max(
        1,
        Math.min(
          MAX_LEVEL,
          Math.floor(
            safeNumber(
              level,
              1
            )
          )
        )
      ),

      worldIndex: Math.max(
        0,
        Math.min(
          worlds.length - 1,
          Math.floor(
            safeNumber(
              worldIndex,
              0
            )
          )
        )
      ),

      machineLevel:
        safeLevel(
          machineLevel
        ),

      powerLevel:
        safeLevel(
          powerLevel
        ),

      speedLevel:
        safeLevel(
          speedLevel
        ),

      pressSpeedLevel:
        safeLevel(
          pressSpeedLevel
        ),

      valueLevel:
        safeLevel(
          valueLevel
        ),

      luckLevel:
        safeLevel(
          luckLevel
        ),

      autoLevel:
        safeLevel(
          autoLevel
        ),

      /*
        Keep this for backwards compatibility,
        but worldVarietyLevels is authoritative.
      */
      varietyLevel:
        safeLevel(
          varietyLevel
        ),

      worldVarietyLevels:
        Array.from(
          {
            length:
              worlds.length
          },
          (_, index) =>
            Math.max(
              1,
              Math.min(
                5,
                Math.floor(
                  safeNumber(
                    worldVarietyLevels[
                      index
                    ],
                    1
                  )
                )
              )
            )
        ),

      speedCost: Math.max(
        25,
        safeNumber(
          speedCost,
          25
        )
      ),

      pressSpeedCost:
        Math.max(
          90,
          safeNumber(
            pressSpeedCost,
            90
          )
        ),

      valueCost: Math.max(
        50,
        safeNumber(
          valueCost,
          50
        )
      ),

      varietyCost: Math.max(
        75,
        safeNumber(
          varietyCost,
          75
        )
      ),

      powerCost: Math.max(
        120,
        safeNumber(
          powerCost,
          120
        )
      ),

      luckCost: Math.max(
        180,
        safeNumber(
          luckCost,
          180
        )
      ),

      autoCost: Math.max(
        300,
        safeNumber(
          autoCost,
          300
        )
      ),

      machineCost: Math.max(
        1000,
        safeNumber(
          machineCost,
          1000
        )
      ),

      milestones:
        Array.from(
          milestones
        ).filter(
          value =>
            Number.isFinite(
              Number(value)
            )
        ),

      adminUpgradeUnlocks: {
        speed:
          adminUpgradeUnlocks.speed ===
          true,

        pressSpeed:
          adminUpgradeUnlocks.pressSpeed ===
          true,

        value:
          adminUpgradeUnlocks.value ===
          true,

        variety:
          adminUpgradeUnlocks.variety ===
          true,

        power:
          adminUpgradeUnlocks.power ===
          true,

        luck:
          adminUpgradeUnlocks.luck ===
          true,

        auto:
          adminUpgradeUnlocks.auto ===
          true,

        machine:
          adminUpgradeUnlocks.machine ===
          true
      }
    };

    const serialized =
      JSON.stringify(
        saveData
      );

    /*
      Verify the save can actually be parsed
      before writing it.
    */
    JSON.parse(
      serialized
    );

    localStorage.setItem(
      SAVE_KEY,
      serialized
    );

    return true;
  } catch (error) {
    console.error(
      "Save error:",
      error
    );

    return false;
  }
}

// =========================
// RESTORE
// =========================
function restoreGame() {
  try {
    const raw =
      localStorage.getItem(
        SAVE_KEY
      );

    if (!raw) {
      return false;
    }

    const s =
      JSON.parse(
        raw
      );

    if (
      !s ||
      typeof s !== "object"
    ) {
      return false;
    }

    /*
      Basic values.
    */
    money =
      Math.max(
        0,
        safeNumber(
          s.money,
          money
        )
      );

    crushed =
      Math.max(
        0,
        Math.floor(
          safeNumber(
            s.crushed,
            crushed
          )
        )
      );

    totalEarned =
      Math.max(
        0,
        safeNumber(
          s.totalEarned,
          totalEarned
        )
      );

    bestCombo =
      Math.max(
        0,
        Math.floor(
          safeNumber(
            s.bestCombo,
            bestCombo
          )
        )
      );

    /*
      Restore the level only as a temporary value.
      syncLevelFromProgress() later calculates
      the correct level from crushed count.
    */
    if (
      s.level !==
      undefined
    ) {
      level =
        Math.max(
          1,
          Math.min(
            MAX_LEVEL,
            Math.floor(
              safeNumber(
                s.level,
                1
              )
            )
          )
        );
    }

    /*
      Restore upgrade levels.
      These are NOT recalculated from variety.
      This prevents Variety 5 from resetting
      other upgrades.
    */
    machineLevel =
      safeLevel(
        s.machineLevel,
        machineLevel
      );

    powerLevel =
      safeLevel(
        s.powerLevel,
        powerLevel
      );

    speedLevel =
      safeLevel(
        s.speedLevel,
        speedLevel
      );

    pressSpeedLevel =
      safeLevel(
        s.pressSpeedLevel,
        pressSpeedLevel
      );

    valueLevel =
      safeLevel(
        s.valueLevel,
        valueLevel
      );

    luckLevel =
      safeLevel(
        s.luckLevel,
        luckLevel
      );

    autoLevel =
      safeLevel(
        s.autoLevel,
        autoLevel
      );

    /*
      Restore world-specific variety.

      New saves:
        use worldVarietyLevels.

      Old saves:
        use the old varietyLevel value
        as a migration fallback.
    */
    if (
      Array.isArray(
        s.worldVarietyLevels
      )
    ) {
      const restoredWorldVariety =
        Array(
          worlds.length
        ).fill(1);

      for (
        let i = 0;
        i < worlds.length;
        i++
      ) {
        restoredWorldVariety[i] =
          Math.max(
            1,
            Math.min(
              5,
              Math.floor(
                safeNumber(
                  s.worldVarietyLevels[
                    i
                  ],
                  1
                )
              )
            )
          );
      }

      worldVarietyLevels =
        restoredWorldVariety;
    } else {
      /*
        Migration for the older save format.
      */
      const oldVariety =
        Math.max(
          1,
          Math.min(
            5,
            Math.floor(
              safeNumber(
                s.varietyLevel,
                1
              )
            )
          )
        );

      worldVarietyLevels =
        Array(
          worlds.length
        ).fill(
          oldVariety
        );
    }

    /*
      Do NOT trust the saved worldIndex as
      the final world. The level determines it.
    */
    worldIndex =
      getWorldIndexForLevel(
        level
      );

    syncWorldVarietyLevel();

    /*
      Restore costs independently.
      This means an upgrade cost is not
      accidentally regenerated from Variety.
    */
    speedCost =
      Math.max(
        25,
        safeNumber(
          s.speedCost,
          speedCost
        )
      );

    pressSpeedCost =
      Math.max(
        90,
        safeNumber(
          s.pressSpeedCost,
          pressSpeedCost
        )
      );

    valueCost =
      Math.max(
        50,
        safeNumber(
          s.valueCost,
          valueCost
        )
      );

    varietyCost =
      Math.max(
        75,
        safeNumber(
          s.varietyCost,
          varietyCost
        )
      );

    powerCost =
      Math.max(
        120,
        safeNumber(
          s.powerCost,
          powerCost
        )
      );

    luckCost =
      Math.max(
        180,
        safeNumber(
          s.luckCost,
          luckCost
        )
      );

    autoCost =
      Math.max(
        300,
        safeNumber(
          s.autoCost,
          autoCost
        )
      );

    machineCost =
      Math.max(
        1000,
        safeNumber(
          s.machineCost,
          machineCost
        )
      );

    /*
      Restore milestones.
    */
    milestones.clear();

    if (
      Array.isArray(
        s.milestones
      )
    ) {
      for (
        const value of s.milestones
      ) {
        const number =
          Number(value);

        if (
          Number.isFinite(
            number
          )
        ) {
          milestones.add(
            number
          );
        }
      }
    }

    /*
      Restore admin unlocks.
    */
    if (
      s.adminUpgradeUnlocks &&
      typeof s.adminUpgradeUnlocks ===
        "object"
    ) {
      for (
        const id of Object.keys(
          adminUpgradeUnlocks
        )
      ) {
        adminUpgradeUnlocks[id] =
          s.adminUpgradeUnlocks[id] ===
          true;
      }
    }

    /*
      IMPORTANT:
      Do not restore speed/itemValue/
      pressPower/spawnDelay from the save.

      Those values are derived from the
      upgrade levels and can become stale.
    */
    recalculateDerivedStats();

    return true;
  } catch (error) {
    console.error(
      "Save restore error:",
      error
    );

    /*
      Do NOT delete the save automatically.
      A temporary parsing/UI problem shouldn't
      destroy the player's progress.
    */
    return false;
  }
}

// =========================
// SAVE ON PAGE CLOSE / REFRESH
// =========================
window.addEventListener(
  "beforeunload",
  () => {
    if (resettingProgress) {
      return;
    }

    saveGame();
  }
);

window.addEventListener(
  "pagehide",
  () => {
    if (resettingProgress) {
      return;
    }

    saveGame();
  }
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState ===
        "hidden" &&
      !resettingProgress
    ) {
      saveGame();
    }
  }
);

// =========================
// START GAME
// =========================
/*
  Start the animation loop FIRST.

  This guarantees that if some UI element
  has an unexpected problem during startup,
  the game loop itself still exists and can
  recover instead of permanently freezing.
*/
requestAnimationFrame(
  gameLoop
);

try {
  restoreGame();

  /*
    Level is based on actual crushed progress.
  */
  syncLevelFromProgress();

  /*
    Recalculate everything from the restored
    upgrade levels.
  */
  recalculateDerivedStats();

  syncWorldVarietyLevel();

  restartSpawner();

  setPressGeometry();

  updateConveyorLock();

  updateUI();
} catch (error) {
  console.error(
    "GAME STARTUP ERROR:",
    error
  );

  /*
    Still keep the factory alive even if
    startup UI code encounters an error.
  */
  try {
    recalculateDerivedStats();
  } catch (_) {}

  try {
    restartSpawner();
  } catch (_) {}

  try {
    setPressGeometry();
  } catch (_) {}
}

// ==================== BUG REPORT ====================

const reportBugButton = document.getElementById("reportBugButton");
const bugReportModal = document.getElementById("bugReportModal");
const cancelBugReport = document.getElementById("cancelBugReport");
const submitBugReport = document.getElementById("submitBugReport");
const bugReportInput = document.getElementById("bugReportInput");
const bugReportStatus = document.getElementById("bugReportStatus");

if (reportBugButton && bugReportModal) {

  reportBugButton.addEventListener("click", () => {
    bugReportModal.classList.add("open");
    bugReportStatus.textContent = "";
    bugReportInput.focus();
  });

  cancelBugReport.addEventListener("click", () => {
    bugReportModal.classList.remove("open");
    bugReportInput.value = "";
    bugReportStatus.textContent = "";
  });

  bugReportModal.addEventListener("click", (event) => {
    if (event.target === bugReportModal) {
      bugReportModal.classList.remove("open");
    }
  });

  submitBugReport.addEventListener("click", async () => {

    const description = bugReportInput.value.trim();

    if (!description) {
      bugReportStatus.textContent = "Please describe the bug first.";
      return;
    }

    submitBugReport.disabled = true;
    submitBugReport.textContent = "Sending...";
    bugReportStatus.textContent = "";

    try {

      const response = await fetch(
        "https://blue-glade-dd71.alexmaku1992.workers.dev/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            description: description,
            browser: navigator.userAgent,
            screen: `${window.innerWidth}x${window.innerHeight}`
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to submit bug report.");
      }

      bugReportStatus.textContent = "Bug report submitted successfully!";
      bugReportInput.value = "";

    } catch (error) {

      console.error("Bug report error:", error);

      bugReportStatus.textContent =
        "Failed to submit bug report.";

    } finally {

      submitBugReport.disabled = false;
      submitBugReport.textContent = "Submit Bug";

    }
  });
}