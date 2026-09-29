"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Activity } from "../lib/types";
import styles from "../day-out.module.css";

function Fit({ activities }: { activities: Activity[] }) {
  const map = useMap();
  useEffect(() => {
    const points = activities.flatMap(item => item.stops?.map(stop => [stop.latitude, stop.longitude] as [number, number]) || (item.latitude !== undefined && item.longitude !== undefined ? [[item.latitude, item.longitude] as [number, number]] : []));
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [45, 45], maxZoom: 13, animate: false });
    map.invalidateSize();
  }, [activities, map]);
  return null;
}
const marker = (label: number) => L.divIcon({ className: "", html: `<div style="width:44px;height:44px;display:grid;place-items:center;border:3px solid white;border-radius:50%;background:#f28c28;color:white;font-weight:700;font-size:17px;box-shadow:0 3px 10px #0004">${label}</div>`, iconSize: [44, 44], iconAnchor: [22, 44] });
export default function DayMap({ activities, onSelect }: { activities: Activity[]; onSelect?: (activity: Activity) => void }) {
  const [tileError, setTileError] = useState(false);
  return <div className={styles.mapWrap}>
    <MapContainer center={[-28, 153.3]} zoom={10} scrollWheelZoom={false} className={styles.map}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} eventHandlers={{ tileerror: () => setTileError(true) }} />
      <Fit activities={activities} />
      {activities.flatMap((activity, index) => {
        const stops = activity.stops || (activity.latitude !== undefined && activity.longitude !== undefined ? [{ name: activity.title, latitude: activity.latitude, longitude: activity.longitude }] : []);
        return stops.map((stop, stopIndex) => <Marker key={`${activity.id}-${stopIndex}`} position={[stop.latitude, stop.longitude]} icon={marker(activity.stops ? stopIndex + 1 : index + 1)} title={stop.name} alt={stop.name}>
          <Popup><div className={styles.mapPopup}><strong>{stop.name}</strong><p>{activity.category} · {activity.region}</p>{onSelect && <button onClick={() => onSelect(activity)}>Show details</button>}</div></Popup>
        </Marker>);
      })}
    </MapContainer>
    {tileError && <p className={styles.mapError} role="status">The map background could not load. Place details and Directions are still available.</p>}
  </div>;
}
