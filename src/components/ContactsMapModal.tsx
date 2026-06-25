"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadGoogleMaps } from "@/lib/google-maps";
import { getInitialsFromName } from "@/lib/utils";
import type { Contact } from "@/lib/types";

interface ContactsMapModalProps {
  contacts: Contact[];
  onClose: () => void;
}

const BRAND_COLOR = "#6B1A2A";

function createInitialsMarkerIcon(
  google: typeof globalThis.google,
  initials: string
): google.maps.Icon {
  const safeInitials = initials.replace(/[^A-Z0-9]/gi, "").slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <path d="M18 41C18 41 33 25.2 33 15.5C33 8.04 26.28 2 18 2C9.72 2 3 8.04 3 15.5C3 25.2 18 41 18 41Z" fill="${BRAND_COLOR}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
    <text x="18" y="19" text-anchor="middle" fill="#ffffff" font-size="10" font-family="system-ui,sans-serif" font-weight="600">${safeInitials}</text>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(36, 44),
    anchor: new google.maps.Point(18, 44),
  };
}

function buildInfoWindowContent(
  contact: Contact,
  onViewContact: (contactId: string) => void
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "contact-map-info";
  wrap.style.minWidth = "180px";
  wrap.style.maxWidth = "220px";

  const name = document.createElement("p");
  name.style.margin = "0 0 2px";
  name.style.fontSize = "14px";
  name.style.fontWeight = "600";
  name.style.color = "#111827";
  name.textContent = contact.name;

  const type = document.createElement("p");
  type.style.margin = "0 0 6px";
  type.style.fontSize = "12px";
  type.style.color = "#6b7280";
  type.textContent = contact.contact_type;

  const address = document.createElement("p");
  address.style.margin = "0 0 10px";
  address.style.fontSize = "12px";
  address.style.lineHeight = "1.4";
  address.style.color = "#9ca3af";
  address.textContent = contact.address ?? "";

  const link = document.createElement("button");
  link.type = "button";
  link.style.margin = "0";
  link.style.padding = "0";
  link.style.border = "none";
  link.style.background = "none";
  link.style.fontSize = "12px";
  link.style.fontWeight = "500";
  link.style.color = BRAND_COLOR;
  link.style.cursor = "pointer";
  link.style.textDecoration = "underline";
  link.textContent = "View Contact";
  link.addEventListener("click", (e) => {
    e.stopPropagation();
    onViewContact(contact.id);
  });

  wrap.append(name, type, address, link);
  return wrap;
}

export default function ContactsMapModal({
  contacts,
  onClose,
}: ContactsMapModalProps) {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  onCloseRef.current = onClose;

  const contactsWithAddress = contacts.filter((c) => c.address?.trim());

  useEffect(() => {
    if (!mapRef.current) return;

    let cancelled = false;
    const listeners: google.maps.MapsEventListener[] = [];
    let infoWindow: google.maps.InfoWindow | null = null;

    const viewContact = (contactId: string) => {
      infoWindow?.close();
      onCloseRef.current();
      router.push(`/contacts/${contactId}`);
    };

    loadGoogleMaps()
      .then(async (google) => {
        if (cancelled || !mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 41.435, lng: -85.58 },
          zoom: 10,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        infoWindow = new google.maps.InfoWindow();
        listeners.push(
          map.addListener("click", () => {
            infoWindow?.close();
          })
        );

        const geocoder = new google.maps.Geocoder();
        const bounds = new google.maps.LatLngBounds();
        let plotted = 0;

        const withAddress = contacts.filter((c) => c.address?.trim());

        for (const contact of withAddress) {
          if (cancelled) return;

          try {
            const { results } = await geocoder.geocode({
              address: contact.address!,
            });
            const location = results[0]?.geometry?.location;
            if (!location) continue;

            const marker = new google.maps.Marker({
              map,
              position: location,
              title: contact.name,
              icon: createInitialsMarkerIcon(
                google,
                getInitialsFromName(contact.name)
              ),
            });

            listeners.push(
              marker.addListener("click", (e: google.maps.MapMouseEvent) => {
                e.stop();
                infoWindow?.setContent(
                  buildInfoWindowContent(contact, viewContact)
                );
                infoWindow?.open({ map, anchor: marker });
              })
            );

            bounds.extend(location);
            plotted++;
          } catch {
            // Skip addresses that fail to geocode
          }
        }

        if (plotted > 0) {
          map.fitBounds(bounds, 48);
          if (plotted === 1) {
            map.setZoom(14);
          }
        }

        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      infoWindow?.close();
      listeners.forEach((listener) => listener.remove());
    };
  }, [contacts, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Contact locations</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-6">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : contactsWithAddress.length === 0 ? (
            <p className="text-sm text-gray-500">
              No contacts have an address yet. Add addresses to see them on the
              map.
            </p>
          ) : (
            <>
              {loading && (
                <p className="mb-2 text-sm text-gray-500">Loading map…</p>
              )}
              <div
                ref={mapRef}
                className="h-[min(70vh,480px)] w-full rounded-lg border border-gray-200"
              />
              <p className="mt-2 text-xs text-gray-500">
                Click a marker to see contact details ·{" "}
                {contactsWithAddress.length} contact
                {contactsWithAddress.length !== 1 ? "s" : ""} with an address
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
