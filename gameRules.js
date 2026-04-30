let runnerIdCounter = 1;
let game = {};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function deepClonePoint(point) {
  return { x: point.x, y: point.y };
}

function polarToField(angleDeg, radius) {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: FIELD.home.x + Math.sin(angle) * radius,
    y: FIELD.home.y - Math.cos(angle) * radius,
  };
}

function circleIntersectionArea(radiusA, radiusB, centerDistance) {
  const distanceValue = Math.max(centerDistance, 0.0001);
  if (distanceValue >= radiusA + radiusB) {
    return 0;
  }
  if (distanceValue <= Math.abs(radiusA - radiusB)) {
    return Math.PI * Math.min(radiusA, radiusB) ** 2;
  }

  const a =
    radiusA ** 2 *
    Math.acos(
      clamp(
        (distanceValue ** 2 + radiusA ** 2 - radiusB ** 2) / (2 * distanceValue * radiusA),
        -1,
        1
      )
    );
  const b =
    radiusB ** 2 *
    Math.acos(
      clamp(
        (distanceValue ** 2 + radiusB ** 2 - radiusA ** 2) / (2 * distanceValue * radiusB),
        -1,
        1
      )
    );
  const c =
    0.5 *
    Math.sqrt(
      Math.max(
        0,
        (-distanceValue + radiusA + radiusB) *
          (distanceValue + radiusA - radiusB) *
          (distanceValue - radiusA + radiusB) *
          (distanceValue + radiusA + radiusB)
      )
    );

  return a + b - c;
}

