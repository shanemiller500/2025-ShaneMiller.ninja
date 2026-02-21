'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

interface LoadMoreButtonProps {
  visibleCount: number;
  totalCount: number;
  onLoadMore: () => void;
}

const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({ visibleCount, totalCount, onLoadMore }) => {
  if (visibleCount >= totalCount) return null;
  return (
    <div className="flex justify-center mt-4">
      <Button variant="indigo" size="md" onClick={onLoadMore}>
        Load More
      </Button>
    </div>
  );
};

export default LoadMoreButton;
