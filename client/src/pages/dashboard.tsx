import { DataTable } from "@/components/DataTable";
import { FileUpload } from "@/components/FileUpload";
import { MapControls } from "@/components/MapControls";
import { MapVisualization } from "@/components/MapVisualization";
import { MetricsOverview } from "@/components/MetricsOverview";
import { Button } from "@/components/ui/button";
import { YearFilter } from "@/components/YearFilter";
import { ChartLine, Download, User } from "lucide-react";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [selectedYears, setSelectedYears] = useState<string[]>(['2022', '2023', '2024', '2025']);
  const [viewMode, setViewMode] = useState<'heatmap' | 'markers' | 'clusters'>('markers');
  const [showLabels, setShowLabels] = useState(true);

  // Clear sales data on page load
  useEffect(() => {
    fetch("/api/clear-sales-data", { method: "POST" });
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between w-full">
              {/* Left: Logo and Titles */}
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <ChartLine className="text-white text-lg" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-neutral-900">Sales Analytics</h1>
                  <p className="text-sm text-neutral-500">India Market Intelligence Platform</p>
                </div>
              </div>
              {/* Right: Export Report and User Icon */}
              <div className="flex items-center space-x-4 ml-auto">
                <Button variant="outline" className="text-sm font-medium">
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
                <div className="w-8 h-8 bg-neutral-300 rounded-full flex items-center justify-center">
                  <User className="text-neutral-600 text-sm" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Dashboard */}
        <main className="px-8 py-8">
          {/* Executive Metrics Overview */}
          <MetricsOverview />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Data Upload and Controls */}
            <div className="lg:col-span-1 space-y-6">
              <MapControls
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                showLabels={showLabels}
                onShowLabelsChange={setShowLabels}
              />
              <YearFilter 
                selectedYears={selectedYears}
                onYearsChange={setSelectedYears}
              />
              <FileUpload />
            </div>

            {/* Map Visualization */}
            <div className="lg:col-span-3">
              <MapVisualization 
                selectedYears={selectedYears}
                viewMode={viewMode}
                showLabels={showLabels}
              />
            </div>
          </div>

          {/* Data Table */}
          <DataTable selectedYears={selectedYears} />
        </main>
      </div>
    </div>
  );
}
