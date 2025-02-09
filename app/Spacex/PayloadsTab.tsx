'use client';

import React, { useState, useEffect } from 'react';
import { Payload } from './types/spacexTypes';
import LoadMoreButton from './LoadMoreButton';

const PayloadsTab: React.FC = () => {
  const [payloads, setPayloads] = useState<Payload[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.spacexdata.com/v4/payloads')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data: Payload[]) => {
        setPayloads(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="text-center text-lg">Loading payloads...</div>;
  if (error)
    return <div className="text-center text-red-500">Error: {error}</div>;
  if (!payloads.length)
    return <div className="text-center">No payloads available</div>;

  const visiblePayloads = payloads.slice(0, visibleCount);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Payloads</h2>
      <ul className="space-y-6">
        {visiblePayloads.map((payload) => (
          <li key={payload.id} className="border-b pb-4">
            <h3 className="text-xl font-semibold">{payload.name}</h3>
            <p>
              <strong>Type:</strong> {payload.type}
            </p>
            {/* Display additional properties */}
            <div className="mt-2">
              {Object.entries(payload)
                .filter(
                  ([key]) => !['id', 'name', 'type'].includes(key)
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
        totalCount={payloads.length}
        onLoadMore={() => setVisibleCount(visibleCount + 7)}
      />
    </div>
  );
};

export default PayloadsTab;
