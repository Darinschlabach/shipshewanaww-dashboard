"use client";

import { useMemo, useState } from "react";
import Button from "@/components/Button";
import {
  describeRecurrence,
  type RecurrenceEndMode,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from "@/lib/calendar-recurrence";

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sun", full: "Sunday" },
  { value: 1, label: "Mon", full: "Monday" },
  { value: 2, label: "Tue", full: "Tuesday" },
  { value: 3, label: "Wed", full: "Wednesday" },
  { value: 4, label: "Thu", full: "Thursday" },
  { value: 5, label: "Fri", full: "Friday" },
  { value: 6, label: "Sat", full: "Saturday" },
] as const;

const SELECT =
  "appearance-none rounded-md border border-gray-300 bg-white px-2 py-1 pr-7 text-sm";

const INPUT =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm disabled:bg-gray-50";

function durationLabel(startTime: string, endTime: string, isAllDay: boolean): string {
  if (isAllDay) return "1 day";
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let mins = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
  if (mins <= 0) mins += 24 * 60;
  if (mins % 60 === 0) {
    const hours = mins / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (mins < 60) return `${mins} minutes`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}

export default function RecurrenceModal({
  initialRule,
  onSave,
  onCancel,
  onRemove,
}: {
  initialRule: RecurrenceRule;
  onSave: (rule: RecurrenceRule) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [rule, setRule] = useState<RecurrenceRule>(initialRule);
  const summary = useMemo(() => describeRecurrence(rule), [rule]);

  function setFrequency(frequency: RecurrenceFrequency) {
    setRule((prev) => ({ ...prev, frequency }));
  }

  function setEndMode(endMode: RecurrenceEndMode) {
    setRule((prev) => ({ ...prev, endMode }));
  }

  function toggleWeekday(day: number) {
    setRule((prev) => {
      const exists = prev.weekdays.includes(day);
      const weekdays = exists
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day].sort((a, b) => a - b);
      return {
        ...prev,
        weekdays: weekdays.length > 0 ? weekdays : [day],
      };
    });
  }

  function handleOk() {
    if (rule.frequency === "weekly" && rule.weekdays.length === 0) return;
    if (rule.endMode === "by_date" && !rule.endDate) return;
    if (
      rule.endMode === "after_count" &&
      (!rule.occurrenceCount || rule.occurrenceCount < 1)
    ) {
      return;
    }
    onSave({
      ...rule,
      interval: Math.max(1, Math.floor(rule.interval) || 1),
      occurrenceCount: Math.max(1, Math.floor(rule.occurrenceCount) || 1),
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-labelledby="recurrence-title"
      >
        <div className="border-b border-gray-200 px-4 py-2.5">
          <h2
            id="recurrence-title"
            className="text-base font-semibold text-gray-900"
          >
            Appointment Recurrence
          </h2>
        </div>

        <div className="space-y-2.5 px-4 py-3">
          {/* Appointment time — single compact row */}
          <section className="rounded-md border border-gray-200 px-3 py-2">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Appointment time
            </div>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <label className="text-sm">
                <span className="mb-0.5 block text-xs text-gray-600">Start</span>
                <input
                  type="time"
                  step={60}
                  value={rule.startTime.slice(0, 5)}
                  disabled={rule.isAllDay}
                  onChange={(e) =>
                    setRule((prev) => ({ ...prev, startTime: e.target.value }))
                  }
                  className={`${INPUT} w-[7.5rem]`}
                />
              </label>
              <label className="text-sm">
                <span className="mb-0.5 block text-xs text-gray-600">End</span>
                <input
                  type="time"
                  step={60}
                  value={rule.endTime.slice(0, 5)}
                  disabled={rule.isAllDay}
                  onChange={(e) =>
                    setRule((prev) => ({ ...prev, endTime: e.target.value }))
                  }
                  className={`${INPUT} w-[7.5rem]`}
                />
              </label>
              <div className="text-sm">
                <span className="mb-0.5 block text-xs text-gray-600">
                  Duration
                </span>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-gray-800">
                  {durationLabel(rule.startTime, rule.endTime, rule.isAllDay)}
                </div>
              </div>
              <label className="mb-1 flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={rule.isAllDay}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      isAllDay: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300"
                />
                All day
              </label>
            </div>
          </section>

          {/* Pattern + Range side by side */}
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <section className="rounded-md border border-gray-200 px-3 py-2">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Recurrence pattern
              </div>
              <div className="flex gap-3">
                <div className="flex shrink-0 flex-col gap-1 border-r border-gray-100 pr-3">
                  {(
                    [
                      ["daily", "Daily"],
                      ["weekly", "Weekly"],
                      ["monthly", "Monthly"],
                      ["yearly", "Yearly"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-1.5 text-sm text-gray-800"
                    >
                      <input
                        type="radio"
                        name="recurrence-frequency"
                        checked={rule.frequency === value}
                        onChange={() => setFrequency(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  {rule.frequency === "daily" ? (
                    <label className="flex flex-wrap items-center gap-1.5 text-sm text-gray-800">
                      Every
                      <input
                        type="number"
                        min={1}
                        value={rule.interval}
                        onChange={(e) =>
                          setRule((prev) => ({
                            ...prev,
                            interval: Number(e.target.value) || 1,
                          }))
                        }
                        className={`${INPUT} w-14`}
                      />
                      day(s)
                    </label>
                  ) : null}

                  {rule.frequency === "weekly" ? (
                    <>
                      <label className="flex flex-wrap items-center gap-1.5 text-sm text-gray-800">
                        Every
                        <input
                          type="number"
                          min={1}
                          value={rule.interval}
                          onChange={(e) =>
                            setRule((prev) => ({
                              ...prev,
                              interval: Number(e.target.value) || 1,
                            }))
                          }
                          className={`${INPUT} w-14`}
                        />
                        week(s) on:
                      </label>
                      <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                        {WEEKDAY_OPTIONS.map((day) => (
                          <label
                            key={day.value}
                            className="flex items-center gap-1 text-sm text-gray-800"
                            title={day.full}
                          >
                            <input
                              type="checkbox"
                              checked={rule.weekdays.includes(day.value)}
                              onChange={() => toggleWeekday(day.value)}
                            />
                            {day.label}
                          </label>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {rule.frequency === "monthly" ? (
                    <div className="space-y-1.5">
                      <label className="flex flex-wrap items-center gap-1.5 text-sm text-gray-800">
                        Every
                        <input
                          type="number"
                          min={1}
                          value={rule.interval}
                          onChange={(e) =>
                            setRule((prev) => ({
                              ...prev,
                              interval: Number(e.target.value) || 1,
                            }))
                          }
                          className={`${INPUT} w-14`}
                        />
                        month(s)
                      </label>
                      <label className="flex flex-wrap items-center gap-1.5 text-sm text-gray-800">
                        <input
                          type="radio"
                          name="monthly-mode"
                          checked={rule.monthlyMode === "day_of_month"}
                          onChange={() =>
                            setRule((prev) => ({
                              ...prev,
                              monthlyMode: "day_of_month",
                            }))
                          }
                        />
                        Day
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={rule.monthDay}
                          disabled={rule.monthlyMode !== "day_of_month"}
                          onChange={(e) =>
                            setRule((prev) => ({
                              ...prev,
                              monthDay: Number(e.target.value) || 1,
                            }))
                          }
                          className={`${INPUT} w-14`}
                        />
                      </label>
                      <label className="flex flex-wrap items-center gap-1.5 text-sm text-gray-800">
                        <input
                          type="radio"
                          name="monthly-mode"
                          checked={rule.monthlyMode === "weekday"}
                          onChange={() =>
                            setRule((prev) => ({
                              ...prev,
                              monthlyMode: "weekday",
                            }))
                          }
                        />
                        The
                        <select
                          value={rule.weekOfMonth}
                          disabled={rule.monthlyMode !== "weekday"}
                          onChange={(e) =>
                            setRule((prev) => ({
                              ...prev,
                              weekOfMonth: Number(e.target.value),
                            }))
                          }
                          className={`${SELECT} disabled:bg-gray-50`}
                        >
                          <option value={1}>first</option>
                          <option value={2}>second</option>
                          <option value={3}>third</option>
                          <option value={4}>fourth</option>
                          <option value={-1}>last</option>
                        </select>
                        <select
                          value={rule.monthWeekday}
                          disabled={rule.monthlyMode !== "weekday"}
                          onChange={(e) =>
                            setRule((prev) => ({
                              ...prev,
                              monthWeekday: Number(e.target.value),
                            }))
                          }
                          className={`${SELECT} disabled:bg-gray-50`}
                        >
                          {WEEKDAY_OPTIONS.map((day) => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {rule.frequency === "yearly" ? (
                    <label className="flex flex-wrap items-center gap-1.5 text-sm text-gray-800">
                      Every
                      <input
                        type="number"
                        min={1}
                        value={rule.interval}
                        onChange={(e) =>
                          setRule((prev) => ({
                            ...prev,
                            interval: Number(e.target.value) || 1,
                          }))
                        }
                        className={`${INPUT} w-14`}
                      />
                      year(s) on
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={rule.yearMonth}
                        onChange={(e) =>
                          setRule((prev) => ({
                            ...prev,
                            yearMonth: Number(e.target.value) || 1,
                          }))
                        }
                        className={`${INPUT} w-14`}
                      />
                      /
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={rule.yearDay}
                        onChange={(e) =>
                          setRule((prev) => ({
                            ...prev,
                            yearDay: Number(e.target.value) || 1,
                          }))
                        }
                        className={`${INPUT} w-14`}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-md border border-gray-200 px-3 py-2">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Range of recurrence
              </div>
              <div className="space-y-1.5">
                <label className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
                  <span className="w-10 shrink-0 text-xs text-gray-600">
                    Start
                  </span>
                  <input
                    type="date"
                    value={rule.startDate}
                    onChange={(e) =>
                      setRule((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className={`${INPUT} min-w-0 flex-1`}
                  />
                </label>
                <label className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
                  <input
                    type="radio"
                    name="recurrence-end"
                    checked={rule.endMode === "by_date"}
                    onChange={() => setEndMode("by_date")}
                  />
                  End by
                  <input
                    type="date"
                    value={rule.endDate ?? ""}
                    disabled={rule.endMode !== "by_date"}
                    onChange={(e) =>
                      setRule((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                    className={`${INPUT} min-w-0 flex-1`}
                  />
                </label>
                <label className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
                  <input
                    type="radio"
                    name="recurrence-end"
                    checked={rule.endMode === "after_count"}
                    onChange={() => setEndMode("after_count")}
                  />
                  End after
                  <input
                    type="number"
                    min={1}
                    value={rule.occurrenceCount}
                    disabled={rule.endMode !== "after_count"}
                    onChange={(e) =>
                      setRule((prev) => ({
                        ...prev,
                        occurrenceCount: Number(e.target.value) || 1,
                      }))
                    }
                    className={`${INPUT} w-14`}
                  />
                  occurrences
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="radio"
                    name="recurrence-end"
                    checked={rule.endMode === "none"}
                    onChange={() => setEndMode("none")}
                  />
                  No end date
                </label>
              </div>
            </section>
          </div>

          <p className="truncate text-xs text-gray-600">{summary}</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-4 py-2.5">
          <Button
            type="button"
            disabled={!onRemove}
            onClick={onRemove}
            className="mr-auto"
          >
            Remove Recurrence
          </Button>
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleOk}>
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
