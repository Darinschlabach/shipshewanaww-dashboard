"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fireReminder,
  getReminderFireDate,
  hasReminderFired,
  type ReminderEvent,
} from "@/lib/calendar-reminders";

const LOOKAHEAD_MS = 2 * 60 * 60 * 1000; // schedule timeouts up to 2 hours out
const POLL_MS = 30_000;
const GRACE_MS = 60_000; // still fire if we missed by up to 1 minute

export default function CalendarReminderWatcher() {
  const timersRef = useRef<Map<string, number>>(new Map());

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current.values()) {
      window.clearTimeout(id);
    }
    timersRef.current.clear();
  }, []);

  const scheduleEvent = useCallback((event: ReminderEvent) => {
    if (hasReminderFired(event)) return;
    const fireAt = getReminderFireDate(event);
    if (!fireAt) return;

    const key = `${event.id}:${event.event_date}:${event.start_time ?? "all-day"}:${event.reminder_minutes}`;
    const existing = timersRef.current.get(key);
    if (existing) {
      window.clearTimeout(existing);
      timersRef.current.delete(key);
    }

    const delay = fireAt.getTime() - Date.now();
    if (delay <= 0) {
      if (delay >= -GRACE_MS) {
        fireReminder(event);
      }
      return;
    }
    if (delay > LOOKAHEAD_MS) return;

    const timerId = window.setTimeout(() => {
      timersRef.current.delete(key);
      fireReminder(event);
    }, delay);
    timersRef.current.set(key, timerId);
  }, []);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const rangeStart = new Date(now.getTime() - GRACE_MS);
      const rangeEnd = new Date(
        now.getTime() + LOOKAHEAD_MS + 24 * 60 * 60 * 1000
      );
      const startKey = rangeStart.toISOString().slice(0, 10);
      const endKey = rangeEnd.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("calendar_events")
        .select(
          "id, title, event_date, start_time, is_all_day, reminder_minutes, location, calendar_scope, user_id"
        )
        .not("reminder_minutes", "is", null)
        .gt("reminder_minutes", 0)
        .gte("event_date", startKey)
        .lte("event_date", endKey);

      // Column may not exist until migration is applied — fail quietly.
      if (error || !data) return;

      const events = (data as ReminderEvent[]).filter((event) => {
        const row = event as ReminderEvent & {
          calendar_scope?: string | null;
          user_id?: string | null;
        };
        if (row.calendar_scope === "personal" && row.user_id !== user.id) {
          return false;
        }
        return true;
      });

      for (const event of events) {
        scheduleEvent(event);
      }
    } catch {
      // Never block the app if reminder polling fails.
    }
  }, [scheduleEvent]);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
    };
  }, [refresh, clearTimers]);

  return null;
}