function overlapDistanceForRatio(radiusA, radiusB, overlapRatio) {
  const targetArea = Math.PI * radiusB ** 2 * overlapRatio;
  let low = Math.max(0, Math.abs(radiusA - radiusB));
  let high = radiusA + radiusB;

  for (let index = 0; index < 28; index += 1) {
    const middle = (low + high) / 2;
    const area = circleIntersectionArea(radiusA, radiusB, middle);
    if (area > targetArea) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}

function buildFielders() {
  return FIELDER_TEMPLATES.map((fielder) => ({
    ...fielder,
    homeX: fielder.x,
    homeY: fielder.y,
    targetX: fielder.x,
    targetY: fielder.y,
  }));
}

function buildPitchers() {
  return Object.fromEntries(
    Object.entries(PITCHING_STAFF).map(([teamKey, pitcher]) => [
      teamKey,
      {
        ...pitcher,
        stamina: pitcher.staminaMax,
        pitchCount: 0,
        pitches: { ...pitcher.pitches },
      },
    ])
  );
}

function createLineScore() {
  return {
    away: Array(9).fill(null),
    home: Array(9).fill(null),
  };
}

function createTeamStats() {
  return {
    away: { hits: 0, errors: 0 },
    home: { hits: 0, errors: 0 },
  };
}

function createRunner(player, teamKey) {
  return {
    id: (runnerIdCounter += 1),
    name: player.name,
    speed: player.speed,
    power: player.power,
    contact: player.contact,
    teamKey,
  };
}

function offenseTeam() {
  return game.half === "top" ? "away" : "home";
}

function defenseTeam() {
  return offenseTeam() === "home" ? "away" : "home";
}

function currentPitcher() {
  return game.pitchers?.[defenseTeam()] || null;
}

function offensePitcher() {
  return game.pitchers?.[offenseTeam()] || null;
}

function staminaPercent(pitcher) {
  if (!pitcher) {
    return 1;
  }
  return clamp(pitcher.stamina / pitcher.staminaMax, 0, 1);
}

function availablePitchTypes(pitcher = currentPitcher()) {
  if (!pitcher) {
    return Object.keys(PITCH_TYPES);
  }
  return Object.keys(pitcher.pitches).filter((key) => PITCH_TYPES[key]);
}

function ensureSelectedPitchAvailable() {
  const available = availablePitchTypes();
  if (!available.includes(game.selectedPitchType)) {
    game.selectedPitchType = available[0] || "fastball";
  }
}

function difficultySettings() {
  return BALANCE.difficulty[game.difficulty] || BALANCE.difficulty.normal;
}

function pitcherPitchGrade(pitcher, pitchTypeKey) {
  return pitcher?.pitches?.[pitchTypeKey] || 55;
}

function pitchProfile(pitcher, pitchTypeKey) {
  const basePitch = PITCH_TYPES[pitchTypeKey];
  const fatigue = 1 - staminaPercent(pitcher);
  const velocity = pitcher?.velocity || 60;
  const grade = pitcherPitchGrade(pitcher, pitchTypeKey);
  const control = pitcher?.control || 60;
  const command =
    basePitch.control -
    (control - 60) * BALANCE.pitching.controlStep -
    (grade - 60) * BALANCE.pitching.pitchCommandStep +
    fatigue * BALANCE.pitching.fatigueControlPenalty;
  const duration =
    basePitch.duration -
    (velocity - 60) * BALANCE.pitching.velocityDurationStep +
    fatigue * BALANCE.pitching.fatigueDurationPenalty;
  const movementBoost = (grade - 60) * BALANCE.pitching.breakStep;

  return {
    ...basePitch,
    duration: clamp(duration, 680, 1280),
    control: clamp(command, 0.018, 0.145),
    deception: clamp(
      basePitch.deception + (grade - 60) * BALANCE.pitching.deceptionStep - fatigue * 0.06,
      0.02,
      0.28
    ),
    breakX: basePitch.breakX * (1 + movementBoost),
    breakY: basePitch.breakY * (1 + movementBoost),
  };
}

function consumePitcherStamina(pitcher, pitchTypeKey) {
  if (!pitcher) {
    return;
  }

  const pitchCost = BALANCE.pitching.pitchCost[pitchTypeKey] || 1;
  const fatigueTax = pitcher.pitchCount > 75 ? 0.28 : pitcher.pitchCount > 55 ? 0.14 : 0;
  pitcher.pitchCount += 1;
  pitcher.stamina = Math.max(
    0,
    pitcher.stamina - BALANCE.pitching.staminaCostBase * pitchCost - fatigueTax
  );
}

function ensureLineCell(teamKey) {
  const index = game.inning - 1;
  while (game.lineScore[teamKey].length <= index) {
    game.lineScore[teamKey].push(null);
  }
  if (game.lineScore[teamKey][index] === null) {
    game.lineScore[teamKey][index] = 0;
  }
}

function markCurrentLineCell() {
  if (game.lineScore) {
    ensureLineCell(offenseTeam());
  }
}

function addRuns(teamKey, runs) {
  if (!runs) {
    return;
  }

  ensureLineCell(teamKey);
  game.score[teamKey] += runs;
  game.lineScore[teamKey][game.inning - 1] += runs;
}

function recordHit(teamKey = offenseTeam()) {
  game.stats[teamKey].hits += 1;
}

function recordError(teamKey = defenseTeam()) {
  game.stats[teamKey].errors += 1;
}

function setBattingMode(mode) {
  if (!BATTING_MODES[mode]) {
    return;
  }
  game.battingMode = mode;
  game.lastPlay = `打擊策略切換為${BATTING_MODES[mode].label}。`;
  renderAll();
}

function setDifficulty(level) {
  if (!DIFFICULTY_LEVELS[level]) {
    return;
  }
  game.difficulty = level;
  game.lastPlay = `難度切換為${DIFFICULTY_LEVELS[level].label}。`;
  renderAll();
}

function enableGameFeedback() {
  game.feedbackEnabled = true;
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  if (!game.audioContext) {
    game.audioContext = new AudioContextClass();
  }
  if (game.audioContext.state === "suspended") {
    game.audioContext.resume();
  }
}

function vibrateCue(pattern) {
  if (!game.feedbackEnabled || typeof navigator === "undefined" || !navigator.vibrate) {
    return;
  }
  navigator.vibrate(pattern);
}

function playCue(cue) {
  if (!game.feedbackEnabled || typeof window === "undefined" || !game.audioContext) {
    return;
  }

  const presets = {
    pitch: { frequency: 520, endFrequency: 940, duration: 0.16, type: "sine", volume: 0.055 },
    hit: { frequency: 160, endFrequency: 95, duration: 0.18, type: "square", volume: 0.08 },
    bunt: { frequency: 260, endFrequency: 190, duration: 0.11, type: "triangle", volume: 0.05 },
    foul: { frequency: 360, endFrequency: 240, duration: 0.16, type: "sawtooth", volume: 0.045 },
    out: { frequency: 190, endFrequency: 130, duration: 0.22, type: "triangle", volume: 0.055 },
    crowd: { frequency: 620, endFrequency: 760, duration: 0.38, type: "sine", volume: 0.045 },
    strikeout: { frequency: 150, endFrequency: 85, duration: 0.4, type: "sine", volume: 0.055 },
  };
  const preset = presets[cue];
  if (!preset) {
    return;
  }

  const now = game.audioContext.currentTime;
  const oscillator = game.audioContext.createOscillator();
  const gain = game.audioContext.createGain();
  oscillator.type = preset.type;
  oscillator.frequency.setValueAtTime(preset.frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(20, preset.endFrequency),
    now + preset.duration
  );
  gain.gain.setValueAtTime(preset.volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + preset.duration);
  oscillator.connect(gain);
  gain.connect(game.audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + preset.duration);
}

function feedback(cue, vibration = 0) {
  playCue(cue);
  if (vibration) {
    vibrateCue(vibration);
  }
}

function recordHotZone(result, target) {
  if (!target) {
    return;
  }
  game.lastHotZone = {
    result,
    target: { x: target.x, y: target.y },
    mode: game.battingMode,
  };
}

function triggerReplay(text) {
  game.replay = {
    text,
    remainingMs: BALANCE.replay.durationMs,
  };
}

function updateReplay(deltaMs) {
  if (!game.replay) {
    return;
  }

  game.replay.remainingMs = Math.max(0, game.replay.remainingMs - deltaMs);
  if (game.replay.remainingMs <= 0) {
    game.replay = null;
  }
}

function coachAdvice() {
  if (game.gameOver) {
    return "比賽結束，可以重新開賽再挑戰一次。";
  }
  if (game.phase === "manualRunning") {
    return "前方跑者優先判斷；深遠安打可以多衝，短淺球先停壘比較穩。";
  }
  if (!userOnOffense()) {
    const pitcher = currentPitcher();
    if (pitcher && staminaPercent(pitcher) < 0.35) {
      return `${pitcher.name} 體力偏低，優先用控球好的球種搶好球數。`;
    }
    if (game.bases[0] && !game.bases[1]) {
      return "一壘有人，小心跑者起跑；滑球或指叉可壓低製造滾地球。";
    }
    return "守備時先搶好球數，兩好球後可以把球投到邊角誘打。";
  }

  if (game.phase !== "awaitPitch" && game.phase !== "pitching") {
    return "看球落點決定跑壘，別急著一次衝到底。";
  }
  if (game.strikes >= 2) {
    return "兩好球後會自動進入保護打擊；推打或正常揮棒比較穩。";
  }
  if (game.bases[0] && game.outs <= 1) {
    return "一壘有人、出局少：可選觸擊推進，或用拉打尋找長打。";
  }
  if (game.bases[2] && game.outs < 2) {
    return "三壘有人時，觸擊或高飛球都有機會換回分數。";
  }
  return "沒人上壘時可用拉打拚長打；落後球數時改正常或推打。";
}

function userOnOffense() {
  return offenseTeam() === "home";
}

function currentHalfLabel() {
  return game.half === "top" ? "上半局" : "下半局";
}

function currentInningTag() {
  return `${game.inning} 局`;
}

function currentBatterLabel() {
  const teamKey = offenseTeam();
  const slot = (game.battingOrder[teamKey] % 9) + 1;
  return `${TEAM_NAMES[teamKey]} ${slot} 棒 ${game.activeBatter.name}`;
}

function baseText() {
  const labels = [];
  if (game.bases[0]) {
    labels.push(`一壘 ${game.bases[0].name}`);
  }
  if (game.bases[1]) {
    labels.push(`二壘 ${game.bases[1].name}`);
  }
  if (game.bases[2]) {
    labels.push(`三壘 ${game.bases[2].name}`);
  }
  return labels.length ? labels.join(" / ") : "壘上無人";
}

function pushLog(text) {
  const prefix = `${currentInningTag()} ${currentHalfLabel()}`;
  game.playLog.unshift(`${prefix}｜${text}`);
  game.playLog = game.playLog.slice(0, 9);
}

function setNextBatter() {
  const teamKey = offenseTeam();
  const index = game.battingOrder[teamKey] % 9;
  game.activeBatter = LINEUPS[teamKey][index];
}

function rotateBatter() {
  const teamKey = offenseTeam();
  game.battingOrder[teamKey] = (game.battingOrder[teamKey] + 1) % 9;
}

function resetCount() {
  game.balls = 0;
  game.strikes = 0;
}

function resetGame() {
  const previousDifficulty = game.difficulty || "normal";
  runnerIdCounter = 1;
  game = {
    inning: 1,
    half: "top",
    balls: 0,
    strikes: 0,
    outs: 0,
    score: { away: 0, home: 0 },
    lineScore: createLineScore(),
    stats: createTeamStats(),
    battingOrder: { away: 0, home: 0 },
    activeBatter: LINEUPS.away[0],
    bases: [null, null, null],
    playLog: [],
    banner: "比賽開始，客隊先攻，你先守備。",
    lastPlay: "先選球種，再點右側好球帶設定投球落點。",
    selectedPitchType: "fastball",
    selectedTarget: { x: 0.5, y: 0.56 },
    battingMode: "normal",
    difficulty: previousDifficulty,
    pitchers: buildPitchers(),
    phase: "awaitPitch",
    currentPitch: null,
    battedBall: null,
    lastHotZone: null,
    replay: null,
    runnerAnimations: [],
    hiddenRunnerIds: new Set(),
    afterAnimations: null,
    fielders: buildFielders(),
    catchDisplay: null,
    afterCatchDisplay: null,
    pendingSteal: null,
    manualRunning: null,
    manualFielding: null,
    feedbackEnabled: false,
    audioContext: null,
    gameOver: false,
  };

  markCurrentLineCell();
  ensureSelectedPitchAvailable();
  pushLog("比賽開打，海風隊先攻。");
  renderAll();
}

function continueAtBat(note) {
  game.phase = "awaitPitch";
  game.currentPitch = null;
  game.banner = userOnOffense() ? "你的進攻" : "你的防守";
  game.lastPlay = note;
  renderAll();
}

function endGame(message) {
  game.gameOver = true;
  game.phase = "gameOver";
  game.currentPitch = null;
  game.battedBall = null;
  game.catchDisplay = null;
  game.afterCatchDisplay = null;
  game.pendingSteal = null;
  game.manualRunning = null;
  game.manualFielding = null;
  game.banner = message;
  game.lastPlay = `終場比分 ${TEAM_NAMES.away} ${game.score.away}：${game.score.home} ${TEAM_NAMES.home}`;
  pushLog(message);
  renderAll();
}

function endHalfInning() {
  markCurrentLineCell();
  game.bases = [null, null, null];
  game.hiddenRunnerIds = new Set();
  game.runnerAnimations = [];
  game.currentPitch = null;
  game.battedBall = null;
  game.catchDisplay = null;
  game.afterCatchDisplay = null;
  game.pendingSteal = null;
  game.manualRunning = null;
  game.manualFielding = null;
  resetCount();

  if (game.half === "top") {
    if (game.inning >= 9 && game.score.home > game.score.away) {
      endGame("赤焰隊守成成功，主隊提前在九局上後收下勝利。");
      return;
    }
    game.half = "bottom";
    game.outs = 0;
    setNextBatter();
    markCurrentLineCell();
    ensureSelectedPitchAvailable();
    game.phase = "awaitPitch";
    game.banner = `第 ${game.inning} 局下半開始，輪到你進攻。`;
    game.lastPlay = "按「下一球」讓對方投手出手。";
    pushLog(`三出局攻守交換，進入第 ${game.inning} 局下半。`);
    renderAll();
    return;
  }

  if (game.inning >= 9) {
    if (game.score.home > game.score.away) {
      endGame("赤焰隊撐住最後半局，拿下九局勝利。");
    } else if (game.score.home < game.score.away) {
      endGame("海風隊守住優勢，九局賽程結束。");
    } else {
      endGame("九局打完雙方平手，這場熱戰以和局收場。");
    }
    return;
  }

  game.inning += 1;
  game.half = "top";
  game.outs = 0;
  setNextBatter();
  markCurrentLineCell();
  ensureSelectedPitchAvailable();
  game.phase = "awaitPitch";
  game.banner = `第 ${game.inning} 局上半開始，先把對手壓下來。`;
  game.lastPlay = "選球種與落點，力拚三上三下。";
  pushLog(`三出局攻守交換，進入第 ${game.inning} 局上半。`);
  renderAll();
}

function finishPlateAppearance(message) {
  game.currentPitch = null;
  game.battedBall = null;
  game.pendingSteal = null;
  game.manualRunning = null;
  game.manualFielding = null;

  const finalize = () => {
    game.hiddenRunnerIds = new Set();
    game.runnerAnimations = [];
    resetCount();
    rotateBatter();

    if (game.inning >= 9 && game.half === "bottom" && game.score.home > game.score.away) {
      endGame("赤焰隊在下半局逆轉成功，形成再見比賽。");
      return;
    }

    if (game.outs >= 3) {
      endHalfInning();
      return;
    }

    setNextBatter();
    ensureSelectedPitchAvailable();
    game.phase = "awaitPitch";
    game.banner = userOnOffense() ? "你的進攻" : "你的防守";
    game.lastPlay = message;
    renderAll();
  };

  if (game.runnerAnimations.length) {
    game.afterAnimations = finalize;
    renderAll();
    return;
  }

  finalize();
}

function pathForMove(fromBase, toBase) {
  const order = ["plate", 0, 1, 2, "home"];
  const startKey = fromBase === "batter" ? "plate" : fromBase;
  const startIndex = order.indexOf(startKey);
  const endIndex = order.indexOf(toBase);
  const path = [];
  const step = startIndex <= endIndex ? 1 : -1;

  for (let index = startIndex; index !== endIndex + step; index += step) {
    path.push(deepClonePoint(BASE_POINTS[order[index]]));
  }

  return path;
}

function startRunnerAnimations(moves) {
  if (!moves.length) {
    game.runnerAnimations = [];
    game.hiddenRunnerIds = new Set();
    return;
  }

  game.hiddenRunnerIds = new Set(moves.map((move) => move.runner.id));
  game.runnerAnimations = moves.map((move) => {
    const path = move.path
      ? move.path.map((point) => deepClonePoint(point))
      : pathForMove(move.from, move.to);
    const segments = Math.max(path.length - 1, 1);
    const duration = 520 * segments * (1.08 - (move.runner.speed - 50) * 0.005);
    return {
      runner: move.runner,
      path,
      elapsed: 0,
      duration,
    };
  });
  game.phase = "runnerMotion";
}

function updateRunnerAnimations(deltaMs) {
  if (!game.runnerAnimations.length) {
    return;
  }

  game.runnerAnimations.forEach((animation) => {
    animation.elapsed = Math.min(animation.duration, animation.elapsed + deltaMs);
  });

  if (game.runnerAnimations.every((animation) => animation.elapsed >= animation.duration)) {
    game.runnerAnimations = [];
    game.hiddenRunnerIds = new Set();
    const callback = game.afterAnimations;
    game.afterAnimations = null;
    if (callback) {
      callback();
    }
  }
}

function runnerAnimationPosition(animation) {
  const progress = clamp(animation.elapsed / animation.duration, 0, 1);
  const segments = animation.path.length - 1;
  if (segments <= 0) {
    return animation.path[0];
  }

  const scaled = progress * segments;
  const segmentIndex = Math.min(segments - 1, Math.floor(scaled));
  const segmentProgress = scaled - segmentIndex;
  const start = animation.path[segmentIndex];
  const end = animation.path[segmentIndex + 1];

  return {
    x: lerp(start.x, end.x, segmentProgress),
    y: lerp(start.y, end.y, segmentProgress),
  };
}

function inStrikeZone(target) {
  return (
    target.x >= STRIKE_ZONE.left &&
    target.x <= STRIKE_ZONE.right &&
    target.y >= STRIKE_ZONE.top &&
    target.y <= STRIKE_ZONE.bottom
  );
}

function missTarget(target, pitchTypeKey, pitcher = currentPitcher()) {
  const pitchType = pitchProfile(pitcher, pitchTypeKey);
  return {
    x: clamp(target.x + randomBetween(-pitchType.control, pitchType.control), 0.12, 0.88),
    y: clamp(target.y + randomBetween(-pitchType.control, pitchType.control), 0.12, 0.9),
  };
}

function randomPitchTarget() {
  const settings = difficultySettings();
  const zoneHeavy = Math.random() < settings.zoneRate;
  if (zoneHeavy) {
    return {
      x: randomBetween(0.28, 0.72),
      y: randomBetween(0.3, 0.78),
    };
  }
  if (Math.random() < settings.edgeRate) {
    return {
      x: Math.random() < 0.5 ? randomBetween(0.18, 0.34) : randomBetween(0.66, 0.82),
      y: randomBetween(0.24, 0.82),
    };
  }
  return {
    x: randomBetween(0.18, 0.82),
    y: randomBetween(0.18, 0.88),
  };
}

function chooseWeightedPitch(weights) {
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of weights) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.key;
    }
  }
  return weights[0]?.key || "fastball";
}

