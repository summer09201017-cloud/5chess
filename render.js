const fieldCanvas = document.getElementById("fieldCanvas");
const pitchCanvas = document.getElementById("pitchCanvas");
const fieldCtx = fieldCanvas.getContext("2d");
const pitchCtx = pitchCanvas.getContext("2d");

const homeScoreEl = document.getElementById("homeScore");
const awayScoreEl = document.getElementById("awayScore");
const inningLabelEl = document.getElementById("inningLabel");
const halfLabelEl = document.getElementById("halfLabel");
const outsValueEl = document.getElementById("outsValue");
const countValueEl = document.getElementById("countValue");
const modeTagEl = document.getElementById("modeTag");
const baseStateEl = document.getElementById("baseState");
const playStatusEl = document.getElementById("playStatus");
const lastPlayEl = document.getElementById("lastPlay");
const pitchHintEl = document.getElementById("pitchHint");
const batterNameEl = document.getElementById("batterName");
const playLogEl = document.getElementById("playLog");
const lineScoreHeadEl = document.getElementById("lineScoreHead");
const lineScoreBodyEl = document.getElementById("lineScoreBody");
const pitcherInfoEl = document.getElementById("pitcherInfo");
const pitcherStaminaTextEl = document.getElementById("pitcherStaminaText");
const pitcherStaminaBarEl = document.getElementById("pitcherStaminaBar");
const coachAdviceEl = document.getElementById("coachAdvice");
const primaryActionButton = document.getElementById("primaryAction");
const swingButton = document.getElementById("swingButton");
const swingHighButton = document.getElementById("swingHighButton");
const swingLowButton = document.getElementById("swingLowButton");
const stealSecondButton = document.getElementById("stealSecondButton");
const stealThirdButton = document.getElementById("stealThirdButton");
const restartButton = document.getElementById("restartButton");
const pitchTypeButtons = [...document.querySelectorAll("[data-pitch-type]")];
const swingZoneButtons = [...document.querySelectorAll("[data-swing-zone]")];
const difficultyButtons = [...document.querySelectorAll("[data-difficulty]")];

function syncCanvasResolution(canvas, ctx, logical) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width || logical.width;
  const cssHeight = cssWidth * (logical.height / logical.width);
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  ctx.setTransform(
    canvas.width / logical.width,
    0,
    0,
    canvas.height / logical.height,
    0,
    0
  );
}

function syncAllCanvases() {
  syncCanvasResolution(fieldCanvas, fieldCtx, LOGICAL.field);
  syncCanvasResolution(pitchCanvas, pitchCtx, LOGICAL.pitch);
}

function canvasPointerPosition(event, canvas, logical) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * logical.width,
    y: ((event.clientY - bounds.top) / bounds.height) * logical.height,
  };
}

function renderLog() {
  playLogEl.innerHTML = "";
  game.playLog.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    playLogEl.appendChild(item);
  });
}

function renderLineScore() {
  const inningCount = Math.max(9, game.lineScore.away.length, game.lineScore.home.length);
  lineScoreHeadEl.innerHTML = "";
  lineScoreBodyEl.innerHTML = "";

  const headRow = document.createElement("tr");
  ["隊伍", ...Array.from({ length: inningCount }, (_, index) => `${index + 1}`), "R", "H", "E"].forEach(
    (label) => {
      const cell = document.createElement("th");
      cell.textContent = label;
      headRow.appendChild(cell);
    }
  );
  lineScoreHeadEl.appendChild(headRow);

  ["away", "home"].forEach((teamKey) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("th");
    nameCell.textContent = TEAM_NAMES[teamKey];
    row.appendChild(nameCell);

    for (let index = 0; index < inningCount; index += 1) {
      const cell = document.createElement("td");
      const value = game.lineScore[teamKey][index];
      const isCurrent =
        index === game.inning - 1 &&
        ((teamKey === "away" && game.half === "top") ||
          (teamKey === "home" && game.half === "bottom"));
      cell.textContent = value === null || value === undefined ? "" : value;
      cell.classList.toggle("is-current", isCurrent);
      row.appendChild(cell);
    }

    [game.score[teamKey], game.stats[teamKey].hits, game.stats[teamKey].errors].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      cell.className = "line-total";
      row.appendChild(cell);
    });
    lineScoreBodyEl.appendChild(row);
  });
}

