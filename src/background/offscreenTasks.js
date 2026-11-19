/** work that needs a DOM: play a sound, parse HTML. runs in the offscreen page (Chrome) or the background page (Firefox) */
export async function handleOffscreen(message) {
  if (message.type === "play") {
    const audio = new Audio(message.url);

    audio.volume = message.volume ?? 1;

    await audio.play();

    return { ok: true };
  }

  if (message.type === "parse") {
    const doc = new DOMParser().parseFromString(message.html, message.mime ?? "text/html");

    return { results: message.queries.map((query) => queryOne(doc, query)) };
  }

  return { ok: false };
}

function queryOne(doc, query) {
  if (query.title) return doc.title ?? null;

  const element = doc.querySelector(query.css);

  if (!element) return null;

  return query.attr ? element.getAttribute(query.attr) : element.textContent;
}