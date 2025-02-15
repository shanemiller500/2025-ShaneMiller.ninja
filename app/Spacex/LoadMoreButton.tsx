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
        className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 px-4 rounded"
      >
        Load More
      </button>
    </div>
  );
};

export default LoadMoreButton;