function renderButtons() {
  const offenseMode = userOnOffense();
  const awaitingPitch = game.phase === "awaitPitch";
  const inPitch = game.phase === "pitching";
  const manualRunning = game.phase === "manualRunning";
  const selectedRunner = manualRunning ? selectedManualRunner() : null;
  const manualCandidates = manualRunning ? manualAdvanceCandidates() : [];
  const canSwing = offenseMode && inPitch && !game.pendingSteal && !game.gameOver;
  const canRequestPitch = (awaitingPitch || manualRunning) && !game.gameOver;
  const canStealSecond =
    offenseMode &&
    awaitingPitch &&
    !!game.bases[0] &&
    !game.bases[1] &&
    !game.pendingSteal;
  const canStealThird =
    offenseMode &&
    awaitingPitch &&
    !!game.bases[1] &&
    !game.bases[2] &&
    !game.pendingSteal;

  if (manualRunning) {
    primaryActionButton.textContent = "結束跑壘";
    swingButton.textContent = selectedRunner
      ? `衝${baseLabel(nextBaseForManualRunner(selectedRunner))}`
      : "衝下一壘";
    stealSecondButton.textContent = "換跑者";
    stealThirdButton.textContent = "停壘";
  } else {
    primaryActionButton.textContent = offenseMode ? "下一球" : "投球";
    swingButton.textContent = "中段揮棒";
    stealSecondButton.textContent = "盜二壘";
    stealThirdButton.textContent = "盜三壘";
  }

  primaryActionButton.disabled = !canRequestPitch;
  const middleSwingDisabled = manualRunning ? !selectedRunner : !canSwing;
  swingButton.disabled = middleSwingDisabled;
  if (swingHighButton) {
    swingHighButton.disabled = manualRunning || !canSwing;
    swingHighButton.classList.toggle(
      "is-active",
      !manualRunning && game.battingMode === "high"
    );
  }
  if (swingLowButton) {
    swingLowButton.disabled = manualRunning || !canSwing;
    swingLowButton.classList.toggle(
      "is-active",
      !manualRunning && game.battingMode === "low"
    );
  }
  swingButton.classList.toggle(
    "is-active",
    !manualRunning && game.battingMode === "middle"
  );
  stealSecondButton.disabled = manualRunning ? manualCandidates.length <= 1 : !canStealSecond;
  stealThirdButton.disabled = manualRunning ? !selectedRunner : !canStealThird;

  pitchTypeButtons.forEach((button) => {
    const selected = button.dataset.pitchType === game.selectedPitchType;
    const pitcher = currentPitcher();
    const available = availablePitchTypes(pitcher).includes(button.dataset.pitchType);
    button.classList.toggle("is-active", selected);
    button.disabled = offenseMode || !awaitingPitch || manualRunning || game.gameOver || !available;
  });

  difficultyButtons.forEach((button) => {
    const selected = button.dataset.difficulty === game.difficulty;
    button.classList.toggle("is-active", selected);
    button.disabled = game.phase !== "awaitPitch" || game.gameOver;
  });

  if (game.gameOver) {
    pitchHintEl.textContent = "比賽結束，按「重新開賽」可以再打一場新的九局比賽。";
  } else if (!offenseMode && game.phase === "ballInPlay" && game.manualFielding) {
    pitchHintEl.textContent = "手動守備中，把標亮守備員移進落點圈就能接殺或處理滾地球。";
  } else if (manualRunning) {
    pitchHintEl.textContent = selectedRunner
      ? `${selectedRunner.runner.name} 可選擇續衝、停壘，或切換到前方其他跑者。`
      : "跑者已停妥，準備下一棒。";
  } else if (offenseMode) {
    pitchHintEl.textContent = game.pendingSteal
      ? "下球會啟動盜壘，打者會放掉這球。曲球與指叉球較容易抓到起跑點。"
      : "判斷球的高度後，按下對應段位（上／中／下）即揮棒。";
  } else {
    pitchHintEl.textContent = "點擊好球帶選位置。曲球下墜大、滑球橫移明顯、指叉球晚下沉。";
  }
}

