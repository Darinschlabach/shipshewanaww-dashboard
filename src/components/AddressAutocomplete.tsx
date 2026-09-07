"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  className?: string;
  id?: string;
}

type AddressSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

/**
 * Custom address suggestions (not Google's .pac-container).
 * The legacy Autocomplete widget appends dropdowns to document.body, which
 * often can't be clicked inside our modals. This keeps the list in-component.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  className = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
  id = "contact-address",
}: AddressAutocompleteProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef =
    useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(
    null
  );
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<number | null>(null);
  const skipNextFetchRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((googleApi) => {
        if (cancelled) return;
        autocompleteServiceRef.current =
          new googleApi.maps.places.AutocompleteService();
        placesServiceRef.current = new googleApi.maps.places.PlacesService(
          document.createElement("div")
        );
        sessionTokenRef.current =
          new googleApi.maps.places.AutocompleteSessionToken();
        setReady(true);
      })
      .catch(() => {
        // Key missing or API unavailable — plain text input still works
      });

    return () => {
      cancelled = true;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const fetchSuggestions = useCallback((input: string) => {
    const service = autocompleteServiceRef.current;
    if (!service || input.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    service.getPlacePredictions(
      {
        input: input.trim(),
        types: ["address"],
        sessionToken: sessionTokenRef.current ?? undefined,
      },
      (results, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !results?.length
        ) {
          setSuggestions([]);
          setOpen(false);
          setActiveIndex(-1);
          return;
        }

        setSuggestions(
          results.map((result) => ({
            placeId: result.place_id,
            description: result.description,
            mainText: result.structured_formatting?.main_text || result.description,
            secondaryText:
              result.structured_formatting?.secondary_text || "",
          }))
        );
        setOpen(true);
        setActiveIndex(-1);
      }
    );
  }, []);

  const selectSuggestion = useCallback(
    (suggestion: AddressSuggestion) => {
      skipNextFetchRef.current = true;
      setOpen(false);
      setSuggestions([]);
      setActiveIndex(-1);

      const places = placesServiceRef.current;
      if (!places) {
        onChange(suggestion.description);
        return;
      }

      places.getDetails(
        {
          placeId: suggestion.placeId,
          fields: ["formatted_address"],
          sessionToken: sessionTokenRef.current ?? undefined,
        },
        (place, status) => {
          const address =
            status === google.maps.places.PlacesServiceStatus.OK &&
            place?.formatted_address
              ? place.formatted_address
              : suggestion.description;
          onChange(address);
          if (window.google?.maps?.places) {
            sessionTokenRef.current =
              new google.maps.places.AutocompleteSessionToken();
          }
        }
      );
    },
    [onChange]
  );

  function handleInputChange(next: string) {
    onChange(next);
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (!ready) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchSuggestions(next);
    }, 200);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") e.preventDefault();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const chosen =
        activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (chosen) selectSuggestion(chosen);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        autoComplete="new-password"
        className={className}
      />
      {open && suggestions.length > 0 ? (
        <ul
          className="absolute left-0 right-0 z-[10050] mt-1 max-h-60 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.placeId} role="option">
              <button
                type="button"
                className={`flex w-full flex-col px-3 py-2 text-left hover:bg-gray-50 ${
                  index === activeIndex ? "bg-gray-50" : ""
                }`}
                onMouseDown={(e) => {
                  // Prevent input blur before click applies the address.
                  e.preventDefault();
                  selectSuggestion(suggestion);
                }}
              >
                <span className="text-sm text-gray-900">
                  {suggestion.mainText}
                </span>
                {suggestion.secondaryText ? (
                  <span className="text-xs text-gray-500">
                    {suggestion.secondaryText}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
