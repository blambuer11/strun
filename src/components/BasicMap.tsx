export function BasicMap() {
  console.log('BasicMap rendering - no leaflet imports');
  
  return (
    <div className="w-full h-full bg-muted/20 flex items-center justify-center">
      <div className="text-center p-8 bg-card rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Map Placeholder</h3>
        <p className="text-muted-foreground">
          Testing without any leaflet imports to isolate the issue
        </p>
      </div>
    </div>
  );
}