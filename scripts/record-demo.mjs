// Records the README demo as PNG frames, deterministically: timers, animation frames and
// Web Animations are all stepped one frame at a time, so slow machines still record smoothly.
//
//   npm run hass:up
//   node scripts/record-demo.mjs out   # needs test-results/.auth.json (run `npm test` once)
//   ffmpeg -framerate 30 -i out/%03d.png -vf \
//     "fps=30,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=none" docs/demo.gif
import { chromium, devices } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const base = process.env.HASS_URL || "http://localhost:8123";
const out = process.argv[2] || "demo-frames";
const FRAME_MS = 1000 / 30;

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["Pixel 7"],
  viewport: { width: 412, height: 480 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  // Home Assistant reloads the page when its service worker first takes control
  serviceWorkers: "block",
  storageState: JSON.parse(await readFile("test-results/.auth.json", "utf8")),
});
const page = await context.newPage();
await page.goto(`${base}/demo-home/home`);
const carets = page.locator("hui-card > group-dropdown-tile button");
await carets.nth(1).waitFor();
await page.waitForTimeout(2000);

await page.clock.install();
await page.clock.pauseAt(Date.now() + 1000); // installed clocks keep running unless paused
await page.evaluate(() => {
  const times = new WeakMap();
  window.__stepAnimations = (ms) => {
    for (const a of document.getAnimations()) {
      const end = a.effect.getComputedTiming().endTime;
      const rate = a.playbackRate;
      const time = (times.get(a) ?? (rate < 0 ? end + ms : -ms)) + ms * rate;
      times.set(a, Math.min(Math.max(time, 0), end));
      a.pause();
      a.currentTime = times.get(a);
      if (rate < 0 ? time <= 0 : time >= end) a.finish(); // paused ones never do
    }
  };
  const dot = document.createElement("div");
  dot.style.cssText = `position:fixed;z-index:20;width:44px;height:44px;margin:-22px;
    border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.6);
    pointer-events:none;display:none`;
  document.body.append(dot);
  window.__finger = (x, y) => {
    dot.style.display = x == null ? "none" : "";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
  };
});

const cdp = await context.newCDPSession(page);
let n = 0;
let finger = [null, null];
const frame = async () => {
  await page.evaluate(([x, y]) => window.__finger(x, y), finger);
  await page.clock.runFor(FRAME_MS);
  await page.evaluate((ms) => window.__stepAnimations(ms), FRAME_MS);
  await page.waitForTimeout(40); // let the browser draw
  await page.screenshot({ path: `${out}/${String(n++).padStart(3, "0")}.png` });
};
const frames = async (count) => {
  for (let i = 0; i < count; i++) await frame();
};
const tap = async (locator, across) => {
  const box = await locator.boundingBox();
  const x = box.x + box.width * across;
  const y = box.y + box.height / 2;
  finger = [x, y];
  await frames(5);
  // Down and up without a frame between, so a slow machine doesn't turn the tap into a hold
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await frames(3);
  finger = [null, null];
};

const list = page.locator("hui-card > group-dropdown-list").first();
await frames(15);
await tap(carets.nth(0), 0.5); // open the living room
await frames(22);
await tap(list.locator("hui-tile-card").nth(1), 0.6); // toggle the reading lamp
await frames(22);
await tap(carets.nth(1), 0.5); // open the kitchen too
await frames(28);
await tap(carets.nth(1), 0.5);
await frames(12);
await tap(carets.nth(0), 0.5);
await frames(20);

await browser.close();
console.log(`${n} frames in ${out}/`);
