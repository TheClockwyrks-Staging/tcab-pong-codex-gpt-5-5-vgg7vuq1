import {
  BALL_R,
  FIELD_CX,
  FIELD_H,
  FIELD_W,
  MATCHOVER_ITEMS,
  NET_X,
  OBSTACLE_H,
  OBSTACLE_W,
  P1_X0,
  P2_X0,
  PADDLE_H,
  PADDLE_W,
  PAUSE_ITEMS,
  TITLE_ITEMS,
  TITLE_TEXT,
} from "./constants";
import type { CaromGame } from "./game";
import type { Snapshot } from "./types";

const colors = {
  bg: "#05070d",
  panel: "rgba(8, 14, 24, 0.72)",
  text: "#f4fbff",
  dim: "#88a0aa",
  p1: "#23d7ff",
  p2: "#ff4d7d",
  ball: "#f8ff66",
  obstacle: "#58f29a",
  net: "#325060",
  active: "#ffffff",
};

export class Renderer {
  diagnostics = false;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly game: CaromGame,
  ) {}

  draw(): void {
    const snapshot = this.game.createSnapshot();
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    this.drawField(snapshot);
    if (snapshot.screen === "title") this.drawTitle(snapshot);
    if (snapshot.screen === "howto") this.drawHowTo(snapshot);
    if (snapshot.screen === "paused") this.drawPause(snapshot);
    if (snapshot.screen === "matchover") this.drawMatchOver(snapshot);
    if (snapshot.screen === "countdown") this.drawCountdown(snapshot);
    if (this.diagnostics) this.drawDiagnostics(snapshot);
    ctx.restore();
  }

  private drawField(snapshot: Snapshot): void {
    const ctx = this.ctx;
    ctx.strokeStyle = "#102838";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, FIELD_W - 4, FIELD_H - 4);
    ctx.strokeStyle = colors.net;
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 18]);
    ctx.beginPath();
    ctx.moveTo(NET_X, 25);
    ctx.lineTo(NET_X, FIELD_H - 25);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const obstacle of snapshot.obstacles) {
      this.roundRect(
        obstacle.cx - OBSTACLE_W / 2,
        obstacle.cy - OBSTACLE_H / 2,
        OBSTACLE_W,
        OBSTACLE_H,
        10,
        colors.obstacle,
        "#baffd0",
      );
    }
    this.drawPaddle(P1_X0, snapshot.paddles.left.cy, colors.p1);
    this.drawPaddle(P2_X0, snapshot.paddles.right.cy, colors.p2);
    if (snapshot.ball) {
      this.drawTrail(snapshot);
      this.glowCircle(snapshot.ball.x, snapshot.ball.y, BALL_R, colors.ball);
    }

    if (
      snapshot.screen === "playing" ||
      snapshot.screen === "countdown" ||
      snapshot.screen === "paused" ||
      snapshot.screen === "matchover"
    ) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = colors.text;
      ctx.font = "700 54px system-ui, sans-serif";
      ctx.fillText(String(snapshot.score.p1), FIELD_CX - 110, 34);
      ctx.fillText(String(snapshot.score.p2), FIELD_CX + 110, 34);
      ctx.font = "700 18px system-ui, sans-serif";
      ctx.fillStyle = colors.dim;
      ctx.fillText(
        snapshot.mode === "solo" ? "SOLO DUEL" : "VERSUS DUEL",
        FIELD_CX,
        102,
      );
    }
  }

  private drawPaddle(x: number, cy: number, color: string): void {
    this.roundRect(x, cy - PADDLE_H / 2, PADDLE_W, PADDLE_H, 8, color, color);
  }

  private drawTrail(snapshot: Snapshot): void {
    const ball = snapshot.ball;
    if (!ball || ball.trail.length < 2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = BALL_R * 1.3;
    ctx.lineCap = "round";
    for (let i = 1; i < ball.trail.length; i += 1) {
      const a = ball.trail[i - 1];
      const b = ball.trail[i];
      const alpha = i / ball.trail.length;
      ctx.strokeStyle = `rgba(248, 255, 102, ${0.08 + alpha * 0.22})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTitle(snapshot: Snapshot): void {
    const ctx = this.ctx;
    this.veil(0.42);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.text;
    ctx.font = "900 104px system-ui, sans-serif";
    ctx.fillText(TITLE_TEXT, FIELD_CX, 205);
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.fillStyle = colors.dim;
    ctx.fillText("curve the rally, bank the shot", FIELD_CX, 282);
    TITLE_ITEMS.forEach((item, index) =>
      this.drawMenuItem(item, index, snapshot.menuIndex === index),
    );
  }

  private drawHowTo(snapshot: Snapshot): void {
    const ctx = this.ctx;
    this.veil(0.52);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = colors.text;
    ctx.font = "800 48px system-ui, sans-serif";
    ctx.fillText("HOW TO PLAY", FIELD_CX, 95);
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillStyle = "#cce5eb";
    const lines = [
      "W/S move the left paddle. Arrow keys move the right paddle in Versus.",
      "In Solo, either pair of movement keys controls the left paddle.",
      "Strike while moving to add spin; the ball keeps curving after contact.",
      "Use the center bars for bank shots. First to 11, win by 2.",
      "P or Escape pauses. M mutes.",
    ];
    lines.forEach((line, index) =>
      ctx.fillText(line, FIELD_CX, 185 + index * 45),
    );
    this.drawMenuItem("BACK", 0, snapshot.menuIndex === 0);
  }

  private drawPause(snapshot: Snapshot): void {
    this.veil(0.58);
    this.heading("PAUSED", 155);
    PAUSE_ITEMS.forEach((item, index) =>
      this.drawMenuItem(item, index, snapshot.menuIndex === index),
    );
  }

  private drawMatchOver(snapshot: Snapshot): void {
    this.veil(0.58);
    this.heading(`${snapshot.winner === "left" ? "LEFT" : "RIGHT"} WINS`, 130);
    const ctx = this.ctx;
    ctx.font = "700 34px system-ui, sans-serif";
    ctx.fillStyle = colors.text;
    ctx.textAlign = "center";
    ctx.fillText(`${snapshot.score.p1} - ${snapshot.score.p2}`, FIELD_CX, 210);
    MATCHOVER_ITEMS.forEach((item, index) =>
      this.drawMenuItem(item, index, snapshot.menuIndex === index),
    );
  }

  private drawCountdown(snapshot: Snapshot): void {
    const ctx = this.ctx;
    const value = Math.max(0, Math.ceil(snapshot.ball?.holdTimer ?? 0));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(244,251,255,0.92)";
    ctx.font = "900 78px system-ui, sans-serif";
    ctx.fillText(value === 0 ? "GO" : String(value), FIELD_CX, FIELD_H - 120);
  }

  private drawMenuItem(label: string, index: number, active: boolean): void {
    const rect = this.game.menuItemRect(index);
    if (!rect) return;
    this.roundRect(
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      8,
      active ? "#e9fbff" : "rgba(20,37,50,0.88)",
      active ? "#e9fbff" : "#31546a",
    );
    const ctx = this.ctx;
    ctx.fillStyle = active ? "#09121b" : colors.text;
    ctx.font = "800 25px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  }

  private drawDiagnostics(snapshot: Snapshot): void {
    const ctx = this.ctx;
    const ball = snapshot.ball;
    const rows = [
      `screen ${snapshot.screen}`,
      `mode ${snapshot.mode}`,
      `score ${snapshot.score.p1}-${snapshot.score.p2}`,
      ball
        ? `ball ${ball.x.toFixed(1)},${ball.y.toFixed(1)} v ${ball.vx.toFixed(1)},${ball.vy.toFixed(1)}`
        : "ball none",
      ball
        ? `speed ${ball.speed.toFixed(1)} spin ${ball.spin.toFixed(1)}`
        : "speed n/a",
      `left cy ${snapshot.paddles.left.cy.toFixed(1)} vy ${snapshot.paddles.left.vy.toFixed(1)}`,
      `right cy ${snapshot.paddles.right.cy.toFixed(1)} vy ${snapshot.paddles.right.vy.toFixed(1)}`,
    ];
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(14, 14, 430, rows.length * 24 + 18);
    ctx.fillStyle = "#bff8ff";
    ctx.font = "16px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    rows.forEach((row, index) => ctx.fillText(row, 25, 25 + index * 24));
  }

  private heading(text: string, y: number): void {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.text;
    ctx.font = "900 58px system-ui, sans-serif";
    ctx.fillText(text, FIELD_CX, y);
  }

  private veil(alpha: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(5, 7, 13, ${alpha})`;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }

  private glowCircle(x: number, y: number, r: number, color: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    stroke: string,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = fill;
    ctx.shadowBlur = 14;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
