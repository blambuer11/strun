import { lazy, Suspense, useEffect, useState } from 'react';

// Lazy load the map component
const LazySimpleMap = lazy(() => 
  import('./SimpleMap').then(module => ({ default: module.SimpleMap }))
);

export function DynamicMap() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background/50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing map...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center bg-background/50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    }>
      <LazySimpleMap />
    </Suspense>
  );
}