import React, { Suspense } from 'react';
import Results from './Results';

const ResultsPage = () => {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <Results />
      </Suspense>
    </div>
  );
};

export default ResultsPage;
