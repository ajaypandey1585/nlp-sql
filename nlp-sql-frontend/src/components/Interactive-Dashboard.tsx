import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, CardHeader, Button, CircularProgress } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import BarChartIcon from '@mui/icons-material/BarChart';
import PerformanceTable from './FormatResponse';
import axios from 'axios';
import queries from './../queries';
import * as XLSX from 'xlsx';

interface PerformanceData {
  index_name: string;
  performance: number;
}

interface ColumnWidths {
  [key: string]: number;
}

interface PerformanceDataSet {
  all: PerformanceData[];
  ytd: PerformanceData[];
  qtd: PerformanceData[];
  mtd: PerformanceData[];
  non_performing: PerformanceData[];
}

const InteractiveDashboard: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceDataSet>({
    all: [],
    ytd: [],
    qtd: [],
    mtd: [],
    non_performing: []
  });
  const [selectedChartData, setSelectedChartData] = useState<PerformanceData[]>([]);
  const [selectedChartTitle, setSelectedChartTitle] = useState<string>('');
  const [isChartOpen, setIsChartOpen] = useState<boolean>(false);
  const [loadingStates, setLoadingStates] = useState({
    all: true,
    ytd: true,
    qtd: true,
    mtd: true,
    non_performing: true
  });
  const [error, setError] = useState<string | null>(null);
  const handleOpenChart = (data: PerformanceData[], title: string) => {
    setSelectedChartData(data);
    setSelectedChartTitle(title);
    setIsChartOpen(true);
  };

  const handleCloseChart = () => {
    setIsChartOpen(false);
  };

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        const apiCalls = [
          { key: 'all', url: 'http://localhost:5000/query-all' },
          { key: 'ytd', url: 'http://localhost:5000/query-ytd' }
          // { key: 'qtd', url: 'http://localhost:5000/query-qtd' },
          // { key: 'mtd', url: 'http://localhost:5000/query-mtd' }
          // { key: 'non_performing', url: 'http://localhost:5000/query-non-performing' }
        ];
  
        // Loop through each API call
        apiCalls.forEach(async (call) => {
          try {
            let queryBody = {};
            // Set the query body based on the key
            if (call.key === 'all') {
              queryBody = { query: queries.queries[0] };
            } else if (call.key === 'mtd') {
              queryBody = { query: queries.queries[1] };
            } else if (call.key === 'qtd') {
              queryBody = { query: queries.queries[2] };
            } else if (call.key === 'ytd') {
              queryBody = { query: queries.queries[3] };
            } else if (call.key === 'non_performing') {
              queryBody = { query: queries.queries[4] };
            }
  
            const response = await axios.post(call.url, queryBody);
            if (response.status === 200) {
              // Update performance data and loading state immediately
              setPerformanceData(prevData => ({
                ...prevData,
                [call.key]: response.data[call.key] || []
              }));
              setLoadingStates(prevStates => ({
                ...prevStates,
                [call.key]: false
              }));
            }
          } catch (err) {
            console.error(`Error fetching ${call.key} data:`, err);
            setLoadingStates(prevStates => ({
              ...prevStates,
              [call.key]: false
            }));
          }
        });
      } catch (err) {
        console.error('Error in overall data fetching:', err);
        setError('Failed to fetch performance data');
      }
    };
  
    fetchPerformanceData();
  }, []);

  const fetchFormattedData = async (data: string) => {
    console.log(data);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer <<TOKEN>>`
      },
      body: JSON.stringify({
        max_tokens: 2000,
        model: "gpt-4o-mini",
        "messages": [{"role": "user", "content":`Format the following data for Excel export:\n\n${data}\n\nOutput as JSON array of objects with keys "Index", "ID", and "MTD or QTD or YTD (based on the relevant sections". Just make json with the Index Names , MTD or QTD or YTD or Entire three performmance values`}],
        n: 1,
        stop: null,
        temperature: 0.5
      })
    }); 

    console.log(response)
    const result = await response.json();
    console.log(result)
    return result.choices[0].message.content;
  };

  const exportToExcel = (jsonData: any, title: string): void => {
    try {
      let dataArray: any[];

      // Handle different input types
      if (Array.isArray(jsonData)) {
        // If it's already an array, check its first element
        if (typeof jsonData[0] === 'string') {
          try {
            // Attempt to parse the first string element as JSON
            dataArray = JSON.parse(jsonData[0]);
          } catch {
            console.error("Unable to parse JSON from string input");
            return;
          }
        } else {
          // If it's an array of objects, use it directly
          dataArray = jsonData;
        }
      } else if (typeof jsonData === 'string') {
        // If it's a direct string, try parsing
        try {
          dataArray = JSON.parse(jsonData);
        } catch {
          console.error("Unable to parse JSON from string");
          return;
        }
      } else {
        // For any other type, convert to array
        dataArray = [jsonData];
      }

      // Ensure data is an array and not empty
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        console.warn("No data to export");
        return;
      }

      // Flatten performance metrics
      const safeData = dataArray.map((item: any) => {
        // Check if Performance is an object
        if (typeof item.Performance === 'object' && item.Performance !== null) {
          return {
            Index: String(item.Index || ''),
            ID: String(item.ID || ''),
            MTD: String(item.Performance.MTD || 'N/A'),
            QTD: String(item.Performance.QTD || 'N/A'),
            YTD: String(item.Performance.YTD || 'N/A')
          };
        }
        // If Performance is not an object, use original approach
        console.log(item)
        return {
          Index: String(item.Index || ''),
          ID: String(item.ID || ''),
          Performance: [
            item.YTD && `YTD: ${String(item.YTD)}`,
            item.QTD && `QTD: ${String(item.QTD)}`,
            item.MTD && `MTD: ${String(item.MTD)}`
          ].filter(Boolean).join(' | ') || 'N/A'
        };
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(safeData);

      // Column width calculation
      const columnWidths = [
        { wch: Math.max(...safeData.map(row => row.Index.length), 10) + 2 },
        { wch: Math.max(...safeData.map(row => row.ID.length), 10) + 2 },
        { wch: Math.max(...safeData.map(row => row.MTD ? row.MTD.length : 0), 10) + 2 },
        { wch: Math.max(...safeData.map(row => row.QTD ? row.QTD.length : 0), 10) + 2 },
        { wch: Math.max(...safeData.map(row => row.YTD ? row.YTD.length : 0), 10) + 2 }
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook, 
        worksheet, 
        title.replace(/[\/\[\]]/g, '_').substring(0, 31)
      );

      // Generate filename
      const filename = `${title.replace(/[\/\[\]]/g, '_')}_Performance_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

    } catch (error) {
      console.error("Excel Export Error:", error);
    }
  };

  const handleExportToExcel = async (data: PerformanceData[], title: string) => {
    try {
      const formattedData = await fetchFormattedData(JSON.stringify(data));
      console.log('Formatted Data:', formattedData);
      
      // Parse the formatted data if it's a string containing JSON
      const parsedData = typeof formattedData === 'string' 
        ? JSON.parse(formattedData.match(/\[.*\]/s)?.[0] || '[]')
        : formattedData;

      exportToExcel(parsedData, title);
    } catch (error) {
      console.error("Failed to fetch formatted data", error);
    }
  };

  const renderPerformanceTable = (
    data: PerformanceData[],
    title: string,
    isLoading: boolean,
    performanceType: string
  ) => (
    <Card
      sx={{
        background: 'linear-gradient(to bottom, #f7f9fc, #e3f2fd)',
        borderRadius: '12px',
        boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)',
        padding: '16px'
      }}
    >
      <CardHeader
        title={
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1565c0' }}>
            {title}
          </Typography>
        }
      />
      <CardContent>
        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <>
            <PerformanceTable performanceText={data} performanceType={performanceType} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => handleExportToExcel(data, title)} // Pass the string data directly
                sx={{
                  textTransform: 'none',
                  borderColor: '#64b5f6',
                  color: '#1565c0',
                  '&:hover': {
                    backgroundColor: '#e3f2fd'
                  }
                }}
              >
                Export to Excel
              </Button>
              <Button
                variant="outlined"
                startIcon={<BarChartIcon />}
                sx={{
                  textTransform: 'none',
                  borderColor: '#64b5f6',
                  color: '#1565c0',
                  '&:hover': {
                    backgroundColor: '#e3f2fd'
                  }
                }}
              >
                View Chart
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 4, height: '100vh', overflowY: 'auto', backgroundColor: '#f5f5f5' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          padding: '8px 16px',
          borderRadius: '8px',
          background: 'linear-gradient(to right, #1565c0, #42a5f5)',
          color: 'white'
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Interactive Dashboard
        </Typography>
      </Box>
      <Grid container spacing={4}>
        <Grid item xs={12}>
          {renderPerformanceTable(performanceData.all, 'Top Performing Indexes', loadingStates.all, 'Top-Indexes')}
        </Grid>
        <Grid item xs={12}>
          {renderPerformanceTable(performanceData.ytd, 'Top 5 YTD Performers', loadingStates.ytd, 'YTD')}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderPerformanceTable(performanceData.qtd, 'Top 5 QTD Performers', loadingStates.qtd, 'QTD')}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderPerformanceTable(performanceData.mtd, 'Top 5 MTD Performers', loadingStates.mtd, 'MTD')}
        </Grid>
        <Grid item xs={12}>
          {renderPerformanceTable(performanceData.non_performing, 'Non-performing Indexes', loadingStates.non_performing, 'Non-performing')}
        </Grid>
      </Grid>
      {/* <PerformanceChart 
        data={selectedChartData}
        title={selectedChartTitle}
        open={isChartOpen}
        onClose={handleCloseChart}
      /> */}
    </Box>
  );
};

export default InteractiveDashboard;