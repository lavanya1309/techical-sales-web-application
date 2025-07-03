import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Search } from "lucide-react";
import type { SalesData } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { ChartContainer } from "@/components/ui/chart";
import { BarChart, XAxis, YAxis, Tooltip, Legend, Bar } from "recharts";

interface DataTableProps {
  selectedYears: string[];
}

export function DataTable({ selectedYears }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCity, setSelectedCity] = useState<SalesData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const itemsPerPage = 10;

  const { data: salesData = [], isLoading } = useQuery<SalesData[]>({
    queryKey: ['/api/sales-data'],
  });

  const filteredData = useMemo(() => {
    return salesData.filter(item =>
      item.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.state.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [salesData, searchTerm]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const calculateGrowthRate = (data: SalesData) => {
    if (data.sales2022 === 0) return data.sales2025 > 0 ? 100 : 0;
    return ((data.sales2025 - data.sales2022) / data.sales2022) * 100;
  };

  const formatUnits = (amount: number) => {
    if (amount >= 100000) {
      return `${(amount / 100000).toFixed(1)}L units`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K units`;
    } else {
      return `${amount.toLocaleString()} units`;
    }
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 20) return "text-success";
    if (growth > 0) return "text-warning";
    return "text-destructive";
  };

  const getGrowthVariant = (growth: number): "default" | "secondary" | "destructive" => {
    if (growth > 20) return "default";
    if (growth > 0) return "secondary";
    return "destructive";
  };

  const exportData = () => {
    const headers = ['City', 'State', '2022', '2023', '2024', '2025', 'Total', 'Growth Rate'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => [
        item.city,
        item.state,
        item.sales2022,
        item.sales2023,
        item.sales2024,
        item.sales2025,
        item.total,
        `${calculateGrowthRate(item).toFixed(1)}%`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCity ? `${selectedCity.city}, ${selectedCity.state}` : "City Analytics"}
            </DialogTitle>
            <DialogDescription>
              Detailed analytics for the selected city
            </DialogDescription>
          </DialogHeader>
          {selectedCity && (
            <div>
              <ChartContainer
                config={{
                  sales2022: { label: "2022", color: "#60a5fa" },
                  sales2023: { label: "2023", color: "#34d399" },
                  sales2024: { label: "2024", color: "#fbbf24" },
                  sales2025: { label: "2025", color: "#f87171" },
                }}
              >
                <BarChart width={400} height={240} data={[
                  { year: "2022", value: selectedCity.sales2022 },
                  { year: "2023", value: selectedCity.sales2023 },
                  { year: "2024", value: selectedCity.sales2024 },
                  { year: "2025", value: selectedCity.sales2025 },
                ]}>
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#60a5fa" />
                </BarChart>
              </ChartContainer>
              <div className="mt-4 space-y-1 text-sm">
                <div><strong>Total Sales:</strong> {selectedCity.total.toLocaleString()} units</div>
                <div><strong>Growth Rate:</strong> {calculateGrowthRate(selectedCity).toFixed(1)}%</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Card className="mt-8 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">Market Performance Analysis</CardTitle>
            <p className="text-sm text-neutral-500 mt-1">Detailed breakdown of sales performance by city</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 h-4 w-4" />
              <Input
                placeholder="Search cities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button onClick={exportData} className="bg-success hover:bg-success/90">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">City</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">State</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">2022</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">2023</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">2024</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">2025</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Total</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Growth</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-neutral-500">
                      Loading data...
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-neutral-500">
                      {searchTerm ? "No cities found matching your search." : "No data available. Please upload an Excel file."}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, index) => {
                    const growthRate = calculateGrowthRate(item);
                    return (
                      <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-3 ${
                              growthRate > 20 ? 'bg-success' : 
                              growthRate > 0 ? 'bg-warning' : 'bg-destructive'
                            }`}></div>
                            <span className="text-sm font-medium text-neutral-900">{item.city}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">{item.state}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-mono">
                          {formatUnits(item.sales2022)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-mono">
                          {formatUnits(item.sales2023)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-mono">
                          {formatUnits(item.sales2024)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-mono">
                          {formatUnits(item.sales2025)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium">
                          {formatUnits(item.total)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <Badge variant={getGrowthVariant(growthRate)} className="text-xs">
                            {growthRate > 0 ? '+' : ''}{growthRate.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80" onClick={() => { setSelectedCity(item); setModalOpen(true); }}>
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredData.length > 0 && (
            <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-600">
                  Showing <span className="font-medium">
                    {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredData.length)}
                  </span> of <span className="font-medium">{filteredData.length}</span> results
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
