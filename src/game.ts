import {
  AI_DEADZONE,
  AI_HOME_DEADZONE,
  AI_HOME_Y,
  AI_REACT,
  AI_SPEED,
  BALL_R,
  CAROM_DEBUG_VERSION,
  FIELD_CX,
  FIELD_CY,
  FIELD_H,
  FIELD_W,
  HOLD_TIME,
  MATCHOVER_ITEMS,
  MAX_BOUNCE_ANGLE,
  MAX_SUBSTEP,
  OBSTACLE_CENTERS,
  OBSTACLE_HH,
  OBSTACLE_HW,
  P1_X0,
  P1_X1,
  P2_X0,
  P2_X1,
  PADDLE_HALF,
  PADDLE_MAX_CY,
  PADDLE_MIN_CY,
  PADDLE_SPEED,
  PAUSE_ITEMS,
  SERVE_ANGLE,
  SERVE_SPEED,
  SPEED_CAP,
  SPEED_MULT,
  SPIN_CLAMP,
  SPIN_FROM_PADDLE,
  SPIN_HALFLIFE,
  TITLE_ITEMS,
  TRAIL_TIME,
  WIN_LEAD,
  WIN_SCORE,
} from "./constants";
import { clamp, randSign, wrapIndex } from "./math";
import type {
  Ball,
  Cue,
  FrameInput,
  GameState,
  Mode,
  Paddle,
  Rect,
  Screen,
  Side,
  Snapshot,
} from "./types";

const emptyActions = {
  "p1-up": false,
  "p1-down": false,
  "p2-up": false,
  "p2-down": false,
  confirm: false,
  back: false,
  pause: false,
  mute: false,
};

export const NO_INPUT: FrameInput = {
  actions: { down: { ...emptyActions }, pressed: { ...emptyActions } },
  pointer: null,
  touch: null,
  toggleMute: false,
};

export interface GameHooks {
  getMuted: () => boolean;
  setMuted: (muted: boolean) => void;
  playCue: (cue: Cue) => void;
  render?: () => void;
}

type Face = "left" | "right" | "top" | "bottom";

export class CaromGame {
  state: GameState;
  autoStep = true;
  private pointerStart: number | null = null;
  private touchStart: number | null = null;

  constructor(private readonly hooks: GameHooks) {
    this.state = this.createTitleState();
  }

  setRenderHook(render: () => void): void {
    this.hooks.render = render;
  }

  update(dt: number, input: FrameInput = NO_INPUT): void {
    if (dt < 0 || !Number.isFinite(dt)) {
      throw new Error("dt must be a finite non-negative number");
    }
    const startingScreen = this.state.screen;
    this.state.simTime += dt;

    if (input.toggleMute || input.actions.pressed.mute) {
      this.hooks.setMuted(!this.hooks.getMuted());
    }
    this.state.muted = this.hooks.getMuted();

    this.applyInput(startingScreen, input);
    if (
      startingScreen === "paused" &&
      this.state.screen !== "paused" &&
      (input.actions.pressed.pause || input.actions.pressed.back)
    ) {
      return;
    }

    if (this.state.screen === "countdown") {
      this.movePaddles(dt, input);
      this.advanceHold(dt);
      this.writeTrail();
    } else if (this.state.screen === "playing") {
      this.movePaddles(dt, input);
      this.advanceBall(dt);
      this.writeTrail();
      this.checkScore();
    }
  }

  advance(seconds: number, frames = 1): void {
    if (frames <= 0 || !Number.isFinite(frames)) {
      throw new Error("frames must be a positive number");
    }
    const dt = seconds / frames;
    for (let i = 0; i < frames; i += 1) {
      this.update(dt, NO_INPUT);
      this.hooks.render?.();
    }
  }

  reset(): void {
    const auto = this.autoStep;
    this.state = this.createTitleState();
    this.autoStep = auto;
  }

  createSnapshot(): Snapshot {
    const ball = this.state.ball
      ? {
          ...this.state.ball,
          trail: [...this.state.ball.trail],
          speed: this.ballSpeed(this.state.ball),
        }
      : null;
    return {
      version: CAROM_DEBUG_VERSION,
      ...this.state,
      score: { ...this.state.score },
      paddles: {
        left: { ...this.state.paddles.left },
        right: { ...this.state.paddles.right },
      },
      ai: { ...this.state.ai },
      ball,
      obstacles: this.state.obstacles.map((obstacle) => ({ ...obstacle })),
      autoStep: this.autoStep,
    };
  }

