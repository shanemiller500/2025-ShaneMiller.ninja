'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { trackEvent } from '@/utils/mixpanel';
import './iss.css';

/* ------------------------------------------------------------------ */
/*  Dynamic import — avoid SSR for Leaflet                            */
/* ------------------------------------------------------------------ */
const ISSTracker = dynamic(() => import('./issTracker'), {
  ssr: false,
  loading: () => (
    <p className="py-24 text-center font-mono text-xs uppercase tracking-wider text-slate-400">
      Acquiring signal from the ISS…
    </p>
  ),
});

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */
export default function ISSTrackerPage() {
  useEffect(() => {
    trackEvent('ISS Tracker Page Viewed', { page: 'ISS Tracker' });
  }, []);

  return <ISSTracker />;
}
