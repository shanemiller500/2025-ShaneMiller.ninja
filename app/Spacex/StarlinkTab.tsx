'use client';

import React, { useState, useEffect } from 'react';
import { StarlinkData } from './types/spacexTypes';
import LoadMoreButton from './LoadMoreButton';

const StarlinkTab: React.FC = () => {
  const [starlinks, setStarlinks] = useState<StarlinkData[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.spacexdata.com/v4/starlink')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data: StarlinkData[]) => {
        setStarlinks(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="text-center text-lg">Loading Starlink data...</div>;
  if (error)
    return <div className="text-center text-red-500">Error: {error}</div>;
  if (!starlinks.length)
    return <div className="text-center">No Starlink data available</div>;

  const visibleStarlinks = starlinks.slice(0, visibleCount);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Starlink Satellites</h2>
      <ul className="space-y-4">
        {visibleStarlinks.map((starlink) => (
          <li key={starlink.id} className="border-b pb-2">
            <p>
              <strong>ID:</strong> {starlink.id}
            </p>
            <p>
              <strong>Version:</strong> {starlink.version}
            </p>
            {starlink.launch && (
              <p>
                <strong>Launch:</strong> {starlink.launch}
              </p>
            )}
            {/* Display any additional properties */}
            <div className="mt-1">
              {Object.entries(starlink)
                .filter(
                  ([key]) =>
                    !['id', 'version', 'launch'].includes(key)
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
        totalCount={starlinks.length}
        onLoadMore={() => setVisibleCount(visibleCount + 7)}
      />
    </div>
  );
};

export default StarlinkTab;
