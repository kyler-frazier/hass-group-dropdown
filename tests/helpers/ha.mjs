import { expect } from "@playwright/test";

export async function openDashboard(page, path = "/test-sections/home") {
  await page.goto(path);
  await page.locator("group-dropdown-tile button").first().waitFor();
  // The tiles' names, once they've loaded and have room made for the caret
  await expect(tile(page, "light.living_room_lights")).toContainText("Living room lights");
  for (const id of ["lamp", "fan", "desk"]) await setBoolean(page, `input_boolean.${id}`, false);
}

// Cards on the dashboard itself, not rows in a list
const cards = { "light.living_room_lights": 0, "light.all_lights": 1 };
export const tile = (page, entity) =>
  page.locator("hui-card > group-dropdown-tile").nth(cards[entity]);
export const caret = (page, entity) => tile(page, entity).locator("button");
export const list = (page, entity) =>
  page.locator("hui-card > group-dropdown-list").nth(cards[entity]);
/** A list's own rows, without those of lists nested in it. */
export const rows = (list) =>
  list.locator(".rows").first().locator("> hui-tile-card, > group-dropdown-tile");

export const moreInfo = (page) =>
  page.evaluate(() => {
    const d = document
      .querySelector("home-assistant")
      .shadowRoot.querySelector("ha-more-info-dialog");
    return d?._open ? d._entityId : null;
  });

/** Presses the body of a tile (away from its icon, which has its own action) for a while. */
export async function hold(page, card) {
  const { x, y, width, height } = await card.boundingBox();
  await page.mouse.move(x + width * 0.6, y + height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700); // HA's hold time is 500
  await page.mouse.up();
}

export async function tap(card) {
  const { width, height } = await card.boundingBox();
  await card.tap({ position: { x: width * 0.6, y: height / 2 } });
}

export const state = (page, id) =>
  page.evaluate((id) => document.querySelector("home-assistant").hass.states[id].state, id);

export async function setBoolean(page, id, on) {
  await page.evaluate(
    ([id, service]) =>
      document
        .querySelector("home-assistant")
        .hass.callService("input_boolean", service, { entity_id: id }),
    [id, on ? "turn_on" : "turn_off"],
  );
  await expect.poll(() => state(page, id)).toBe(on ? "on" : "off");
}

/** Checks that `get()` keeps returning `value` for a while, for what shouldn't happen. */
export async function stays(get, value, ms = 1000) {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 100)))
    expect(await get()).toBe(value);
}
