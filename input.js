let lastFrame = performance.now();

function handlePitchCanvasPointer(event) {
  enableGameFeedback();
  if (userOnOffense() || game.phase !== "awaitPitch" || game.gameOver) {
    return;
  }
  const point = canvasPointerPosition(event, pitchCanvas, LOGICAL.pitch);
  game.selectedTarget = {
    x: clamp(point.x / LOGICAL.pitch.width, 0.16, 0.84),
    y: clamp(point.y / LOGICAL.pitch.height, 0.16, 0.88),
  };
  game.lastPlay = `落點鎖定在 ${Math.round(game.selectedTarget.x * 100)} / ${Math.round(game.selectedTarget.y * 100)} 區域。`;
  renderAll();
}

function handleFieldCanvasPointer(event) {
  enableGameFeedback();
  if (!manualFieldingActive()) {
    return;
  }

  event.preventDefault();
  const point = canvasPointerPosition(event, fieldCanvas, LOGICAL.field);
  setManualFielderTarget(point);

  if (event.type === "pointerdown" && fieldCanvas.setPointerCapture) {
    fieldCanvas.setPointerCapture(event.pointerId);
  }
}

function handleFieldCanvasPointerEnd(event) {
  if (!game.manualFielding) {
    return;
  }

  event.preventDefault();
  releaseManualFielderPointer();
  if (fieldCanvas.releasePointerCapture) {
    fieldCanvas.releasePointerCapture(event.pointerId);
  }
}

function isFieldingMoveKey(key) {
  const lowerKey = key.toLowerCase();
  return (
    key === "ArrowUp" ||
    key === "ArrowDown" ||
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    lowerKey === "w" ||
    lowerKey === "a" ||
    lowerKey === "s" ||
    lowerKey === "d"
  );
}

function gameLoop(timestamp) {
  const deltaMs = Math.min(40, timestamp - lastFrame);
  const deltaSeconds = deltaMs / 1000;
  lastFrame = timestamp;

  updatePitch(timestamp);
  updateBattedBall(deltaSeconds);
  updateFielders(deltaSeconds);
  updateRunnerAnimations(deltaMs);
  updateCatchDisplay(deltaMs);
  updateReplay(deltaMs);
  updateAutoPitch(deltaMs);
  drawPitchCanvas();
  drawFieldCanvas();
  requestAnimationFrame(gameLoop);
}

pitchTypeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    enableGameFeedback();
    if (userOnOffense() || game.phase !== "awaitPitch" || game.gameOver) {
      return;
    }
    game.selectedPitchType = button.dataset.pitchType;
    renderAll();
  });
});

function commitSwingZone(zone) {
  if (game.gameOver || !userOnOffense()) return;
  setBattingMode(zone);
  if (game.phase === "pitching" && game.currentPitch) {
    resolveUserSwing(game.currentPitch.progress, zone);
  }
}

swingZoneButtons.forEach((button) => {
  button.addEventListener("click", () => {
    enableGameFeedback();
    if (game.phase === "manualRunning" && button.id === "swingButton") {
      attemptManualAdvance();
      return;
    }
    const zone = button.dataset.swingZone;
    if (!zone) return;
    commitSwingZone(zone);
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    enableGameFeedback();
    if (game.phase !== "awaitPitch" || game.gameOver) {
      return;
    }
    setDifficulty(button.dataset.difficulty);
  });
});

primaryActionButton.addEventListener("click", () => {
  enableGameFeedback();
  if (game.phase === "manualRunning") {
    finishManualRunningByUser();
    return;
  }
  startPitch();
});
stealSecondButton.addEventListener("click", () => {
  enableGameFeedback();
  if (game.phase === "manualRunning") {
    cycleManualRunner();
    return;
  }
  queueSteal(0);
});
stealThirdButton.addEventListener("click", () => {
  enableGameFeedback();
  if (game.phase === "manualRunning") {
    holdSelectedManualRunner();
    return;
  }
  queueSteal(1);
});
restartButton.addEventListener("click", () => {
  enableGameFeedback();
  resetGame();
});
pitchCanvas.addEventListener("pointerdown", handlePitchCanvasPointer);
fieldCanvas.addEventListener("pointerdown", handleFieldCanvasPointer);
fieldCanvas.addEventListener("pointermove", handleFieldCanvasPointer);
fieldCanvas.addEventListener("pointerup", handleFieldCanvasPointerEnd);
fieldCanvas.addEventListener("pointercancel", handleFieldCanvasPointerEnd);

document.addEventListener("keydown", (event) => {
  enableGameFeedback();
  if (event.repeat) {
    return;
  }

  if (manualFieldingActive() && isFieldingMoveKey(event.key)) {
    event.preventDefault();
    setManualFielderKey(event.key, true);
    return;
  }

  if (event.code === "Enter") {
    event.preventDefault();
    if (game.phase === "manualRunning") {
      finishManualRunningByUser();
      return;
    }
    startPitch();
  }

  if (event.code === "Space" && userOnOffense()) {
    event.preventDefault();
    if (game.phase === "manualRunning") {
      attemptManualAdvance();
      return;
    }
    if (game.phase === "pitching") {
      commitSwingZone("middle");
    }
  }

  if (
    userOnOffense() &&
    !manualFieldingActive() &&
    (game.phase === "awaitPitch" || game.phase === "pitching")
  ) {
    const lower = event.key.toLowerCase();
    if (lower === "q") {
      event.preventDefault();
      commitSwingZone("high");
      return;
    }
    if (lower === "w") {
      event.preventDefault();
      commitSwingZone("middle");
      return;
    }
    if (lower === "e") {
      event.preventDefault();
      commitSwingZone("low");
      return;
    }
  }

  if (
    (event.key === "ArrowRight" || event.key.toLowerCase() === "d") &&
    userOnOffense() &&
    game.phase === "manualRunning"
  ) {
    event.preventDefault();
    cycleManualRunner();
  }

  if (event.key.toLowerCase() === "s" && userOnOffense() && game.phase === "awaitPitch") {
    event.preventDefault();
    if (game.bases[0] && !game.bases[1]) {
      queueSteal(0);
    } else if (game.bases[1] && !game.bases[2]) {
      queueSteal(1);
    }
  }

  if (event.key.toLowerCase() === "s" && userOnOffense() && game.phase === "manualRunning") {
    event.preventDefault();
    holdSelectedManualRunner();
  }
});

document.addEventListener("keyup", (event) => {
  if (!game.manualFielding || !isFieldingMoveKey(event.key)) {
    return;
  }

  event.preventDefault();
  setManualFielderKey(event.key, false);
});

window.addEventListener("resize", syncAllCanvases);

syncAllCanvases();
resetGame();
requestAnimationFrame(gameLoop);