function chooseCpuPitchType(pitcher = currentPitcher()) {
  const available = availablePitchTypes(pitcher);
  const settings = difficultySettings();
  if (!settings.aiPitchBrains) {
    return available[Math.floor(Math.random() * available.length)] || "fastball";
  }

  const ahead = game.strikes > game.balls;
  const behind = game.balls > game.strikes;
  const runnerPressure = game.bases.some(Boolean) ? 1 : 0;
  const weights = available.map((key) => {
    let weight = 1 + pitcherPitchGrade(pitcher, key) / 80;
    if (key === "fastball") {
      weight += behind ? 1.1 : 0.25;
    }
    if ((key === "curve" || key === "splitter") && ahead) {
      weight += 1.2 * settings.aiPitchBrains;
    }
    if (key === "slider" && runnerPressure) {
      weight += 0.45;
    }
    if (game.strikes >= 2 && key !== "fastball") {
      weight += 0.65 * settings.aiPitchBrains;
    }
    return { key, weight };
  });

  return chooseWeightedPitch(weights);
}

function startPitch() {
  if (game.phase !== "awaitPitch" || game.gameOver) {
    return;
  }

  const offenseMode = userOnOffense();
  const pitcher = currentPitcher();
  ensureSelectedPitchAvailable();
  const pitchTypeKey = offenseMode ? chooseCpuPitchType(pitcher) : game.selectedPitchType;
  const requestedTarget = offenseMode ? randomPitchTarget() : game.selectedTarget;
  const actualTarget = missTarget(requestedTarget, pitchTypeKey, pitcher);
  const pitchType = pitchProfile(pitcher, pitchTypeKey);
  consumePitcherStamina(pitcher, pitchTypeKey);

  game.currentPitch = {
    pitchTypeKey,
    pitcherTeam: defenseTeam(),
    pitcherName: pitcher?.name || "",
    profile: pitchType,
    requestedTarget,
    actualTarget,
    startedAt: performance.now(),
    duration: pitchType.duration + randomBetween(-45, 55),
    progress: 0,
    resolved: false,
    userSwung: false,
    aiDecisionMade: false,
    aiSwingPoint: randomBetween(0.72, 0.83),
    contactPoint: randomBetween(0.78, 0.87),
  };

  feedback("pitch", 8);
  game.phase = "pitching";
  const pitcherName = pitcher?.name || "投手";
  game.banner = offenseMode
    ? `${pitcherName} 投出 ${pitchType.label}`
    : `${pitcherName} 投出 ${pitchType.label}`;
  game.lastPlay = offenseMode
    ? game.pendingSteal
      ? "跑者起跑中，這球打者不會揮棒。"
      : `${BATTING_MODES[game.battingMode].label}模式，抓好時機按揮棒。`
    : "觀察結果，好的落點比較容易製造弱擊球。";
  renderAll();
}

function applyWalk() {
  const battingTeam = offenseTeam();
  const batterRunner = createRunner(game.activeBatter, battingTeam);
  const oldBases = [...game.bases];
  const newBases = [oldBases[0], oldBases[1], oldBases[2]];
  const moves = [];
  let runs = 0;

  if (oldBases[2] && oldBases[1] && oldBases[0]) {
    runs += 1;
    moves.push({ runner: oldBases[2], from: 2, to: "home" });
    newBases[2] = oldBases[1];
  }

  if (oldBases[1] && oldBases[0]) {
    moves.push({ runner: oldBases[1], from: 1, to: 2 });
    newBases[2] = oldBases[1];
  }

  if (oldBases[0]) {
    moves.push({ runner: oldBases[0], from: 0, to: 1 });
    newBases[1] = oldBases[0];
  }

  newBases[0] = batterRunner;
  moves.push({ runner: batterRunner, from: "batter", to: 0 });

  addRuns(battingTeam, runs);
  game.bases = newBases;
  startRunnerAnimations(moves);
  pushLog(`${game.activeBatter.name} 選到保送上壘。`);
  game.banner = "保送";
  finishPlateAppearance("靠耐心選到四壞球保送。");
}

