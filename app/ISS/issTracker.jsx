"use client";

import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ISSTracker = () => {
  const mapRef = useRef(null); // Holds the Leaflet map instance
  const markerRef = useRef(null); // Holds the ISS marker

  const [issData, setIssData] = useState({
    latitude: 0,
    longitude: 0,
    altitude: 0,
    velocity: 0,
    visibility: "",
  });

  // Add a state to handle the window being available
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set isClient to true when the component is mounted (client-side)
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      // Now that we're on the client side, initialize the map
      mapRef.current = L.map("mapISS").setView([0, 0], 2);

      // Add OpenStreetMap tile layer.
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
      }).addTo(mapRef.current);

      // Define a custom satellite icon.
      const satelliteIcon = L.icon({
        iconUrl: "/images/world.png", // Replace this URL with your preferred satellite icon
        iconSize: [30, 30], // Increase size for better visibility
        iconAnchor: [15, 15], // Center the icon
      });

      // Function to fetch and update the ISS location and data.
      const getISSLocation = async () => {
        try {
          const response = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
          const data = await response.json();
          const { latitude, longitude, altitude, velocity, visibility } = data;
          setIssData({ latitude, longitude, altitude, velocity, visibility });

          // Update or create the marker.
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          } else {
            markerRef.current = L.marker([latitude, longitude], { icon: satelliteIcon }).addTo(mapRef.current);
          }
          // Update map view and force layout recalculation.
          mapRef.current.setView([latitude, longitude], 2);
          mapRef.current.invalidateSize();
        } catch (error) {
          console.error("Error fetching ISS data:", error);
        }
      };

      // Do an initial fetch after a brief delay.
      const timeoutId = setTimeout(getISSLocation, 50);
      // Then update the ISS data every 10 seconds.
      const intervalId = setInterval(getISSLocation, 10000);

      // Cleanup function: clear timers and remove the map on unmount.
      return () => {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        if (mapRef.current) {
          mapRef.current.remove();
        }
      };
    }
  }, [isClient]); // Only run this effect after `isClient` is true

  if (!isClient) {
    return null; // Don't render anything on the server-side
  }

  return (
    <div className="p-4 dark:text-gray-100">
      <h2 className="text-2xl font-bold mb-4 text-center">ISS Tracker</h2>

      {/* Map container */}
      <div id="mapISS" className="h-[600px] w-full rounded shadow-lg mb-4"></div>

      {/* ISS data display */}
      <div id="issData" className="mt-4 p-4 rounded">
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Latitude:</span> {issData.latitude}
        </p>
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Longitude:</span> {issData.longitude}
        </p>
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Altitude:</span> {issData.altitude.toFixed(2)} km above the earth&apos;s surface
        </p>
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Velocity:</span> {issData.velocity.toFixed(2)} km/h
        </p>
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Visibility:</span> {issData.visibility}
        </p>
      </div>
    </div>
  );
};

export default ISSTracker;
