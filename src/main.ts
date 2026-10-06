import { AudioRuntime } from "./audio";
import { CaromGame } from "./game";
import { Renderer } from "./render";
import { CanvasFit, InputRuntime } from "./runtime";
import type { Mode, Screen, Side } from "./types";

const canvas = document.querySelector<HTMLCanvasElement>("#stage");
if (!canvas) {
  throw new Error("Canvas #stage was not found");
}
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("2D canvas context is unavailable");
}
const context = ctx;

const fit = new CanvasFit(canvas);
const audio = new AudioRuntime();
const game = new CaromGame({
  getMuted: () => audio.muted,
  setMuted: (muted) => audio.setMuted(muted),
  playCue: (cue) => audio.play(cue),
});
const input = new InputRuntime(canvas, fit);
const renderer = new Renderer(context, game);
game.setRenderHook(render);
input.onUserGesture(() => audio.arm());

function render(): void {
  fit.resize();
  fit.apply(context);
  renderer.draw();
}

function assertScreen(screen: string): asserts screen is Screen {
  if (
    !["title", "howto", "countdown", "playing", "paused", "matchover"].includes(
      screen,
    )
  ) {
    throw new Error(`Invalid screen: ${screen}`);
  }
}

function assertMode(mode: string): asserts mode is Mode {
  if (mode !== "solo" && mode !== "versus") {
    throw new Error(`Invalid mode: ${mode}`);
  }
}

function assertSide(side: string): asserts side is Side {
  if (side !== "left" && side !== "right") {
    throw new Error(`Invalid side: ${side}`);
  }
}

function installDebugSurface(): void {
  window.__carom = {
    version: 1,
    setAutoStep(enabled: boolean) {
      game.autoStep = enabled;
    },
    advance(seconds: number, frames = 1) {
      game.advance(seconds, frames);
    },
    clearWorld() {
      game.clearWorld();
    },
    spawnBall() {
      game.spawnBall();
    },
    spawnObstacle(index: number) {
      game.spawnObstacle(index);
    },
    reset() {
      game.reset();
    },
    reconcile() {},
    setScreen(screen: Screen) {
      assertScreen(screen);
      game.state.screen = screen;
    },
    setMode(mode: Mode) {
      assertMode(mode);
      game.state.mode = mode;
    },
    setMenuIndex(index: number) {
      game.state.menuIndex = index;
    },
    setTitleIndex(index: number) {
      game.state.titleIndex = index;
    },
    setResumeScreen(screen: "countdown" | "playing") {
      if (screen !== "countdown" && screen !== "playing")
        throw new Error(`Invalid resume screen: ${screen}`);
      game.state.resumeScreen = screen;
    },
    setScore(p1: number, p2: number) {
      game.state.score = { p1, p2 };
    },
    setWinner(side: Side | null) {
      if (side !== null) assertSide(side);
      game.state.winner = side;
    },
    setReceiver(side: Side) {
      assertSide(side);
      game.state.receiver = side;
    },
    setPaddleCy(side: Side, cy: number) {
      assertSide(side);
      game.state.paddles[side].cy = cy;
    },
    setPaddleVy(side: Side, vy: number) {
      assertSide(side);
      game.state.paddles[side].drivenVy = vy;
    },
    setPaddleDriven(side: Side, driven: boolean) {
      assertSide(side);
      game.state.paddles[side].driven = driven;
    },
    setBallPosition(x: number, y: number) {
      const ball = game.requireBall();
      ball.x = x;
      ball.y = y;
    },
    setBallVelocity(vx: number, vy: number) {
      const ball = game.requireBall();
      ball.vx = vx;
      ball.vy = vy;
    },
    setBallSpin(spin: number) {
      game.requireBall().spin = spin;
    },
    setBallHeld(held: boolean) {
      game.requireBall().held = held;
    },
    setBallHoldTimer(seconds: number) {
      game.requireBall().holdTimer = seconds;
    },
    setBallServeSign(sign: 1 | -1) {
      if (sign !== 1 && sign !== -1)
        throw new Error(`Invalid serve sign: ${sign}`);
      game.requireBall().serveSign = sign;
    },
    drawBallServeSign() {
      game.drawBallServeSign();
    },
    setAiTracking(enabled: boolean) {
      game.state.ai.tracking = enabled;
    },
    setAiMovement(enabled: boolean) {
      game.state.ai.movement = enabled;
    },
    setMuted(muted: boolean) {
      audio.setMuted(muted);
      game.state.muted = muted;
    },
    snapshot() {
      return game.createSnapshot();
    },
    menuItemRect(index: number) {
      return game.menuItemRect(index);
    },
  };
}

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (input.overlayPressed) {
    renderer.diagnostics = !renderer.diagnostics;
    input.overlayPressed = false;
  }
  if (game.autoStep) {
    game.update(dt, input.frame());
  } else {
    input.frame();
  }
  render();
  requestAnimationFrame(loop);
}

installDebugSurface();
render();
requestAnimationFrame(loop);

declare global {
  interface Window {
    __carom: {
      version: number;
      setAutoStep(enabled: boolean): void;
      advance(seconds: number, frames?: number): void;
      clearWorld(): void;
      spawnBall(): void;
      spawnObstacle(index: number): void;
      reset(): void;
      reconcile(): void;
      setScreen(screen: Screen): void;
      setMode(mode: Mode): void;
      setMenuIndex(index: number): void;
      setTitleIndex(index: number): void;
      setResumeScreen(screen: "countdown" | "playing"): void;
      setScore(p1: number, p2: number): void;
      setWinner(side: Side | null): void;
      setReceiver(side: Side): void;
      setPaddleCy(side: Side, cy: number): void;
      setPaddleVy(side: Side, vy: number): void;
      setPaddleDriven(side: Side, driven: boolean): void;
      setBallPosition(x: number, y: number): void;
      setBallVelocity(vx: number, vy: number): void;
      setBallSpin(spin: number): void;
      setBallHeld(held: boolean): void;
      setBallHoldTimer(seconds: number): void;
      setBallServeSign(sign: 1 | -1): void;
      drawBallServeSign(): void;
      setAiTracking(enabled: boolean): void;
      setAiMovement(enabled: boolean): void;
      setMuted(muted: boolean): void;
      snapshot(): ReturnType<CaromGame["createSnapshot"]>;
      menuItemRect(index: number): ReturnType<CaromGame["menuItemRect"]>;
    };
  }
}
