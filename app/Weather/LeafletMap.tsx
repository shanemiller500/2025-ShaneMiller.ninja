// app/Weather/components/LeafletMap.tsx

"use client";

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { Location } from './types';

const LeafletMapComponent: React.FC<{ location: Location }> = ({ location }) => {
  const { MapContainer, TileLayer, Marker, Popup, useMap } = require('react-leaflet');
  const React = require('react');
  const { useEffect } = React;

  const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
    const map = useMap();
    useEffect(() => {
      map.setView([lat, lng], 10);
    }, [lat, lng, map]);
    return null;
  };

  return (
    <MapContainer
      center={[location.latitude, location.longitude]}
      zoom={10}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Marker position={[location.latitude, location.longitude]}>
        <Popup>
          {location.name}{location.country ? `, ${location.country}` : ""}
        </Popup>
      </Marker>
      <RecenterMap lat={location.latitude} lng={location.longitude} />
    </MapContainer>
  );
};

const LeafletMap = dynamic(
  () => Promise.resolve(LeafletMapComponent),
  { ssr: false }
);

export default LeafletMap;
