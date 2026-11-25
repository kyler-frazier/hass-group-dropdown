import { expect, test } from "@playwright/test";
import {
  caret,
  hold,
  list,
  moreInfo,
  openDashboard,
  rows,
  setBoolean,
  state,
  stays,
  tap,
  tile,
} from "./helpers/ha.mjs";

const LIVING = "light.living_room_lights";
const ALL = "light.all_lights";

test.beforeEach(async ({ page }) => openDashboard(page));

const open = async (page, entity) => {
  await caret(page, entity).tap();
  await expect(list(page, entity)).toBeVisible();
};

test("the caret opens and closes the list without toggling the group", async ({ page }) => {
  await open(page, LIVING);
  await expect(caret(page, LIVING)).toHaveAttribute("aria-expanded", "true");
  await expect(rows(list(page, LIVING))).toHaveText([/Lamp light/, /Fan light/]);
  await caret(page, LIVING).tap();
  await expect(list(page, LIVING)).toBeHidden();
  await expect(caret(page, LIVING)).toHaveAttribute("aria-expanded", "false");
  await stays(() => state(page, LIVING), "off");
  expect(await moreInfo(page)).toBe(null);
});

test("the caret has a 48px touch area, clear of the name", async ({ page }) => {
  const button = await caret(page, LIVING).boundingBox();
  expect([button.width, button.height]).toEqual([48, 48]);
  const name = await tile(page, LIVING).getByText("Living room lights").boundingBox();
  expect(name.x + name.width).toBeLessThanOrEqual(button.x + 12); // the icon is inset by 12
});

test("the rest of the tile still toggles on tap and opens details on hold", async ({ page }) => {
  await tap(tile(page, LIVING));
  await expect.poll(() => state(page, LIVING)).toBe("on");
  await expect(list(page, LIVING)).toBeHidden();
  await hold(page, tile(page, LIVING));
  await expect.poll(() => moreInfo(page)).toBe(LIVING);
  expect(await state(page, LIVING)).toBe("on");
});

test("the list is full width under the row, and pushes down only what's below", async ({
  page,
}) => {
  const box = (locator) => locator.boundingBox();
  const neighbour = page.locator("hui-card > hui-tile-card").first();
  const [tileBefore, neighbourBefore, allBefore] = [
    await box(tile(page, LIVING)),
    await box(neighbour),
    await box(tile(page, ALL)),
  ];
  // Closed, the list leaves no gap: only the grid's own 8px
  expect(allBefore.y - (tileBefore.y + tileBefore.height)).toBe(8);

  await open(page, LIVING);
  // One 56px row of two, and the grid's 8px
  await expect.poll(async () => (await box(tile(page, ALL))).y - allBefore.y).toBe(64);
  expect(await box(tile(page, LIVING))).toEqual(tileBefore);
  expect(await box(neighbour)).toEqual(neighbourBefore);
  const opened = await box(list(page, LIVING));
  expect(opened.width).toBe(neighbourBefore.x + neighbourBefore.width - tileBefore.x);
  expect(opened.y).toBe(allBefore.y);

  await caret(page, LIVING).tap();
  await expect.poll(async () => (await box(tile(page, ALL))).y).toBe(allBefore.y);
});

test("columns sets how many tiles are side by side, 2 by default", async ({ page }) => {
  await open(page, LIVING);
  const boxes = () => Promise.all([0, 1].map((i) => rows(list(page, LIVING)).nth(i).boundingBox()));
  const expectSideBySide = async () => {
    await expect
      .poll(async () => {
        const [a, b] = await boxes();
        return [b.y - a.y, Math.round(b.x - (a.x + a.width)), Math.round(b.width - a.width)];
      })
      .toEqual([0, 8, 0]);
  };
  await expectSideBySide();

  const setColumns = (columns) =>
    list(page, LIVING).evaluate((el, columns) => {
      el.setConfig({ type: "custom:group-dropdown-list", entity: el._config.entity, columns });
    }, columns);
  await setColumns(1);
  await expect
    .poll(async () => {
      const [a, b] = await boxes();
      return [b.y - a.y, b.x - a.x];
    })
    .toEqual([64, 0]);
  for (const bad of [0, 1.5, "2"])
    await expect(setColumns(bad)).rejects.toThrow("columns must be a whole number");
});