function resolveStealAttempt(pitchWasBall) {
  const stealInfo = game.pendingSteal;
  game.pendingSteal = null;

  if (!stealInfo || !game.bases[stealInfo.fromBase]) {
    continueAtBat(pitchWasBall ? "壞球。準備下一球。" : "好球。準備下一球。");
    return;
  }

  const runner = game.bases[stealInfo.fromBase];
  const pitch = game.currentPitch;
  const pitchType = pitch.profile || PITCH_TYPES[pitch.pitchTypeKey];
  const nextBase = stealInfo.fromBase + 1;
  const isBreaking =
    pitch.pitchTypeKey === "curve" || pitch.pitchTypeKey === "splitter";
  const throwWindow =
    pitch.duration / 1000 +
    BALANCE.steal.catcherThrowBase +
    (isBreaking ? BALANCE.steal.breakingPenalty : BALANCE.steal.fastballBonus);
  const runnerTime =
    BALANCE.steal.runnerBaseTime -
    (runner.speed - BALANCE.steal.runnerSpeedAnchor) * BALANCE.steal.runnerSpeedFactor -
    (pitchType.duration - BALANCE.steal.pitchDurationAnchor) /
      BALANCE.steal.pitchDurationDivisor;
  const safe = runnerTime < throwWindow;

  if (safe) {
    const newBases = [...game.bases];
    newBases[stealInfo.fromBase] = null;
    newBases[nextBase] = runner;
    game.bases = newBases;
    startRunnerAnimations([{ runner, from: stealInfo.fromBase, to: nextBase }]);
    pushLog(`${runner.name} 起跑成功，盜上${nextBase === 1 ? "二" : "三"}壘。`);
    game.banner = "盜壘成功";
    game.lastPlay = pitchWasBall ? "同時也替打者多拿到一顆壞球。" : "就算是好球，跑者還是搶到壘包。";
    game.afterAnimations = () => {
      game.hiddenRunnerIds = new Set();
      game.runnerAnimations = [];
      game.phase = "awaitPitch";
      game.currentPitch = null;
      renderAll();
    };
    renderAll();
    return;
  }

  game.outs += 1;
  game.bases[stealInfo.fromBase] = null;
  pushLog(`${runner.name} 盜壘失敗，被觸殺出局。`);
  game.banner = "盜壘失敗";
  if (game.outs >= 3) {
    finishPlateAppearance("跑者出局，這個半局結束。");
    return;
  }
  continueAtBat("盜壘失敗，這個打席繼續。");
}

function calledPitchResult(pitch) {
  const strike = inStrikeZone(pitch.actualTarget);
  if (strike) {
    game.strikes += 1;
    const message = `這球進壘，${game.activeBatter.name} ${userOnOffense() ? "目送" : "沒有出棒"}，判定好球。`;
    recordHotZone("看進好球", pitch.actualTarget);
    pushLog(message);
    if (game.strikes >= 3) {
      game.outs += 1;
      pushLog(`${game.activeBatter.name} 被三振。`);
      game.banner = userOnOffense() ? "三振出局" : "漂亮三振";
      feedback("strikeout", [45, 30, 45]);
      finishPlateAppearance("三振換人。");
      return;
    }

    if (game.pendingSteal) {
      resolveStealAttempt(false);
      return;
    }

    continueAtBat(message);
    return;
  }

  game.balls += 1;
  const message = "這球偏離好球帶，判定壞球。";
  recordHotZone("壞球", pitch.actualTarget);
  pushLog(message);
  if (game.balls >= 4) {
    applyWalk();
    return;
  }

  if (game.pendingSteal) {
    resolveStealAttempt(true);
    return;
  }

  continueAtBat(message);
}

function describeFieldArea(point) {
  const dx = point.x - FIELD.home.x;
  const dy = FIELD.home.y - point.y;
  if (dy < 130) {
    return dx < -40 ? "三壘側內野" : dx > 40 ? "一壘側內野" : "投手前方";
  }
  if (dy < 260) {
    return dx < -80 ? "左外野" : dx > 80 ? "右外野" : "中外野";
  }
  return dx < -70 ? "左外野深處" : dx > 70 ? "右外野深處" : "中外野深處";
}

function resolveUserSwing(progress) {
  const pitch = game.currentPitch;
  if (!pitch || pitch.resolved || pitch.userSwung || game.pendingSteal) {
    return;
  }

  pitch.userSwung = true;
  pitch.resolved = true;

  const timingDelta = progress - pitch.contactPoint;
  const timingError = Math.abs(timingDelta);
  const inZone = inStrikeZone(pitch.actualTarget);
  const pitchType = pitch.profile || PITCH_TYPES[pitch.pitchTypeKey];
  const mode = game.battingMode;
  const protectMode = game.strikes >= 2 && mode !== "bunt";
  let contactChance = inZone ? BALANCE.batting.contactInZone : BALANCE.batting.contactOutZone;
  contactChance -=
    timingError *
    (mode === "bunt" ? BALANCE.batting.buntTimingPenalty : BALANCE.batting.timingPenalty);
  contactChance -= pitchType.deception * BALANCE.batting.deceptionPenalty;
  if (mode === "push") {
    contactChance += BALANCE.batting.pushContactBonus;
  }
  if (mode === "bunt") {
    contactChance += BALANCE.batting.buntContactBonus + game.activeBatter.contact * 0.001;
  }
  if (protectMode) {
    contactChance += BALANCE.batting.protectContactBonus;
  }
  contactChance = clamp(
    contactChance,
    BALANCE.batting.contactMin,
    BALANCE.batting.contactMax
  );

  if (Math.random() > contactChance) {
    game.strikes += 1;
    recordHotZone("揮空", pitch.actualTarget);
    pushLog(`${game.activeBatter.name} 揮空。`);
    if (game.strikes >= 3) {
      game.outs += 1;
      game.banner = "揮棒落空";
      feedback("strikeout", [45, 30, 45]);
      finishPlateAppearance("三振出局。");
      return;
    }
    feedback("out", 20);
    continueAtBat("揮空一記，球數落後。");
    return;
  }

  const foulRate =
    BALANCE.batting.foulOutZoneRate + (mode === "pull" ? BALANCE.batting.pullFoulPenalty : 0);
  if (timingError > BALANCE.batting.foulTimingThreshold || (!inZone && Math.random() < foulRate)) {
    if (game.strikes < 2) {
      game.strikes += 1;
    }
    recordHotZone("界外", pitch.actualTarget);
    triggerReplay("界外球慢動作");
    feedback("foul", 16);
    pushLog(`${game.activeBatter.name} 打成界外球。`);
    continueAtBat("界外球。重新準備下一球。");
    return;
  }

  recordHotZone(BATTING_MODES[mode].label, pitch.actualTarget);
  createBattedBall({
    batterSide: "user",
    timingDelta,
    contactQuality: contactChance,
    battingMode: mode,
    protectMode,
  });
}

function resolveAiSwing() {
  const pitch = game.currentPitch;
  if (!pitch || pitch.resolved) {
    return;
  }

  pitch.aiDecisionMade = true;
  const pitchType = pitch.profile || PITCH_TYPES[pitch.pitchTypeKey];
  const settings = difficultySettings();
  const target = pitch.actualTarget;
  const zone = inStrikeZone(target);
  const centerDistance = distance({ x: target.x, y: target.y }, { x: 0.5, y: 0.53 });
  let swingChance = zone ? BALANCE.aiBatting.swingZoneBase : BALANCE.aiBatting.swingChaseBase;
  swingChance += game.strikes * BALANCE.aiBatting.strikeAggression;
  swingChance -= game.balls * BALANCE.aiBatting.ballPatience;
  swingChance -= pitchType.deception * BALANCE.aiBatting.deceptionTakePenalty;
  swingChance += zone ? settings.aiSwingDiscipline * 0.4 : -settings.aiSwingDiscipline;

  if (
    Math.random() >
    clamp(swingChance, BALANCE.aiBatting.swingMin, BALANCE.aiBatting.swingMax)
  ) {
    return;
  }

  pitch.resolved = true;
  const whiffChance =
    BALANCE.aiBatting.whiffBase +
    pitchType.deception * BALANCE.aiBatting.whiffDeception +
    centerDistance * BALANCE.aiBatting.whiffCenterDistance -
    settings.aiContactBonus;
  if (Math.random() < whiffChance) {
    game.strikes += 1;
    recordHotZone("對手揮空", pitch.actualTarget);
    pushLog(`${game.activeBatter.name} 揮棒落空。`);
    if (game.strikes >= 3) {
      game.outs += 1;
      game.banner = "你成功三振打者";
      feedback("strikeout", [45, 30, 45]);
      finishPlateAppearance("精彩三振。");
      return;
    }
    continueAtBat("對手揮空，這個打席你佔上風。");
    return;
  }

  const weakContact =
    centerDistance * BALANCE.aiBatting.weakCenterDistance +
    pitchType.deception * BALANCE.aiBatting.weakDeception;
  if (Math.random() < weakContact * BALANCE.aiBatting.weakFoulRate) {
    if (game.strikes < 2) {
      game.strikes += 1;
    }
    recordHotZone("對手界外", pitch.actualTarget);
    triggerReplay("界外球慢動作");
    feedback("foul", 16);
    pushLog(`${game.activeBatter.name} 勉強碰成界外球。`);
    continueAtBat("對手只碰到界外球。");
    return;
  }

  recordHotZone("對手擊球", pitch.actualTarget);
  createBattedBall({
    batterSide: "ai",
    timingDelta: randomBetween(-0.12, 0.12),
    contactQuality: clamp(
      BALANCE.aiBatting.contactQualityBase -
        weakContact +
        settings.aiContactBonus +
        randomBetween(
          BALANCE.aiBatting.contactQualityRandomLow,
          BALANCE.aiBatting.contactQualityRandomHigh
        ),
      BALANCE.aiBatting.contactQualityMin,
      BALANCE.aiBatting.contactQualityMax
    ),
    battingMode: "normal",
    protectMode: false,
  });
}

