"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { PhaseDates, ScheduleColor, SchedulePhaseKey } from "@/lib/schedule-phase-drag";

export type { PhaseDates };

interface CalendarEmbedContextValue {
  embedded: boolean;
  scheduleMode: boolean;
  jobName: string;
  phaseDates: PhaseDates;
  setPhaseDate: (phase: SchedulePhaseKey, isoDate: string) => void;
  selectedColor: ScheduleColor;
  setSelectedColor: (color: ScheduleColor) => void;
  activePhase: SchedulePhaseKey | null;
  setActivePhase: (phase: SchedulePhaseKey | null) => void;
  resetSchedule: () => void;
}

const defaultPhaseDates: PhaseDates = {
  fabricating: null,
  finishing: null,
  delivery: null,
};

const defaultContextValue: CalendarEmbedContextValue = {
  embedded: false,
  scheduleMode: false,
  jobName: "",
  phaseDates: defaultPhaseDates,
  setPhaseDate: () => {},
  selectedColor: "red",
  setSelectedColor: () => {},
  activePhase: null,
  setActivePhase: () => {},
  resetSchedule: () => {},
};

const CalendarEmbedContext =
  createContext<CalendarEmbedContextValue>(defaultContextValue);

export function useCalendarEmbed() {
  return useContext(CalendarEmbedContext).embedded;
}

export function useProductionSchedule() {
  return useContext(CalendarEmbedContext);
}

export function CalendarEmbedProvider({
  embedded,
  scheduleMode = false,
  jobName = "",
  initialPhaseDates = defaultPhaseDates,
  initialColor = "red",
  children,
}: {
  embedded: boolean;
  scheduleMode?: boolean;
  jobName?: string;
  initialPhaseDates?: PhaseDates;
  initialColor?: ScheduleColor;
  children: React.ReactNode;
}) {
  const [phaseDates, setPhaseDates] = useState<PhaseDates>(initialPhaseDates);
  const [selectedColor, setSelectedColor] = useState<ScheduleColor>(initialColor);
  const [activePhase, setActivePhase] = useState<SchedulePhaseKey | null>(null);

  const setPhaseDate = useCallback((phase: SchedulePhaseKey, isoDate: string) => {
    setPhaseDates((prev) => ({ ...prev, [phase]: isoDate }));
  }, []);

  const resetSchedule = useCallback(() => {
    setPhaseDates(initialPhaseDates);
    setSelectedColor(initialColor);
    setActivePhase(null);
  }, [initialPhaseDates, initialColor]);

  const value = useMemo(
    () => ({
      embedded,
      scheduleMode,
      jobName,
      phaseDates,
      setPhaseDate,
      selectedColor,
      setSelectedColor,
      activePhase,
      setActivePhase,
      resetSchedule,
    }),
    [
      embedded,
      scheduleMode,
      jobName,
      phaseDates,
      setPhaseDate,
      selectedColor,
      activePhase,
      resetSchedule,
    ]
  );

  return (
    <CalendarEmbedContext.Provider value={value}>
      {children}
    </CalendarEmbedContext.Provider>
  );
}
