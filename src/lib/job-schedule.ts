import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildJobScheduleBubbles,
  type PhaseDates,
  type ScheduleBubbleKind,
  type ScheduleColor,
} from "@/lib/schedule-phase-drag";
import type { CalendarEventType } from "@/lib/types";

export interface JobScheduleRecord {
  job_id: string;
  fabricating_start: string | null;
  finishing_start: string | null;
  delivery_date: string | null;
  color: ScheduleColor;
}

export interface ScheduleBubbleMeta {
  schedule_bubble: true;
  phase_label: string;
  kind: ScheduleBubbleKind;
  color: ScheduleColor;
}

export function phaseDatesFromRecord(
  record: JobScheduleRecord | null
): PhaseDates {
  if (!record) {
    return { fabricating: null, finishing: null, delivery: null };
  }
  return {
    fabricating: record.fabricating_start,
    finishing: record.finishing_start,
    delivery: record.delivery_date,
  };
}

export function parseScheduleBubbleDescription(
  description: string | null
): ScheduleBubbleMeta | null {
  if (!description) return null;
  try {
    const parsed = JSON.parse(description) as ScheduleBubbleMeta;
    if (parsed?.schedule_bubble !== true) return null;
    if (!parsed.phase_label || !parsed.kind || !parsed.color) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Fabricating Start, Finishing Start, and all Delivery dates. */
export function isScheduleStartOrDeliveryEvent(event: {
  event_type: string;
  description: string | null;
}): boolean {
  const meta = parseScheduleBubbleDescription(event.description);
  if (meta) {
    if (meta.kind === "delivery") return true;
    return (
      meta.phase_label === "Fabricating Start" ||
      meta.phase_label === "Finishing Start"
    );
  }
  return event.event_type === "delivery";
}

function eventTypeForBubbleKind(kind: ScheduleBubbleKind): CalendarEventType {
  if (kind === "fabricating") return "production";
  if (kind === "finishing") return "finishing";
  return "delivery";
}

export async function loadJobSchedule(
  supabase: SupabaseClient,
  jobId: string
): Promise<JobScheduleRecord | null> {
  const { data, error } = await supabase
    .from("job_schedules")
    .select("job_id, fabricating_start, finishing_start, delivery_date, color")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load job schedule:", error.message);
    return null;
  }

  if (!data) return null;

  return {
    job_id: data.job_id,
    fabricating_start: data.fabricating_start,
    finishing_start: data.finishing_start,
    delivery_date: data.delivery_date,
    color: (data.color as ScheduleColor) ?? "red",
  };
}

export async function saveJobSchedule(
  supabase: SupabaseClient,
  jobId: string,
  jobName: string,
  phaseDates: PhaseDates,
  color: ScheduleColor
): Promise<{ error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to save the schedule." };
  }

  const { error: scheduleError } = await supabase.from("job_schedules").upsert(
    {
      job_id: jobId,
      fabricating_start: phaseDates.fabricating,
      finishing_start: phaseDates.finishing,
      delivery_date: phaseDates.delivery,
      color,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "job_id" }
  );

  if (scheduleError) {
    if (scheduleError.message.includes("job_schedules")) {
      return {
        error:
          "Job schedule table is missing. Run 20260729000001_job_schedules.sql in Supabase, then try again.",
      };
    }
    return { error: scheduleError.message };
  }

  const { data: existingEvents, error: loadEventsError } = await supabase
    .from("calendar_events")
    .select("id, description")
    .eq("job_id", jobId)
    .eq("calendar_scope", "production");

  if (loadEventsError) {
    return { error: loadEventsError.message };
  }

  const scheduleEventIds =
    existingEvents
      ?.filter((event) => parseScheduleBubbleDescription(event.description))
      .map((event) => event.id) ?? [];

  if (scheduleEventIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("calendar_events")
      .delete()
      .in("id", scheduleEventIds);

    if (deleteError) {
      return { error: deleteError.message };
    }
  }

  const bubbles = buildJobScheduleBubbles(jobName, phaseDates);
  if (bubbles.size === 0) {
    return {};
  }

  const inserts = Array.from(bubbles.entries()).map(([eventDate, bubble]) => {
    const meta: ScheduleBubbleMeta = {
      schedule_bubble: true,
      phase_label: bubble.phaseLabel,
      kind: bubble.kind,
      color,
    };

    return {
      job_id: jobId,
      title: bubble.jobName,
      event_type: eventTypeForBubbleKind(bubble.kind),
      event_date: eventDate,
      is_all_day: true,
      start_time: null,
      end_time: null,
      location: null,
      description: JSON.stringify(meta),
      user_id: user.id,
      calendar_scope: "production",
    };
  });

  let { error: insertError } = await supabase
    .from("calendar_events")
    .insert(inserts);

  // Older DBs may not have the finishing enum yet — fall back to production.
  if (
    insertError?.message?.includes(
      'invalid input value for enum calendar_event_type: "finishing"'
    )
  ) {
    const fallbackInserts = inserts.map((row) =>
      row.event_type === "finishing"
        ? { ...row, event_type: "production" as CalendarEventType }
        : row
    );
    ({ error: insertError } = await supabase
      .from("calendar_events")
      .insert(fallbackInserts));
  }

  if (insertError) {
    if (
      insertError.message.includes(
        "invalid input value for enum calendar_event_type"
      )
    ) {
      return {
        error:
          'Calendar event type "finishing" is missing. Run 20260729000002_calendar_event_finishing.sql in the Supabase SQL Editor, then try again.',
      };
    }
    return { error: insertError.message };
  }

  return {};
}

export async function removeJobSchedule(
  supabase: SupabaseClient,
  jobId: string
): Promise<{ error?: string }> {
  const { error: scheduleError } = await supabase
    .from("job_schedules")
    .delete()
    .eq("job_id", jobId);

  if (scheduleError && !scheduleError.message.includes("0 rows")) {
    return { error: scheduleError.message };
  }

  const { data: existingEvents, error: loadEventsError } = await supabase
    .from("calendar_events")
    .select("id, description")
    .eq("job_id", jobId)
    .eq("calendar_scope", "production");

  if (loadEventsError) {
    return { error: loadEventsError.message };
  }

  const scheduleEventIds =
    existingEvents
      ?.filter((event) => parseScheduleBubbleDescription(event.description))
      .map((event) => event.id) ?? [];

  if (scheduleEventIds.length === 0) return {};

  const { error: deleteError } = await supabase
    .from("calendar_events")
    .delete()
    .in("id", scheduleEventIds);

  if (deleteError) {
    return { error: deleteError.message };
  }

  return {};
}
