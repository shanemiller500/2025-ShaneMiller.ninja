'use client';

import React from 'react';

interface LoadMoreButtonProps {
  visibleCount: number;
  totalCount: number;
  onLoadMore: () => void;
}

const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({ visibleCount, totalCount, onLoadMore }) => {
  if (visibleCount >= totalCount) return null;
  return (
    <div className="flex justify-center mt-4">
      <button
        onClick={onLoadMore}
        className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded"
      >
        Load More
      </button>
    </div>
  );
};

export default LoadMoreButton;
