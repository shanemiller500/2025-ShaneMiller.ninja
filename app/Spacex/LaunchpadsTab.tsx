'use client';

import React, { useState, useEffect } from 'react';
import { Launchpad } from './types/spacexTypes';
import LoadMoreButton from './LoadMoreButton';

const LaunchpadsTab: React.FC = () => {
  const [launchpads, setLaunchpads] = useState<Launchpad[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.spacexdata.com/v4/launchpads')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data: Launchpad[]) => {
        setLaunchpads(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="text-center text-lg">Loading launchpads...</div>;
  if (error)
    return <div className="text-center text-red-500">Error: {error}</div>;
  if (!launchpads.length)
    return <div className="text-center">No launchpads available</div>;

  const visibleLaunchpads = launchpads.slice(0, visibleCount);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Launchpads</h2>
      <ul className="space-y-6">
        {visibleLaunchpads.map((pad) => (
          <li key={pad.id} className="border-b pb-4">
            <h3 className="text-xl font-semibold">{pad.name}</h3>
            <p>
              <strong>Location:</strong> {pad.locality}, {pad.region}
            </p>
            <p>{pad.details}</p>
            {/* Display additional data */}
            <div className="mt-2">
              {Object.entries(pad)
                .filter(
                  ([key]) =>
                    !['id', 'name', 'details', 'locality', 'region'].includes(key)
                )
                .map(([key, value]) => (
                  <p key={key}>
                    <strong>{key}:</strong> {JSON.stringify(value)}
                  </p>
                ))}
            </div>
          </li>
        ))}
      </ul>
      <LoadMoreButton
        visibleCount={visibleCount}
        totalCount={launchpads.length}
        onLoadMore={() => setVisibleCount(visibleCount + 7)}
      />
    </div>
  );
};

export default LaunchpadsTab;
