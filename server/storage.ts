import { salesData, type SalesData, type InsertSalesData } from "@shared/schema";

export interface IStorage {
  getAllSalesData(): Promise<SalesData[]>;
  createSalesData(data: InsertSalesData): Promise<SalesData>;
  createMultipleSalesData(data: InsertSalesData[]): Promise<SalesData[]>;
  clearSalesData(): Promise<void>;
  getSalesDataByFilters(years?: string[]): Promise<SalesData[]>;
}

export class MemStorage implements IStorage {
  private salesDataMap: Map<number, SalesData>;
  private currentId: number;

  constructor() {
    this.salesDataMap = new Map();
    this.currentId = 1;
  }

  async getAllSalesData(): Promise<SalesData[]> {
    return Array.from(this.salesDataMap.values());
  }

  async createSalesData(insertData: InsertSalesData): Promise<SalesData> {
    const id = this.currentId++;
    const data: SalesData = { 
      ...insertData, 
      id,
      sales2022: insertData.sales2022 || 0,
      sales2023: insertData.sales2023 || 0,
      sales2024: insertData.sales2024 || 0,
      sales2025: insertData.sales2025 || 0,
      total: insertData.total || 0
    };
    this.salesDataMap.set(id, data);
    return data;
  }

  async createMultipleSalesData(insertDataArray: InsertSalesData[]): Promise<SalesData[]> {
    const results: SalesData[] = [];
    for (const insertData of insertDataArray) {
      const data = await this.createSalesData(insertData);
      results.push(data);
    }
    return results;
  }

  async clearSalesData(): Promise<void> {
    this.salesDataMap.clear();
    this.currentId = 1;
  }

  async getSalesDataByFilters(years?: string[]): Promise<SalesData[]> {
    const allData = await this.getAllSalesData();
    
    if (!years || years.length === 0) {
      return allData;
    }

    // For filtering, we return all data since year filtering is handled on frontend
    // This could be optimized to filter on backend if needed
    return allData;
  }
}

export const storage = new MemStorage();
