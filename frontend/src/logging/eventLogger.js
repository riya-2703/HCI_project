const events = [];

export function logEvent(type, payload = {}) {
  events.push({
    timestamp: Date.now(),
    type,
    ...payload
  });
}

export function getEvents() {
  return events.slice();
}

export function clearEvents() {
  events.length = 0;
}

export function getEventsAsCsv() {
  if (events.length === 0) return "timestamp,type\n";
  const headers = new Set(["timestamp", "type"]);
  events.forEach((ev) => {
    Object.keys(ev).forEach((k) => headers.add(k));
  });
  const headerArr = Array.from(headers);
  const lines = [];
  lines.push(headerArr.join(","));
  for (const ev of events) {
    const row = headerArr.map((h) => JSON.stringify(ev[h] ?? ""));
    lines.push(row.join(","));
  }
  return lines.join("\n");
}
