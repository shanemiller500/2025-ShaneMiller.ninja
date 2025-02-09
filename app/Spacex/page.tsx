'use client';

import React, { useEffect } from 'react';
import SpaceXDashboard from './SpaceXDashboard';
import { trackEvent } from '@/utils/mixpanel';

const Spacex: React.FC = () => {
  useEffect(() => {
    trackEvent('SpaceX API Page Viewed', { page: 'SpaceX API Page' });
  }, []);

  return <SpaceXDashboard />;
};

export default Spacex;
