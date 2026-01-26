"use client";

import { useEffect } from "react";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

import { Location } from "./types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface LeafletMapProps {
  location: Location;
}

interface RecenterMapProps {
  lat: number;
  lng: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const DEFAULT_ZOOM = 10;
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = "&copy; OpenStreetMap contributors";

/* ------------------------------------------------------------------ */
/*  LeafletMapComponent                                                */
/* ------------------------------------------------------------------ */
function LeafletMapComponent({ location }: LeafletMapProps) {
  // react-leaflet only on client (dynamic wrapper below)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MapContainer, TileLayer, Marker, Popup, useMap } = require("react-leaflet");

  function RecenterMap({ lat, lng }: RecenterMapProps) {
    const map = useMap();
    useEffect(() => {
      map.setView([lat, lng], DEFAULT_ZOOM);
    }, [lat, lng, map]);
    return null;
  }

  return (
    <MapContainer
      center={[location.latitude, location.longitude]}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

      <Marker position={[location.latitude, location.longitude]}>
        <Popup>
          {location.name}
          {location.country ? `, ${location.country}` : ""}
        </Popup>
      </Marker>

      <RecenterMap lat={location.latitude} lng={location.longitude} />
    </MapContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Dynamic Export (SSR disabled)                                      */
/* ------------------------------------------------------------------ */
const LeafletMap = dynamic(() => Promise.resolve(LeafletMapComponent), { ssr: false });

export default LeafletMap;
