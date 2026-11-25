# Group Dropdown for Home Assistant

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![Tests](https://github.com/kyler-frazier/hass-group-dropdown/actions/workflows/tests.yml/badge.svg)](https://github.com/kyler-frazier/hass-group-dropdown/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A tile with a caret that drops down the group's members, pushing down the cards below.

- **The caret only opens and closes the list.** The rest of the tile keeps its tap and hold
  actions.
- **Members are normal tiles.** Tap to toggle, hold for details. They're read from the group, so
  there's nothing to keep in sync. Groups inside groups get a caret of their own.
- **Full width under half-width tiles.** The list is a card of its own, so tiles next to the
  group's stay put.
- **No space taken while closed,** and lists close when you leave the view.

## Installation

In HACS, open the menu (⋮) → **Custom repositories**, add
`https://github.com/kyler-frazier/hass-group-dropdown` with the type **Dashboard**, then download
**Group Dropdown** and reload. Or put `group-dropdown.js` from the
[latest release](https://github.com/kyler-frazier/hass-group-dropdown/releases/latest) in
`config/www/` and add `/local/group-dropdown.js` as a **JavaScript module** resource.

## Usage

Needs a sections view. Put the tile where you want it, and the list, with the same entity, after
the last card of its row, in the same section:

```yaml
- type: custom:group-dropdown-tile
  entity: light.living_room_lights
  tap_action:
    action: toggle
  hold_action:
    action: more-info
- type: tile
  entity: light.desk
- type: custom:group-dropdown-list
  entity: light.living_room_lights
```

`group-dropdown-tile` takes every option of Home Assistant's
[tile card](https://www.home-assistant.io/dashboards/tile/). `group-dropdown-list` only takes
`entity`. It works with any entity that lists its members in an `entity_id` attribute, like light,
switch and cover groups.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
