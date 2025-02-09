'use client';

import React, { useState } from 'react';
import LatestLaunchTab from './LatestLaunchTab';
import UpcomingLaunchesTab from './UpcomingLaunchesTab';
import PastLaunchesTab from './PastLaunchesTab';
import RocketsTab from './RocketsTab';
import StarlinkTab from './StarlinkTab';
import LaunchpadsTab from './LaunchpadsTab';
import CoresTab from './CoresTab';
import CapsulesTab from './CapsulesTab';
import PayloadsTab from './PayloadsTab';
import { trackEvent } from '@/utils/mixpanel';

const SpaceXDashboard: React.FC = () => {
  const tabs = [
    { name: 'Latest Launch', component: <LatestLaunchTab /> },
    { name: 'Upcoming Launches', component: <UpcomingLaunchesTab /> },
    { name: 'Past Launches', component: <PastLaunchesTab /> },
    { name: 'Rockets', component: <RocketsTab /> },
    { name: 'Starlink', component: <StarlinkTab /> },
    { name: 'Launchpads', component: <LaunchpadsTab /> },
    { name: 'Cores', component: <CoresTab /> },
    { name: 'Capsules', component: <CapsulesTab /> },
    { name: 'Payloads', component: <PayloadsTab /> },
  ];

  const [activeTab, setActiveTab] = useState(0);

  const handleTabClick = (index: number, tabName: string) => {
    // Track the tab click event with Mixpanel
    trackEvent('Tab Clicked', { tabName });
    setActiveTab(index);
  };

  return (
    <div className="min-h-screen dark:text-gray-100 p-4">
      <h1 className="text-4xl font-bold text-center mb-8">
        SpaceX Dashboard
      </h1>
      {/* Tab Navigation */}
      <div className="flex flex-wrap justify-center border-b border-gray-700 mb-4">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => handleTabClick(index, tab.name)}
            className={`px-4 py-2 m-1 text-lg font-medium focus:outline-none transition-all border-b-2 ${
              activeTab === index
                ? 'border-indigo-500 text-indigo-500'
                : 'border-transparent hover:border-gray-500'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>
      {/* Active Tab Content */}
      <div className="mt-6">{tabs[activeTab].component}</div>
    </div>
  );
};

export default SpaceXDashboard;
