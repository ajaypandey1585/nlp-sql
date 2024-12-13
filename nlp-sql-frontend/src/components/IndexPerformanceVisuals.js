import React, { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

const parsePerformanceData = (text) => {
  const sections = {
    mtd: [],
    qtd: [],
    ytd: []
  };

  const sectionTitles = ['Month to Date (MTD) Performance', 'Quarter to Date (QTD) Performance', 'Year to Date (YTD) Performance'];
  const sectionKeys = ['mtd', 'qtd', 'ytd'];

  sectionTitles.forEach((title, index) => {
    const sectionRegex = new RegExp(`${title}\\n(.*?)(?=###|$)`, 's');
    const sectionMatch = text.match(sectionRegex);
    
    if (sectionMatch) {
      const performanceLines = sectionMatch[1].trim().split('\n');
      sections[sectionKeys[index]] = performanceLines.map(line => {
        const match = line.match(/\*\*(.*?)\*\* \(ID: (\d+)\) - \*\*Performance: ([\d.]+)%\*\*/);
        if (match) {
          return {
            name: match[1],
            id: parseInt(match[2]),
            performance: parseFloat(match[3])
          };
        }
        return null;
      }).filter(Boolean);
    }
  });

  return sections;
};

const IndexPerformanceVisuals = ({ performanceText }) => {
    console.log(performanceText)
  const performanceData = useMemo(() => parsePerformanceData(performanceText), [performanceText]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!performanceData) return [];

    const periods = ['MTD', 'QTD', 'YTD'];
    return periods.map((period, index) => {
      const periodKey = period.toLowerCase();
      const periodData = performanceData[periodKey];
      
      return {
        period,
        ...Object.fromEntries(
          periodData.map(item => [item.name, item.performance])
        )
      };
    });
  }, [performanceData]);

  // Render performance table
  const renderPerformanceTable = (performanceList, title) => {
    if (!performanceList || performanceList.length === 0) return null;

    return (
      <div className="mt-4">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Rank</th>
              <th className="border p-2">Index Name</th>
              <th className="border p-2">Index ID</th>
              <th className="border p-2">Performance</th>
            </tr>
          </thead>
          <tbody>
            {performanceList.map((index, idx) => (
              <tr key={index.id} className="hover:bg-gray-50">
                <td className="border p-2 text-center">{idx + 1}</td>
                <td className="border p-2">{index.name}</td>
                <td className="border p-2 text-center">{index.id}</td>
                <td className="border p-2 text-right">{index.performance}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      {/* Responsive Chart */}
      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            {performanceData && performanceData.mtd && performanceData.mtd.length > 0 && Object.keys(performanceData.mtd[0])
  .filter(key => key !== 'name' && key !== 'id')
  .map((indexName) => (
    <Line 
      key={indexName}
      type="monotone" 
      dataKey={indexName}
      stroke={`#${Math.floor(Math.random()*16777215).toString(16)}`}
    />
  ))
}

          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Performance Tables */}
      {performanceData && (
        <div>
          {renderPerformanceTable(performanceData.mtd, 'Month to Date (MTD) Performance')}
          {renderPerformanceTable(performanceData.qtd, 'Quarter to Date (QTD) Performance')}
          {renderPerformanceTable(performanceData.ytd, 'Year to Date (YTD) Performance')}
        </div>
      )}
    </div>
  );
};

export default IndexPerformanceVisuals;