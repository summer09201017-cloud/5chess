const TEAM_NAMES = {
  away: "海風隊",
  home: "赤焰隊",
};

const LINEUPS = {
  away: [
    { name: "江海岳", speed: 66, contact: 60, power: 54 },
    { name: "周柏廷", speed: 58, contact: 67, power: 57 },
    { name: "林思遠", speed: 63, contact: 72, power: 61 },
    { name: "陳曜廷", speed: 54, contact: 68, power: 74 },
    { name: "許振宇", speed: 59, contact: 64, power: 69 },
    { name: "何子淵", speed: 62, contact: 61, power: 58 },
    { name: "沈冠銘", speed: 71, contact: 58, power: 49 },
    { name: "溫哲安", speed: 64, contact: 57, power: 53 },
    { name: "韓奕辰", speed: 55, contact: 62, power: 52 },
  ],
  home: [
    { name: "王承澤", speed: 68, contact: 62, power: 56 },
    { name: "郭浩鈞", speed: 61, contact: 69, power: 58 },
    { name: "葉昀哲", speed: 58, contact: 74, power: 64 },
    { name: "吳尚勳", speed: 56, contact: 68, power: 76 },
    { name: "鄭凱嵐", speed: 70, contact: 60, power: 55 },
    { name: "徐家朗", speed: 63, contact: 65, power: 60 },
    { name: "顏博勛", speed: 72, contact: 57, power: 50 },
    { name: "謝彥廷", speed: 59, contact: 63, power: 54 },
    { name: "傅予辰", speed: 57, contact: 61, power: 52 },
  ],
};

const PITCHING_STAFF = {
  away: {
    name: "羅子豪",
    velocity: 63,
    control: 68,
    staminaMax: 92,
    composure: 64,
    pitches: {
      fastball: 66,
      curve: 70,
      slider: 62,
    },
  },
  home: {
    name: "梁彥翔",
    velocity: 70,
    control: 61,
    staminaMax: 88,
    composure: 67,
    pitches: {
      fastball: 73,
      slider: 68,
      splitter: 64,
    },
  },
};

const BATTING_MODES = {
  normal: { label: "正常", shortLabel: "正常" },
  pull: { label: "拉打", shortLabel: "拉" },
  push: { label: "推打", shortLabel: "推" },
  bunt: { label: "觸擊", shortLabel: "觸" },
};

const DIFFICULTY_LEVELS = {
  rookie: { label: "新手" },
  normal: { label: "標準" },
  veteran: { label: "老手" },
};

const PITCH_TYPES = {
  fastball: {
    label: "直球",
    duration: 820,
    breakX: 0.01,
    breakY: -0.02,
    control: 0.04,
    deception: 0.04,
    color: "#ffd47d",
  },
  curve: {
    label: "曲球",
    duration: 1080,
    breakX: -0.08,
    breakY: 0.11,
    control: 0.065,
    deception: 0.16,
    color: "#9de2ff",
  },
  slider: {
    label: "滑球",
    duration: 960,
    breakX: 0.09,
    breakY: 0.04,
    control: 0.055,
    deception: 0.13,
    color: "#d7ff9f",
  },
  splitter: {
    label: "指叉",
    duration: 1010,
    breakX: 0.015,
    breakY: 0.13,
    control: 0.07,
    deception: 0.18,
    color: "#ffc8f2",
  },
};

const STRIKE_ZONE = {
  left: 0.2306,
  right: 0.7694,
  top: 0.1993,
  bottom: 0.8607,
};

const FIELD = {
  home: { x: 420, y: 575 },
  first: { x: 548, y: 447 },
  second: { x: 420, y: 319 },
  third: { x: 292, y: 447 },
  pitcher: { x: 420, y: 465 },
  fenceRadius: 352,
};

const BASE_POINTS = {
  plate: FIELD.home,
  0: FIELD.first,
  1: FIELD.second,
  2: FIELD.third,
  home: FIELD.home,
};

const FIELDER_TEMPLATES = [
  { id: "c", label: "C", x: 420, y: 607 },
  { id: "p", label: "P", x: 420, y: 468 },
  { id: "1b", label: "1B", x: 582, y: 442 },
  { id: "2b", label: "2B", x: 492, y: 388 },
  { id: "ss", label: "SS", x: 348, y: 392 },
  { id: "3b", label: "3B", x: 258, y: 442 },
  { id: "lf", label: "LF", x: 262, y: 252 },
  { id: "cf", label: "CF", x: 420, y: 202 },
  { id: "rf", label: "RF", x: 578, y: 252 },
];

const CATCH_DISPLAY_MS = 650;
const FIELDER_BASE_RADIUS = 13;
const FIELDER_CAUGHT_RADIUS = 20;
const BALL_DRAW_RADIUS = 8;
const BALL_OVERLAP_RATIO = 0.75;