function renderHUD() {
  homeScoreEl.textContent = game.score.home;
  awayScoreEl.textContent = game.score.away;
  inningLabelEl.textContent = currentInningTag();
  halfLabelEl.textContent = currentHalfLabel();
  outsValueEl.textContent = game.outs;
  countValueEl.textContent = `${game.balls}-${game.strikes}`;
  modeTagEl.textContent = game.gameOver
    ? "比賽結束"
    : userOnOffense()
      ? "你的進攻"
      : "你的防守";
  baseStateEl.textContent = baseText();
  batterNameEl.textContent = currentBatterLabel();
  playStatusEl.textContent = game.banner;
  lastPlayEl.textContent = game.lastPlay;
  const pitcher = currentPitcher();
  const stamina = Math.round(staminaPercent(pitcher) * 100);
  pitcherInfoEl.textContent = pitcher
    ? `${TEAM_NAMES[defenseTeam()]} ${pitcher.name}｜${pitcher.pitchCount} 球`
    : "投手";
  pitcherStaminaTextEl.textContent = `體力 ${stamina}%`;
  pitcherStaminaBarEl.style.width = `${stamina}%`;
  pitcherStaminaBarEl.classList.toggle("is-low", stamina < 35);
  coachAdviceEl.textContent = coachAdvice();
  renderLineScore();
  renderButtons();
  renderLog();
}

