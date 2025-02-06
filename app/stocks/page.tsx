import React from 'react';
import FinnhubDashboard from './stock/stocks'; // adjust the path if needed

const StocksPage = () => {
  return (
    <div>
      <h1>Stock Market Data</h1>
      {/* Render your stocks content here */}
      <FinnhubDashboard />
    </div>
  );
};

export default StocksPage;
