import OBR from "@owlbear-rodeo/sdk";
import "./style.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <h2>Google Sheet Roller</h2>

  <label for="script-url">Apps Script URL</label>
  <input id="script-url" type="text" placeholder="Paste your Apps Script URL here" />

  <button id="save-url">Save URL</button>
  <button id="load-data">Load Character</button>
  <button id="roll-init">Roll Initiative</button>
  <button id="roll-weapon">Roll Weapon</button>

  <div id="result"></div>
`;

const result = document.getElementById("result");
const scriptUrlInput = document.getElementById("script-url");

function getSavedScriptUrl() {
  return localStorage.getItem("sheet_roller_script_url") || "";
}

function saveScriptUrl(url) {
  localStorage.setItem("sheet_roller_script_url", url);
}

scriptUrlInput.value = getSavedScriptUrl();

async function getCharacter() {
  const source = getSavedScriptUrl();

  if (!source) {
    throw new Error("No Apps Script URL saved");
  }

  const proxyUrl = `/.netlify/functions/character?source=${encodeURIComponent(source)}`;

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
  return Number(String(value).replace(/\s+/g, "")) || 0;
}

function rollDice(formula) {
  const clean = String(formula).replace(/\s+/g, "");
  const match = clean.match(/(\d+)d(\d+)([+-]\d+)?/i);

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

async function init() {
  await OBR.onReady();

  let character = null;

  document.getElementById("save-url").onclick = async () => {
    const url = scriptUrlInput.value.trim();
    saveScriptUrl(url);
    await OBR.notification.show("Apps Script URL saved");
  };

  document.getElementById("load-data").onclick = async () => {
    try {
      character = await getCharacter();

      result.innerHTML = `
        <p><strong>${character.name}</strong></p>
        <p>AC: ${character.ac} | HP: ${character.hp}</p>
        <p>Init: ${character.initiative}</p>
        <p>Weapon: ${character.weapon1Name}</p>
        <p>Attack Bonus: ${character.weapon1Hit}</p>
        <p>Damage: ${character.weapon1Damage}</p>
      `;

      await OBR.notification.show(`Loaded ${character.name}`);
    } catch (err) {
      console.error(err);
      result.innerHTML = `<p style="color:red;">Load failed: ${err.message}</p>`;
      await OBR.notification.show("Load failed");
    }
  };

  document.getElementById("roll-init").onclick = async () => {
    try {
      if (!character) character = await getCharacter();

      const d20 = Math.floor(Math.random() * 20) + 1;
      const bonus = parseBonus(character.initiative);
      const total = d20 + bonus;

      result.innerHTML = `
        <p><strong>${character.name}</strong> initiative</p>
        <p>${d20} + ${bonus} = <strong>${total}</strong></p>
      `;

      await OBR.notification.show(`${character.name} rolled initiative ${total}`);
    } catch (err) {
      console.error(err);
      result.innerHTML = `<p style="color:red;">Initiative failed: ${err.message}</p>`;
    }
  };

  document.getElementById("roll-weapon").onclick = async () => {
    try {
      if (!character) character = await getCharacter();

      const d20 = Math.floor(Math.random() * 20) + 1;
      const attackBonus = parseBonus(character.weapon1Hit);
      const attackTotal = d20 + attackBonus;
      const damage = rollDice(character.weapon1Damage);

      result.innerHTML = `
        <p><strong>${character.weapon1Name}</strong></p>
        <p>Attack: ${d20} + ${attackBonus} = <strong>${attackTotal}</strong></p>
        <p>Damage: ${damage.formula} = <strong>${damage.total}</strong></p>
      `;

      await OBR.notification.show(
        `${character.name} used ${character.weapon1Name}: attack ${attackTotal}, damage ${damage.total}`
      );
    } catch (err) {
      console.error(err);
      result.innerHTML = `<p style="color:red;">Weapon roll failed: ${err.message}</p>`;
    }
  };
}

init().catch(console.error);