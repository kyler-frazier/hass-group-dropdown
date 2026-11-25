/**
 * Group Dropdown for Home Assistant
 * A tile with a caret that opens a list of the group's members, pushing down the cards below.
 */

const VERSION = "0.0.0";

(() => {
  if (customElements.get("group-dropdown-tile")) return; // e.g. added as a resource twice

  const EVENT = "group-dropdown";
  const helpers = window.loadCardHelpers();

  class GroupDropdownTile extends HTMLElement {
    setConfig(config) {
      if (!config.entity) throw new Error("entity is required");
      this._config = config;
      this._open = false;
      this._built = this._build();
    }

    async _build() {
      const config = this._config;
      const { createCardElement } = await helpers;
      if (config !== this._config) return;
      const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      root.innerHTML = `
        <style>
          :host { display: block; position: relative; height: 100%; }
          hui-tile-card { display: block; height: 100%; }
          button {
            position: absolute; inset-block: 0; inset-inline-end: 0; margin-block: auto;
            width: 48px; height: min(48px, 100%); padding: 0; border: 0; background: none;
            color: var(--secondary-text-color); cursor: pointer; border-radius: 24px;
            -webkit-tap-highlight-color: transparent; touch-action: manipulation;
          }
          button:focus-visible { outline: 2px solid var(--primary-color); }
          ha-icon { display: block; transition: rotate 200ms ease; }
          button[aria-expanded="true"] ha-icon { rotate: 180deg; }
          @media (prefers-reduced-motion) { ha-icon { transition: none; } }
        </style>
        <button type="button" aria-expanded="false" aria-label="Show group members">
          <ha-icon icon="mdi:chevron-down"></ha-icon>
        </button>`;
      this._tile = createCardElement({ ...config, type: "tile" });
      this._tile.hass = this._hass;
      root.prepend(this._tile);
      this._button = root.querySelector("button");
      this._button.addEventListener("click", () => this._toggle(!this._open));
      await this._tile.updateComplete;
      // Keeps the name clear of the caret; the tile has no option for it
      const style = document.createElement("style");
      style.textContent = "ha-card { padding-inline-end: 40px; box-sizing: border-box; }";
      this._tile.shadowRoot?.append(style);
    }

    set hass(hass) {
      this._hass = hass;
      if (this._tile) this._tile.hass = hass;
    }

    // The tile and its list share a root (the section), so cards in other views aren't affected
    _toggle(open) {
      const ev = new CustomEvent(EVENT, {
        detail: { entity: this._config.entity, open },
        cancelable: true,
      });
      if (this.getRootNode().dispatchEvent(ev))
        throw new Error(`No group-dropdown-list for ${this._config.entity} in this section`);
      this._open = open;
      this._button.setAttribute("aria-expanded", open);
    }

    // So a dashboard always starts compact when it's opened again
    disconnectedCallback() {
      this._open = false;
      this._button?.setAttribute("aria-expanded", false);
    }

    getCardSize() {
      return 1;
    }

    getGridOptions() {
      return { columns: 6, rows: 1, min_columns: 6, min_rows: 1 };
    }
  }

  class GroupDropdownList extends HTMLElement {
    // Home Assistant takes hidden cards out of the page unless they ask to stay
    connectedWhileHidden = true;

    constructor() {
      super();
      this.attachShadow({ mode: "open" }).innerHTML = `
        <style>
          :host {
            display: grid; grid-template: 1fr / minmax(0, 1fr); padding-inline-start: 16px;
          }
          :host([hidden]) { display: none; }
          /* dense: the tile after an open nested list fills the gap beside its group */
          .rows {
            min-height: 0; overflow: hidden;
            display: grid; grid-auto-flow: row dense; gap: var(--row-gap, 8px);
            grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
          }
          .rows > :not(group-dropdown-list) { min-height: 56px; }
          .rows > group-dropdown-list { grid-column: 1 / -1; }
        </style>
        <div class="rows"></div>`;
      this._rows = this.shadowRoot.querySelector(".rows");
      // Grid rows rather than height: Home Assistant shows the card around this one a moment later,
      // so there's no height to measure yet
      this._animation = this.animate(
        { gridTemplateRows: ["0fr", "1fr"], opacity: [0, 1] },
        { easing: "ease-out" },
      );
      this._animation.cancel();
      this._animation.onfinish = () => this._setHidden(!this._open && !this._preview);
      this._onToggle = (ev) => {
        if (ev.detail.entity !== this._config.entity) return;
        ev.preventDefault();
        this._show(ev.detail.open);
      };
    }

    setConfig(config) {
      if (!config.entity) throw new Error("entity is required");
      const { columns = 2 } = config;
      if (!Number.isInteger(columns) || columns < 1)
        throw new Error("columns must be a whole number, 1 or more");
      this._config = config;
      this._columns = columns;
      this._rows.style.setProperty("--columns", columns);
      this._members = undefined;
      this.hidden = !this._open && !this._preview;
      this._update();
    }

    set hass(hass) {
      this._hass = hass;
      this._update();
    }

    set preview(preview) {
      this._preview = preview;
      this._setHidden(!preview && !this._open);
      this._update();
    }

    connectedCallback() {
      this._root = this.getRootNode();
      this._root.addEventListener(EVENT, this._onToggle);
    }

    disconnectedCallback() {
      this._root.removeEventListener(EVENT, this._onToggle);
      this._animation.cancel();
      this._open = false;
      this._setHidden(!this._preview);
    }

    _setHidden(hidden) {
      if (this.hidden === hidden) return;
      this.hidden = hidden;
      this.dispatchEvent(new Event("card-visibility-changed", { bubbles: true, composed: true }));
    }

    async _show(open) {
      this._open = open;
      await this._update();
      if (this._open !== open || !this.isConnected) return;
      if (!open && this.hidden) return; // closed again before it was built
      this._setHidden(false);
      const still = matchMedia("(prefers-reduced-motion)").matches;
      this._animation.effect.updateTiming({ duration: still ? 0 : 250 });
      this._animation.playbackRate = open ? 1 : -1; // turns around from where it is
      this._animation.play();
    }

    async _update() {
      if (!this._hass || !this._config || !(this._open || this._preview)) return;
      const members = this._hass.states[this._config.entity]?.attributes.entity_id ?? [];
      if (String(members) !== this._members) {
        this._members = String(members);
        const { createCardElement } = await helpers;
        if (String(members) !== this._members) return;
        this._rows.replaceChildren(...members.flatMap((id) => this._row(createCardElement, id)));
        if (!members.length) this._rows.textContent = "No group members available";
      }
      for (const row of this._rows.children) row.hass = this._hass;
    }

    _row(createCardElement, entity) {
      const toggles = this._hass.services[entity.split(".")[0]]?.toggle;
      const config = {
        type: "tile",
        entity,
        tap_action: { action: toggles ? "toggle" : "more-info" },
        hold_action: { action: "more-info" },
      };
      if (!Array.isArray(this._hass.states[entity]?.attributes.entity_id))
        return [createCardElement(config)];
      return [
        createCardElement({ ...config, type: "custom:group-dropdown-tile" }),
        createCardElement({
          type: "custom:group-dropdown-list",
          entity,
          columns: this._columns,
        }),
      ];
    }

    getCardSize() {
      return 0;
    }

    getGridOptions() {
      return { columns: "full", rows: "auto" };
    }
  }

  customElements.define("group-dropdown-tile", GroupDropdownTile);
  customElements.define("group-dropdown-list", GroupDropdownList);

  console.info(`%c GROUP-DROPDOWN %c ${VERSION} `, "color: #fff; background: #03a9f4;", "");
})();
