// app/Weather/components/LoadingSpinner.tsx

import React from 'react';

const LoadingSpinner: React.FC = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="w-16 h-16 border-4 border-t-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export default LoadingSpinner;
