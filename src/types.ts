export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";
export type Mode = "solo" | "versus";
export type Side = "left" | "right";
export type Cue = "paddle-hit" | "wall-bounce" | "obstacle-bounce" | "score";
export type Action =
  | "p1-up"
  | "p1-down"
  | "p2-up"
  | "p2-down"
  | "confirm"
  | "back"
  | "pause"
  | "mute";

export interface ActionState {
  down: Record<Action, boolean>;
  pressed: Record<Action, boolean>;
}

export interface PointerFrame {
  x: number;
  y: number;
  moved: boolean;
  down: boolean;
  pressed: boolean;
  released: boolean;
}

export interface TouchFrame {
  x: number;
  y: number;
  active: boolean;
  started: boolean;
  moved: boolean;
  ended: boolean;
}

export interface FrameInput {
  actions: ActionState;
  pointer: PointerFrame | null;
  touch: TouchFrame | null;
  toggleMute: boolean;
}

export interface Paddle {
  cy: number;
  vy: number;
  driven: boolean;
  drivenVy: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  held: boolean;
  holdTimer: number;
  serveSign: 1 | -1;
  trail: TrailSample[];
}

export interface TrailSample {
  x: number;
  y: number;
  t: number;
}

export interface Obstacle {
  index: number;
  cx: number;
  cy: number;
}

export interface GameState {
  screen: Screen;
  mode: Mode;
  menuIndex: number;
  titleIndex: number;
  resumeScreen: "countdown" | "playing";
  score: { p1: number; p2: number };
  winner: Side | null;
  receiver: Side;
  paddles: { left: Paddle; right: Paddle };
  ai: { tracking: boolean; movement: boolean };
  ball: Ball | null;
  obstacles: Obstacle[];
  simTime: number;
  muted: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Snapshot extends GameState {
  version: number;
  ball: (Ball & { speed: number }) | null;
  autoStep: boolean;
}
