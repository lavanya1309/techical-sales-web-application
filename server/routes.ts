import { insertSalesDataSchema, type InsertSalesData } from "@shared/schema";
import 'dotenv/config';
import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";

interface MulterRequest extends Request {
  file?: any;
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.oasis.opendocument.spreadsheet'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload an Excel file.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all sales data
  app.get("/api/sales-data", async (req, res) => {
    try {
      const data = await storage.getAllSalesData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales data" });
    }
  });

  // Upload and parse Excel file
  app.post("/api/upload-excel", upload.single('file'), async (req: MulterRequest, res) => {
    try {
      console.log('Upload request received:', {
        hasFile: !!req.file,
        contentType: req.headers['content-type'],
        bodyKeys: Object.keys(req.body || {}),
        fileKeys: req.file ? Object.keys(req.file) : []
      });
      
      if (!req.file) {
        console.log('No file found in request');
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Validate and transform data
      const salesDataArray: InsertSalesData[] = [];
      
      for (const row of jsonData) {
        try {
          // Handle different possible column names
          const rowData = row as any;
          const state = rowData['State'] || rowData['state'] || '';
          const city = rowData['City'] || rowData['city'] || '';
          
          // Use geocoding API to get proper coordinates for Indian cities
          let latitude = 0;
          let longitude = 0;
          
          const apiKey = process.env.GOOGLE_MAP_API || process.env.GOOGLE_GEOCODING_API;
          if (apiKey && state && city) {
            try {
              const address = `${city}, ${state}, India`;
              const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
              const geocodeResponse = await fetch(geocodeUrl);
              const geocodeData = await geocodeResponse.json();
              
              if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
                const location = geocodeData.results[0].geometry.location;
                latitude = location.lat;
                longitude = location.lng;
              } else {
                console.warn(`Geocoding failed for ${address}: ${geocodeData.status}`);
                // Fallback to Excel coordinates if geocoding fails
                latitude = parseFloat(rowData['Latitude'] || rowData['latitude'] || '0');
                longitude = parseFloat(rowData['Longitude'] || rowData['longitude'] || '0');
              }
            } catch (geocodeError) {
              console.error(`Geocoding error for ${city}, ${state}:`, geocodeError);
              // Fallback to Excel coordinates if geocoding fails
              latitude = parseFloat(rowData['Latitude'] || rowData['latitude'] || '0');
              longitude = parseFloat(rowData['Longitude'] || rowData['longitude'] || '0');
            }
          } else {
            // Fallback to Excel coordinates if no API key
            latitude = parseFloat(rowData['Latitude'] || rowData['latitude'] || '0');
            longitude = parseFloat(rowData['Longitude'] || rowData['longitude'] || '0');
          }
          const sales2022 = parseInt(rowData['2022'] || '0');
          const sales2023 = parseInt(rowData['2023'] || '0');
          const sales2024 = parseInt(rowData['2024'] || '0');
          const sales2025 = parseInt(rowData['2025'] || '0');
          const total = parseInt(rowData['Total'] || rowData['total'] || '0');

          if (!state || !city || latitude === 0 || longitude === 0) {
            continue; // Skip invalid rows
          }

          const salesData: InsertSalesData = {
            state,
            city,
            latitude,
            longitude,
            sales2022,
            sales2023,
            sales2024,
            sales2025,
            total: total || (sales2022 + sales2023 + sales2024 + sales2025)
          };

          // Validate with schema
          const validatedData = insertSalesDataSchema.parse(salesData);
          salesDataArray.push(validatedData);
        } catch (error) {
          console.warn(`Skipping invalid row:`, row, error);
          continue;
        }
      }

      if (salesDataArray.length === 0) {
        return res.status(400).json({ 
          message: "No valid data found in the Excel file. Please check the format and required columns." 
        });
      }

      // Clear existing data and insert new data
      await storage.clearSalesData();
      const insertedData = await storage.createMultipleSalesData(salesDataArray);

      res.json({ 
        message: `Successfully imported ${insertedData.length} records`,
        count: insertedData.length,
        data: insertedData
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process Excel file" 
      });
    }
  });

  // Get analytics/metrics
  app.get("/api/analytics", async (req, res) => {
    try {
      const data = await storage.getAllSalesData();
      
      if (data.length === 0) {
        return res.json({
          totalMarkets: 0,
          totalSales2024: 0,
          avgGrowthRate: 0,
          marketPenetration: 0,
          activeMarkets: 0,
          growthMarkets: 0,
          emergingMarkets: 0
        });
      }

      const totalMarkets = data.length;
      const totalSales2024 = data.reduce((sum, item) => sum + item.sales2024, 0);
      
      // Calculate average growth rate (2022 to 2025)
      const growthRates = data.map(item => {
        if (item.sales2022 === 0) return 0;
        return ((item.sales2025 - item.sales2022) / item.sales2022) * 100;
      }).filter(rate => !isNaN(rate) && isFinite(rate));
      
      const avgGrowthRate = growthRates.length > 0 
        ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length 
        : 0;

      // Market categorization
      const activeMarkets = data.filter(item => item.total > 0).length;
      const growthMarkets = data.filter(item => {
        if (item.sales2022 === 0) return item.sales2025 > 0;
        return ((item.sales2025 - item.sales2022) / item.sales2022) > 0.1; // >10% growth
      }).length;
      const emergingMarkets = data.filter(item => {
        if (item.sales2022 === 0) return item.sales2025 > 0;
        return ((item.sales2025 - item.sales2022) / item.sales2022) > 0.5; // >50% growth
      }).length;

      const marketPenetration = totalMarkets > 0 ? (activeMarkets / totalMarkets) * 100 : 0;

      res.json({
        totalMarkets,
        totalSales2024,
        avgGrowthRate: Math.round(avgGrowthRate * 10) / 10,
        marketPenetration: Math.round(marketPenetration * 10) / 10,
        activeMarkets,
        growthMarkets,
        emergingMarkets
      });

    } catch (error) {
      res.status(500).json({ message: "Failed to calculate analytics" });
    }
  });

  // Geocoding proxy endpoint
  app.post("/api/geocode", async (req, res) => {
    try {
      const { address } = req.body;
      const apiKey = process.env.GOOGLE_MAP_API || process.env.GOOGLE_GEOCODING_API || process.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Geocoding failed" });
    }
  });

  // Get Google Maps API key
  app.get("/api/maps-config", async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_MAP_API || process.env.GOOGLE_GEOCODING_API;
      res.json({ apiKey: apiKey || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to get maps configuration" });
    }
  });

  // Clear all sales data
  app.post("/api/clear-sales-data", async (req, res) => {
    try {
      await storage.clearSalesData();
      res.json({ message: "Sales data cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear sales data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