function createBattedBall({
  batterSide,
  timingDelta,
  contactQuality,
  battingMode = "normal",
  protectMode = false,
}) {
  const power = game.activeBatter.power;
  const contact = game.activeBatter.contact;
  let approachAngle = 0;
  if (battingMode === "pull") {
    approachAngle = BALANCE.batting.pullAngleBonus;
  } else if (battingMode === "push") {
    approachAngle = BALANCE.batting.pushAngleBonus;
  }

  const pullBias = clamp(
    timingDelta * BALANCE.batting.pullBiasScale +
      approachAngle +
      randomBetween(-BALANCE.batting.pullBiasRandom, BALANCE.batting.pullBiasRandom),
    -BALANCE.batting.pullBiasLimit,
    BALANCE.batting.pullBiasLimit
  );
  const fairAngle = clamp(
    pullBias,
    -BALANCE.batting.fairAngleLimit,
    BALANCE.batting.fairAngleLimit
  );
  const adjustedPower = protectMode
    ? Math.max(25, power - BALANCE.batting.protectPowerPenalty)
    : power;
  const batSkill =
    (adjustedPower * BALANCE.batting.batSkillPowerWeight +
      contact * BALANCE.batting.batSkillContactWeight) /
    100;
  const loftSeed = clamp(
    BALANCE.batting.loftBase +
      contactQuality * BALANCE.batting.loftContactFactor +
      randomBetween(-BALANCE.batting.loftRandom, BALANCE.batting.loftRandom),
    0,
    1.15
  );
  let type = "line";

  if (battingMode === "bunt") {
    type = Math.random() < BALANCE.batting.buntPopupRate ? "popup" : "ground";
  } else if (loftSeed < BALANCE.batting.groundLoftMax) {
    type = "ground";
  } else if (loftSeed < BALANCE.batting.lineLoftMax) {
    type = "line";
  } else if (loftSeed < BALANCE.batting.flyLoftMax) {
    type = "fly";
  } else {
    type = "popup";
  }

  let distanceFeet = 115 + batSkill * 145 + contactQuality * 125;
  if (battingMode === "pull") {
    distanceFeet += BALANCE.batting.pullDistanceBonus;
  } else if (battingMode === "push") {
    distanceFeet -= BALANCE.batting.pushDistancePenalty;
  } else if (battingMode === "bunt") {
    distanceFeet = randomBetween(BALANCE.batting.buntDistanceMin, BALANCE.batting.buntDistanceMax);
  }
  if (type === "ground") {
    distanceFeet -= 55;
  }
  if (type === "popup") {
    distanceFeet -= 105;
  }
  if (type === "fly") {
    distanceFeet += 32;
  }

  distanceFeet = clamp(distanceFeet, 45, 420);

  if (
    battingMode !== "bunt" &&
    Math.abs(pullBias) > BALANCE.batting.foulAngleThreshold &&
    Math.random() < BALANCE.batting.foulAngleRate + (battingMode === "pull" ? 0.08 : 0)
  ) {
    if (game.strikes < 2) {
      game.strikes += 1;
    }
    triggerReplay("界外球慢動作");
    feedback("foul", 16);
    pushLog(`${game.activeBatter.name} 打成界外球。`);
    continueAtBat("球飛出邊線，界外球。");
    return;
  }

  const radius = distanceFeet * 1.02;
  const landing = polarToField(fairAngle, radius);
  const settleDistance = clamp(radius + (type === "ground" ? 32 : 12), 60, 430);
  const settle = polarToField(fairAngle, settleDistance);
  const chasingFielders = closestFielders(landing, BALANCE.pursuerCount[type]);
  const hangTime =
    type === "ground"
      ? battingMode === "bunt"
        ? 0.55
        : 0.8
      : type === "line"
        ? 1.25
        : type === "fly"
          ? 2.3 + contactQuality * 0.8
          : battingMode === "bunt"
            ? 1.1
            : 2.95;

  game.battedBall = {
    batterSide,
    type,
    battingMode,
    protectMode,
    hangTime,
    rollTime: type === "ground" ? 0.5 : 0.45,
    elapsed: 0,
    landing,
    settle,
    fairAngle,
    distanceFeet,
    chasingFielderIds: chasingFielders.map(({ fielder }) => fielder.id),
    defenseSuccess: Math.random() < BALANCE.defenseCatchRate[type],
    landed: false,
    resolved: false,
    landingFielderDistance: 999,
    manualCatcherId: null,
  };
  setupManualFielding(game.battedBall, chasingFielders[0]?.fielder);
  game.currentPitch = null;
  game.phase = "ballInPlay";
  feedback(battingMode === "bunt" ? "bunt" : "hit", battingMode === "bunt" ? 10 : 24);
  game.banner = batterSide === "user" ? "球被打進場內" : "對手把球掃進場內";
  game.lastPlay =
    batterSide === "user"
      ? `${BATTING_MODES[battingMode]?.label || "正常"}擊球，觀察落點與跑者。`
      : "移動標亮的守備員到落點圈，方向鍵、WASD 或拖曳球場都能操作。";
  pushLog(`${game.activeBatter.name} 把球打向${describeFieldArea(landing)}。`);
  renderAll();
}

function closestFielders(point, count = 2) {
  return game.fielders
    .filter((fielder) => fielder.id !== "c")
    .map((fielder) => ({
      fielder,
      bestDistance: distance(point, fielder),
    }))
    .sort((left, right) => left.bestDistance - right.bestDistance)
    .slice(0, count);
}

function closestFielder(point) {
  const [closest] = closestFielders(point, 1);
  return {
    chosen: closest ? closest.fielder : game.fielders[0],
    bestDistance: closest ? closest.bestDistance : Number.POSITIVE_INFINITY,
  };
}

function controlledFielder() {
  if (!game.manualFielding) {
    return null;
  }
  return game.fielders.find((fielder) => fielder.id === game.manualFielding.fielderId) || null;
}

function manualFieldingActive() {
  return (
    game.phase === "ballInPlay" &&
    !userOnOffense() &&
    !!game.battedBall &&
    !!controlledFielder()
  );
}

function clampFieldPoint(point) {
  return {
    x: clamp(point.x, BALANCE.manualFielding.minX, BALANCE.manualFielding.maxX),
    y: clamp(point.y, BALANCE.manualFielding.minY, BALANCE.manualFielding.maxY),
  };
}

function setManualFielderTarget(point) {
  if (!manualFieldingActive()) {
    return;
  }

  game.manualFielding.target = clampFieldPoint(point);
  game.manualFielding.pointerActive = true;
}

function releaseManualFielderPointer() {
  if (!game.manualFielding) {
    return;
  }
  game.manualFielding.pointerActive = false;
}

function setManualFielderKey(key, pressed) {
  if (!game.manualFielding) {
    return;
  }

  const keys = game.manualFielding.keys;
  if (key === "ArrowUp" || key.toLowerCase() === "w") {
    keys.up = pressed;
  } else if (key === "ArrowDown" || key.toLowerCase() === "s") {
    keys.down = pressed;
  } else if (key === "ArrowLeft" || key.toLowerCase() === "a") {
    keys.left = pressed;
  } else if (key === "ArrowRight" || key.toLowerCase() === "d") {
    keys.right = pressed;
  }
}

function manualFieldingTargetPoint(ball) {
  return ball.type === "ground" && ball.landed ? ball.settle : ball.landing;
}

function setupManualFielding(ball, fielder) {
  if (userOnOffense() || !fielder) {
    game.manualFielding = null;
    return;
  }

  game.manualFielding = {
    fielderId: fielder.id,
    target: deepClonePoint(fielder),
    pointerActive: false,
    keys: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
  };
}

function controlledFielderReached(point, radius) {
  const fielder = controlledFielder();
  return !!fielder && distance(fielder, point) <= radius;
}

function resolveCatcher(ball) {
  if (ball.manualCatcherId) {
    const manualCatcher = game.fielders.find((fielder) => fielder.id === ball.manualCatcherId);
    if (manualCatcher) {
      return manualCatcher;
    }
  }

  const candidateIds = ball.chasingFielderIds || [];
  const targetPoint = ball.type === "ground" ? ball.settle : ball.landing;
  const candidates = game.fielders.filter((fielder) => candidateIds.includes(fielder.id));

  if (!candidates.length) {
    return closestFielder(targetPoint).chosen;
  }

  return candidates.reduce((best, fielder) =>
    distance(fielder, targetPoint) < distance(best, targetPoint) ? fielder : best
  );
}

