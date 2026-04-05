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
  <div id="result"></div>
`;

const result = document.getElementById("result");
const scriptUrlInput = document.getElementById("script-url");
const characterInfo = document.getElementById("character-info");
const savedUrlDisplay = document.getElementById("saved-url-display");

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

function renderCharacter(data) {
  const c = data.character || {};
  const firstAttack = getPrimaryAttack(data);

  characterInfo.innerHTML = `
    <p><strong>${c.name || "Unknown Character"}</strong></p>
    <p>AC: ${c.ac ?? "?"}</p>
    <p>HP: ${c.hp?.current ?? "?"} / ${c.hp?.max ?? "?"}</p>
    <p>Temp HP: ${c.hp?.temp ?? 0}</p>
    <p>Initiative: ${c.initiative ?? "?"}</p>
    <p>Speed: ${c.speed ?? "?"}</p>
    <p>Weapon: ${firstAttack ? firstAttack.name : "None"}</p>
    <p>Attack Bonus: ${firstAttack ? firstAttack.attackBonus : "-"}</p>
    <p>Damage: ${firstAttack ? firstAttack.damage : "-"}</p>
  `;
}

function requireCharacter() {
  if (!characterData) {
    throw new Error("No character loaded. Click Load Character first.");
  }
  return characterData;
}

async function init() {
  await OBR.onReady();

  document.getElementById("save-url").onclick = async () => {
    const url = scriptUrlInput.value.trim();
    saveScriptUrl(url);
    savedUrlDisplay.textContent = `Saved URL: ${url || "(none)"}`;
    characterData = null;
    characterInfo.innerHTML = "";
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