  menuItemRect(index: number): Rect | null {
    const count = this.menuCount();
    if (count === 0 || index < 0 || index >= count) {
      return null;
    }
    if (this.state.screen === "howto") {
      return { x: 510, y: 572, w: 260, h: 58 };
    }
    const w = this.state.screen === "paused" ? 330 : 300;
    const h = 58;
    const gap = 14;
    const total = count * h + (count - 1) * gap;
    const startY = this.state.screen === "title" ? 385 : 395 - total / 2;
    return { x: FIELD_CX - w / 2, y: startY + index * (h + gap), w, h };
  }

  startMatch(mode: Mode): void {
    this.state.mode = mode;
    this.state.screen = "countdown";
    this.state.resumeScreen = "playing";
    this.state.menuIndex = 0;
    this.state.score = { p1: 0, p2: 0 };
    this.state.winner = null;
    this.state.receiver = "left";
    this.state.paddles.left.cy = FIELD_CY;
    this.state.paddles.left.vy = 0;
    this.state.paddles.right.cy = FIELD_CY;
    this.state.paddles.right.vy = 0;
    this.spawnBall();
  }

  returnToTitle(): void {
    const titleIndex = this.state.titleIndex;
    const simTime = this.state.simTime;
    const muted = this.state.muted;
    this.state = this.createTitleState();
    this.state.titleIndex = titleIndex;
    this.state.menuIndex = titleIndex;
    this.state.simTime = simTime;
    this.state.muted = muted;
  }

  clearWorld(): void {
    this.state.ball = null;
    this.state.obstacles = [];
  }

  spawnBall(): void {
    this.state.ball = this.createParkedBall();
  }

  spawnObstacle(index: number): void {
    const center = OBSTACLE_CENTERS[index];
    if (!center) {
      throw new Error(`No obstacle at index ${index}`);
    }
    this.state.obstacles = this.state.obstacles.filter(
      (obstacle) => obstacle.index !== index,
    );
    this.state.obstacles.push({ index, cx: center.cx, cy: center.cy });
    this.state.obstacles.sort((a, b) => a.index - b.index);
  }

  drawBallServeSign(): void {
    this.requireBall().serveSign = randSign();
  }

  private createTitleState(): GameState {
    return {
      screen: "title",
      mode: "solo",
      menuIndex: 0,
      titleIndex: 0,
      resumeScreen: "playing",
      score: { p1: 0, p2: 0 },
      winner: null,
      receiver: "left",
      paddles: {
        left: this.createPaddle(),
        right: this.createPaddle(),
      },
      ai: { tracking: true, movement: true },
      ball: this.createParkedBall(),
      obstacles: OBSTACLE_CENTERS.map((center, index) => ({
        index,
        cx: center.cx,
        cy: center.cy,
      })),
      simTime: 0,
      muted: this.hooks.getMuted(),
    };
  }

  private createParkedBall(): Ball {
    return {
      x: FIELD_CX,
      y: FIELD_CY,
      vx: 0,
      vy: 0,
      spin: 0,
      held: true,
      holdTimer: HOLD_TIME,
      serveSign: randSign(),
      trail: [],
    };
  }

  private createPaddle(): Paddle {
    return { cy: FIELD_CY, vy: 0, driven: false, drivenVy: 0 };
  }

  private applyInput(screen: Screen, input: FrameInput): void {
    const pressed = input.actions.pressed;
    if (screen === "countdown" || screen === "playing") {
      if (pressed.pause) {
        this.state.resumeScreen = screen;
        this.state.screen = "paused";
        this.state.menuIndex = 0;
      }
      return;
    }

    if (screen === "paused" && (pressed.pause || pressed.back)) {
      this.state.screen = this.state.resumeScreen;
      return;
    }

    const count = this.menuCount();
    if (count > 0) {
      const keyboardMoved = this.applyMenuKeyboard(screen, count, input);
      const keyboardConfirmed = pressed.confirm && !keyboardMoved;
      if (keyboardConfirmed) {
        this.confirmMenu(screen);
        return;
      }
      this.applyPointingInput(input, keyboardConfirmed);
    }
  }

