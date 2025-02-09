'use client';

import React, { useState, useEffect } from 'react';
import { LaunchData } from './types/spacexTypes';

const LatestLaunchTab: React.FC = () => {
  const [launch, setLaunch] = useState<LaunchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.spacexdata.com/v5/launches/latest')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data: LaunchData) => {
        setLaunch(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="text-center text-lg">Loading latest launch...</div>;
  if (error)
    return <div className="text-center text-red-500">Error: {error}</div>;
  if (!launch)
    return <div className="text-center">No data available</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{launch.name}</h2>
      <p>
        <strong>Flight Number:</strong> {launch.flight_number}
      </p>
      <p>
        <strong>Date:</strong> {new Date(launch.date_utc).toLocaleString()}
      </p>
      {launch.links.patch?.small && (
        <div>
          <img
            src={launch.links.patch.small}
            alt="Mission Patch Small"
            className="w-32 mx-auto"
          />
          {launch.links.patch.large && (
            <img
              src={launch.links.patch.large}
              alt="Mission Patch Large"
              className="w-32 mx-auto mt-2"
            />
          )}
        </div>
      )}
      {launch.details && <p className="max-w-2xl">{launch.details}</p>}
      {/* Additional links and images */}
      <div className="space-y-2">
        {launch.links.reddit && (
          <div>
            <strong>Reddit Links:</strong>
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
        {launch.links.flickr &&
          launch.links.flickr.original &&
          launch.links.flickr.original.length > 0 && (
            <div>
              <strong>Flickr Images:</strong>
              <div className="flex flex-wrap gap-2">
                {launch.links.flickr.original.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt={`Flickr ${index}`}
                    className="w-24 h-24 object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        {launch.links.presskit && (
          <p>
            <strong>Presskit:</strong>{' '}
            <a
              href={launch.links.presskit}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 underline"
            >
              View Presskit
            </a>
          </p>
        )}
        {launch.links.webcast && launch.links.youtube_id && (
          <div className="mt-4">
            <h3 className="text-xl font-semibold mb-2">Webcast</h3>
            <div className="overflow-hidden rounded-lg shadow-lg mx-auto">
              <iframe
                width="560"
                height="315"
                src={`https://www.youtube.com/embed/${launch.links.youtube_id}`}
                title="Webcast"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full"
              ></iframe>
            </div>
          </div>
        )}
        {launch.links.article && (
          <p>
            <strong>Article:</strong>{' '}
            <a
              href={launch.links.article}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 underline"
            >
              Read Article
            </a>
          </p>
        )}
        {launch.links.wikipedia && (
          <p>
            <strong>Wikipedia:</strong>{' '}
            <a
              href={launch.links.wikipedia}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 underline"
            >
              View Wikipedia
            </a>
          </p>
        )}
      </div>
    </div>
  );
};

export default LatestLaunchTab;
