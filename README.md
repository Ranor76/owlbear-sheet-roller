# Owlbear Sheet Roller

Owlbear Sheet Roller is a small Owlbear Rodeo extension for an online D&D group.
It reads one character from a published Google Apps Script endpoint, rolls that
character's actions, and shares a short roll history with everyone in the room.

## The finish line

The project is **feature-frozen for the first usable release**. That release is
done when a player can:

1. paste and save an Apps Script URL;
2. verify that the URL returns character data;
3. load or refresh the character and see name, AC, HP, initiative, speed, and the
   primary weapon;
4. roll initiative, a primary-weapon attack, primary-weapon damage, or a generic
   ability supplied by the sheet;
5. show the result to other players and retain the 10 most recent rolls; and
6. deploy the extension and its character proxy to Netlify.

The current implementation covers the product behavior in steps 1–5.
Work before release should therefore be limited to deployment verification,
fixing release-blocking defects, and writing the minimum setup instructions a
player needs.

## Explicitly out of scope

Do not add these before the first release:

- character or campaign editing;
- multiple characters or character switching;
- spell, feature, inventory, or resource tracking;
- additional weapons or attack selection;
- advantage, disadvantage, critical-hit, or situational-modifier workflows;
- encounter automation or integration with Owlbear's built-in dice tray;
- support for sheet formats other than the existing JSON contract; or
- visual redesign beyond fixes required for legibility or use.

Capture ideas for later instead of implementing them. A feature may enter the
release only if the existing six-step finish line cannot work without it.

## Release checklist

- [x] Save an Apps Script endpoint locally.
- [x] Test the endpoint through the Netlify proxy.
- [x] Load and refresh the character summary.
- [x] Roll initiative.
- [x] Roll the primary weapon's attack and damage.
- [x] Roll sheet-defined generic abilities.
- [x] Share results and retain the 10 most recent room rolls.
- [x] Produce a production build with `npm run build`.
- [x] Document the expected Apps Script JSON payload with a copyable example.
- [ ] Verify the deployed extension inside Owlbear Rodeo.
- [ ] Tag the verified commit as the first usable release.

## Character data contract

The Apps Script endpoint should return JSON in this shape. `abilities` is a flat
list on purpose: version 1 does not need to understand whether an action is a
spell, skill, feature, or weapon.

```json
{
  "character": {
    "name": "Mira",
    "ac": 15,
    "hp": { "current": 22, "max": 28, "temp": 0 },
    "initiative": "+3",
    "speed": 30,
    "attributes": {
      "Strength": 10,
      "Dexterity": 16,
      "Constitution": 14,
      "Intelligence": 12,
      "Wisdom": 13,
      "Charisma": 8
    }
  },
  "attacks": [
    { "name": "Longbow", "attackBonus": "+5", "damage": "1d8+3", "equipped": true }
  ],
  "abilities": [
    { "name": "Stealth", "roll": "1d20+5" },
    { "name": "Second Wind", "roll": "1d10+2" }
  ]
}
```

Each object in `abilities` becomes a button. Its `roll` value supports standard
`NdS`, `NdS+M`, and `NdS-M` formulas such as `1d20`, `2d6+3`, or `1d8-1`.

## How shared rolls work

Rolls are written to Owlbear room metadata so the latest 10 results persist and
appear in every open copy of the extension. A broadcast message also triggers an
Owlbear notification for other players who currently have the extension open.
This stays within the supported extension SDK; it does not attempt to inject
messages into Owlbear's built-in dice tray.

## Local development

```sh
npm install
npm run dev
```

Create a production bundle with:

```sh
npm run build
```

The browser client is in `src/main.js`. The Netlify proxy is in
`netlify/functions/character.js`.

## Decision rule

Until the release checklist is complete, classify every proposed task as one of:

- **Blocker:** the finish line cannot be completed without it — do it now.
- **Defect:** an existing finish-line behavior is broken — fix it now.
- **Later:** everything else — record it and keep shipping.