const LOGICAL = {
  field: { width: 840, height: 660 },
  pitch: { width: 360, height: 440 },
};

const BALANCE = {
  batting: {
    contactInZone: 0.9,
    contactOutZone: 0.4,
    timingPenalty: 2.4,
    deceptionPenalty: 0.6,
    contactMin: 0.08,
    contactMax: 0.94,
    foulTimingThreshold: 0.16,
    foulOutZoneRate: 0.52,
    pullBiasScale: 170,
    pullBiasRandom: 8,
    pullBiasLimit: 58,
    fairAngleLimit: 43,
    foulAngleThreshold: 47,
    foulAngleRate: 0.6,
    batSkillPowerWeight: 0.55,
    batSkillContactWeight: 0.45,
    loftBase: 0.18,
    loftContactFactor: 0.9,
    loftRandom: 0.25,
    groundLoftMax: 0.32,
    lineLoftMax: 0.58,
    flyLoftMax: 0.9,
    protectContactBonus: 0.12,
    protectPowerPenalty: 28,
    pullAngleBonus: -18,
    pullDistanceBonus: 16,
    pullFoulPenalty: 0.12,
    pushAngleBonus: 18,
    pushDistancePenalty: 12,
    pushContactBonus: 0.06,
    buntContactBonus: 0.18,
    buntTimingPenalty: 1.15,
    buntDistanceMin: 42,
    buntDistanceMax: 118,
    buntPopupRate: 0.18,
    buntHitBonusSpeedAnchor: 62,
  },
  aiBatting: {
    swingZoneBase: 0.7,
    swingChaseBase: 0.24,
    strikeAggression: 0.08,
    ballPatience: 0.04,
    deceptionTakePenalty: 0.45,
    swingMin: 0.12,
    swingMax: 0.92,
    whiffBase: 0.18,
    whiffDeception: 0.7,
    whiffCenterDistance: 0.28,
    weakCenterDistance: 0.55,
    weakDeception: 0.45,
    weakFoulRate: 0.32,
    contactQualityBase: 0.78,
    contactQualityRandomLow: -0.12,
    contactQualityRandomHigh: 0.16,
    contactQualityMin: 0.22,
    contactQualityMax: 0.96,
  },
  pitching: {
    staminaCostBase: 1.08,
    pitchCost: {
      fastball: 0.9,
      curve: 1.05,
      slider: 1,
      splitter: 1.12,
    },
    velocityDurationStep: 4.5,
    fatigueDurationPenalty: 115,
    controlStep: 0.0012,
    pitchCommandStep: 0.001,
    fatigueControlPenalty: 0.065,
    deceptionStep: 0.002,
    breakStep: 0.0015,
  },
  difficulty: {
    rookie: {
      zoneRate: 0.72,
      edgeRate: 0.2,
      aiPitchBrains: 0,
      aiSwingDiscipline: -0.08,
      aiContactBonus: -0.04,
    },
    normal: {
      zoneRate: 0.64,
      edgeRate: 0.34,
      aiPitchBrains: 0.55,
      aiSwingDiscipline: 0,
      aiContactBonus: 0,
    },
    veteran: {
      zoneRate: 0.54,
      edgeRate: 0.5,
      aiPitchBrains: 1,
      aiSwingDiscipline: 0.09,
      aiContactBonus: 0.06,
    },
  },
  defenseCatchRate: {
    ground: 0.78,
    line: 0.75,
    fly: 0.82,
    popup: 0.93,
  },
  pursuerCount: {
    ground: 2,
    line: 1,
    fly: 1,
    popup: 1,
  },
  homeRun: {
    minDistance: 365,
    maxAngle: 39,
  },
  steal: {
    runnerBaseTime: 3.34,
    runnerSpeedFactor: 0.015,
    runnerSpeedAnchor: 50,
    pitchDurationDivisor: 3600,
    pitchDurationAnchor: 820,
    catcherThrowBase: 1.9,
    breakingPenalty: 0.08,
    fastballBonus: -0.03,
  },
  flyBall: {
    sacFlyMinDistance: 255,
    lineDoubleMinDistance: 275,
    extraBaseMinDistance: 312,
    tripleMinDistance: 345,
  },
  fielding: {
    doublePlayBase: 0.32,
    doublePlayBatterSpeedStep: 0.004,
    errorRate: {
      ground: 0.07,
      line: 0.025,
      fly: 0.018,
      popup: 0.012,
    },
  },
  manualFielding: {
    moveSpeed: 205,
    catchRadius: 28,
    groundRadius: 34,
    minX: 165,
    maxX: 675,
    minY: 110,
    maxY: 615,
  },
  replay: {
    durationMs: 1500,
  },
};
