'use client';

import React, { useState, useEffect } from 'react';
import { Capsule } from './types/spacexTypes';
import LoadMoreButton from './LoadMoreButton';

const CapsulesTab: React.FC = () => {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.spacexdata.com/v4/capsules')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data: Capsule[]) => {
        setCapsules(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="text-center text-lg">Loading capsules...</div>;
  if (error)
    return <div className="text-center text-red-500">Error: {error}</div>;
  if (!capsules.length)
    return <div className="text-center">No capsules available</div>;

  const visibleCapsules = capsules.slice(0, visibleCount);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Capsules</h2>
      <ul className="space-y-4">
        {visibleCapsules.map((capsule) => (
          <li key={capsule.id} className="border-b pb-2">
            <p>
              <strong>Serial:</strong> {capsule.serial}
            </p>
            <p>
              <strong>Status:</strong> {capsule.status}
            </p>
            {/* Additional properties */}
            <div className="mt-1">
              {Object.entries(capsule)
                .filter(
                  ([key]) =>
                    !['id', 'serial', 'status'].includes(key)
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
        totalCount={capsules.length}
        onLoadMore={() => setVisibleCount(visibleCount + 7)}
      />
    </div>
  );
};

export default CapsulesTab;
