// /components/FlightSearch.tsx
"use client";

import React, { useState } from "react";

interface Flight {
  flightNumber: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
}

export default function FlightSearch() {
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [date, setDate] = useState("");
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleFlightSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSearching(true);

    // Dummy flight search results; replace with an actual API call if needed.
    setTimeout(() => {
      const dummyFlights: Flight[] = [
        {
          flightNumber: "AA123",
          departure: departure,
          arrival: arrival,
          departureTime: `${date} 08:00`,
          arrivalTime: `${date} 10:00`,
          price: "$150",
        },
        {
          flightNumber: "BA456",
          departure: departure,
          arrival: arrival,
          departureTime: `${date} 12:00`,
          arrivalTime: `${date} 14:00`,
          price: "$180",
        },
        {
          flightNumber: "CA789",
          departure: departure,
          arrival: arrival,
          departureTime: `${date} 16:00`,
          arrivalTime: `${date} 18:00`,
          price: "$200",
        },
      ];
      setFlights(dummyFlights);
      setIsSearching(false);
    }, 1000);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Search Flights</h2>
      <form onSubmit={handleFlightSearch} className="mb-4 space-y-4">
        <div>
          <label htmlFor="departure" className="block font-semibold mb-1">
            Departure
          </label>
          <input
            type="text"
            id="departure"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="City or airport code"
            required
          />
        </div>
        <div>
          <label htmlFor="arrival" className="block font-semibold mb-1">
            Arrival
          </label>
          <input
            type="text"
            id="arrival"
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="City or airport code"
            required
          />
        </div>
        <div>
          <label htmlFor="date" className="block font-semibold mb-1">
            Date
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            required
          />
        </div>
        <button
          type="submit"
          className="bg-indigo-600 text-white px-4 py-2 rounded-md"
          disabled={isSearching}
        >
          {isSearching ? "Searching..." : "Search Flights"}
        </button>
      </form>

      {flights.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Flight Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Departure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Arrival
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Departure Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Arrival Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Price
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {flights.map((flight, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">{flight.flightNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{flight.departure}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{flight.arrival}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{flight.departureTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{flight.arrivalTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{flight.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
