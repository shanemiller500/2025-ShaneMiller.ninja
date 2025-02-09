"use client";

import React, { useEffect } from "react";
import dynamic from 'next/dynamic';
import { trackEvent } from '@/utils/mixpanel';

// Dynamically import the ISSTracker component with ssr: false
const ISSTracker = dynamic(() => import("./issTracker"), { ssr: false });

const ISSTrackerPage = () => {
        // Fire a page view event Mixpannel
        useEffect(() => {
          trackEvent('ISS tracker Page Viewed', { page: 'ISS Tracked!' });
        }, []);
  return (
    <div>
      <ISSTracker />
    </div>
  );
};

export default ISSTrackerPage;
