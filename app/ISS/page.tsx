'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { trackEvent } from '@/utils/mixpanel';

/* ------------------------------------------------------------------ */
/*  Dynamic import — avoid SSR for Leaflet                            */
/* ------------------------------------------------------------------ */
const ISSTracker = dynamic(() => import('./issTracker'), {
  ssr: false,
  loading: () => (
    <p className="text-center py-20 text-brand-600 dark:text-brand-300">
      Loading ISS Tracker…
    </p>
  ),
});

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */
const ISSTrackerPage = () => {
  useEffect(() => {
    trackEvent('ISS Tracker Page Viewed', { page: 'ISS Tracker' });
  }, []);

  return (
    <main className="min-h-screen bg-brand-50 dark:bg-brand-950 pt-6">
      <ISSTracker />
    </main>
  );
};

export default ISSTrackerPage;
