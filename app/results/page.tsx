import React, { Suspense } from 'react';
import Results from './Results';

const StocksPage = () => {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <Results />
      </Suspense>
    </div>
  );
};

export default StocksPage;
