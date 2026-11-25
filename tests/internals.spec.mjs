// The Home Assistant internals the plugin relies on, checked one by one, so a frontend change
// that breaks it fails here with a message naming what changed instead of as a timeout elsewhere.
import { expect, test } from "@playwright/test";
import { list, openDashboard, tile } from "./helpers/ha.mjs";

const changed = (what) => `Home Assistant changed: ${what}`;

test.beforeEach(async ({ page }) => openDashboard(page));

test("card helpers create tiles", async ({ page }) => {
  const name = await page.evaluate(async () => {
    const helpers = await window.loadCardHelpers?.();
    return helpers?.createCardElement?.({ type: "tile", entity: "light.desk_light" }).localName;
  });
  expect(name, changed("loadCardHelpers().createCardElement makes no hui-tile-card")).toBe(
    "hui-tile-card",
  );
});

test("a tile's ha-card is in its shadow root", async ({ page }) => {
  const found = await tile(page, "light.living_room_lights")
    .locator("hui-tile-card")
    .evaluate((card) => !!card.shadowRoot?.querySelector("ha-card"));
  expect(found, changed("hui-tile-card has no ha-card in its shadow root")).toBe(true);
});

test("groups list their members in entity_id", async ({ page }) => {
  const members = await page.evaluate(
    () =>
      document.querySelector("home-assistant").hass.states["light.living_room_lights"].attributes
        .entity_id,
  );
  expect(members, changed("groups have no entity_id attribute")).toEqual([
    "light.lamp_light",
    "light.fan_light",
  ]);
});

test("hidden cards stay connected, and card-visibility-changed shows them", async ({ page }) => {
  const card = list(page, "light.living_room_lights");
  const hostHidden = () => card.evaluate((el) => el.parentElement.hidden);
  expect(
    await card.evaluate((el) => el.isConnected && el.parentElement.localName),
    changed("connectedWhileHidden no longer keeps a hidden card in its hui-card"),
  ).toBe("hui-card");
  expect(await hostHidden(), changed("a hui-card isn't hidden with its card")).toBe(true);
  await card.evaluate((el) => {
    el.hidden = false;
    el.dispatchEvent(new Event("card-visibility-changed", { bubbles: true, composed: true }));
  });
  await expect
    .poll(hostHidden, { message: changed("card-visibility-changed no longer shows a card") })
    .toBe(false);
});