  private applyMenuKeyboard(
    screen: Screen,
    count: number,
    input: FrameInput,
  ): boolean {
    const pressed = input.actions.pressed;
    if (screen === "howto") {
      if (pressed.back) {
        this.returnToTitle();
      }
      return false;
    }
    const up = pressed["p1-up"] || pressed["p2-up"];
    const down = pressed["p1-down"] || pressed["p2-down"];
    if (up) {
      this.state.menuIndex = wrapIndex(this.state.menuIndex - 1, count);
      return true;
    }
    if (down) {
      this.state.menuIndex = wrapIndex(this.state.menuIndex + 1, count);
      return true;
    }
    if (screen === "matchover" && pressed.back) {
      this.returnToTitle();
    }
    return false;
  }

  private applyPointingInput(
    input: FrameInput,
    keyboardConfirmed: boolean,
  ): void {
    const pointer = input.pointer;
    if (pointer && (pointer.moved || pointer.pressed || pointer.released)) {
      const item = this.hitMenu(pointer.x, pointer.y);
      if (item !== null) {
        this.state.menuIndex = item;
      }
      if (pointer.pressed) {
        this.pointerStart = item;
      }
      if (pointer.released) {
        if (!keyboardConfirmed && item !== null && item === this.pointerStart) {
          this.confirmMenu(this.state.screen);
        }
        this.pointerStart = null;
      }
    }

    const touch = input.touch;
    if (touch && (touch.started || touch.moved || touch.ended)) {
      const item = this.hitMenu(touch.x, touch.y);
      if (item !== null) {
        this.state.menuIndex = item;
      }
      if (touch.started) {
        this.touchStart = item;
      }
      if (touch.ended) {
        if (!keyboardConfirmed && item !== null && item === this.touchStart) {
          this.confirmMenu(this.state.screen);
        }
        this.touchStart = null;
      }
    }
  }

  private confirmMenu(screen: Screen): void {
    if (screen === "title") {
      this.state.titleIndex = this.state.menuIndex;
      if (this.state.menuIndex === 0) {
        this.startMatch("solo");
      } else if (this.state.menuIndex === 1) {
        this.startMatch("versus");
      } else {
        this.state.screen = "howto";
        this.state.menuIndex = 0;
      }
    } else if (screen === "howto") {
      this.returnToTitle();
    } else if (screen === "paused") {
      if (this.state.menuIndex === 0) {
        this.state.screen = this.state.resumeScreen;
      } else if (this.state.menuIndex === 1) {
        this.startMatch(this.state.mode);
      } else {
        this.returnToTitle();
      }
    } else if (screen === "matchover") {
      if (this.state.menuIndex === 0) {
        this.startMatch(this.state.mode);
      } else {
        this.returnToTitle();
      }
    }
  }

  private movePaddles(dt: number, input: FrameInput): void {
    if (this.state.paddles.left.driven) {
      this.integratePaddle(
        this.state.paddles.left,
        this.state.paddles.left.drivenVy,
        dt,
      );
    } else {
      this.integratePaddle(
        this.state.paddles.left,
        this.humanAxis("left", input) * PADDLE_SPEED,
        dt,
      );
    }

    if (this.state.paddles.right.driven) {
      this.integratePaddle(
        this.state.paddles.right,
        this.state.paddles.right.drivenVy,
        dt,
      );
    } else if (this.state.mode === "versus") {
      this.integratePaddle(
        this.state.paddles.right,
        this.humanAxis("right", input) * PADDLE_SPEED,
        dt,
      );
    } else {
      this.moveAi(dt);
    }
  }

  private humanAxis(side: Side, input: FrameInput): number {
    const down = input.actions.down;
    if (side === "left" && this.state.mode === "solo") {
      return (
        Number(down["p1-down"] || down["p2-down"]) -
        Number(down["p1-up"] || down["p2-up"])
      );
    }
    return (
      Number(down[side === "left" ? "p1-down" : "p2-down"]) -
      Number(down[side === "left" ? "p1-up" : "p2-up"])
    );
  }

  private moveAi(dt: number): void {
    const paddle = this.state.paddles.right;
    if (!this.state.ai.movement) {
      this.integratePaddle(paddle, 0, dt);
      return;
    }
    let target = AI_HOME_Y;
    let deadzone = AI_HOME_DEADZONE;
    const ball = this.state.ball;
    if (
      this.state.ai.tracking &&
      this.state.screen === "playing" &&
      ball &&
      ball.vx > 0
    ) {
      target = ball.y - ball.vy * AI_REACT;
      deadzone = AI_DEADZONE;
    }
    const diff = target - paddle.cy;
    const vy =
      Math.abs(diff) <= deadzone || dt === 0
        ? 0
        : Math.sign(diff) * Math.min(AI_SPEED, Math.abs(diff) / dt);
    this.integratePaddle(paddle, vy, dt);
  }

