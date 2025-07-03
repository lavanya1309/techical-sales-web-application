import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalesData } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Eye, EyeOff, MapPin, Maximize, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

interface MapVisualizationProps {
  selectedYears: string[];
  viewMode: "heatmap" | "markers" | "clusters";
  showLabels: boolean;
}

interface GoogleMapsWindow extends Window {
  google: any;
  initMap: () => void;
  currentMarkers: any[];
  currentInfoWindow: any;
  currentHeatmap?: any;
}

declare const window: GoogleMapsWindow & { currentMarkers: any[]; currentInfoWindow: any };

export function MapVisualization({ selectedYears, viewMode, showLabels }: MapVisualizationProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapRefObj = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedCity, setSelectedCity] = useState<SalesData | null>(null);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const boundariesLoadedRef = useRef(false);
  const [showDistrictLabels, setShowDistrictLabels] = useState(false);
  const [districtLabelOverlays, setDistrictLabelOverlays] = useState<any[]>([]);
  const [cityLabelOverlays, setCityLabelOverlays] = useState<any[]>([]);
  const [mapType, setMapType] = useState("roadmap");
  // Track the district boundaries layer
  const districtBoundariesLayerRef = useRef<any>(null);
  // Track features added for district boundaries
  const [districtBoundaryFeatures, setDistrictBoundaryFeatures] = useState<any[]>([]);

  const { data: salesData = [], isLoading } = useQuery<SalesData[]>({
    queryKey: ["/api/sales-data"],
  });

  // Load Google Maps API
  useEffect(() => {
    const initializeMap = () => {
      if (!mapRef.current) return;

      // Define styled map to fill India with green and hide non-India areas
      const styledMapType = new window.google.maps.StyledMapType([
        {
          featureType: "landscape",
          elementType: "geometry.fill",
          stylers: [
            { visibility: "on" },
            { color: "#ffffff" }, // Green for land
          ],
        },
        // {
        //   featureType: "administrative.country",
        //   elementType: "geometry.fill",
        //   stylers: [
        //     { visibility: "on" },
        //     { color: "#008000" }, // Reinforce green for country boundaries
        //   ],
        // },
        {
          featureType: "water",
          elementType: "geometry.fill",
          stylers: [
            { visibility: "on" },
            { color: "#ffffff" }, // White for oceans and lakes
          ],
        },
        {
          featureType: "administrative.country",
          elementType: "labels",
          stylers: [{ visibility: "off" }], // Hide country labels
        },
        {
          featureType: "administrative.province",
          elementType: "geometry.stroke",
          stylers: [
            { visibility: "on" },
            { color: "#FF0000" }, // Red for state boundaries
            { weight: 1.5 },
          ],
        },
        {
          featureType: "administrative.province",
          elementType: "labels",
          stylers: [{ visibility: "off" }], // Hide state labels
        },
        // Remove or comment out this block to show city/town/village names
        // {
        //   featureType: "administrative.locality",
        //   elementType: "labels",
        //   stylers: [{ visibility: "off" }], // Hide city/town labels
        // },
        {
          featureType: "road",
          stylers: [{ visibility: "off" }], // Hide all roads
        },
        {
          featureType: "poi",
          stylers: [{ visibility: "off" }], // Hide all points of interest
        },
      ]);

      // INDIA BOUNDS for map restriction
      const indiaBounds = {
        north: 37.5,
        south: 6.0,
        west: 68.1,
        east: 97.5,
      };

      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: { lat: 22.5, lng: 82.5 }, // Centered to fit all of India
        zoom: 4, // Reasonable initial zoom
        minZoom: 4, // Prevent zooming out further than the initial view
        maxZoom: 12,
        gestureHandling: "greedy",
        scrollwheel: true,
        disableDoubleClickZoom: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        scaleControl: true,
        rotateControl: true,
        disableDefaultUI: false,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_CENTER,
        },
        mapTypeId: mapType,
        restriction: {
          latLngBounds: {
            north: 45,
            south: -10,
            west: 55,
            east: 120,
          },
          strictBounds: true,
        },
      });

      // Register the styled map type
      mapInstance.mapTypes.set("styled_map", styledMapType);

      mapRefObj.current = mapInstance;
      setIsMapLoaded(true);

      // Remove any previous data layers if present
      if (mapInstance.data) {
        mapInstance.data.forEach((feature: any) => {
          mapInstance.data.remove(feature);
        });
      }
      // Fetch and add GeoJSON for India's district boundaries
      fetch("/gadm41_IND_2.json")
        .then((res) => res.json())
        .then((geojson) => {
          mapInstance.data.addGeoJson(geojson);
          mapInstance.data.setStyle({
            strokeColor: "rgba(100,100,100,0.5)",
            strokeWeight: 0.7,
            fillColor: "transparent",
            fillOpacity: 0,
            clickable: false,
          });
        })
        .catch((err) => {
          console.error("Failed to load district boundaries GeoJSON:", err);
        });

      // Fetch and add GeoJSON for India's state boundaries and overlay state names
      fetch("/gadm41_IND_1.json")
        .then((res) => res.json())
        .then((geojson) => {
          // Add state boundaries
          mapInstance.data.addGeoJson(geojson);
          mapInstance.data.setStyle({
            strokeColor: "#FF0000",
            strokeWeight: 2,
            fillOpacity: 0,
            clickable: false,
          });
          // Add state name labels at centroid
          geojson.features.forEach((feature: any) => {
            const name = feature.properties.NAME_1;
            let coords = feature.geometry.coordinates;
            // Handle MultiPolygon and Polygon
            if (feature.geometry.type === "MultiPolygon") {
              coords = coords[0][0];
            } else if (feature.geometry.type === "Polygon") {
              coords = coords[0];
            }
            // Calculate centroid
            let lat = 0, lng = 0;
            coords.forEach((c: number[]) => {
              lng += c[0];
              lat += c[1];
            });
            lng /= coords.length;
            lat /= coords.length;
            // Create label overlay
            const labelDiv = document.createElement("div");
            labelDiv.style.cssText = `
              position: absolute;
              background: rgba(255,255,255,0.7);
              padding: 2px 6px;
              font-size: 13px;
              font-weight: bold;
              color: #d32f2f;
              border-radius: 3px;
              border: 1px solid #e5e7eb;
              pointer-events: none;
              z-index: 1000;
              white-space: nowrap;
            `;
            labelDiv.innerHTML = name;
            const overlay = new window.google.maps.OverlayView();
            overlay.onAdd = function () {
              this.getPanes().overlayLayer.appendChild(labelDiv);
            };
            overlay.draw = function () {
              const projection = this.getProjection();
              const position = projection.fromLatLngToDivPixel(
                new window.google.maps.LatLng(lat, lng)
              );
              labelDiv.style.left = position.x + "px";
              labelDiv.style.top = position.y + "px";
            };
            overlay.onRemove = function () {
              if (labelDiv.parentNode) {
                labelDiv.parentNode.removeChild(labelDiv);
              }
            };
            overlay.setMap(mapInstance);
          });
        })
        .catch((err) => {
          console.error("Failed to load state boundaries GeoJSON:", err);
        });

      // Fit map to India bounds once the map is idle and has its final dimensions.
      window.google.maps.event.addListenerOnce(mapInstance, 'idle', function(){
        const bounds = new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(5, 60), // Further expanded Southwest corner
          new window.google.maps.LatLng(40, 105) // Further expanded Northeast corner
        );
        mapInstance.fitBounds(bounds, { padding: 0 });
        });
    };

    const loadGoogleMaps = async () => {
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      try {
        const response = await fetch("/api/maps-config");
        const config = await response.json();
        const apiKey = config.apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
          console.warn("Google Maps API key not found. Please configure GOOGLE_MAP_API");
          return;
        }

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization`;
        script.async = true;
        script.defer = true;
        script.onload = initializeMap;
        document.head.appendChild(script);
      } catch (error) {
        console.error("Failed to load maps configuration:", error);
      }
    };

    loadGoogleMaps();
  }, [mapType]);

  // Effect to handle boundaries overlay toggle
  useEffect(() => {
    if (!mapRefObj.current || !isMapLoaded) return;

    // Remove all features with NAME_2 property (district boundaries)
    const featuresToRemove: any[] = [];
    mapRefObj.current.data.forEach((feature: any) => {
      if (feature.getProperty && feature.getProperty("NAME_2")) {
        featuresToRemove.push(feature);
      }
    });
    featuresToRemove.forEach((feature) => mapRefObj.current.data.remove(feature));

    if (showBoundaries) {
      fetch("/gadm41_IND_2.json")
        .then((res) => res.json())
        .then((geojson) => {
          mapRefObj.current.data.addGeoJson(geojson);
          mapRefObj.current.data.setStyle({
            strokeColor: "rgba(100,100,100,0.5)",
            strokeWeight: 0.7,
            fillColor: "transparent",
            fillOpacity: 0,
            clickable: false,
          });
          boundariesLoadedRef.current = true;
        })
        .catch((err) => {
          console.error("Failed to load district boundaries GeoJSON:", err);
        });
    }
  }, [isMapLoaded, showBoundaries]);

  // Helper to compute centroid of a polygon
  function getPolygonCentroid(coords: any[][]) {
    let area = 0,
      x = 0,
      y = 0;
    for (let i = 0, len = coords.length - 1; i < len; i++) {
      const [x0, y0] = coords[i];
      const [x1, y1] = coords[i + 1];
      const f = x0 * y1 - x1 * y0;
      area += f;
      x += (x0 + x1) * f;
      y += (y0 + y1) * f;
    }
    area *= 0.5;
    if (area === 0) return coords[0];
    x /= 6 * area;
    y /= 6 * area;
    return [x, y];
  }

  // Add/Remove district labels overlays
  useEffect(() => {
    if (!mapRefObj.current || !isMapLoaded) {
      districtLabelOverlays.forEach((overlay) => overlay.setMap(null));
      setDistrictLabelOverlays([]);
      return;
    }
    if (!showDistrictLabels || mapRefObj.current.getZoom() < 7) {
      districtLabelOverlays.forEach((overlay) => overlay.setMap(null));
      setDistrictLabelOverlays([]);
      return;
    }
    // Re-add overlays when toggled ON
    fetch("/gadm41_IND_2.json")
      .then((res) => res.json())
      .then((geojson) => {
        const overlays: any[] = [];
        geojson.features.forEach((feature: any) => {
          let coords = feature.geometry.coordinates;
          let centroid;
          if (feature.geometry.type === "Polygon") {
            centroid = getPolygonCentroid(coords[0]);
          } else if (feature.geometry.type === "MultiPolygon") {
            centroid = getPolygonCentroid(coords[0][0]);
          }
          if (!centroid) return;
          const name = feature.properties?.NAME_2 || feature.properties?.district || "";
          if (!name) return;
          const labelDiv = document.createElement("div");
          labelDiv.style.cssText = `
            background: rgba(255,255,255,0.85);
            padding: 2px 8px;
            font-size: 11px;
            color: #444;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
            pointer-events: none;
            white-space: nowrap;
          `;
          labelDiv.innerText = name;
          const overlay = new window.google.maps.OverlayView();
          overlay.onAdd = function () {
            this.getPanes().overlayLayer.appendChild(labelDiv);
          };
          overlay.draw = function () {
            const projection = this.getProjection();
            const position = projection.fromLatLngToDivPixel(
              new window.google.maps.LatLng(centroid[1], centroid[0])
            );
            labelDiv.style.left = position.x + "px";
            labelDiv.style.top = position.y + "px";
          };
          overlay.onRemove = function () {
            if (labelDiv.parentNode) labelDiv.parentNode.removeChild(labelDiv);
          };
          overlay.setMap(mapRefObj.current);
          overlays.push(overlay);
        });
        setDistrictLabelOverlays(overlays);
      });
    const zoomListener = mapRefObj.current.addListener("zoom_changed", () => {
      if (!showDistrictLabels || mapRefObj.current.getZoom() < 7) {
        districtLabelOverlays.forEach((overlay) => overlay.setMap(null));
        setDistrictLabelOverlays([]);
      } else {
        // Re-add overlays if toggled ON and zoomed in
        fetch("/gadm41_IND_2.json")
          .then((res) => res.json())
          .then((geojson) => {
            const overlays: any[] = [];
            geojson.features.forEach((feature: any) => {
              let coords = feature.geometry.coordinates;
              let centroid;
              if (feature.geometry.type === "Polygon") {
                centroid = getPolygonCentroid(coords[0]);
              } else if (feature.geometry.type === "MultiPolygon") {
                centroid = getPolygonCentroid(coords[0][0]);
              }
              if (!centroid) return;
              const name = feature.properties?.NAME_2 || feature.properties?.district || "";
              if (!name) return;
              const labelDiv = document.createElement("div");
              labelDiv.style.cssText = `
                background: rgba(255,255,255,0.85);
                padding: 2px 8px;
                font-size: 11px;
                color: #444;
                border-radius: 4px;
                border: 1px solid #e5e7eb;
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
                pointer-events: none;
                white-space: nowrap;
              `;
              labelDiv.innerText = name;
              const overlay = new window.google.maps.OverlayView();
              overlay.onAdd = function () {
                this.getPanes().overlayLayer.appendChild(labelDiv);
              };
              overlay.draw = function () {
                const projection = this.getProjection();
                const position = projection.fromLatLngToDivPixel(
                  new window.google.maps.LatLng(centroid[1], centroid[0])
                );
                labelDiv.style.left = position.x + "px";
                labelDiv.style.top = position.y + "px";
              };
              overlay.onRemove = function () {
                if (labelDiv.parentNode) labelDiv.parentNode.removeChild(labelDiv);
              };
              overlay.setMap(mapRefObj.current);
              overlays.push(overlay);
            });
            setDistrictLabelOverlays(overlays);
          });
      }
    });
    return () => {
      window.google.maps.event.removeListener(zoomListener);
      districtLabelOverlays.forEach((overlay) => overlay.setMap(null));
      setDistrictLabelOverlays([]);
    };
  }, [isMapLoaded, showDistrictLabels]);

  // Effect to handle city label overlays based on zoom level and marker/data changes
  useEffect(() => {
    if (!mapRefObj.current || !isMapLoaded) return;

    // Helper to clear overlays
    const clearCityLabels = () => {
      cityLabelOverlays.forEach((overlay) => overlay.setMap(null));
      setCityLabelOverlays([]);
    };

    // Handler for zoom changes and data changes
    const refreshCityLabels = () => {
      const zoom = mapRefObj.current.getZoom();
      clearCityLabels();
      if (zoom > 7 && showLabels) {
        // Add city labels
        const overlays: any[] = [];
        salesData.forEach((item) => {
          const totalSales = selectedYears.reduce((sum, year) => {
            const salesKey = `sales${year}` as keyof SalesData;
            return sum + (item[salesKey] as number || 0);
          }, 0);
          if (totalSales === 0) return;
          const labelDiv = document.createElement("div");
          labelDiv.style.cssText = `
            position: absolute;
            background: rgba(255,255,255,0.9);
            padding: 2px 6px;
            font-size: 10px;
            font-weight: 500;
            color: #374151;
            border-radius: 3px;
            border: 1px solid #e5e7eb;
            pointer-events: none;
            z-index: 1000;
          `;
          labelDiv.innerHTML = item.city;
          const overlay = new window.google.maps.OverlayView();
          overlay.onAdd = function () {
            this.getPanes().overlayLayer.appendChild(labelDiv);
          };
          overlay.draw = function () {
            const projection = this.getProjection();
            const position = projection.fromLatLngToDivPixel(
              new window.google.maps.LatLng(item.latitude, item.longitude)
            );
            labelDiv.style.left = position.x + 15 + "px";
            labelDiv.style.top = position.y - 20 + "px";
          };
          overlay.onRemove = function () {
            if (labelDiv.parentNode) {
              labelDiv.parentNode.removeChild(labelDiv);
            }
          };
          overlay.setMap(mapRefObj.current);
          overlays.push(overlay);
        });
        setCityLabelOverlays(overlays);
      }
    };

    // Listen for zoom changes
    const zoomListener = mapRefObj.current.addListener("zoom_changed", refreshCityLabels);
    // Refresh on mount and whenever data/view changes
    refreshCityLabels();
    return () => {
      window.google.maps.event.removeListener(zoomListener);
      clearCityLabels();
    };
  }, [mapRefObj, isMapLoaded, showLabels, salesData, selectedYears, viewMode]);

  // Update map with sales data
  useEffect(() => {
    if (!mapRefObj.current || !isMapLoaded || !salesData.length) return;

    if (window.currentMarkers) {
      window.currentMarkers.forEach((marker: any) => {
        if (marker.setMap) marker.setMap(null);
        if (marker.onRemove) marker.onRemove();
      });
      window.currentMarkers = [];
    }
    if (window.currentHeatmap) {
      window.currentHeatmap.setMap(null);
      window.currentHeatmap = undefined;
    }

    if (viewMode === "heatmap") {
      createHeatmap();
    } else if (viewMode === "markers") {
      createMarkers();
    } else {
      createClusters();
    }
  }, [mapRefObj, isMapLoaded, salesData, selectedYears, viewMode]);

  const createHeatmap = () => {
    if (!window.google || !mapRefObj.current) return;

    const heatmapData = salesData.map((item) => {
      const totalSales = selectedYears.reduce((sum, year) => {
        const salesKey = `sales${year}` as keyof SalesData;
        return sum + (item[salesKey] as number || 0);
      }, 0);

      return {
        location: new window.google.maps.LatLng(item.latitude, item.longitude),
        weight: totalSales / 1000,
      };
    });

    const heatmap = new window.google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map: mapRefObj.current,
      radius: 20,
      opacity: 0.6,
    });
    window.currentHeatmap = heatmap;
  };

  const createMarkers = () => {
    if (!window.google || !mapRefObj.current) return;

    if (window.currentMarkers) {
      window.currentMarkers.forEach((marker: any) => marker.setMap(null));
    }
    window.currentMarkers = [];

    salesData.forEach((item) => {
      const totalSales = selectedYears.reduce((sum, year) => {
        const salesKey = `sales${year}` as keyof SalesData;
        return sum + (item[salesKey] as number || 0);
      }, 0);

      if (totalSales === 0) return;

      const marker = new window.google.maps.Marker({
        position: { lat: item.latitude, lng: item.longitude },
        map: mapRefObj.current,
        title: `${item.city}, ${item.state}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 4,
          fillColor: "#008000", // Match India land color
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#ffffff",
        },
      });

      window.currentMarkers.push(marker);

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 200px; font-family: system-ui;">
            <h4 style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937; font-size: 14px;">${item.city}, ${item.state}</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; margin-bottom: 8px;">
              <div><strong>2022:</strong> ${item.sales2022.toLocaleString()}</div>
              <div><strong>2023:</strong> ${item.sales2023.toLocaleString()}</div>
              <div><strong>2024:</strong> ${item.sales2024.toLocaleString()}</div>
              <div><strong>2025:</strong> ${item.sales2025.toLocaleString()}</div>
            </div>
            <div style="padding-top: 6px; border-top: 1px solid #e5e7eb; font-size: 12px;">
              <div><strong>Total:</strong> ${item.total.toLocaleString()} units</div>
              <div><strong>Growth:</strong> 
                <span style="color: ${calculateGrowthRate(item) > 0 ? "#16a34a" : calculateGrowthRate(item) < 0 ? "#dc2626" : "#f59e0b"}; font-weight: bold;">
                  ${calculateGrowthRate(item) > 0 ? "+" : ""}${calculateGrowthRate(item).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        `,
      });

      marker.addListener("mouseover", () => {
        if (window.currentInfoWindow) {
          window.currentInfoWindow.close();
        }
        infoWindow.open(mapRefObj.current, marker);
        window.currentInfoWindow = infoWindow;
      });

      marker.addListener("mouseout", () => {
        setTimeout(() => {
          infoWindow.close();
        }, 200);
      });

      marker.addListener("click", () => {
        setSelectedCity(item);
      });

      if (showLabels) {
        const labelDiv = document.createElement("div");
        labelDiv.style.cssText = `
          position: absolute;
          background: rgba(255,255,255,0.9);
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 500;
          color: #374151;
          border-radius: 3px;
          border: 1px solid #e5e7eb;
          pointer-events: none;
          z-index: 1000;
        `;
        labelDiv.innerHTML = item.city;

        const overlay = new window.google.maps.OverlayView();
        overlay.onAdd = function () {
          this.getPanes().overlayLayer.appendChild(labelDiv);
        };

        overlay.draw = function () {
          const projection = this.getProjection();
          const position = projection.fromLatLngToDivPixel(
            new window.google.maps.LatLng(item.latitude, item.longitude)
          );
          labelDiv.style.left = position.x + 15 + "px";
          labelDiv.style.top = position.y - 20 + "px";
        };

        overlay.onRemove = function () {
          if (labelDiv.parentNode) {
            labelDiv.parentNode.removeChild(labelDiv);
          }
        };

        overlay.setMap(mapRefObj.current);
        window.currentMarkers.push(overlay);
      }
    });
  };

  const createClusters = () => {
    createMarkers();
  };

  const calculateGrowthRate = (data: SalesData) => {
    if (data.sales2022 === 0) return data.sales2025 > 0 ? 100 : 0;
    return ((data.sales2025 - data.sales2022) / data.sales2022) * 100;
  };

  const refreshMap = () => {
    if (mapRefObj.current) {
      const bounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(5, 60),
        new window.google.maps.LatLng(40, 105)
      );
      mapRefObj.current.fitBounds(bounds, { padding: 0 });
    }
  };

  const fullscreenMap = () => {
    if (mapRef.current) {
      mapRef.current.requestFullscreen();
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-semibold">India Market Distribution</CardTitle>
          <p className="text-sm text-neutral-500 mt-1">Sales performance across geographic regions</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={refreshMap}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={fullscreenMap}>
            <Maximize className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBoundaries((v) => !v)}
            title={showBoundaries ? "Hide District Boundaries" : "Show District Boundaries"}
          >
            {showBoundaries ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDistrictLabels((v) => !v)}
            title={showDistrictLabels ? "Hide District Labels" : "Show District Labels"}
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <div ref={mapRef} className="w-full max-w-[1600px] h-[90vh] min-h-[600px] mx-auto bg-neutral-100 rounded-lg shadow" />
          {/* Floating map type dropdown inside the map */}
          <div className="absolute top-6 right-6 z-30">
            <Select value={mapType} onValueChange={setMapType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roadmap">Roadmap</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="satellite">Satellite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-50">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <MapPin className="text-primary text-xl" />
                </div>
                <p className="text-sm font-medium text-neutral-600 mb-1">Initializing Map</p>
                <p className="text-xs text-neutral-500">Loading geographic data...</p>
                <div className="mt-3">
                  <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </div>
              </div>
            </div>
          )}
          {isMapLoaded && salesData.length > 0 && (
            <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 border border-neutral-200 z-10">
              <div className="text-xs font-medium text-neutral-700 mb-2">Quick Stats</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Active Markets:</span>
                  <span className="font-medium">{salesData.filter((item) => item.total > 0).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Growth Markets:</span>
                  <span className="font-medium text-success">
                    {salesData.filter((item) => calculateGrowthRate(item) > 10).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Emerging:</span>
                  <span className="font-medium text-warning">
                    {salesData.filter((item) => calculateGrowthRate(item) > 50).length}
                  </span>
                </div>
              </div>
            </div>
          )}
          {selectedCity && (
            <div className="absolute top-20 right-4 bg-white rounded-lg shadow-lg p-4 border border-neutral-200 max-w-xs z-10">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-neutral-900">
                  {selectedCity.city}, {selectedCity.state}
                </h4>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCity(null)}>
                  ×
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">2024 Sales:</span>
                  <span className="font-medium">
                    {selectedCity.sales2024 >= 1000
                      ? `${(selectedCity.sales2024 / 1000).toFixed(1)}K units`
                      : `${selectedCity.sales2024} units`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">YoY Growth:</span>
                  <span
                    className={`font-medium ${
                      calculateGrowthRate(selectedCity) > 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {calculateGrowthRate(selectedCity) > 0 ? "+" : ""}
                    {calculateGrowthRate(selectedCity).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Total Sales:</span>
                  <span className="font-medium">
                    {selectedCity.total >= 1000
                      ? `${(selectedCity.total / 1000).toFixed(1)}K units`
                      : `${selectedCity.total} units`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}