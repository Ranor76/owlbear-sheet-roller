import OBR from "@owlbear-rodeo/sdk";
import "./style.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <h2>Google Sheet Roller v2 DIRECT</h2>

  <label for="script-url">Apps Script URL</label>
  <input id="script-url" type="text" placeholder="Paste your Apps Script URL here" />

  <button id="save-url">Save URL</button>
  <button id="test-connection">Test Connection</button>
  <button id="load-data">Load Character</button>
  <button id="refresh-data">Refresh Character</button>
  <button id="roll-init">Roll Initiative</button>
  <button id="weapon-attack">Weapon Attack</button>
  <button id="weapon-damage">Weapon Damage</button>

  <p id="saved-url-display"></p>
  <div id="character-info"></div>
  <div id="ability-actions"></div>
  <div id="result"></div>
  <section aria-labelledby="roll-log-title">
    <h3 id="roll-log-title">Shared roll log</h3>
    <ol id="roll-log"><li>No rolls yet.</li></ol>
  </section>
`;

const result = document.getElementById("result");
const scriptUrlInput = document.getElementById("script-url");
const characterInfo = document.getElementById("character-info");
const savedUrlDisplay = document.getElementById("saved-url-display");
const abilityActions = document.getElementById("ability-actions");
const rollLog = document.getElementById("roll-log");

const ROLL_CHANNEL = "com.owlbear-sheet-roller/roll";
const ROLL_LOG_KEY = "com.owlbear-sheet-roller/rolls";
const MAX_ROLLS = 10;

let characterData = null;

function getSavedScriptUrl() {
  return localStorage.getItem("sheet_roller_script_url") || "";
}

function saveScriptUrl(url) {
  localStorage.setItem("sheet_roller_script_url", url);
}

scriptUrlInput.value = getSavedScriptUrl();
savedUrlDisplay.textContent = `Saved URL: ${getSavedScriptUrl() || "(none)"}`;

async function getCharacter() {
  const source = getSavedScriptUrl();

  if (!source) {
    throw new Error("No Apps Script URL saved");
  }

  const proxyBase = "https://owlbear-sheet-roller.netlify.app/.netlify/functions/character";
  const proxyUrl = `${proxyBase}?source=${encodeURIComponent(source)}`;

  const response = await fetch(proxyUrl, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Proxy error: ${response.status} ${text}`);
  }

  return await response.json();
}

function parseBonus(value) {
  if (value === null || value === undefined || value === "") return 0;
  return Number(String(value).replace(/\s+/g, "").replace(/^\+/, "")) || 0;
}

function rollDice(formula) {
  const clean = String(formula).replace(/\s+/g, "");
  const match = clean.match(/^(\d+)d(\d+)([+-]\d+)?$/i);

  if (!match) {
    throw new Error(`Invalid dice formula: ${formula}`);
  }

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const mod = match[3] ? parseInt(match[3], 10) : 0;

  let total = 0;
  const rolls = [];

  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    total += roll;
  }

  total += mod;

  return { formula: clean, rolls, mod, total };
}

function getPrimaryAttack(data) {
  if (!data?.attacks || !Array.isArray(data.attacks) || data.attacks.length === 0) {
    return null;
  }

  const equipped = data.attacks.find(a => a.equipped);
  return equipped || data.attacks[0];
}

function getAbilities(data) {
  if (!Array.isArray(data?.abilities)) return [];

  return data.abilities.filter(
    ability => ability && ability.name && (ability.roll || ability.dice)
  );
}

function formatModifier(value) {
  const modifier = parseBonus(value);
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

function renderRollLog(rolls) {
  rollLog.replaceChildren();

  if (!Array.isArray(rolls) || rolls.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No rolls yet.";
    rollLog.append(empty);
    return;
  }

  for (const roll of rolls) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = `${roll.character}: ${roll.label}`;
    const detail = document.createElement("span");
    detail.textContent = ` ${roll.detail} = ${roll.total} — ${roll.player}`;
    item.append(title, detail);
    rollLog.append(item);
  }
}

