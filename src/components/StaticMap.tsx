import { useEffect, useRef } from 'react';

export function StaticMap() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Basit bir canvas map çizimi
    if (mapRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = mapRef.current.clientWidth;
      canvas.height = mapRef.current.clientHeight;
      canvas.className = 'w-full h-full';
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f23');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Grid lines
        ctx.strokeStyle = '#ffffff10';
        ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x < canvas.width; x += 50) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < canvas.height; y += 50) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
        
        // Center marker
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Glow effect
        const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30);
        glowGradient.addColorStop(0, '#00ff88aa');
        glowGradient.addColorStop(1, '#00ff8800');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
        ctx.fill();
        
        // User marker
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Marker border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      mapRef.current.innerHTML = '';
      mapRef.current.appendChild(canvas);
    }
  }, []);

  return (
    <div ref={mapRef} className="w-full h-full bg-card rounded-lg overflow-hidden relative">
      <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-lg">
        <p className="text-sm font-medium">Istanbul, Turkey</p>
        <p className="text-xs text-muted-foreground">Current Location</p>
      </div>
    </div>
  );
}