function renderAll() {
  renderHUD();
  drawPitchCanvas();
  drawFieldCanvas();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

const SWING_ANIMATION_MS = 280;

function swingZoneBandY(zone, zoneY, zoneHeight) {
  const third = zoneHeight / 3;
  if (zone === "high") return zoneY + third * 0.5;
  if (zone === "low") return zoneY + third * 2.5;
  return zoneY + third * 1.5;
}

function drawBatterAndBat(width, height, zoneX, zoneY, zoneWidth, zoneHeight) {
  if (!userOnOffense() || game.gameOver) {
    return;
  }
  const batter = game.activeBatter;
  if (!batter) return;
  const bats = batter.bats === "L" ? "L" : "R";
  // Right-handed batter stands on the LEFT of the strike zone (catcher's view);
  // Left-handed batter stands on the RIGHT.
  const onLeft = bats === "R";
  const bodyX = onLeft ? zoneX - 28 : zoneX + zoneWidth + 28;
  const bodyTop = zoneY + zoneHeight * 0.05;
  const bodyHeight = zoneHeight * 0.95;
  const bodyW = 14;

  // Body
  pitchCtx.save();
  pitchCtx.fillStyle = "rgba(255, 232, 196, 0.92)";
  pitchCtx.strokeStyle = "rgba(16, 36, 59, 0.65)";
  pitchCtx.lineWidth = 2;
  pitchCtx.beginPath();
  pitchCtx.ellipse(bodyX, bodyTop + 14, 11, 12, 0, 0, Math.PI * 2);
  pitchCtx.fill();
  pitchCtx.stroke();
  pitchCtx.fillStyle = onLeft ? "rgba(196, 72, 45, 0.92)" : "rgba(34, 80, 120, 0.92)";
  drawRoundedRect(pitchCtx, bodyX - bodyW / 2, bodyTop + 22, bodyW, bodyHeight - 22, 6);
  pitchCtx.fill();
  pitchCtx.stroke();
  pitchCtx.fillStyle = "rgba(16, 36, 59, 0.78)";
  pitchCtx.font = "700 9px Trebuchet MS";
  pitchCtx.textAlign = "center";
  pitchCtx.textBaseline = "middle";
  pitchCtx.fillText(bats, bodyX, bodyTop + 14);
  pitchCtx.restore();

  // Determine current swing animation
  const now = performance.now();
  const swingingZone = game.swingDisplay && game.swingDisplay.expires > now
    ? game.swingDisplay.zone
    : null;
  const swingProgress = swingingZone
    ? clamp(1 - (game.swingDisplay.expires - now) / SWING_ANIMATION_MS, 0, 1)
    : 0;

  // Bat: anchored at batter's hands; rotates from "ready" to "extended"
  const restZone = game.battingMode || "middle";
  const activeZone = swingingZone || restZone;
  const anchorX = bodyX + (onLeft ? bodyW / 2 + 2 : -bodyW / 2 - 2);
  const anchorY = bodyTop + 30;
  const targetY = swingZoneBandY(activeZone, zoneY, zoneHeight);

  // Ready angle (before swing) and extended angle (after swing through zone center)
  // We draw bat as a line from anchor to a tip, parameterised by swingProgress.
  const zoneCenterX = zoneX + zoneWidth / 2;
  const readyTipX = onLeft ? bodyX - 4 : bodyX + 4;
  const readyTipY = bodyTop - 2;
  const extendedTipX = onLeft ? zoneCenterX + 26 : zoneCenterX - 26;
  const extendedTipY = targetY;

  // Mid swing point — slightly forward of zone, raised/lowered by zone band
  const midTipX = onLeft ? zoneX + 6 : zoneX + zoneWidth - 6;
  const midTipY = targetY + (activeZone === "high" ? -10 : activeZone === "low" ? 10 : 0);

  let tipX;
  let tipY;
  if (swingingZone) {
    if (swingProgress < 0.5) {
      const t = swingProgress * 2;
      tipX = lerp(readyTipX, midTipX, t);
      tipY = lerp(readyTipY, midTipY, t);
    } else {
      const t = (swingProgress - 0.5) * 2;
      tipX = lerp(midTipX, extendedTipX, t);
      tipY = lerp(midTipY, extendedTipY, t);
    }
  } else {
    tipX = readyTipX;
    tipY = readyTipY;
  }

  // Highlight selected band on the strike zone (pre-swing intent indicator)
  const bandTop = zoneY + ((restZone === "high" ? 0 : restZone === "middle" ? 1 : 2) * zoneHeight) / 3;
  const bandHeight = zoneHeight / 3;
  pitchCtx.save();
  pitchCtx.fillStyle = swingingZone
    ? "rgba(255, 221, 133, 0.22)"
    : "rgba(255, 221, 133, 0.10)";
  pitchCtx.fillRect(zoneX, bandTop, zoneWidth, bandHeight);
  pitchCtx.restore();

  // Bat
  pitchCtx.save();
  pitchCtx.lineCap = "round";
  pitchCtx.strokeStyle = "rgba(255, 240, 210, 0.95)";
  pitchCtx.lineWidth = 7;
  pitchCtx.beginPath();
  pitchCtx.moveTo(anchorX, anchorY);
  pitchCtx.lineTo(tipX, tipY);
  pitchCtx.stroke();
  // bat knob
  pitchCtx.fillStyle = "rgba(143, 45, 31, 0.92)";
  pitchCtx.beginPath();
  pitchCtx.arc(anchorX, anchorY, 4.5, 0, Math.PI * 2);
  pitchCtx.fill();
  // bat tip cap
  pitchCtx.fillStyle = "rgba(255, 248, 224, 1)";
  pitchCtx.beginPath();
  pitchCtx.arc(tipX, tipY, 5, 0, Math.PI * 2);
  pitchCtx.fill();
  pitchCtx.restore();
}

function drawPitchCanvas() {
  const width = LOGICAL.pitch.width;
  const height = LOGICAL.pitch.height;
  pitchCtx.clearRect(0, 0, width, height);

  const backGradient = pitchCtx.createLinearGradient(0, 0, 0, height);
  backGradient.addColorStop(0, "#2f3f58");
  backGradient.addColorStop(1, "#121826");
  pitchCtx.fillStyle = backGradient;
  pitchCtx.fillRect(0, 0, width, height);

  pitchCtx.fillStyle = "rgba(255,255,255,0.08)";
  for (let stripe = 0; stripe < 7; stripe += 1) {
    pitchCtx.fillRect(stripe * 58, 0, 20, height);
  }

  const zoneX = width * STRIKE_ZONE.left;
  const zoneY = height * STRIKE_ZONE.top;
  const zoneWidth = width * (STRIKE_ZONE.right - STRIKE_ZONE.left);
  const zoneHeight = height * (STRIKE_ZONE.bottom - STRIKE_ZONE.top);

  drawRoundedRect(pitchCtx, zoneX, zoneY, zoneWidth, zoneHeight, 18);
  pitchCtx.fillStyle = "rgba(255,255,255,0.05)";
  pitchCtx.fill();
  pitchCtx.strokeStyle = "rgba(255,255,255,0.92)";
  pitchCtx.lineWidth = 3;
  pitchCtx.stroke();

  pitchCtx.strokeStyle = "rgba(255,255,255,0.16)";
  pitchCtx.lineWidth = 1.2;
  pitchCtx.beginPath();
  pitchCtx.moveTo(zoneX + zoneWidth / 3, zoneY);
  pitchCtx.lineTo(zoneX + zoneWidth / 3, zoneY + zoneHeight);
  pitchCtx.moveTo(zoneX + (zoneWidth * 2) / 3, zoneY);
  pitchCtx.lineTo(zoneX + (zoneWidth * 2) / 3, zoneY + zoneHeight);
  pitchCtx.moveTo(zoneX, zoneY + zoneHeight / 3);
  pitchCtx.lineTo(zoneX + zoneWidth, zoneY + zoneHeight / 3);
  pitchCtx.moveTo(zoneX, zoneY + (zoneHeight * 2) / 3);
  pitchCtx.lineTo(zoneX + zoneWidth, zoneY + (zoneHeight * 2) / 3);
  pitchCtx.stroke();

  if (!userOnOffense() && game.phase === "awaitPitch" && !game.gameOver) {
    const targetX = game.selectedTarget.x * width;
    const targetY = game.selectedTarget.y * height;
    pitchCtx.strokeStyle = "#ffdd85";
    pitchCtx.lineWidth = 3;
    pitchCtx.beginPath();
    pitchCtx.moveTo(targetX - 16, targetY);
    pitchCtx.lineTo(targetX + 16, targetY);
    pitchCtx.moveTo(targetX, targetY - 16);
    pitchCtx.lineTo(targetX, targetY + 16);
    pitchCtx.stroke();
  }

  drawBatterAndBat(width, height, zoneX, zoneY, zoneWidth, zoneHeight);

  const pitch = game.currentPitch;
  if (pitch && game.phase === "pitching") {
    const type = pitch.profile || PITCH_TYPES[pitch.pitchTypeKey];
    const progress = pitch.progress;
    const curve = Math.sin(progress * Math.PI);
    const x =
      lerp(width * 0.5, pitch.actualTarget.x * width, progress) + curve * type.breakX * width;
    const y =
      lerp(50, pitch.actualTarget.y * height, progress) + curve * type.breakY * height;

    pitchCtx.fillStyle = "rgba(255,255,255,0.18)";
    for (let trail = 1; trail <= 5; trail += 1) {
      const trailProgress = clamp(progress - trail * 0.05, 0, 1);
      const trailCurve = Math.sin(trailProgress * Math.PI);
      const trailX =
        lerp(width * 0.5, pitch.actualTarget.x * width, trailProgress) +
        trailCurve * type.breakX * width;
      const trailY =
        lerp(50, pitch.actualTarget.y * height, trailProgress) +
        trailCurve * type.breakY * height;
      pitchCtx.beginPath();
      pitchCtx.arc(trailX, trailY, Math.max(3, 9 - trail), 0, Math.PI * 2);
      pitchCtx.fill();
    }

    pitchCtx.fillStyle = type.color;
    pitchCtx.beginPath();
    pitchCtx.arc(x, y, 11, 0, Math.PI * 2);
    pitchCtx.fill();
    pitchCtx.strokeStyle = "rgba(255,255,255,0.95)";
    pitchCtx.lineWidth = 2;
    pitchCtx.stroke();
  }

  if (game.lastHotZone && (!pitch || game.phase !== "pitching")) {
    const markerX = game.lastHotZone.target.x * width;
    const markerY = game.lastHotZone.target.y * height;
    pitchCtx.beginPath();
    pitchCtx.fillStyle = "rgba(255, 221, 133, 0.32)";
    pitchCtx.arc(markerX, markerY, 18, 0, Math.PI * 2);
    pitchCtx.fill();
    pitchCtx.strokeStyle = "#ffdd85";
    pitchCtx.lineWidth = 3;
    pitchCtx.stroke();
    pitchCtx.fillStyle = "rgba(255,255,255,0.92)";
    pitchCtx.font = "700 13px Trebuchet MS";
    pitchCtx.textAlign = "center";
    pitchCtx.fillText(game.lastHotZone.result, markerX, markerY - 24);
    pitchCtx.textAlign = "left";
  }

  pitchCtx.fillStyle = "rgba(255,255,255,0.88)";
  pitchCtx.font = "700 18px Trebuchet MS";
  pitchCtx.fillText(
    game.currentPitch ? `球種：${PITCH_TYPES[game.currentPitch.pitchTypeKey].label}` : "準備下一球",
    22,
    32
  );
}

function drawRunner(ctx, point, runner, radius = 11, selected = false) {
  if (selected) {
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 221, 103, 0.34)";
    ctx.arc(point.x, point.y, radius + 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 241, 158, 0.95)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = runner.teamKey === "home" ? "#fef1db" : "#dbf4ff";
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = runner.teamKey === "home" ? "#8b351d" : "#21506d";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = runner.teamKey === "home" ? "#7f301e" : "#1c4c69";
  ctx.font = "700 11px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(runner.name.slice(0, 1), point.x, point.y + 0.5);
}

function drawFieldCanvas() {
  const width = LOGICAL.field.width;
  const height = LOGICAL.field.height;
  fieldCtx.clearRect(0, 0, width, height);

  const grassGradient = fieldCtx.createLinearGradient(0, 0, 0, height);
  grassGradient.addColorStop(0, "#76c191");
  grassGradient.addColorStop(1, "#20704d");
  fieldCtx.fillStyle = grassGradient;
  fieldCtx.fillRect(0, 0, width, height);

  const sheen = fieldCtx.createLinearGradient(0, 0, width, height);
  sheen.addColorStop(0, "rgba(255,255,255,0.08)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(0,0,0,0.08)");
  fieldCtx.fillStyle = sheen;
  fieldCtx.fillRect(0, 0, width, height);

  fieldCtx.fillStyle = "rgba(245, 228, 191, 0.95)";
  fieldCtx.beginPath();
  fieldCtx.moveTo(FIELD.home.x, FIELD.home.y);
  fieldCtx.lineTo(FIELD.first.x, FIELD.first.y);
  fieldCtx.lineTo(FIELD.second.x, FIELD.second.y);
  fieldCtx.lineTo(FIELD.third.x, FIELD.third.y);
  fieldCtx.closePath();
  fieldCtx.fill();

  fieldCtx.fillStyle = "rgba(191, 109, 56, 0.96)";
  fieldCtx.beginPath();
  fieldCtx.arc(FIELD.pitcher.x, FIELD.pitcher.y, 44, 0, Math.PI * 2);
  fieldCtx.fill();

  fieldCtx.beginPath();
  fieldCtx.moveTo(FIELD.home.x, FIELD.home.y);
  fieldCtx.arc(FIELD.home.x, FIELD.home.y, FIELD.fenceRadius, -Math.PI * 0.24, -Math.PI * 0.76, true);
  fieldCtx.closePath();
  fieldCtx.fillStyle = "rgba(38, 113, 78, 0.82)";
  fieldCtx.fill();

  fieldCtx.strokeStyle = "rgba(255, 248, 233, 0.75)";
  fieldCtx.lineWidth = 4;
  fieldCtx.beginPath();
  fieldCtx.moveTo(FIELD.home.x, FIELD.home.y);
  fieldCtx.lineTo(185, 108);
  fieldCtx.moveTo(FIELD.home.x, FIELD.home.y);
  fieldCtx.lineTo(655, 108);
  fieldCtx.stroke();

  fieldCtx.beginPath();
  fieldCtx.arc(FIELD.home.x, FIELD.home.y, FIELD.fenceRadius, Math.PI * 1.23, Math.PI * 1.77);
  fieldCtx.strokeStyle = "rgba(231, 241, 220, 0.55)";
  fieldCtx.lineWidth = 6;
  fieldCtx.stroke();

  [FIELD.first, FIELD.second, FIELD.third, { x: FIELD.home.x, y: FIELD.home.y }].forEach((base) => {
    fieldCtx.save();
    fieldCtx.translate(base.x, base.y);
    fieldCtx.rotate(Math.PI / 4);
    fieldCtx.fillStyle = "#fff6da";
    fieldCtx.fillRect(-11, -11, 22, 22);
    fieldCtx.restore();
  });

  if (game.battedBall) {
    fieldCtx.save();
    fieldCtx.setLineDash([9, 8]);
    fieldCtx.strokeStyle = "rgba(255, 248, 206, 0.96)";
    fieldCtx.lineWidth = 3;
    fieldCtx.beginPath();
    fieldCtx.arc(game.battedBall.landing.x, game.battedBall.landing.y, 18, 0, Math.PI * 2);
    fieldCtx.stroke();
    fieldCtx.restore();

    if (game.manualFielding && !userOnOffense()) {
      const target = manualFieldingTargetPoint(game.battedBall);
      const radius =
        game.battedBall.type === "ground"
          ? BALANCE.manualFielding.groundRadius
          : BALANCE.manualFielding.catchRadius;
      fieldCtx.save();
      fieldCtx.fillStyle = "rgba(255, 245, 168, 0.18)";
      fieldCtx.strokeStyle = "rgba(255, 245, 168, 0.95)";
      fieldCtx.lineWidth = 3;
      fieldCtx.beginPath();
      fieldCtx.arc(target.x, target.y, radius, 0, Math.PI * 2);
      fieldCtx.fill();
      fieldCtx.stroke();
      fieldCtx.restore();
    }
  }

  const chasingIds = game.battedBall?.chasingFielderIds || [];
  const catcherId = game.catchDisplay?.catcherId || null;

  game.fielders.forEach((fielder) => {
    const isControlled = game.manualFielding?.fielderId === fielder.id && game.phase === "ballInPlay";

    if (chasingIds.includes(fielder.id)) {
      fieldCtx.beginPath();
      fieldCtx.fillStyle = "rgba(255, 221, 133, 0.28)";
      fieldCtx.arc(fielder.x, fielder.y, 20, 0, Math.PI * 2);
      fieldCtx.fill();
    }

    if (isControlled) {
      fieldCtx.beginPath();
      fieldCtx.fillStyle = "rgba(16, 36, 59, 0.22)";
      fieldCtx.arc(fielder.x, fielder.y, 28, 0, Math.PI * 2);
      fieldCtx.fill();
      fieldCtx.strokeStyle = "rgba(255, 248, 206, 0.96)";
      fieldCtx.lineWidth = 4;
      fieldCtx.stroke();
    }

    const isCatcher = fielder.id === catcherId;
    const fielderRadius = isCatcher ? FIELDER_CAUGHT_RADIUS : FIELDER_BASE_RADIUS;

    fieldCtx.beginPath();
    fieldCtx.fillStyle = isCatcher
      ? "#ffe27a"
      : defenseTeam() === "home"
        ? "#f3d6c8"
        : "#cde8f5";
    fieldCtx.arc(fielder.x, fielder.y, fielderRadius, 0, Math.PI * 2);
    fieldCtx.fill();
    fieldCtx.strokeStyle = isCatcher ? "rgba(143, 84, 0, 0.92)" : "rgba(16, 36, 59, 0.38)";
    fieldCtx.lineWidth = isCatcher ? 3 : 2;
    fieldCtx.stroke();
    fieldCtx.fillStyle = "#10243b";
    fieldCtx.font = "700 10px Trebuchet MS";
    fieldCtx.textAlign = "center";
    fieldCtx.textBaseline = "middle";
    fieldCtx.fillText(fielder.label, fielder.x, fielder.y + 0.5);
  });

  const selectedRunnerId =
    game.phase === "manualRunning" ? game.manualRunning?.selectedRunnerId : null;

  game.bases.forEach((runner, baseIndex) => {
    if (!runner || game.hiddenRunnerIds.has(runner.id)) {
      return;
    }
    drawRunner(fieldCtx, BASE_POINTS[baseIndex], runner, 12, runner.id === selectedRunnerId);
  });

  game.runnerAnimations.forEach((animation) => {
    drawRunner(
      fieldCtx,
      runnerAnimationPosition(animation),
      animation.runner,
      12,
      animation.runner.id === selectedRunnerId
    );
  });

  if (game.catchDisplay) {
    const catcher = game.fielders.find((fielder) => fielder.id === game.catchDisplay.catcherId);
    if (catcher) {
      const ballX = catcher.x + game.catchDisplay.ballOffsetX;
      const ballY = catcher.y + game.catchDisplay.ballOffsetY;
      fieldCtx.beginPath();
      fieldCtx.fillStyle = "rgba(0,0,0,0.16)";
      fieldCtx.arc(ballX + 2, ballY + 5, game.catchDisplay.ballRadius, 0, Math.PI * 2);
      fieldCtx.fill();

      fieldCtx.beginPath();
      fieldCtx.fillStyle = "#fff8ee";
      fieldCtx.arc(ballX, ballY, game.catchDisplay.ballRadius, 0, Math.PI * 2);
      fieldCtx.fill();
      fieldCtx.strokeStyle = "rgba(123, 75, 37, 0.45)";
      fieldCtx.lineWidth = 2;
      fieldCtx.stroke();
    }
  } else if (game.battedBall) {
    const ball = game.battedBall;
    const lineProgress = ball.landed
      ? clamp((ball.elapsed - ball.hangTime) / Math.max(ball.rollTime, 0.01), 0, 1)
      : clamp(ball.elapsed / Math.max(ball.hangTime, 0.01), 0, 1);
    const start = ball.landed ? ball.landing : FIELD.home;
    const end = ball.landed ? ball.settle : ball.landing;
    const x = lerp(start.x, end.x, lineProgress);
    const y = lerp(start.y, end.y, lineProgress);
    const arcHeight =
      ball.type === "ground" ? 10 : ball.type === "line" ? 18 : ball.type === "fly" ? 72 : 92;
    const lift = ball.landed ? 0 : Math.sin(lineProgress * Math.PI) * arcHeight;

    fieldCtx.beginPath();
    fieldCtx.fillStyle = "rgba(0,0,0,0.18)";
    fieldCtx.arc(x + 3, y + 9, BALL_DRAW_RADIUS, 0, Math.PI * 2);
    fieldCtx.fill();

    fieldCtx.beginPath();
    fieldCtx.fillStyle = "#fff8ee";
    fieldCtx.arc(x, y - lift, BALL_DRAW_RADIUS, 0, Math.PI * 2);
    fieldCtx.fill();
    fieldCtx.strokeStyle = "rgba(123, 75, 37, 0.45)";
    fieldCtx.lineWidth = 2;
    fieldCtx.stroke();
  }

  if (game.replay) {
    const total = (typeof BALANCE !== "undefined" && BALANCE.replay && BALANCE.replay.durationMs) || 1500;
    const remain = Math.max(0, Math.min(total, game.replay.remainingMs || 0));
    const progress = 1 - remain / total;
    const alpha = remain > 240 ? 1 : remain / 240;
    fieldCtx.save();
    fieldCtx.globalAlpha = alpha;
    const boxW = 460;
    const boxH = 88;
    const boxX = 420 - boxW / 2;
    const boxY = 30 + progress * 6;
    fieldCtx.fillStyle = "rgba(16, 36, 59, 0.78)";
    drawRoundedRect(fieldCtx, boxX, boxY, boxW, boxH, 22);
    fieldCtx.fill();
    fieldCtx.strokeStyle = "rgba(255, 232, 196, 0.55)";
    fieldCtx.lineWidth = 2;
    drawRoundedRect(fieldCtx, boxX, boxY, boxW, boxH, 22);
    fieldCtx.stroke();
    fieldCtx.fillStyle = "#fff8ee";
    fieldCtx.font = "800 42px Trebuchet MS";
    fieldCtx.textAlign = "center";
    fieldCtx.textBaseline = "middle";
    fieldCtx.fillText(game.replay.text, 420, boxY + boxH / 2);
    fieldCtx.restore();
  }

  fieldCtx.fillStyle = "rgba(255,255,255,0.92)";
  fieldCtx.font = "700 18px Trebuchet MS";
  fieldCtx.textAlign = "left";
  fieldCtx.fillText(game.gameOver ? "終場" : `${TEAM_NAMES[offenseTeam()]} 進攻中`, 24, 34);
  fieldCtx.font = "600 14px Trebuchet MS";
  fieldCtx.fillText(
    game.manualFielding && game.phase === "ballInPlay"
      ? "手動守備中：標亮選手要進入落點圈。"
      : game.phase === "manualRunning"
      ? "跑壘決策中：黃色圈是目前操作的跑者。"
      : "球場上可看到落點圈；最近的守備員會自動追球。",
    24,
    58
  );
}
