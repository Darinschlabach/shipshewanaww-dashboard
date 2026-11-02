"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";

const STORAGE_PREFIX = "shipshewana-catalogue-v2:";
const memory = new Map<string, unknown>();

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function load<T>(key: string, initial: T): T {
  if (memory.has(key)) return memory.get(key) as T;
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (raw == null) return initial;
    const parsed = JSON.parse(raw) as T;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return initial;
  }
}

function save<T>(key: string, value: T) {
  memory.set(key, value);
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(key), JSON.stringify(value));
}

/** Keeps catalogue edits after leaving the tab and after a refresh. */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setValue(load(key, initial));
    setReady(true);
  }, [key, initial]);

  const setSession = useCallback((action: SetStateAction<T>) => {
    setValue((prev) => {
      const next =
        typeof action === "function"
          ? (action as (current: T) => T)(prev)
          : action;
      save(key, next);
      return next;
    });
  }, [key]);

  return [value, setSession, ready] as const;
}
