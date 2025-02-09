'use client';

import React, { useState, useEffect } from 'react';
import { Core } from './types/spacexTypes';
import LoadMoreButton from './LoadMoreButton';

const CoresTab: React.FC = () => {
  const [cores, setCores] = useState<Core[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.spacexdata.com/v4/cores')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data: Core[]) => {
        setCores(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="text-center text-lg">Loading cores...</div>;
  if (error)
    return <div className="text-center text-red-500">Error: {error}</div>;
  if (!cores.length)
    return <div className="text-center">No cores available</div>;

  const visibleCores = cores.slice(0, visibleCount);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Cores</h2>
      <ul className="space-y-4">
        {visibleCores.map((core) => (
          <li key={core.id} className="border-b pb-2">
            <p>
              <strong>Serial:</strong> {core.serial}
            </p>
            <p>
              <strong>Status:</strong> {core.status}
            </p>
            {/* Additional properties */}
            <div className="mt-1">
              {Object.entries(core)
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
        totalCount={cores.length}
        onLoadMore={() => setVisibleCount(visibleCount + 7)}
      />
    </div>
  );
};

export default CoresTab;
