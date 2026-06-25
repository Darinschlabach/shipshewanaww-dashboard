import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let configured = false;
let loadPromise: Promise<typeof google> | null = null;

export function getGoogleMapsApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

function ensureConfigured() {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured");
  }
  if (!configured) {
    setOptions({ key: apiKey, v: "weekly" });
    configured = true;
  }
}

export function loadGoogleMaps(): Promise<typeof google> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured")
    );
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      ensureConfigured();
      await importLibrary("maps");
      await importLibrary("places");
      await importLibrary("geocoding");
      return google;
    })();
  }

  return loadPromise;
}
