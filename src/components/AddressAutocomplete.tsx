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
    onChangeRef.current(address);
  }, []);

  useEffect(() => {
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let googleApi: typeof google | null = null;

    loadGoogleMaps()
      .then((google) => {
        googleApi = google;
        if (!inputRef.current) return;

        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          fields: ["formatted_address"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete?.getPlace();
          if (place?.formatted_address) {
            handlePlaceChange(place.formatted_address);
          }
        });
      })
      .catch(() => {
        // Key missing or API unavailable — plain text input still works
      });

    return () => {
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
      autoComplete="new-password"
      className={className}
    />
  );
}
