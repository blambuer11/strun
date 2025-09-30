import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import api from "../lib/http";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { MapPin, Play, Square, Activity } from "lucide-react";
import { toast } from "sonner";

const MAP_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${import.meta.env.VITE_MAPTILER_KEY || 'JNY9zsA8c4duUO7cPboB'}`;

export default function RunMap() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const watchIdRef = useRef<number | null>(null);

  const [initialLocation, setInitialLocation] = useState<[number,number] | null>(null);
  const [route, setRoute] = useState<[number,number][]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [area, setArea] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [29.06, 41.0],
      zoom: 12
    });
    map.addControl(new maplibregl.NavigationControl());
    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: { type:"FeatureCollection", features: [] }});
      map.addLayer({ id:"route-line", type:"line", source:"route", paint: {"line-color":"#00D4FF","line-width":4}});
    });
    mapRef.current = map;

    // ask for permission on mount to force prompt
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lng = pos.coords.longitude, lat = pos.coords.latitude;
        setInitialLocation([lng, lat]);
        map.setCenter([lng, lat]);
        // Add user marker
        new maplibregl.Marker({ color: "#00D4FF" })
          .setLngLat([lng, lat])
          .addTo(map);
      }, (err) => {
        console.error("getCurrentPosition failed", err);
        toast.error("Konum erişimine izin verin");
      }, { enableHighAccuracy: true, timeout: 10000 });
    } else {
      toast.error("Tarayıcınız konum servislerini desteklemiyor");
    }

    return () => map.remove();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const src = mapRef.current.getSource("route") as maplibregl.GeoJSONSource;
    if (src) {
      const geo = { 
        type:"FeatureCollection" as const, 
        features: route.length ? [{ 
          type:"Feature" as const, 
          properties: {},
          geometry: { type:"LineString" as const, coordinates: route } 
        }] : [] 
      };
      src.setData(geo);
    }
    if (route.length) {
      mapRef.current.setCenter(route[route.length - 1] as [number, number]);
    }

    // Calculate distance
    if (route.length > 1) {
      const line = turf.lineString(route);
      const length = turf.length(line, { units: 'kilometers' });
      setDistance(length);
    }
  }, [route]);

  function startRun() {
    if (!initialLocation) { 
      toast.error("Konum erişimine izin verin"); 
      return; 
    }
    setRoute([]);
    setArea(null);
    setDistance(0);
    
    const id = navigator.geolocation.watchPosition((pos) => {
      const coord: [number,number] = [pos.coords.longitude, pos.coords.latitude];
      setRoute((r) => [...r, coord]);
    }, (err) => {
      console.error("watchPosition error", err);
      toast.error("Konum takibi hatası");
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
    
    watchIdRef.current = id;
    localStorage.setItem("strun_watch_id", String(id));
    setIsRunning(true);
    toast.success("Koşu başladı!");
  }

  async function stopRun() {
    const idStr = localStorage.getItem("strun_watch_id");
    if (idStr) {
      navigator.geolocation.clearWatch(Number(idStr));
      localStorage.removeItem("strun_watch_id");
    } else if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    setIsRunning(false);

    if (route.length < 3) {
      toast.error("Yeterli nokta kaydedilmedi");
      return;
    }

    // create buffer polygon around route (10 meters)
    const line = turf.lineString(route);
    const buffered = turf.buffer(line, 10, { units: "meters" });
    const areaM = turf.area(buffered);
    setArea(areaM);

    // compute bbox
    const [minX, minY, maxX, maxY] = turf.bbox(buffered);
    const bbox = { lonMin: minX, latMin: minY, lonMax: maxX, latMax: maxY };

    // Prepare metadata
    const metadata = {
      route: { type: "LineString", coordinates: route },
      polygon: buffered?.geometry,
      bbox,
      area_m2: Math.round(areaM),
      date: new Date().toISOString().slice(0,10)
    };

    try {
      const resp = await api.post("/runs", metadata);
      if (resp.data?.ok) {
        toast.success(`Koşu kaydedildi! Alan: ${Math.round(areaM)} m²`);
      } else {
        toast.error("Kayıt başarısız");
      }
    } catch (e: any) {
      console.error("save run failed", e);
      toast.error(e?.response?.data?.error || "Kayıt hatası");
    }
  }

  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="absolute inset-0" />
      
      <Card className="absolute top-4 left-4 z-10 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-medium">Koşu Takibi</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Mesafe:</span>
            <span className="font-mono font-medium">{distance.toFixed(2)} km</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Nokta:</span>
            <span className="font-mono font-medium">{route.length}</span>
          </div>
          {area && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Alan:</span>
              <span className="font-mono font-medium">{Math.round(area)} m²</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!isRunning ? (
            <Button 
              onClick={startRun}
              disabled={!initialLocation}
              className="flex-1"
              variant="default"
            >
              <Play className="h-4 w-4 mr-2" />
              Başla
            </Button>
          ) : (
            <Button 
              onClick={stopRun}
              className="flex-1"
              variant="destructive"
            >
              <Square className="h-4 w-4 mr-2" />
              Durdur & Kaydet
            </Button>
          )}
        </div>
        
        {!initialLocation && (
          <p className="text-xs text-muted-foreground text-center">
            Konum erişimine izin verin
          </p>
        )}
      </Card>
    </div>
  );
}