test("an open nested list spans the columns, and leaves no gap beside its group", async ({
  page,
}) => {
  await open(page, ALL);
  const outer = list(page, ALL);
  const [living, kitchen] = [0, 1].map((i) => outer.locator("group-dropdown-tile").nth(i));
  await living.locator("button").tap();
  const inner = outer.locator("group-dropdown-list").first();
  await expect(inner).toBeVisible();
  const [l, k] = [await living.boundingBox(), await kitchen.boundingBox()];
  expect(k.y).toBe(l.y);
  expect(k.x).toBeGreaterThan(l.x);
  await expect
    .poll(async () => {
      const b = await inner.boundingBox();
      return [b.x, b.x + b.width, b.y];
    })
    .toEqual([l.x, k.x + k.width, l.y + l.height + 8]);
  // Columns are inherited
  await outer.evaluate((el) => el.setConfig({ ...el._config, columns: 1 }));
  await outer.locator("group-dropdown-tile button").first().tap();
  const [a, b] = [rows(inner).nth(0), rows(inner).nth(1)];
  await expect(b).toBeVisible();
  expect((await b.boundingBox()).x).toBe((await a.boundingBox()).x);
});

test("several lists stay open at once", async ({ page }) => {
  await open(page, LIVING);
  await open(page, ALL);
  await expect(list(page, LIVING)).toBeVisible();
});

test("rows toggle on tap and open details on hold", async ({ page }) => {
  await open(page, LIVING);
  const lamp = rows(list(page, LIVING)).first();
  await tap(lamp);
  await expect.poll(() => state(page, "light.lamp_light")).toBe("on");
  expect(await state(page, "light.fan_light")).toBe("off");
  await hold(page, lamp);
  await expect.poll(() => moreInfo(page)).toBe("light.lamp_light");
});

test("rows follow their entity's state", async ({ page }) => {
  await open(page, LIVING);
  const lamp = rows(list(page, LIVING)).first();
  await expect(lamp).toContainText("Off");
  await setBoolean(page, "input_boolean.lamp", true);
  await expect(lamp).toContainText("On");
});

test("the list follows the group's members", async ({ page }) => {
  await open(page, LIVING);
  await page.evaluate((id) => {
    const list = (function find(root) {
      for (const el of root.querySelectorAll("*")) {
        if (el.localName === "group-dropdown-list") return el;
        const found = el.shadowRoot && find(el.shadowRoot);
        if (found) return found;
      }
    })(document);
    const { hass } = document.querySelector("home-assistant");
    const group = hass.states[id];
    const attributes = { ...group.attributes, entity_id: ["light.desk_light"] };
    list.hass = { ...hass, states: { ...hass.states, [id]: { ...group, attributes } } };
  }, LIVING);
  await expect(rows(list(page, LIVING))).toHaveText([/Desk light/]);
});

test("a group in a list has its own caret", async ({ page }) => {
  await open(page, ALL);
  const outer = list(page, ALL);
  await expect(rows(outer)).toHaveText([/Living room lights/, /Kitchen lights/]);
  await outer.locator("group-dropdown-tile button").first().tap();
  const inner = outer.locator("group-dropdown-list").first();
  await expect(inner).toBeVisible();
  await expect(rows(inner)).toHaveText([/Lamp light/, /Fan light/]);
  // The dashboard's own list of the same group is another one
  await expect(list(page, LIVING)).toBeHidden();
  await outer.locator("group-dropdown-tile button").first().tap();
  await expect(inner).toBeHidden();
  await expect(outer).toBeVisible();
});