async function publishRoll({ character, label, detail, total }) {
  const player = await OBR.player.getName();
  const roll = {
    id: `${Date.now()}-${OBR.player.id}`,
    character,
    label,
    detail,
    total,
    player,
    createdAt: new Date().toISOString()
  };
  const metadata = await OBR.room.getMetadata();
  const existing = Array.isArray(metadata[ROLL_LOG_KEY]) ? metadata[ROLL_LOG_KEY] : [];
  const rolls = [roll, ...existing].slice(0, MAX_ROLLS);

  await OBR.room.setMetadata({ [ROLL_LOG_KEY]: rolls });
  await OBR.broadcast.sendMessage(ROLL_CHANNEL, roll, { destination: "REMOTE" });
  renderRollLog(rolls);
}

function renderAbilities(data) {
  abilityActions.replaceChildren();
  const abilities = getAbilities(data);
  if (abilities.length === 0) return;

  const heading = document.createElement("h3");
  heading.textContent = "Abilities";
  abilityActions.append(heading);

  for (const ability of abilities) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = ability.name;
    button.onclick = () => rollAbility(ability);
    abilityActions.append(button);
  }
}

function renderCharacter(data) {
  const c = data.character || {};
  const firstAttack = getPrimaryAttack(data);
  const attributes = c.attributes && typeof c.attributes === "object" ? c.attributes : {};

  characterInfo.innerHTML = `
    <p><strong>${c.name || "Unknown Character"}</strong></p>
    <p>AC: ${c.ac ?? "?"}</p>
    <p>HP: ${c.hp?.current ?? "?"} / ${c.hp?.max ?? "?"}</p>
    <p>Temp HP: ${c.hp?.temp ?? 0}</p>
    <p>Initiative: ${c.initiative ?? "?"}</p>
    <p>Speed: ${c.speed ?? "?"}</p>
    <div id="character-attributes"></div>
    <p>Weapon: ${firstAttack ? firstAttack.name : "None"}</p>
    <p>Attack Bonus: ${firstAttack ? firstAttack.attackBonus : "-"}</p>
    <p>Damage: ${firstAttack ? firstAttack.damage : "-"}</p>
  `;
  const attributeList = document.getElementById("character-attributes");
  for (const [name, value] of Object.entries(attributes)) {
    const stat = document.createElement("p");
    stat.textContent = `${name}: ${value}`;
    attributeList.append(stat);
  }
  renderAbilities(data);
}

function requireCharacter() {
  if (!characterData) {
    throw new Error("No character loaded. Click Load Character first.");
  }
  return characterData;
}

async function rollAbility(ability) {
  try {
    const data = requireCharacter();
    const c = data.character || {};
    const rolled = rollDice(ability.roll || ability.dice);
    const detail = `${rolled.formula} (${rolled.rolls.join(", ")}${
      rolled.mod ? ` ${formatModifier(rolled.mod)}` : ""
    })`;

    result.innerHTML = `
      <p><strong>${ability.name}</strong></p>
      <p>${detail} = <strong>${rolled.total}</strong></p>
    `;
    await publishRoll({
      character: c.name || "Character",
      label: ability.name,
      detail,
      total: rolled.total
    });
  } catch (err) {
    console.error(err);
    result.innerHTML = `<p style="color:red;">Ability roll failed: ${err.message}</p>`;
  }
}

