import OBR from "@owlbear-rodeo/sdk";

const SHEET_URL = "https://script.google.com/macros/s/AKfycbwtgAZs4knMN01rE-9AuzuZAIhAs6A7vB4WJeTqjEqVSIiGhzGM-H7_XczYxC5AMRvv/exec";

async function getCharacter() {
  const response = await fetch(SHEET_URL);
  return await response.json();
}

function rollDice(dice) {
  const match = dice.match(/(\d+)d(\d+)([+-]\d+)?/);

  if (!match) return 0;

  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const mod = parseInt(match[3] || 0);

  let total = 0;

  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }

  return total + mod;
}

OBR.onReady(async () => {

  const data = await getCharacter();

  const button = document.createElement("button");
  button.innerText = `Roll ${data.weapon1Name}`;

  button.onclick = () => {
    const attack = rollDice(`1d20${data.weapon1Hit}`);
    const damage = rollDice(data.weapon1Damage);

    alert(`${data.name} attacks!\nAttack: ${attack}\nDamage: ${damage}`);
  };

  document.body.appendChild(button);

});