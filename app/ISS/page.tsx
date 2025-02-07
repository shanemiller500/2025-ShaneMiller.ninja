"use client"; // Marking this as a client-side component

import dynamic from 'next/dynamic';

// Dynamically import the ISSTracker component with ssr: false
const ISSTracker = dynamic(() => import("./issTracker"), { ssr: false });

const ISSTrackerPage = () => {
  return (
    <div>
      <ISSTracker />
    </div>
  );
};

export default ISSTrackerPage;