async function init() {
  await OBR.onReady();

  const initialMetadata = await OBR.room.getMetadata();
  renderRollLog(initialMetadata[ROLL_LOG_KEY]);
  OBR.room.onMetadataChange(metadata => renderRollLog(metadata[ROLL_LOG_KEY]));
  OBR.broadcast.onMessage(ROLL_CHANNEL, ({ data }) => {
    if (data?.character && data?.label) {
      OBR.notification.show(`${data.character}: ${data.label} = ${data.total}`);
    }
  });

  document.getElementById("save-url").onclick = async () => {
    const url = scriptUrlInput.value.trim();
    saveScriptUrl(url);
    savedUrlDisplay.textContent = `Saved URL: ${url || "(none)"}`;
    characterData = null;
    characterInfo.innerHTML = "";
    abilityActions.replaceChildren();
    result.innerHTML = `<p>Saved URL. Character cache cleared.</p>`;
    await OBR.notification.show("Apps Script URL saved");
  };

  document.getElementById("test-connection").onclick = async () => {
    try {
      const data = await getCharacter();
      const name = data.character?.name || "Unknown Character";

      result.innerHTML = `
        <p style="color:lightgreen;"><strong>Connected successfully</strong></p>
        <p>Name: ${name}</p>
        <p>Attacks: ${data.attacks?.length || 0}</p>
        <p>Spells: ${data.spells?.length || 0}</p>
        <p>Features: ${data.features?.length || 0}</p>
      `;

      await OBR.notification.show(`Connected to ${name}`);
    } catch (err) {
      console.error(err);
      result.innerHTML = `<p style="color:red;">Connection failed: ${err.message}</p>`;
      await OBR.notification.show("Connection failed");
    }
  };

  document.getElementById("load-data").onclick = async () => {
    try {
      characterData = await getCharacter();
      renderCharacter(characterData);

      const name = characterData.character?.name || "Unknown Character";
      result.innerHTML = `<p>Character loaded and cached.</p>`;
      await OBR.notification.show(`Loaded ${name}`);
    } catch (err) {
      console.error(err);
      result.innerHTML = `<p style="color:red;">Load failed: ${err.message}</p>`;
      await OBR.notification.show("Load failed");
    }
  };

  document.getElementById("refresh-data").onclick = async () => {
    try {
      characterData = await getCharacter();
      renderCharacter(characterData);

      const name = characterData.character?.name || "Unknown Character";
      result.innerHTML = `<p>Character refreshed from sheet.</p>`;
      await OBR.notification.show(`Refreshed ${name}`);
    } catch (err) {
      console.error(err);
      result.innerHTML = `<p style="color:red;">Refresh failed: ${err.message}</p>`;
      await OBR.notification.show("Refresh failed");
    }
  };

  document.getElementById("roll-init").onclick = async () => {
    try {
      const data = requireCharacter();
      const c = data.character || {};

      const d20 = Math.floor(Math.random() * 20) + 1;
      const bonus = parseBonus(c.initiative);
      const total = d20 + bonus;

      result.innerHTML = `
        <p><strong>${c.name || "Character"}</strong> initiative</p>
        <p>${d20} + ${bonus} = <strong>${total}</strong></p>
      `;

      await publishRoll({
        character: c.name || "Character",
        label: "Initiative",
        detail: `d20 (${d20}) ${formatModifier(bonus)}`,
        total
      });

      await OBR.notification.show(`${c.name || "Character"} rolled initiative ${total}`);
    } catch (err) {
      console.error(err);
      result.innerHTML = `<p style="color:red;">Initiative failed: ${err.message}</p>`;
    }
  };

  document.getElementById("weapon-attack").onclick = async () => {
    try {
      const data = requireCharacter();
      const c = data.character || {};
      const attack = getPrimaryAttack(data);

      if (!attack) {
        throw new Error("No attack found.");
      }

      const d20 = Math.floor(Math.random() * 20) + 1;
      const attackBonus = parseBonus(attack.attackBonus);
      const attackTotal = d20 + attackBonus;

      result.innerHTML = `
        <p><strong>${attack.name} Attack</strong></p>
        <p>${d20} + ${attackBonus} = <strong>${attackTotal}</strong></p>
      `;

      await publishRoll({
        character: c.name || "Character",
        label: `${attack.name} Attack`,
        detail: `d20 (${d20}) ${formatModifier(attackBonus)}`,
        total: attackTotal
      });

      await OBR.notification.show(
        `${c.name || "Character"} attacked with ${attack.name}: ${attackTotal}`
      );
    } catch (err) {
      console.error(err);
      result.innerHTML = `<p style="color:red;">Attack failed: ${err.message}</p>`;
    }
  };

  document.getElementById("weapon-damage").onclick = async () => {
    try {
      const data = requireCharacter();
      const c = data.character || {};
      const attack = getPrimaryAttack(data);

      if (!attack) {
        throw new Error("No attack found.");
      }

      if (!attack.damage) {
        throw new Error(`No damage formula found for ${attack.name}.`);
      }

      const damage = rollDice(attack.damage);

      result.innerHTML = `
        <p><strong>${attack.name} Damage</strong></p>
        <p>${damage.formula} = <strong>${damage.total}</strong></p>
      `;

      const detail = `${damage.formula} (${damage.rolls.join(", ")}${
        damage.mod ? ` ${formatModifier(damage.mod)}` : ""
      })`;
      await publishRoll({
        character: c.name || "Character",
        label: `${attack.name} Damage`,
        detail,
        total: damage.total
      });

      await OBR.notification.show(
        `${c.name || "Character"} rolled ${attack.name} damage: ${damage.total}`
      );
    } catch (err) {
      console.error(err);
      result.innerHTML = `<p style="color:red;">Damage failed: ${err.message}</p>`;
    }
  };
}

init().catch(console.error);
