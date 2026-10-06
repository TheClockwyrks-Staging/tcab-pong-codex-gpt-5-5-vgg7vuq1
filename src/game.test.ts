import { describe, expect, it } from "vitest";
import {
  BALL_R,
  FIELD_CY,
  FIELD_W,
  HOLD_TIME,
  P1_X1,
  PADDLE_SPEED,
  SERVE_SPEED,
  SPEED_MULT,
} from "./constants";
import { CaromGame, NO_INPUT } from "./game";
import type { Action, FrameInput, Cue } from "./types";

const actions: Action[] = [
  "p1-up",
  "p1-down",
  "p2-up",
  "p2-down",
  "confirm",
  "back",
  "pause",
  "mute",
];

function input(
  held: Partial<Record<Action, boolean>> = {},
  pressed: Partial<Record<Action, boolean>> = {},
): FrameInput {
  const down = Object.fromEntries(
    actions.map((action) => [action, held[action] ?? false]),
  ) as Record<Action, boolean>;
  const edge = Object.fromEntries(
    actions.map((action) => [action, pressed[action] ?? false]),
  ) as Record<Action, boolean>;
  return {
    actions: { down, pressed: edge },
    pointer: null,
    touch: null,
    toggleMute: false,
  };
}

function makeGame(): {
  game: CaromGame;
  cues: Cue[];
  muted: { value: boolean };
} {
  const cues: Cue[] = [];
  const muted = { value: false };
  const game = new CaromGame({
    getMuted: () => muted.value,
    setMuted: (value) => {
      muted.value = value;
    },
    playCue: (cue) => cues.push(cue),
  });
  return { game, cues, muted };
}

describe("CaromGame", () => {
  it("opens on the specified title state with a parked ball and obstacles", () => {
    const { game } = makeGame();
    const snapshot = game.createSnapshot();
    expect(snapshot.screen).toBe("title");
    expect(snapshot.mode).toBe("solo");
    expect(snapshot.ball?.held).toBe(true);
    expect(snapshot.ball?.x).toBe(640);
    expect(snapshot.ball?.holdTimer).toBe(HOLD_TIME);
    expect(snapshot.obstacles).toHaveLength(2);
  });

  it("serves toward the receiver after the countdown elapses", () => {
    const { game } = makeGame();
    game.startMatch("versus");
    game.state.ball!.serveSign = 1;
    game.update(HOLD_TIME, NO_INPUT);
    const ball = game.createSnapshot().ball;
    expect(game.state.screen).toBe("playing");
    expect(ball?.held).toBe(false);
    expect(ball?.speed).toBeCloseTo(SERVE_SPEED, 5);
    expect(ball!.vx).toBeLessThan(0);
    expect(ball!.vy).toBeGreaterThan(0);
    expect(ball?.trail).toHaveLength(1);
  });

  it("uses integrated paddle velocity to add spin on a face hit", () => {
    const { game, cues } = makeGame();
    game.startMatch("versus");
    game.state.screen = "playing";
    const ball = game.requireBall();
    ball.held = false;
    ball.x = P1_X1 + BALL_R + 1;
    ball.y = FIELD_CY;
    ball.vx = -400;
    ball.vy = 0;
    ball.spin = 0;
    game.update(1 / 60, input({ "p1-down": true }));
    const snapshot = game.createSnapshot();
    expect(snapshot.ball!.vx).toBeGreaterThan(0);
    expect(snapshot.ball!.speed).toBeCloseTo(400 * SPEED_MULT, 5);
    expect(snapshot.ball!.spin).toBeGreaterThan(PADDLE_SPEED * 0.8);
    expect(cues).toContain("paddle-hit");
  });

  it("scores a point, parks the ball, and serves toward the scored-on side", () => {
    const { game, cues } = makeGame();
    game.startMatch("solo");
    game.state.screen = "playing";
    const ball = game.requireBall();
    ball.held = false;
    ball.x = FIELD_W + BALL_R + 4;
    ball.y = FIELD_CY;
    ball.vx = 300;
    game.update(0.001, NO_INPUT);
    const snapshot = game.createSnapshot();
    expect(snapshot.score.p1).toBe(1);
    expect(snapshot.receiver).toBe("right");
    expect(snapshot.screen).toBe("countdown");
    expect(snapshot.ball?.held).toBe(true);
    expect(snapshot.ball?.trail).toHaveLength(0);
    expect(cues).toContain("score");
  });

  it("keeps reset from changing mute or auto-step", () => {
    const { game, muted } = makeGame();
    muted.value = true;
    game.autoStep = false;
    game.startMatch("versus");
    game.reset();
    const snapshot = game.createSnapshot();
    expect(snapshot.screen).toBe("title");
    expect(snapshot.muted).toBe(true);
    expect(snapshot.autoStep).toBe(false);
    expect(snapshot.simTime).toBe(0);
  });
});
