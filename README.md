# Sales Analytics Dashboard

A business intelligence web application for Indian EV 2-wheeler market analysis, enabling CEOs to visualize competitor sales data and identify emerging markets.

## Features

- **Interactive Map Visualization**: Google Maps integration with geocoded Indian city coordinates
- **Excel File Upload**: Bulk import of sales data with automatic coordinate geocoding
- **4-Year Sales Analysis**: Hover tooltips showing detailed sales breakdown (2022-2025)
- **Growth Rate Calculations**: Automatic YoY growth rate analysis
- **Executive Dashboard**: KPI overview with market insights
- **Responsive Design**: Mobile-first approach with clean UI

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and builds
- **Tailwind CSS** for styling
- **Shadcn/ui** component library
- **TanStack Query** for server state management
- **Google Maps JavaScript API** for visualization

### Backend
- **Node.js** with Express.js
- **PostgreSQL** with Drizzle ORM
- **Multer** for file uploads
- **XLSX** for Excel file processing
- **Google Geocoding API** for coordinate resolution

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Google Maps API key
- Google Geocoding API key

### Environment Variables
```bash
DATABASE_URL=your_postgresql_connection_string
GOOGLE_MAP_API=your_google_maps_api_key
GOOGLE_GEOCODING_API=your_google_geocoding_api_key
```

### Installation
```bash
# Install dependencies
npm install

# Apply database schema
npm run db:push

# Start development server
npm run dev
```

### Production Build
```bash
# Build for production
npm run build

# Start production server
npm run start
```

## Usage

1. **Upload Excel File**: Use the file upload component to import sales data
   - Required columns: State, City, Latitude, Longitude, 2022, 2023, 2024, 2025, Total
   - System automatically geocodes Indian cities using Google API

2. **Map Visualization**: 
   - Interactive markers show sales data for each city
   - Hover over markers to see 4-year sales breakdown
   - Toggle labels and view modes using map controls

3. **Analytics Dashboard**:
   - View executive metrics and KPIs
   - Filter data by year ranges
   - Analyze growth patterns and market penetration

## Data Format

Excel files should contain the following columns:
- **State**: Indian state name
- **City**: City name within the state
- **Latitude/Longitude**: Coordinates (will be replaced by geocoded values)
- **2022, 2023, 2024, 2025**: Sales figures (units sold)
- **Total**: Total sales across all years

## API Endpoints

- `GET /api/sales-data` - Retrieve all sales data
- `POST /api/upload-excel` - Upload and process Excel files
- `GET /api/analytics` - Get analytics metrics
- `GET /api/maps-config` - Get Google Maps API configuration

## Deployment

The application is configured for Replit deployment with autoscale support. For other platforms:

1. Set environment variables
2. Ensure PostgreSQL database is accessible
3. Run `npm run build && npm run start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary software for EV market intelligence analysis.