  private integratePaddle(
    paddle: Paddle,
    requestedVy: number,
    dt: number,
  ): void {
    if (dt === 0) {
      paddle.vy = requestedVy;
      return;
    }
    const previous = paddle.cy;
    const next = clamp(
      previous + requestedVy * dt,
      PADDLE_MIN_CY,
      PADDLE_MAX_CY,
    );
    paddle.vy =
      next !== previous + requestedVy * dt
        ? (next - previous) / dt
        : requestedVy;
    paddle.cy = next;
  }

  private advanceHold(dt: number): void {
    const ball = this.state.ball;
    if (!ball || !ball.held) {
      return;
    }
    ball.x = FIELD_CX;
    ball.y = FIELD_CY;
    ball.holdTimer -= dt;
    if (ball.holdTimer <= 0) {
      ball.holdTimer = 0;
      ball.held = false;
      ball.trail = [];
      const dir = this.state.receiver === "left" ? -1 : 1;
      ball.vx = dir * SERVE_SPEED * Math.cos(SERVE_ANGLE);
      ball.vy = ball.serveSign * SERVE_SPEED * Math.sin(SERVE_ANGLE);
      this.state.screen = "playing";
    }
  }

  private advanceBall(dt: number): void {
    const ball = this.state.ball;
    if (!ball || ball.held) {
      return;
    }
    const speed = this.ballSpeed(ball);
    const steps = Math.max(1, Math.ceil((speed * dt) / MAX_SUBSTEP));
    const h = dt / steps;
    const cues = new Set<Cue>();
    for (let i = 0; i < steps; i += 1) {
      this.turnAndMove(ball, h);
      this.resolveWalls(ball, cues);
      this.resolvePaddle(ball, "left", cues);
      this.resolvePaddle(ball, "right", cues);
      for (const obstacle of this.state.obstacles) {
        this.resolveObstacle(ball, obstacle.cx, obstacle.cy, cues);
      }
    }
    for (const cue of cues) {
      this.hooks.playCue(cue);
    }
  }

  private turnAndMove(ball: Ball, h: number): void {
    const speed = this.ballSpeed(ball);
    if (speed > 0) {
      const angle = (ball.spin / speed) * h;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const vx = ball.vx * cos - ball.vy * sin;
      const vy = ball.vx * sin + ball.vy * cos;
      ball.vx = vx;
      ball.vy = vy;
    }
    ball.spin *= 0.5 ** (h / SPIN_HALFLIFE);
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
  }

  private resolveWalls(ball: Ball, cues: Set<Cue>): void {
    if (ball.y - BALL_R < 0 && ball.vy < 0) {
      ball.y = BALL_R;
      ball.vy = -ball.vy;
      cues.add("wall-bounce");
    } else if (ball.y + BALL_R > FIELD_H && ball.vy > 0) {
      ball.y = FIELD_H - BALL_R;
      ball.vy = -ball.vy;
      cues.add("wall-bounce");
    }
  }

  private resolvePaddle(ball: Ball, side: Side, cues: Set<Cue>): void {
    const paddle = this.state.paddles[side];
    const x0 = side === "left" ? P1_X0 : P2_X0;
    const x1 = side === "left" ? P1_X1 : P2_X1;
    const face = this.collideRect(
      ball,
      x0,
      paddle.cy - PADDLE_HALF,
      x1,
      paddle.cy + PADDLE_HALF,
    );
    if (!face) {
      return;
    }
    if (face === "top" || face === "bottom") {
      cues.add("wall-bounce");
      return;
    }
    const offset = clamp((ball.y - paddle.cy) / PADDLE_HALF, -1, 1);
    const theta = offset * MAX_BOUNCE_ANGLE;
    const speed = Math.min(this.ballSpeed(ball) * SPEED_MULT, SPEED_CAP);
    const dir = side === "left" ? 1 : -1;
    ball.vx = dir * speed * Math.cos(theta);
    ball.vy = speed * Math.sin(theta);
    ball.spin = clamp(
      ball.spin + paddle.vy * SPIN_FROM_PADDLE,
      -SPIN_CLAMP,
      SPIN_CLAMP,
    );
    ball.x = side === "left" ? P1_X1 + BALL_R : P2_X0 - BALL_R;
    cues.add("paddle-hit");
  }

