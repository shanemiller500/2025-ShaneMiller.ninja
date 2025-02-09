'use client';

import React, { useState, useEffect } from 'react';
import { Rocket } from './types/spacexTypes';
import LoadMoreButton from './LoadMoreButton';

const RocketsTab: React.FC = () => {
  const [rockets, setRockets] = useState<Rocket[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.spacexdata.com/v4/rockets')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data: Rocket[]) => {
        setRockets(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="text-center text-lg">Loading rockets...</div>;
  if (error)
    return <div className="text-center text-red-500">Error: {error}</div>;
  if (!rockets.length)
    return <div className="text-center">No rockets available</div>;

  const visibleRockets = rockets.slice(0, visibleCount);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Rockets</h2>
      <ul className="space-y-6">
        {visibleRockets.map((rocket) => (
          <li key={rocket.id} className="border-b pb-4">
            <h3 className="text-xl font-semibold">{rocket.name}</h3>
            <p>{rocket.description}</p>
            {/* Display additional properties */}
            <div className="mt-2">
              <strong>Additional Data:</strong>
              <ul>
                {Object.entries(rocket)
                  .filter(
                    ([key]) =>
                      !['id', 'name', 'description'].includes(key)
                  )
                  .map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}:</strong> {JSON.stringify(value)}
                    </li>
                  ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
      <LoadMoreButton
        visibleCount={visibleCount}
        totalCount={rockets.length}
        onLoadMore={() => setVisibleCount(visibleCount + 7)}
      />
    </div>
  );
};

export default RocketsTab;
