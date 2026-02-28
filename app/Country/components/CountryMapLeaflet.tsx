"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PlaceResult } from "../lib/types";

// ─── Custom icons (SVG-based — avoids webpack default marker URL issue) ────────

const countryIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;background:#4f46e5;border:3px solid white;border-radius:50%;box-shadow:0 0 0 3px rgba(79,70,229,0.25),0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});

const TYPE_HEX: Record<string, string> = {
  City:              "#6366f1",
  Town:              "#0ea5e9",
  Village:           "#10b981",
  Island:            "#06b6d4",
  Beach:             "#f59e0b",
  Mountain:          "#64748b",
  Region:            "#8b5cf6",
  "National Park":   "#22c55e",
  "Historical Site": "#f97316",
};

function makePlaceIcon(type: string, num: number) {
  const bg = TYPE_HEX[type] ?? "#6366f1";
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;background:${bg};border:2.5px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;box-shadow:0 2px 8px rgba(0,0,0,0.3);line-height:1;">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

// ─── Auto-fit map bounds when places arrive ────────────────────────────────────

function MapFitter({ places }: { places: PlaceResult[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = places.filter((p) => p.lat != null && p.lng != null);
    if (valid.length === 0) return;
    const bounds = L.latLngBounds(valid.map((p) => [p.lat!, p.lng!] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 9 });
  }, [places, map]);
  return null;
}

function OpenSelectedPlace({
  places,
  selectedPlaceKey,
  markerRefs,
}: {
  places: PlaceResult[];
  selectedPlaceKey: string | null;
  markerRefs: MutableRefObject<Record<string, L.Marker>>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedPlaceKey) return;
    const selected = places.find((p) => getPlaceKey(p) === selectedPlaceKey);
    if (selected?.lat == null || selected?.lng == null) return;

    const marker = markerRefs.current[selectedPlaceKey];
    map.panTo([selected.lat, selected.lng], { animate: true, duration: 0.45 });
    marker?.openPopup();
  }, [places, selectedPlaceKey, markerRefs, map]);

  return null;
}

function getPlaceKey(place: PlaceResult) {
  return `${place.name}::${place.lat ?? "na"}::${place.lng ?? "na"}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CountryMapLeafletProps {
  lat: number;
  lng: number;
  countryName: string;
  places?: PlaceResult[];
  selectedPlaceKey?: string | null;
}

export default function CountryMapLeaflet({ lat, lng, countryName, places, selectedPlaceKey }: CountryMapLeafletProps) {
  const validPlaces = places?.filter((p) => p.lat != null && p.lng != null) ?? [];
  const markerRefs = useRef<Record<string, L.Marker>>({});

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* Country centre dot */}
      <Marker position={[lat, lng]} icon={countryIcon}>
        <Popup>
          <strong>{countryName}</strong>
        </Popup>
      </Marker>

      {/* Place pins */}
      {validPlaces.length > 0 && (
        <>
          <MapFitter places={validPlaces} />
          <OpenSelectedPlace places={validPlaces} selectedPlaceKey={selectedPlaceKey ?? null} markerRefs={markerRefs} />
          {validPlaces.map((place, i) => (
            <Marker
              key={getPlaceKey(place)}
              ref={(marker) => {
                const key = getPlaceKey(place);
                if (marker) markerRefs.current[key] = marker;
                else delete markerRefs.current[key];
              }}
              position={[place.lat!, place.lng!]}
              icon={makePlaceIcon(place.type, i + 1)}
            >
              <Popup>
                <div style={{ minWidth: 150, fontFamily: "inherit" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{place.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                    {place.type}{place.region ? ` · ${place.region}` : ""}
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.5, color: "#374151" }}>{place.why}</div>
                  {place.bestFor?.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {place.bestFor.map((tag, j) => (
                        <span key={j} style={{ background: "#ede9fe", color: "#7c3aed", borderRadius: 99, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </>
      )}
    </MapContainer>
  );
}
