"use client";

import { useEffect, useRef, useCallback } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  className?: string;
  id?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  className = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
  id = "contact-address",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handlePlaceChange = useCallback((address: string) => {
    const trimmed = address.trim();
    if (!trimmed) return;
    onChangeRef.current(trimmed);
  }, []);

  useEffect(() => {
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let googleApi: typeof google | null = null;
    let cancelled = false;
    let pacMouseDownHandler: ((e: MouseEvent) => void) | null = null;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !inputRef.current) return;
        googleApi = google;

        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          fields: ["formatted_address", "name", "address_components"],
        });

        // Keep focus on the input when clicking a suggestion so place_changed
        // fires reliably inside modals / controlled React inputs.
        pacMouseDownHandler = (e: MouseEvent) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest?.(".pac-item")) {
            e.preventDefault();
          }
        };
        document.addEventListener("mousedown", pacMouseDownHandler, true);

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete?.getPlace();
          const fromPlace =
            place?.formatted_address?.trim() || place?.name?.trim() || "";
          const fromInput = inputRef.current?.value?.trim() || "";
          const address = fromPlace || fromInput;
          if (address) {
            handlePlaceChange(address);
            return;
          }
          // Google sometimes fills the input a tick after place_changed.
          window.setTimeout(() => {
            const delayed =
              autocomplete?.getPlace()?.formatted_address?.trim() ||
              inputRef.current?.value?.trim() ||
              "";
            if (delayed) handlePlaceChange(delayed);
          }, 0);
        });
      })
      .catch(() => {
        // Key missing or API unavailable — plain text input still works
      });

    return () => {
      cancelled = true;
      if (pacMouseDownHandler) {
        document.removeEventListener("mousedown", pacMouseDownHandler, true);
      }
      if (autocomplete && googleApi) {
        googleApi.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [handlePlaceChange]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // Enter selects a suggestion — don't submit the surrounding form.
        if (e.key === "Enter") e.preventDefault();
      }}
      autoComplete="new-password"
      className={className}
    />
  );
}
