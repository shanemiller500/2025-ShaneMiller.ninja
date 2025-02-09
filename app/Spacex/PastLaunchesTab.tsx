'use client';

import React, { useState, useEffect } from 'react';
import { LaunchData } from './types/spacexTypes';
import LoadMoreButton from './LoadMoreButton';

const PastLaunchesTab: React.FC = () => {
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.spacexdata.com/v5/launches/past')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data: LaunchData[]) => {
        setLaunches(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="text-center text-lg">Loading past launches...</div>;
  if (error)
    return <div className="text-center text-red-500">Error: {error}</div>;
  if (!launches.length)
    return <div className="text-center">No past launches available</div>;

  const visibleLaunches = launches.slice(0, visibleCount);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Past Launches</h2>
      <ul className="space-y-6">
        {visibleLaunches.map((launch) => (
          <li key={launch.flight_number} className="border-b pb-4">
            <h3 className="text-xl font-semibold">{launch.name}</h3>
            <p>
              <strong>Flight Number:</strong> {launch.flight_number}
            </p>
            <p>
              <strong>Date:</strong> {new Date(launch.date_utc).toLocaleString()}
            </p>
            {launch.links.patch?.small && (
              <img
                src={launch.links.patch.small}
                alt="Mission Patch"
                className="w-24 my-2"
              />
            )}
            {launch.details && <p>{launch.details}</p>}
            {launch.links.flickr &&
              launch.links.flickr.small &&
              launch.links.flickr.small.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {launch.links.flickr.small.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`Flickr ${index}`}
                      className="w-16 h-16 object-cover"
                    />
                  ))}
                </div>
              )}
            {launch.links.reddit && (
              <div className="mt-2">
                <strong>Reddit:</strong>
                <ul>
                  {Object.entries(launch.links.reddit).map(
                    ([key, url]) =>
                      url && (
                        <li key={key}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-500 underline"
                          >
                            {key}
                          </a>
                        </li>
                      )
                  )}
                </ul>
              </div>
            )}
            {launch.links.webcast && launch.links.youtube_id && (
              <div className="mt-4">
                <iframe
                  width="420"
                  height="236"
                  src={`https://www.youtube.com/embed/${launch.links.youtube_id}`}
                  title="Webcast"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full"
                ></iframe>
              </div>
            )}
          </li>
        ))}
      </ul>
      <LoadMoreButton
        visibleCount={visibleCount}
        totalCount={launches.length}
        onLoadMore={() => setVisibleCount(visibleCount + 7)}
      />
    </div>
  );
};

export default PastLaunchesTab;
