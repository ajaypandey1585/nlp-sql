import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Box,
    SvgIcon,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Slide,
    CircularProgress
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { Insights } from '@mui/icons-material';
import MarkdownTemplate from './MarkdownTemplate';

// Styled components
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
    maxWidth: '100%',
    marginTop: theme.spacing(3),
    boxShadow: theme.shadows[3],
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
}));

const HeaderBox = styled(Box)(({ theme }) => ({
    background: `linear-gradient(45deg, #1a237e 50%, #7e1a1a 90%)`,
    padding: theme.spacing(3),
    color: '#ffffff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
}));

const StyledHeaderCell = styled(TableCell)(({ theme }) => ({
    background: `linear-gradient(to right, #1a237e, #1976d2)`,
    color: '#ffffff',
    fontWeight: 'bold',
    borderBottom: 'none',
    borderRight: '1px solid rgba(255, 255, 255, 0.15)',
    '&:last-child': {
        borderRight: 'none',
    },
    fontSize: '1rem',
    padding: '16px',
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderBottom: `1px solid ${theme.palette.grey[300]}`,
    padding: '12px',
    fontSize: '0.95rem',
    color: 'steelblue',
    fontWeight: 'bold',
}));

const TrendIndicator = styled('span')(({ isPositive }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '2px',
    marginLeft: '2px',
    verticalAlign: 'middle',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: isPositive ? '#4caf50' : '#f44336',
}));

// New animation for loading
const fadeInOut = keyframes`
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
`;

const LoadingContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(3),
    animation: `${fadeInOut} 1.5s ease-in-out infinite`,
}));

const UpwardArrowIcon = () => (
<SvgIcon sx={{ color: '#ffffff', fontSize: '24px' }}>
   <path d="M7 14l5-5 5 5H7z" />
</SvgIcon>
);

const DownwardArrowIcon = () => (
<SvgIcon sx={{ color: '#ffffff', fontSize: '16px' }}>
   <path d="M7 10l5 5 5-5H7z" />
</SvgIcon>
);

// Slide transition for dialog
const Transition = React.forwardRef(function Transition(props, ref) {
   return <Slide direction="up" ref={ref} {...props} />;
});

const InsightsDialog = ({ open, onClose, insights, isLoading }) => {
   return (
       <Dialog open={open} TransitionComponent={Transition} onClose={onClose} aria-labelledby="insights-dialog-title" maxWidth="sm" fullWidth PaperProps={{
           sx: {
               background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
               boxShadow: '0 8px 32px 0 rgba(66, 38, 135, 0.37)',
               borderRadius: '15px',
           }
       }}>
           <DialogTitle id="insights-dialog-title" sx={{
               backgroundColor: 'rgba(25, 118, 210, 0.1)',
               color: '#1976d2',
               fontWeight: 'bold',
               borderBottom: '1px solid rgba(25, 118, 210, 0.2)',
               padding: 2
           }}>
               Market Performance Insights
           </DialogTitle>
           <DialogContent dividers>
               {isLoading ? (
                   <LoadingContainer>
                       <CircularProgress size={50} thickness={4} sx={{ color: '#1976d2' }} />
                   </LoadingContainer>
               ) : (
                   <DialogContentText>
                       <Typography variant="body1" sx={{
                           whiteSpace: 'pre-wrap',
                           color: '#37474f',
                           lineHeight: 1.6,
                           letterSpacing: '0.5px'
                       }}>
                           <MarkdownTemplate markdownText={insights} />
                       </Typography>
                   </DialogContentText>
               )}
           </DialogContent>
           <DialogActions sx={{ padding: 2 }}>
               <Button onClick={onClose} color="primary" variant="contained" sx={{
                   backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#115293' }
               }}>
                   Close
               </Button>
           </DialogActions>
       </Dialog>
   );
};