function startCatchDisplay(ball, catcher, onComplete) {
  const overlapDistance = overlapDistanceForRatio(
    FIELDER_CAUGHT_RADIUS,
    BALL_DRAW_RADIUS,
    BALL_OVERLAP_RATIO
  );
  const angle = Math.atan2(FIELD.home.y - catcher.y, FIELD.home.x - catcher.x);

  game.phase = "catchDisplay";
  game.catchDisplay = {
    catcherId: catcher.id,
    catcherRadius: FIELDER_CAUGHT_RADIUS,
    ballRadius: BALL_DRAW_RADIUS,
    ballOffsetX: Math.cos(angle) * overlapDistance,
    ballOffsetY: Math.sin(angle) * overlapDistance,
    remainingMs: CATCH_DISPLAY_MS,
  };
  game.afterCatchDisplay = onComplete;
  renderAll();
}

function updateCatchDisplay(deltaMs) {
  if (!game.catchDisplay) {
    return;
  }

  game.catchDisplay.remainingMs = Math.max(0, game.catchDisplay.remainingMs - deltaMs);
  if (game.catchDisplay.remainingMs > 0) {
    return;
  }

  game.catchDisplay = null;
  const callback = game.afterCatchDisplay;
  game.afterCatchDisplay = null;
  if (callback) {
    callback();
  }
}

function baseLabel(base) {
  if (base === "home") {
    return "本壘";
  }
  return ["一壘", "二壘", "三壘"][base] || "";
}

function hitResultText(baseAward) {
  if (baseAward === 2) {
    return "二壘安打";
  }
  if (baseAward === 3) {
    return "三壘安打";
  }
  if (baseAward >= 4) {
    return "全壘打";
  }
  return "一壘安打";
}

function nextBaseForManualRunner(entry) {
  return entry.base >= 2 ? "home" : entry.base + 1;
}

function canManualRunnerAdvance(entry) {
  if (!entry || entry.out || entry.scored || entry.stopped || entry.base === null) {
    return false;
  }

  const nextBase = nextBaseForManualRunner(entry);
  return nextBase === "home" || !game.bases[nextBase];
}

function manualAdvanceCandidates() {
  if (!game.manualRunning) {
    return [];
  }

  return game.manualRunning.runners
    .filter((entry) => canManualRunnerAdvance(entry))
    .sort((left, right) => right.base - left.base);
}

function ensureManualRunnerSelection() {
  if (!game.manualRunning) {
    return null;
  }

  const candidates = manualAdvanceCandidates();
  if (!candidates.length) {
    game.manualRunning.selectedRunnerId = null;
    return null;
  }

  const stillSelected = candidates.find(
    (entry) => entry.runner.id === game.manualRunning.selectedRunnerId
  );
  if (stillSelected) {
    return stillSelected;
  }

  game.manualRunning.selectedRunnerId = candidates[0].runner.id;
  return candidates[0];
}

function selectedManualRunner() {
  if (!game.manualRunning) {
    return null;
  }
  return ensureManualRunnerSelection();
}

function manualRunnerPrompt(entry) {
  if (!entry) {
    return "所有跑者停壘，準備下一棒。";
  }

  const target = nextBaseForManualRunner(entry);
  return `${entry.runner.name} 在${baseLabel(entry.base)}，可衝${baseLabel(target)}或停壘。`;
}

function finishManualRunning(message) {
  if (!game.manualRunning) {
    return;
  }

  game.manualRunning = null;
  finishPlateAppearance(message);
}

function finishManualRunningByUser() {
  if (game.phase !== "manualRunning" || !game.manualRunning) {
    return;
  }

  game.manualRunning.runners.forEach((entry) => {
    if (!entry.out && !entry.scored && entry.base !== null) {
      entry.stopped = true;
    }
  });
  pushLog("跑者選擇停壘，跑壘結束。");
  game.banner = game.manualRunning.resultText;
  finishManualRunning("跑者停在壘上，準備下一棒。");
}

function resumeManualRunning(note) {
  if (!game.manualRunning) {
    return;
  }

  if (game.outs >= 3) {
    finishManualRunning("跑壘出局，形成第三出局。");
    return;
  }

  const entry = ensureManualRunnerSelection();
  if (!entry) {
    finishManualRunning(note || "跑者停在壘上，準備下一棒。");
    return;
  }

  game.phase = "manualRunning";
  game.banner = "跑壘判斷";
  game.lastPlay = note || manualRunnerPrompt(entry);
  renderAll();
}

function cycleManualRunner() {
  if (game.phase !== "manualRunning" || !game.manualRunning) {
    return;
  }

  const candidates = manualAdvanceCandidates();
  if (candidates.length <= 1) {
    return;
  }

  const currentIndex = candidates.findIndex(
    (entry) => entry.runner.id === game.manualRunning.selectedRunnerId
  );
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % candidates.length;
  game.manualRunning.selectedRunnerId = candidates[nextIndex].runner.id;
  game.lastPlay = manualRunnerPrompt(candidates[nextIndex]);
  renderAll();
}

function holdSelectedManualRunner() {
  if (game.phase !== "manualRunning" || !game.manualRunning) {
    return;
  }

  const entry = ensureManualRunnerSelection();
  if (!entry) {
    finishManualRunning("跑者停在壘上，準備下一棒。");
    return;
  }

  entry.stopped = true;
  pushLog(`${entry.runner.name} 停在${baseLabel(entry.base)}。`);
  resumeManualRunning(`${entry.runner.name} 停壘，繼續判斷其他跑者。`);
}

function manualAdvanceOdds(entry, targetBase) {
  const ball = game.manualRunning.ball;
  const distanceBonus = clamp((ball.distanceFeet - 215) / 250, -0.18, 0.24);
  const typeBonus =
    {
      ground: -0.08,
      popup: -0.07,
      line: 0.03,
      fly: 0.08,
    }[ball.type] || 0;
  const fielderLag = clamp((ball.landingFielderDistance - 22) / 150, -0.12, 0.18);
  const speedBonus = (entry.runner.speed - 60) * 0.006;
  const targetPenalty = targetBase === "home" ? 0.16 : targetBase === 2 ? 0.1 : 0.06;
  const repeatPenalty = entry.extraAdvances * 0.12;
  const safeChance = clamp(
    0.58 + distanceBonus + typeBonus + fielderLag + speedBonus - targetPenalty - repeatPenalty,
    0.25,
    0.9
  );
  const returnChance = clamp(0.18 + (entry.runner.speed - 55) * 0.002 + (0.55 - safeChance) * 0.2, 0.1, 0.32);

  return { safeChance, returnChance };
}

function returnAttemptPath(fromBase, targetBase) {
  const start = BASE_POINTS[fromBase];
  const target = BASE_POINTS[targetBase];
  const middle = {
    x: lerp(start.x, target.x, 0.56),
    y: lerp(start.y, target.y, 0.56),
  };

  return [start, middle, start];
}

function attemptManualAdvance() {
  if (game.phase !== "manualRunning" || !game.manualRunning) {
    return;
  }

  const entry = ensureManualRunnerSelection();
  if (!entry) {
    finishManualRunning("跑者停在壘上，準備下一棒。");
    return;
  }

  if (!canManualRunnerAdvance(entry)) {
    game.lastPlay = "前方壘包有人，先處理更前面的跑者。";
    renderAll();
    return;
  }

  const fromBase = entry.base;
  const targetBase = nextBaseForManualRunner(entry);
  const { safeChance, returnChance } = manualAdvanceOdds(entry, targetBase);
  const roll = Math.random();

  if (roll < safeChance) {
    game.bases[fromBase] = null;
    entry.extraAdvances += 1;

    if (targetBase === "home") {
      entry.base = null;
      entry.scored = true;
      addRuns(offenseTeam(), 1);
      pushLog(`${entry.runner.name} 衝回本壘得分。`);
      game.banner = "跑回本壘";
    } else {
      entry.base = targetBase;
      game.bases[targetBase] = entry.runner;
      pushLog(`${entry.runner.name} 衝上${baseLabel(targetBase)}安全。`);
      game.banner = "安全上壘";
    }

    const isWalkoff =
      game.inning >= 9 && game.half === "bottom" && game.score.home > game.score.away;
    startRunnerAnimations([{ runner: entry.runner, from: fromBase, to: targetBase }]);
    game.afterAnimations = () => {
      if (isWalkoff) {
        finishManualRunning("再見得分，比賽結束。");
        return;
      }
      resumeManualRunning(
        targetBase === "home"
          ? `${entry.runner.name} 回本壘得分，還可處理其他跑者。`
          : `${entry.runner.name} 安全抵達${baseLabel(targetBase)}，可再決定是否續衝。`
      );
    };
    renderAll();
    return;
  }

  if (roll < safeChance + returnChance) {
    entry.stopped = true;
    pushLog(`${entry.runner.name} 判斷傳球太快，回到${baseLabel(fromBase)}。`);
    game.banner = "回壘成功";
    startRunnerAnimations([
      {
        runner: entry.runner,
        from: fromBase,
        to: fromBase,
        path: returnAttemptPath(fromBase, targetBase),
      },
    ]);
    game.afterAnimations = () =>
      resumeManualRunning(`${entry.runner.name} 成功回壘，先停在${baseLabel(fromBase)}。`);
    renderAll();
    return;
  }

  game.bases[fromBase] = null;
  entry.base = null;
  entry.out = true;
  game.outs += 1;
  pushLog(
    targetBase === "home"
      ? `${entry.runner.name} 衝本壘遭觸殺出局。`
      : `${entry.runner.name} 衝${baseLabel(targetBase)}遭守備封殺。`
  );
  game.banner = targetBase === "home" ? "本壘觸殺" : "封殺出局";
  startRunnerAnimations([{ runner: entry.runner, from: fromBase, to: targetBase }]);
  game.afterAnimations = () => {
    if (game.outs >= 3) {
      finishManualRunning("跑壘出局，形成第三出局。");
      return;
    }
    resumeManualRunning(`${entry.runner.name} 出局，繼續判斷其他跑者。`);
  };
  renderAll();
}