test("tapping again mid-animation ends up closed", async ({ page }) => {
  await caret(page, LIVING).evaluate((button) => {
    button.click();
    setTimeout(() => button.click(), 100);
  });
  await expect(caret(page, LIVING)).toHaveAttribute("aria-expanded", "false");
  await expect(list(page, LIVING)).toBeHidden();
  await stays(() => list(page, LIVING).isHidden(), true);
});

/** Taps a caret and returns the list's [height, opacity] in each frame until it's done. */
const frames = (page, entity, again) =>
  list(page, entity).evaluate(async (el, again) => {
    const button = [...el.getRootNode().querySelectorAll("group-dropdown-tile")]
      .find((t) => t._config.entity === el._config.entity)
      .shadowRoot.querySelector("button");
    const result = [];
    button.click();
    const start = performance.now();
    let turned;
    while (performance.now() - start < 1000) {
      await new Promise(requestAnimationFrame);
      result.push([el.offsetHeight, Number(getComputedStyle(el).opacity)]);
      if (again && !turned && el.offsetHeight > 10 && el.offsetHeight < 50) {
        turned = result.length;
        button.click();
      }
    }
    return again ? result.slice(turned - 1) : result;
  }, again);

for (const entity of [LIVING, ALL]) {
  test(`a list slides and fades both ways (${entity})`, async ({ page }) => {
    const midway = (seen) => seen.filter(([h, o]) => h > 0 && h < 56 && o > 0 && o < 1);
    const heights = (seen) => seen.map(([h]) => h);
    const opening = await frames(page, entity);
    expect(midway(opening).length).toBeGreaterThan(3);
    expect(heights(opening)).toEqual(heights(opening).sort((a, b) => a - b));
    expect(opening.at(-1)).toEqual([56, 1]);
    const closing = await frames(page, entity);
    expect(midway(closing).length).toBeGreaterThan(3);
    expect(heights(closing)).toEqual(heights(closing).sort((a, b) => b - a));
    expect(closing.at(-1)[0]).toBe(0);
  });
}

test("a half-open list can't be scrolled, so its tiles don't shift", async ({ page }) => {
  await open(page, LIVING);
  const scrolled = await list(page, LIVING).evaluate((el) => {
    const rows = el.shadowRoot.querySelector(".rows");
    rows.style.height = "20px";
    rows.scrollTop = 10;
    return [rows.clientHeight < rows.scrollHeight, rows.scrollTop];
  });
  expect(scrolled).toEqual([true, 0]);
});

test("tapping midway turns the animation around without a jump", async ({ page }) => {
  const seen = (await frames(page, LIVING, true)).map(([h]) => h);
  expect(Math.max(...seen)).toBeLessThan(56);
  expect(seen.at(-1)).toBe(0);
});

test("a list is closed again after leaving the view", async ({ page }) => {
  await open(page, LIVING);
  const path = (path) =>
    page.evaluate((path) => {
      history.pushState(null, "", path);
      window.dispatchEvent(new CustomEvent("location-changed"));
    }, path);
  await path("/test-sections/other");
  await expect(page.getByText("Other view")).toBeVisible();
  await path("/test-sections/home");
  await expect(tile(page, LIVING)).toBeVisible();
  await expect(list(page, LIVING)).toBeHidden();
  await expect(caret(page, LIVING)).toHaveAttribute("aria-expanded", "false");
  await open(page, LIVING);
});

test("a tile without its list reports an error", async ({ page }) => {
  const error = page.waitForEvent("pageerror", (e) => e.message.includes("No group-dropdown-list"));
  await list(page, LIVING).evaluate((el) => el.remove());
  await caret(page, LIVING).tap();
  expect((await error).message).toContain(LIVING);
  await expect(caret(page, LIVING)).toHaveAttribute("aria-expanded", "false");
});