  private resolveObstacle(
    ball: Ball,
    cx: number,
    cy: number,
    cues: Set<Cue>,
  ): void {
    if (
      this.collideRect(
        ball,
        cx - OBSTACLE_HW,
        cy - OBSTACLE_HH,
        cx + OBSTACLE_HW,
        cy + OBSTACLE_HH,
      )
    ) {
      cues.add("obstacle-bounce");
    }
  }

  private collideRect(
    ball: Ball,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): Face | null {
    if (!(
      ball.x > x0 - BALL_R &&
      ball.x < x1 + BALL_R &&
      ball.y > y0 - BALL_R &&
      ball.y < y1 + BALL_R
    )) {
      return null;
    }
    const depths = [
      ["left", ball.x - (x0 - BALL_R)],
      ["right", x1 + BALL_R - ball.x],
      ["top", ball.y - (y0 - BALL_R)],
      ["bottom", y1 + BALL_R - ball.y],
    ] as const;
    let face: Face = depths[0][0];
    let best = depths[0][1];
    for (const [candidate, depth] of depths.slice(1)) {
      if (depth < best) {
        face = candidate;
        best = depth;
      }
    }
    if (face === "left") {
      ball.x = x0 - BALL_R;
      if (ball.vx > 0) ball.vx = -ball.vx;
    } else if (face === "right") {
      ball.x = x1 + BALL_R;
      if (ball.vx < 0) ball.vx = -ball.vx;
    } else if (face === "top") {
      ball.y = y0 - BALL_R;
      if (ball.vy > 0) ball.vy = -ball.vy;
    } else {
      ball.y = y1 + BALL_R;
      if (ball.vy < 0) ball.vy = -ball.vy;
    }
    return face;
  }

  private checkScore(): void {
    const ball = this.state.ball;
    if (!ball) {
      return;
    }
    const scorer =
      ball.x - BALL_R > FIELD_W ? "left" : ball.x + BALL_R < 0 ? "right" : null;
    if (!scorer) {
      return;
    }
    if (scorer === "left") {
      this.state.score.p1 += 1;
    } else {
      this.state.score.p2 += 1;
    }
    this.hooks.playCue("score");
    if (this.hasWon(scorer)) {
      this.state.winner = scorer;
      this.state.screen = "matchover";
      this.state.menuIndex = 0;
      return;
    }
    this.spawnBall();
    this.state.receiver = scorer === "left" ? "right" : "left";
    if (this.state.ball) {
      this.state.ball.holdTimer = HOLD_TIME;
    }
    this.state.screen = "countdown";
  }

  private hasWon(side: Side): boolean {
    const p1 = this.state.score.p1;
    const p2 = this.state.score.p2;
    return side === "left"
      ? p1 >= WIN_SCORE && p1 - p2 >= WIN_LEAD
      : p2 >= WIN_SCORE && p2 - p1 >= WIN_LEAD;
  }

  private writeTrail(): void {
    const ball = this.state.ball;
    if (!ball) {
      return;
    }
    ball.trail.push({ x: ball.x, y: ball.y, t: this.state.simTime });
    ball.trail = ball.trail.filter(
      (sample) => this.state.simTime - sample.t <= TRAIL_TIME,
    );
  }

  private menuCount(): number {
    if (this.state.screen === "title") return TITLE_ITEMS.length;
    if (this.state.screen === "howto") return 1;
    if (this.state.screen === "paused") return PAUSE_ITEMS.length;
    if (this.state.screen === "matchover") return MATCHOVER_ITEMS.length;
    return 0;
  }

  private hitMenu(x: number, y: number): number | null {
    for (let i = 0; i < this.menuCount(); i += 1) {
      const rect = this.menuItemRect(i);
      if (
        rect &&
        x >= rect.x &&
        x <= rect.x + rect.w &&
        y >= rect.y &&
        y <= rect.y + rect.h
      ) {
        return i;
      }
    }
    return null;
  }

  private ballSpeed(ball: Ball): number {
    return Math.hypot(ball.vx, ball.vy);
  }

  requireBall(): Ball {
    if (!this.state.ball) {
      throw new Error("No ball is present");
    }
    return this.state.ball;
  }
}
