import { FIELD_H, FIELD_W } from "./constants";
import type { Action, FrameInput, Rect } from "./types";

const actionKeys: Record<string, Action[]> = {
  KeyW: ["p1-up"],
  KeyS: ["p1-down"],
  ArrowUp: ["p2-up"],
  ArrowDown: ["p2-down"],
  Enter: ["confirm"],
  Space: ["confirm"],
  Escape: ["back", "pause"],
  KeyP: ["pause"],
  KeyM: ["mute"],
};

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

function actionMap(value: boolean): Record<Action, boolean> {
  return Object.fromEntries(actions.map((action) => [action, value])) as Record<
    Action,
    boolean
  >;
}

export class CanvasFit {
  rect: Rect = { x: 0, y: 0, w: FIELD_W, h: FIELD_H };
  scale = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.max(1, Math.floor(cssW * dpr));
    this.canvas.height = Math.max(1, Math.floor(cssH * dpr));
    this.scale = Math.min(cssW / FIELD_W, cssH / FIELD_H);
    const w = FIELD_W * this.scale;
    const h = FIELD_H * this.scale;
    this.rect = { x: (cssW - w) / 2, y: (cssH - h) / 2, w, h };
  }

  apply(ctx: CanvasRenderingContext2D): void {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate(this.rect.x, this.rect.y);
    ctx.scale(this.scale, this.scale);
  }

  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - bounds.left - this.rect.x) / this.scale,
      y: (clientY - bounds.top - this.rect.y) / this.scale,
    };
  }
}

export class InputRuntime {
  private down = actionMap(false);
  private pressed = actionMap(false);
  private pointer = {
    x: 0,
    y: 0,
    moved: false,
    down: false,
    pressed: false,
    released: false,
  };
  private touch = {
    x: 0,
    y: 0,
    active: false,
    started: false,
    moved: false,
    ended: false,
  };
  private userGestureCallback: (() => void) | null = null;
  overlayPressed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly fit: CanvasFit,
  ) {
    window.addEventListener("keydown", (event) => this.onKeyDown(event));
    window.addEventListener("keyup", (event) => this.onKeyUp(event));
    canvas.addEventListener("pointermove", (event) =>
      this.onPointerMove(event),
    );
    canvas.addEventListener("pointerdown", (event) =>
      this.onPointerDown(event),
    );
    canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    canvas.addEventListener("pointercancel", (event) =>
      this.onPointerUp(event),
    );
    canvas.addEventListener(
      "touchstart",
      (event) => this.onTouch(event, "start"),
      { passive: false },
    );
    canvas.addEventListener(
      "touchmove",
      (event) => this.onTouch(event, "move"),
      { passive: false },
    );
    canvas.addEventListener("touchend", (event) => this.onTouch(event, "end"), {
      passive: false,
    });
    canvas.addEventListener(
      "touchcancel",
      (event) => this.onTouch(event, "end"),
      { passive: false },
    );
  }

  onUserGesture(callback: () => void): void {
    this.userGestureCallback = callback;
  }

  frame(): FrameInput {
    const frame: FrameInput = {
      actions: { down: { ...this.down }, pressed: { ...this.pressed } },
      pointer:
        this.pointer.moved || this.pointer.pressed || this.pointer.released
          ? { ...this.pointer }
          : null,
      touch:
        this.touch.started || this.touch.moved || this.touch.ended
          ? { ...this.touch }
          : null,
      toggleMute: false,
    };
    this.pressed = actionMap(false);
    this.pointer.moved = false;
    this.pointer.pressed = false;
    this.pointer.released = false;
    this.touch.started = false;
    this.touch.moved = false;
    this.touch.ended = false;
    return frame;
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.userGestureCallback?.();
    if (event.code === "Backquote" && !event.repeat) {
      this.overlayPressed = true;
      event.preventDefault();
      return;
    }
    for (const action of actionKeys[event.code] ?? []) {
      if (!this.down[action] && !event.repeat) {
        this.pressed[action] = true;
      }
      this.down[action] = true;
      event.preventDefault();
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    for (const action of actionKeys[event.code] ?? []) {
      this.down[action] = false;
      event.preventDefault();
    }
  }

  private onPointerMove(event: PointerEvent): void {
    const point = this.fit.toLogical(event.clientX, event.clientY);
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    this.pointer.moved = true;
  }

  private onPointerDown(event: PointerEvent): void {
    this.userGestureCallback?.();
    this.canvas.setPointerCapture(event.pointerId);
    const point = this.fit.toLogical(event.clientX, event.clientY);
    this.pointer = {
      x: point.x,
      y: point.y,
      moved: true,
      down: true,
      pressed: true,
      released: false,
    };
    event.preventDefault();
  }

  private onPointerUp(event: PointerEvent): void {
    const point = this.fit.toLogical(event.clientX, event.clientY);
    this.pointer = {
      x: point.x,
      y: point.y,
      moved: true,
      down: false,
      pressed: false,
      released: true,
    };
    event.preventDefault();
  }

  private onTouch(event: TouchEvent, kind: "start" | "move" | "end"): void {
    this.userGestureCallback?.();
    const touch = event.changedTouches[0];
    if (!touch) return;
    const point = this.fit.toLogical(touch.clientX, touch.clientY);
    this.touch.x = point.x;
    this.touch.y = point.y;
    this.touch.active = kind !== "end";
    this.touch.started = kind === "start";
    this.touch.moved = kind === "move";
    this.touch.ended = kind === "end";
    event.preventDefault();
  }
}
