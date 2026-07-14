import React from 'react';

const LoadingSkeleton = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top summary skeleton (6 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-border-subtle p-5 h-28 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-gray-200 rounded-md"></div>
              <div className="h-8 w-8 bg-gray-200 rounded-xl"></div>
            </div>
            <div className="space-y-1.5">
              <div className="h-6 w-24 bg-gray-300 rounded-md"></div>
              <div className="h-2 w-32 bg-gray-200 rounded-md"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter bar skeleton */}
      <div className="bg-white rounded-2xl border border-border-subtle p-5 space-y-4">
        <div className="h-12 bg-gray-200 rounded-xl w-full"></div>
        <div className="flex flex-wrap gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>

      {/* Main Grid: Case list skeleton + Right sidebar skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border-subtle p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="flex gap-2">
                    <div className="h-5 w-20 bg-gray-200 rounded-md"></div>
                    <div className="h-5 w-24 bg-gray-200 rounded-md"></div>
                  </div>
                  <div className="h-6 w-3/4 bg-gray-300 rounded-md"></div>
                </div>
                <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-bg-light/60 p-3 rounded-xl">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="space-y-1">
                    <div className="h-2.5 w-16 bg-gray-200 rounded"></div>
                    <div className="h-4 w-20 bg-gray-300 rounded"></div>
                  </div>
                ))}
              </div>
              <div className="h-2.5 w-full bg-gray-200 rounded-full"></div>
              <div className="flex justify-between gap-2 pt-2 border-t border-border-subtle/60">
                <div className="flex gap-2">
                  <div className="h-8 w-24 bg-gray-200 rounded-xl"></div>
                  <div className="h-8 w-20 bg-gray-200 rounded-xl"></div>
                </div>
                <div className="h-8 w-28 bg-gray-300 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Panel Skeleton */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-border-subtle p-6 space-y-4">
            <div className="h-5 w-40 bg-gray-300 rounded-md"></div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 rounded-xl bg-bg-light/60 space-y-2">
                <div className="h-4 w-3/4 bg-gray-300 rounded"></div>
                <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSkeleton;
