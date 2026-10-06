# Carom

Carom is a top-down browser paddle duel. Two paddles trade a glowing ball across
a dark field, bending rallies with paddle-driven spin and banking shots around
the fixed center obstacles. It runs entirely in the browser with canvas-rendered
graphics and synthesized audio.

## Install

```sh
npm ci
```

## Development

```sh
npm run dev
```

Vite serves the game with hot reload. Open the printed local URL in a browser.

## Production Build

```sh
npm run build
```

The static site is emitted to `dist/` and can be served from the root of any
static file server.

## Controls

- Left paddle: `W` and `S`
- Right paddle in Versus: `ArrowUp` and `ArrowDown`
- Solo mode: either movement pair controls the left paddle
- Menus: `W`/`S` or arrow keys, then `Enter` or `Space`
- Pause or resume: `P` or `Escape`
- Back from menus: `Escape`
- Mute: `M`
- Diagnostics overlay: backtick

## Checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```