function beginManualAdvanceOnHit(baseAward, ball) {
  const battingTeam = offenseTeam();
  const batterRunner = createRunner(game.activeBatter, battingTeam);
  const oldBases = [...game.bases];
  const newBases = [null, null, null];
  const moves = [];
  const runners = [];
  let runs = 0;
  let trailingDestination = baseAward - 1;
  const resultText = hitResultText(baseAward);

  const batterEntry = {
    runner: batterRunner,
    from: "batter",
    base: trailingDestination,
    stopped: false,
    scored: false,
    out: false,
    extraAdvances: 0,
  };
  runners.push(batterEntry);
  newBases[trailingDestination] = batterRunner;
  moves.push({ runner: batterRunner, from: "batter", to: trailingDestination });

  for (let base = 0; base <= 2; base += 1) {
    const runner = oldBases[base];
    if (!runner) {
      continue;
    }

    const destination = Math.max(base, trailingDestination + 1);
    trailingDestination = destination;
    const entry = {
      runner,
      from: base,
      base: destination >= 3 ? null : destination,
      stopped: false,
      scored: destination >= 3,
      out: false,
      extraAdvances: 0,
    };
    runners.push(entry);

    if (destination >= 3) {
      runs += 1;
      moves.push({ runner, from: base, to: "home" });
    } else {
      newBases[destination] = runner;
      if (destination !== base) {
        moves.push({ runner, from: base, to: destination });
      }
    }
  }

  addRuns(battingTeam, runs);
  game.bases = newBases;
  game.manualRunning = {
    resultText,
    baseAward,
    ball,
    runners,
    selectedRunnerId: null,
  };
  pushLog(`${game.activeBatter.name} 擊出${resultText}，跑者先安全進佔。`);
  game.banner = resultText;
  game.lastPlay = "安打形成，等跑者抵達壘包後可決定續衝或停壘。";

  startRunnerAnimations(moves);
  game.afterAnimations = () => resumeManualRunning();
  renderAll();
}

function advanceOnHitAutomatically(baseAward, ball) {
  const battingTeam = offenseTeam();
  const batterRunner = createRunner(game.activeBatter, battingTeam);
  const oldBases = [...game.bases];
  const newBases = [null, null, null];
  const moves = [];
  let runs = 0;

  for (let base = 2; base >= 0; base -= 1) {
    const runner = oldBases[base];
    if (!runner) {
      continue;
    }

    let basesToAdvance = 1;
    if (baseAward === 1) {
      if (base === 2) {
        basesToAdvance = 1;
      } else if (base === 1) {
        basesToAdvance = ball.type === "ground" || ball.distanceFeet < 190 ? 1 : 2;
      } else {
        basesToAdvance = ball.distanceFeet > 250 && ball.type !== "ground" ? 2 : 1;
      }
    } else if (baseAward === 2) {
      if (base === 0) {
        basesToAdvance = ball.distanceFeet > 285 ? 3 : 2;
      } else {
        basesToAdvance = 2;
      }
    } else if (baseAward === 3) {
      basesToAdvance = 3;
    } else {
      basesToAdvance = 4;
    }

    const destination = base + basesToAdvance;
    if (destination >= 3) {
      runs += 1;
      moves.push({ runner, from: base, to: "home" });
    } else {
      newBases[destination] = runner;
      moves.push({ runner, from: base, to: destination });
    }
  }

  if (baseAward >= 4) {
    runs += 1;
    moves.push({ runner: batterRunner, from: "batter", to: "home" });
  } else {
    newBases[baseAward - 1] = batterRunner;
    moves.push({ runner: batterRunner, from: "batter", to: baseAward - 1 });
  }

  addRuns(battingTeam, runs);
  game.bases = newBases;
  startRunnerAnimations(moves);

  const resultText = hitResultText(baseAward);

  pushLog(`${game.activeBatter.name} 擊出${resultText}。`);
  game.banner = resultText;
  finishPlateAppearance(`形成${resultText}，跑者持續推進。`);
}

function advanceOnHit(baseAward, ball) {
  recordHit(offenseTeam());
  feedback(baseAward >= 4 ? "crowd" : "hit", baseAward >= 4 ? [35, 25, 35] : 18);
  if (userOnOffense() && baseAward < 4) {
    beginManualAdvanceOnHit(baseAward, ball);
    return;
  }

  advanceOnHitAutomatically(baseAward, ball);
}

function resolveCaughtFly(ball) {
  game.outs += 1;
  const oldBases = [...game.bases];
  const newBases = [...game.bases];
  const moves = [];
  let runs = 0;
  const catcher = resolveCatcher(ball);

  if (ball.distanceFeet > BALANCE.flyBall.sacFlyMinDistance && game.outs < 3) {
    if (oldBases[2]) {
      runs += 1;
      moves.push({ runner: oldBases[2], from: 2, to: "home" });
      newBases[2] = null;
    }
    if (oldBases[1]) {
      moves.push({ runner: oldBases[1], from: 1, to: 2 });
      newBases[2] = oldBases[1];
      newBases[1] = null;
    }
  }

  addRuns(offenseTeam(), runs);
  game.bases = newBases;
  startRunnerAnimations(moves);
  pushLog(`${game.activeBatter.name} 的高飛球被接殺。`);
  game.banner = "高飛球接殺";
  startCatchDisplay(ball, catcher, () => finishPlateAppearance("高飛球被穩穩接住。"));
}

function resolveSacrificeBunt(ball, catcher) {
  const oldBases = [...game.bases];
  const newBases = [...game.bases];
  const moves = [];
  let runs = 0;

  for (let base = 2; base >= 0; base -= 1) {
    const runner = oldBases[base];
    if (!runner) {
      continue;
    }
    const destination = base + 1;
    newBases[base] = null;
    if (destination >= 3) {
      runs += 1;
      moves.push({ runner, from: base, to: "home" });
    } else if (!newBases[destination]) {
      newBases[destination] = runner;
      moves.push({ runner, from: base, to: destination });
    } else {
      newBases[base] = runner;
    }
  }

  addRuns(offenseTeam(), runs);
  game.bases = newBases;
  startRunnerAnimations(moves);
  pushLog(`${game.activeBatter.name} 犧牲觸擊，跑者推進。`);
  game.banner = "犧牲觸擊";
  startCatchDisplay(ball, catcher, () => finishPlateAppearance("觸擊成功換取推進。"));
}

function doublePlayChance(ball, oldBases) {
  const batterSpeed = game.activeBatter.speed || 60;
  const runnerSpeed = oldBases[0]?.speed || 60;
  return clamp(
    BALANCE.fielding.doublePlayBase -
      (batterSpeed - 60) * BALANCE.fielding.doublePlayBatterSpeedStep -
      (runnerSpeed - 60) * 0.002 +
      (ball.type === "ground" ? 0.04 : 0),
    0.08,
    0.55
  );
}

function resolveGroundOut(ball) {
  game.outs += 1;
  const oldBases = [...game.bases];
  const newBases = [...game.bases];
  const catcher = resolveCatcher(ball);

  if (ball.battingMode === "bunt" && oldBases.some(Boolean) && game.outs < 3) {
    resolveSacrificeBunt(ball, catcher);
    return;
  }

  if (
    oldBases[0] &&
    !oldBases[1] &&
    game.outs < 3 &&
    Math.random() < doublePlayChance(ball, oldBases)
  ) {
    game.outs += 1;
    newBases[0] = null;
    triggerReplay("雙殺慢動作");
    feedback("out", [30, 35, 30]);
    pushLog(`${game.activeBatter.name} 遭雙殺處理。`);
    game.bases = newBases;
    game.banner = "雙殺打";
    startCatchDisplay(ball, catcher, () => finishPlateAppearance("內野順利完成雙殺。"));
    return;
  }

  game.bases = newBases;
  pushLog(`${game.activeBatter.name} 遭內野處理出局。`);
  game.banner = "滾地出局";
  startCatchDisplay(ball, catcher, () => finishPlateAppearance("滾地球被內野處理。"));
}

