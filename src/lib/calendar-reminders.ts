const FIRED_PREFIX = "calendar:reminderFired:";

export type ReminderEvent = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  is_all_day: boolean | null;
  reminder_minutes: number | null;
  location?: string | null;
};

export function reminderFiredKey(event: ReminderEvent): string {
  return `${FIRED_PREFIX}${event.id}:${event.event_date}:${event.start_time ?? "all-day"}:${event.reminder_minutes}`;
}

export function hasReminderFired(event: ReminderEvent): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(reminderFiredKey(event)) === "1";
  } catch {
    return false;
  }
}

export function markReminderFired(event: ReminderEvent): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(reminderFiredKey(event), "1");
  } catch {
    // ignore quota / private mode
  }
}

/** Local Date when the event starts. All-day events use 9:00 AM. */
export function getEventStartDate(event: ReminderEvent): Date | null {
  if (!event.event_date) return null;
  const time =
    event.is_all_day || !event.start_time
      ? "09:00:00"
      : event.start_time.length === 5
        ? `${event.start_time}:00`
        : event.start_time.slice(0, 8);
  const start = new Date(`${event.event_date}T${time}`);
  if (Number.isNaN(start.getTime())) return null;
  return start;
}

export function getReminderFireDate(event: ReminderEvent): Date | null {
  if (!event.reminder_minutes || event.reminder_minutes <= 0) return null;
  const start = getEventStartDate(event);
  if (!start) return null;
  return new Date(start.getTime() - event.reminder_minutes * 60_000);
}

export async function ensureNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Soft two-tone chime similar to a desktop alert. */
export function playReminderSound(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    function tone(freq: number, start: number, duration: number, gain = 0.08) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    }

    tone(880, now, 0.18, 0.09);
    tone(1174.7, now + 0.16, 0.28, 0.07);

    window.setTimeout(() => {
      void ctx.close();
    }, 800);
  } catch {
    // Audio may be blocked until a user gesture; ignore.
  }
}

export function showReminderNotification(event: ReminderEvent): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const minutes = event.reminder_minutes ?? 0;
  const bodyParts = [
    minutes === 1
      ? "Starts in 1 minute"
      : `Starts in ${minutes} minutes`,
  ];
  if (event.location?.trim()) {
    bodyParts.push(event.location.trim());
  }

  try {
    const notification = new Notification(event.title || "Calendar reminder", {
      body: bodyParts.join(" · "),
      tag: reminderFiredKey(event),
      renotify: true,
      silent: true, // we play our own sound
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some browsers throw if permission was revoked mid-session.
  }
}

export function fireReminder(event: ReminderEvent): void {
  if (hasReminderFired(event)) return;
  markReminderFired(event);
  playReminderSound();
  showReminderNotification(event);
}
