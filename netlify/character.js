async function getCharacter() {
  const source = getSavedScriptUrl();

  if (!source) {
    throw new Error("No Apps Script URL saved");
  }

  const response = await fetch(source, {
    method: "GET",
    cache: "no-store",
    redirect: "follow"
  });

  const finalUrl = response.url;
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${finalUrl}\n${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Not JSON from ${finalUrl}\nFirst 300 chars:\n${text.slice(0, 300)}`
    );
  }
}