const PerformanceTable = ({ performanceText, performanceType = 'all' }) => {
   const [performanceData, setPerformanceData] = useState([]);
   const [parseError, setParseError] = useState(null);
   const [insights, setInsights] = useState('');
   const [isInsightsDialogOpen, setIsInsightsDialogOpen] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   console.log(performanceText);
   useEffect(() => {
    const parsePerformanceData = (text) => {
        try {
            const indexMap = new Map();
            
            // Comprehensive regex patterns to handle different input formats
            const patterns = [
                // Pattern 1: Detailed format with Market Index ID
                {
                    regex: /Fund Name:\s*(.*?)\s*-\s*Market Index ID:\s*(\d+)\s*-\s*(?:MTD|QTD|YTD) Performance:\s*(-?[\d\.]+)%/,
                    extractor: (match) => ({
                        indexName: match[1].trim(),
                        marketIndexId: match[2],
                        performance: match[3].trim(),
                        hasMarketIndexId: true
                    })
                },
                // Pattern 2: Simple format with just index name and performance
                {
                    regex: /(.*?)\s*:\s*(-?[\d\.]+)%/,
                    extractor: (match) => ({
                        indexName: match[1].trim(),
                        performance: match[2].trim(),
                        hasMarketIndexId: false
                    })
                },
                // Pattern 3: More flexible format with variations
                {
                    regex: /(?:^|\n)\s*(.*?)\s*(?:MTD|QTD|YTD)?\s*[:-]\s*(-?[\d\.]+)%/,
                    extractor: (match) => ({
                        indexName: match[1].trim(),
                        performance: match[2].trim(),
                        hasMarketIndexId: false
                    })
                },
                // Pattern 4: Numbered list format (for top performing indexes)
                {
                    regex: /\d+\.\s*\*\*(.*?)\*\*:\s*(-?[\d\.]+)%/,
                    extractor: (match) => ({
                        indexName: match[1].trim(),
                        performance: match[2].trim(),
                        hasMarketIndexId: false
                    })
                },
                // Pattern 5: New detailed list format with bold text
                {
                    regex: /\d+\.\s*\*\*Fund Name:\*\*\s*(.*?)\s*-\s*\*\*Market Index ID:\*\*\s*(\d+)\s*-\s*\*\*(?:MTD|QTD|YTD) Performance:\*\*\s*(-?[\d\.]+)%/,
                    extractor: (match) => ({
                        indexName: match[1].trim(),
                        marketIndexId: match[2],
                        performance: match[3].trim(),
                        hasMarketIndexId: true
                    })
                }
            ];
    
            // Helper function to extract performance data
            const extractPerformance = (text, timeframe) => {
                // Normalize text to handle different section formats
                const normalizedText = text.replace(/###\s*.*?Timeframe/i, '');
                
                // Try each parsing pattern
                patterns.forEach(({ regex, extractor }) => {
                    const matches = [...normalizedText.matchAll(new RegExp(regex, 'g'))];
                    
                    matches.forEach(match => {
                        const extractedData = extractor(match);
                        const { indexName, marketIndexId, performance } = extractedData;
    
                        // Initialize or update index entry
                        if (!indexMap.has(indexName)) {
                            const baseEntry = { 
                                index_name: indexName, 
                                mtd: null, 
                                qtd: null, 
                                ytd: null 
                            };
                            
                            // Add market index ID if available
                            if (extractedData.hasMarketIndexId && marketIndexId) {
                                baseEntry.market_index_id = marketIndexId;
                            }
                            
                            indexMap.set(indexName, baseEntry);
                        }
    
                        // Update performance for specific timeframe
                        const entry = indexMap.get(indexName);
                        entry[timeframe] = performance;
                    });
                });
            };
    
            // Define timeframe extraction patterns
            const timeframePatterns = {
                mtd: [
                    /### (?:Month to Date|MTD)([\s\S]*?)(?=###|$)/i,
                    /Here are the top 5 Index performing summaries in Month to Date \(MTD\):([\s\S]*?)These performances/i
                ],
                qtd: /### (?:Quarter to Date|QTD)([\s\S]*?)(?=###|$)/i,
                ytd: [
                    /### (?:Year to Date|YTD)([\s\S]*?)(?=###|$)/i,
                    /Here are the top 5 performing Index summaries for Year to Date \(YTD\):([\s\S]*?)These percentages/i
                ]
            };
    
            // Extract data for each timeframe
            Object.entries(timeframePatterns).forEach(([timeframe, patterns]) => {
                const patternArray = Array.isArray(patterns) ? patterns : [patterns];
                
                for (const pattern of patternArray) {
                    const match = text.match(pattern);
                    if (match) {
                        extractPerformance(match[1], timeframe);
                        break; // Stop after first successful match
                    }
                }
            });
    
            // Fallback: If no section-based parsing works, parse entire text
            if (indexMap.size === 0) {
                patterns.forEach(({ regex, extractor }) => {
                    const matches = [...text.matchAll(new RegExp(regex, 'g'))];
                    
                    matches.forEach(match => {
                        const extractedData = extractor(match);
                        const { indexName, marketIndexId, performance } = extractedData;
    
                        // Determine timeframe (if possible)
                        let timeframe = 'mtd'; // default
                        if (match[0].includes('QTD')) timeframe = 'qtd';
                        if (match[0].includes('YTD')) timeframe = 'ytd';
    
                        // Initialize or update index entry
                        if (!indexMap.has(indexName)) {
                            const baseEntry = { 
                                index_name: indexName, 
                                mtd: null, 
                                qtd: null, 
                                ytd: null 
                            };
                            
                            // Add market index ID if available
                            if (extractedData.hasMarketIndexId && marketIndexId) {
                                baseEntry.market_index_id = marketIndexId;
                            }
                            
                            indexMap.set(indexName, baseEntry);
                        }
    
                        // Update performance for determined timeframe
                        const entry = indexMap.get(indexName);
                        entry[timeframe] = performance;
                    });
                });
            }
    
            // Return the parsed data
            return Array.from(indexMap.values());
        } catch (error) {
            console.error("Parsing Error:", error);
            return [];
        }
    };
    
    
    
        
    
    
    
    
    
    
       if (performanceText) {
           const parsed = parsePerformanceData(performanceText);
           console.log("Parsed Data:", parsed);
           setPerformanceData(parsed);
       }
   }, [performanceText]);

   const fetchInsights = async () => {
       setIsLoading(true);
       try {
           const response = await axios.post('http://localhost:5000/getInsights', {
               data: performanceData.map(item => ({
                   name: item.index_name,
                   id:item.index_id ||'N/A', 
                   performance:{ mtd:item.mtd,qtd:item.qtd,ytd:item.ytd}
                })),
                context:'Market Performance Summary'
           });
           setInsights(response.data.insights);
           setIsInsightsDialogOpen(true);
       } catch (error) {
           console.error('Error fetching insights:', error);
           setInsights('Unable to generate insights at the moment.');
           setIsInsightsDialogOpen(true);
       } finally {
           setIsLoading(false);
       }
   };

   const getTrendIndicator = (value) => {
       if (!value || value === 'N/A') return null;
       const numValue = parseFloat(value);
       return numValue < 0;
   };

   const formatValue = (value) => {
       if (!value || value === 'N/A') return 'N/A';
       return `${parseFloat(value).toFixed(2)}%`;
   };

   const getVisibleColumns = () => {
    console.log(performanceType,performanceType)
       switch(performanceType) {
           case 'MTD':
               return ['mtd'];
           case 'QTD':
               return ['qtd'];
           case 'YTD':
               return ['ytd'];
           default:
               return ['mtd', 'qtd', 'ytd'];
       }
   };

   const visibleColumns = getVisibleColumns();

   return (
       <Paper elevation={3} sx={{ borderRadius: 2, overflow:'hidden'}}>
           <HeaderBox>
              <Box>
              <Typography variant="h5" component="h2" fontWeight="bold">
            {performanceType === 'mtd'
              ? 'Month to Date'
              : performanceType === 'qtd'
              ? 'Quarter to Date'
              : performanceType === 'ytd'
              ? 'Year to Date'
              : 'Market Performance Summary'}
          </Typography>
                  <Typography variant="subtitle2" sx={{ mt :1 , opacity :0.9}}>
                      Market Indices Performance
                  </Typography>
              </Box>
              <Button variant="contained" color="primary" startIcon={!isLoading &&<Insights />} onClick={fetchInsights} disabled={isLoading || performanceData.length===0}
              sx={{
                  position:'relative', 
                  backgroundColor:isLoading?'#4A90E2':'rgba(255 ,255 ,255 ,0.2)', 
                  color:'#ffffff', 
                  fontWeight:'bold', 
                  opacity:isLoading?0.9 :1 ,
                  display:'flex', 
                  alignItems:'center', 
                  justifyContent:'center', 
                  overflow:'hidden', 
                  '& :hover':{backgroundColor:isLoading?'#357ABD':'rgba(255 ,255 ,255 ,0.3)',},
                  '& .MuiButton-startIcon':{opacity:isLoading?0 :1,},
                  '& ::after':{
                      content:'""', 
                      position:'absolute', 
                      top :0 , 
                      left:'-150%', 
                      width:'200%', 
                      height:'100%', 
                      background:'linear-gradient(120deg , rgba(255 ,255 ,255 ,0)30%, rgba(255 ,255 ,255 ,0.4)50%, rgba(255 ,255 ,255 ,0)70%)', 
                      transform:'skewX(-30deg)', 
                      animation :'shimmer 2s infinite', 
                      zIndex :1 ,
                  },
                  zIndex :2 ,
              }}>
              {isLoading ? (
                <>
                <CircularProgress size={20} sx={{color:'#ffffff' , marginRight :1}} />
                <span style={{color:'#ffffff'}}>Generating Insights...</span>
                </>
              ):(
                "Get Insights"
              )}
              </Button>
              <style jsx>{`
                 @keyframes shimmer{
                     0%{left:-150%;}
                     100%{left :150%;}
                 }
              `}</style>
          </HeaderBox>

          <StyledTableContainer>
              <Table aria-label="performance table" size="medium" sx={{borderCollapse:'collapse',border:'1px solid #aaa'}}>
                  <TableHead>
                      <TableRow>
                          <StyledHeaderCell sx={{border :'1px solid #ddd'}}>Index Name</StyledHeaderCell>  
                          {visibleColumns.map(col=>(
                              <StyledHeaderCell key={col} align="center" sx={{border :'1px solid #aaa'}}>
                                  {col.toUpperCase()}
                              </StyledHeaderCell>  
                          ))}
                      </TableRow>  
                  </TableHead>

                  <TableBody>
                      {performanceData.length >0 ? (
                          performanceData.map((row,index)=>(
                              <TableRow key={index} hover sx={{
                                  '& :last-child td , &:last-child th':{border :1},
                                  '& :hover':{backgroundColor:'#f5f5f5'},
                                  border :'1px solid #aaa'
                              }}>
                                  <StyledTableCell component="th" scope="row" sx={{borderRight :'1px solid #aaa'}}>
                                      {row.index_name}
                                  </StyledTableCell>

                                  {visibleColumns.map(col=>(
                                      <StyledTableCell key={col} component="th" scope="row" sx={{borderRight :'1px solid #aaa'}}>
                                          {formatValue(row[col])}
                                          {getTrendIndicator(row[col]) !== null && (
                                              <TrendIndicator isPositive={!getTrendIndicator(row[col])}>
                                                  {!getTrendIndicator(row[col]) ?<UpwardArrowIcon />:<DownwardArrowIcon />}
                                              </TrendIndicator>  
                                          )}
                                      </StyledTableCell>  
                                  ))}
                              </TableRow>  
                          ))
                      ):(
                          <TableRow>
                              <StyledTableCell colSpan={visibleColumns.length +1 } align ="center">
                                  No data available
                              </StyledTableCell>  
                          </TableRow>  
                      )}
                  </TableBody>  
              </Table>  
          </StyledTableContainer>

          <InsightsDialog open={isInsightsDialogOpen} onClose={() => setIsInsightsDialogOpen(false)} insights={insights} isLoading={isLoading}/>
      </Paper>  
   );
};

export default PerformanceTable;