function shouldScoreFieldingError(ball) {
  if (ball.battingMode === "bunt") {
    return false;
  }
  return Math.random() < (BALANCE.fielding.errorRate[ball.type] || 0);
}

function advanceOnFieldingError(ball) {
  const battingTeam = offenseTeam();
  const oldBases = [...game.bases];
  const batterRunner = createRunner(game.activeBatter, battingTeam);
  const newBases = [...oldBases];
  const moves = [];
  let runs = 0;

  for (let base = 2; base >= 0; base -= 1) {
    const runner = oldBases[base];
    if (!runner) {
      continue;
    }
    const forced =
      base === 0 ||
      (base === 1 && oldBases[0]) ||
      (base === 2 && oldBases[1] && oldBases[0]);
    if (!forced) {
      continue;
    }

    newBases[base] = null;
    if (base === 2) {
      runs += 1;
      moves.push({ runner, from: 2, to: "home" });
    } else {
      newBases[base + 1] = runner;
      moves.push({ runner, from: base, to: base + 1 });
    }
  }

  newBases[0] = batterRunner;
  moves.push({ runner: batterRunner, from: "batter", to: 0 });
  addRuns(battingTeam, runs);
  recordError(defenseTeam());
  game.bases = newBases;
  startRunnerAnimations(moves);
  pushLog(`${resolveCatcher(ball).label} 發生守備失誤，${game.activeBatter.name} 上壘。`);
  game.banner = "守備失誤";
  feedback("out", 24);
  finishPlateAppearance("守備失誤讓打者安全上壘。");
}

function resolveBallInPlayOutcome(ball) {
  if (ball.resolved) {
    return;
  }

  ball.resolved = true;
  game.manualFielding = null;
  if (
    ball.distanceFeet > BALANCE.homeRun.minDistance &&
    Math.abs(ball.fairAngle) <= BALANCE.homeRun.maxAngle
  ) {
    triggerReplay("全壘打慢動作");
    advanceOnHit(4, ball);
    return;
  }

  if (ball.defenseSuccess) {
    if (ball.type === "ground") {
      resolveGroundOut(ball);
      return;
    }
    resolveCaughtFly(ball);
    return;
  }

  if (shouldScoreFieldingError(ball)) {
    advanceOnFieldingError(ball);
    return;
  }

  pushLog("守備員沒有把球處理下來，形成安打。");

  if (ball.type === "ground") {
    advanceOnHit(1, ball);
    return;
  }

  if (ball.type === "popup") {
    advanceOnHit(1, ball);
    return;
  }

  if (ball.type === "line") {
    advanceOnHit(ball.distanceFeet > BALANCE.flyBall.lineDoubleMinDistance ? 2 : 1, ball);
    return;
  }

  if (ball.distanceFeet > BALANCE.flyBall.extraBaseMinDistance) {
    advanceOnHit(ball.distanceFeet > BALANCE.flyBall.tripleMinDistance ? 3 : 2, ball);
    return;
  }

  advanceOnHit(1, ball);
}

function updateFielders(deltaSeconds) {
  const ball = game.battedBall;
  if (!ball) {
    game.fielders.forEach((fielder) => {
      fielder.targetX = fielder.homeX;
      fielder.targetY = fielder.homeY;
      const travel = distance(fielder, { x: fielder.targetX, y: fielder.targetY });
      if (travel > 0) {
        const step = Math.min(travel, 140 * deltaSeconds);
        const angle = Math.atan2(fielder.targetY - fielder.y, fielder.targetX - fielder.x);
        fielder.x += Math.cos(angle) * step;
        fielder.y += Math.sin(angle) * step;
      }
    });
    return;
  }

  const pursuitPoint = ball.landed ? ball.settle : ball.landing;
  const chaserIds = ball.chasingFielderIds || [];

  game.fielders.forEach((fielder) => {
    if (game.manualFielding?.fielderId === fielder.id && manualFieldingActive()) {
      const keys = game.manualFielding.keys;
      const inputX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const inputY = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      const inputLength = Math.hypot(inputX, inputY);
      const speed = BALANCE.manualFielding.moveSpeed;

      if (inputLength > 0) {
        fielder.x = clamp(
          fielder.x + (inputX / inputLength) * speed * deltaSeconds,
          BALANCE.manualFielding.minX,
          BALANCE.manualFielding.maxX
        );
        fielder.y = clamp(
          fielder.y + (inputY / inputLength) * speed * deltaSeconds,
          BALANCE.manualFielding.minY,
          BALANCE.manualFielding.maxY
        );
        game.manualFielding.target = deepClonePoint(fielder);
      } else {
        const target = game.manualFielding.target || fielder;
        fielder.targetX = target.x;
        fielder.targetY = target.y;
        const travel = distance(fielder, target);
        if (travel > 0) {
          const step = Math.min(travel, speed * deltaSeconds);
          const angle = Math.atan2(target.y - fielder.y, target.x - fielder.x);
          fielder.x = clamp(
            fielder.x + Math.cos(angle) * step,
            BALANCE.manualFielding.minX,
            BALANCE.manualFielding.maxX
          );
          fielder.y = clamp(
            fielder.y + Math.sin(angle) * step,
            BALANCE.manualFielding.minY,
            BALANCE.manualFielding.maxY
          );
        }
      }
      return;
    }

    if (fielder.id === "c" || !chaserIds.includes(fielder.id)) {
      fielder.targetX = fielder.homeX;
      fielder.targetY = fielder.homeY;
    } else {
      fielder.targetX = pursuitPoint.x;
      fielder.targetY = pursuitPoint.y;
    }

    let speed = 140;
    if (chaserIds.includes(fielder.id)) {
      speed = ball.type === "ground" ? 132 : 120;
    }

    const travel = distance(fielder, { x: fielder.targetX, y: fielder.targetY });
    if (travel > 0) {
      const step = Math.min(travel, speed * deltaSeconds);
      const angle = Math.atan2(fielder.targetY - fielder.y, fielder.targetX - fielder.x);
      fielder.x += Math.cos(angle) * step;
      fielder.y += Math.sin(angle) * step;
    }
  });
}

function updatePitch(timestamp) {
  const pitch = game.currentPitch;
  if (!pitch || game.phase !== "pitching") {
    return;
  }

  const elapsed = timestamp - pitch.startedAt;
  pitch.progress = clamp(elapsed / pitch.duration, 0, 1);

  if (!userOnOffense() && !pitch.aiDecisionMade && pitch.progress >= pitch.aiSwingPoint) {
    resolveAiSwing();
    return;
  }

  if (pitch.progress >= 1 && !pitch.resolved) {
    pitch.resolved = true;
    calledPitchResult(pitch);
  }
}

function updateBattedBall(deltaSeconds) {
  const ball = game.battedBall;
  if (!ball || game.phase !== "ballInPlay") {
    return;
  }

  ball.elapsed += deltaSeconds;
  if (!ball.landed && ball.elapsed >= ball.hangTime) {
    ball.landed = true;
    const nearest = closestFielder(ball.landing);
    ball.landingFielderDistance = nearest.bestDistance;

    if (manualFieldingActive() && ball.type !== "ground") {
      const targetRadius =
        ball.type === "line"
          ? BALANCE.manualFielding.catchRadius * 0.85
          : BALANCE.manualFielding.catchRadius;
      if (controlledFielderReached(ball.landing, targetRadius)) {
        const fielder = controlledFielder();
        ball.manualCatcherId = fielder.id;
        ball.resolved = true;
        game.manualFielding = null;
        pushLog(`${fielder.label} 移動到落點，親手把球接進手套。`);
        resolveCaughtFly(ball);
        return;
      }

      game.lastPlay = "球落地了，這會形成安打；接下來看跑者推進。";
    }
  }

  if (ball.elapsed >= ball.hangTime + ball.rollTime) {
    if (manualFieldingActive()) {
      if (ball.type === "ground") {
        const target = manualFieldingTargetPoint(ball);
        if (controlledFielderReached(target, BALANCE.manualFielding.groundRadius)) {
          const fielder = controlledFielder();
          ball.manualCatcherId = fielder.id;
          ball.defenseSuccess = true;
          pushLog(`${fielder.label} 攔下滾地球，完成守備處理。`);
        }
      }
      game.manualFielding = null;
    }

    resolveBallInPlayOutcome(ball);
  }
}

function queueSteal(fromBase) {
  if (game.phase !== "awaitPitch" || !userOnOffense() || game.gameOver) {
    return;
  }
  if (!game.bases[fromBase] || game.bases[fromBase + 1]) {
    return;
  }
  game.pendingSteal = { fromBase };
  game.banner = "戰術盜壘";
  game.lastPlay = `${game.bases[fromBase].name} 準備盜上${fromBase === 0 ? "二" : "三"}壘。`;
  renderAll();
}
