const minutes = (hhmm) => {
  const [hours, minute] = hhmm.split(":").map(Number);

  return hours * 60 + minute;
};

/** whether the quiet-hours window covers this moment (the window may cross midnight) */
export function hoursActive(settings, date) {
  const quietWindow = settings.quietHours;

  if (!quietWindow?.on) return false;

  const now = date.getHours() * 60 + date.getMinutes();
  const from = minutes(quietWindow.from);
  const to = minutes(quietWindow.to);

  if (from === to) return false;

  return from < to ? now >= from && now < to : now >= from || now < to;
}

/** the moment the current quiet-hours window ends: the next time the clock shows the end of the window */
export function hoursEnd(settings, date) {
  return nextClock(settings.quietHours.to, date);
}

// the next moment the clock shows hh:mm, today or tomorrow
const nextClock = (hhmm, date) => {
  const [hours, minute] = hhmm.split(":").map(Number);
  const at = new Date(date);

  at.setHours(hours, minute, 0, 0);

  if (at <= date) at.setDate(at.getDate() + 1);

  return at.getTime();
};

/**
 * the next moment quiet mode may switch by itself: a quiet-hours edge or the end of a skip
 * @return ms, or null when nothing switches by the clock
 */
export function nextQuietChange(settings, date) {
  const moments = [];
  const quietWindow = settings.quietHours;

  if (quietWindow?.on && quietWindow.from !== quietWindow.to) moments.push(nextClock(quietWindow.from, date), nextClock(quietWindow.to, date));
  if ((settings.quietSkipUntil ?? 0) > date.getTime()) moments.push(settings.quietSkipUntil);

  return moments.length ? Math.min(...moments) : null;
}

/**
 * manual quiet mode, or the quiet hours unless the user switched them off until the window ends
 * @param settings - quietManual, quietHours, quietSkipUntil (ms, 0 when not skipping)
 */
export function isQuiet(settings, date) {
  if (settings.quietManual) return true;
  if (date.getTime() < (settings.quietSkipUntil ?? 0)) return false;

  return hoursActive(settings, date);
}