import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Grid, Typography, CircularProgress, Paper } from '@mui/material';
import { Bar, Pie, Line } from 'react-chartjs-2';
import axios from 'axios';
import { Chart as ChartJS, registerables } from 'chart.js';
ChartJS.register(...registerables);

interface ExecutionStats {
    time: number;
    status: string;
    progress: number;
}

interface TokenMetrics {
    count: number;
    usage: number;
    cost: number;
    projection: number;
    threshold: string;
}

interface AnalyticsData {
    bar: {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
            backgroundColor?: string[];
        }[];
    };
    pie: {
        labels: string[];
        datasets: {
            data: number[];
            backgroundColor?: string[];
        }[];
    };
    line: {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
            borderColor?: string;
            backgroundColor?: string;
        }[];
    };
}

const Dashboard: React.FC = () => {
    const [query, setQuery] = useState<string>('');
    const [queryHistory, setQueryHistory] = useState<string[]>([]);
    const [liveResults, setLiveResults] = useState<string[]>([]);
    const [executionStats, setExecutionStats] = useState<ExecutionStats>({
        time: 0,
        status: 'Idle',
        progress: 0,
    });
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
        bar: {
            labels: [],
            datasets: [{
                label: 'No Data',
                data: [],
                backgroundColor: ['#3e95cd']
            }]
        },
        pie: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#3e95cd']
            }]
        },
        line: {
            labels: [],
            datasets: [{
                label: 'No Data',
                data: [],
                borderColor: '#3e95cd',
                backgroundColor: 'rgba(62, 149, 205, 0.2)'
            }]
        }
    });
    const [serverStatus, setServerStatus] = useState<string>('Online');
    const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics>({
        count: 0,
        usage: 0,
        cost: 0,
        projection: 0,
        threshold: '0%',
    });

    const handleRunQuery = async () => {
        if (!query.trim()) return;

        try {
            setExecutionStats({ ...executionStats, status: 'Running', progress: 0 });

            const response = await axios.post('/api/run-query', { query });
            const { results, timing, status } = response.data;

            setLiveResults(results);
            setExecutionStats({ time: timing, status, progress: 100 });
            setQueryHistory([query, ...queryHistory]);
        } catch (error) {
            const errorResponse = {
                error: 'Query execution failed',
                message: error instanceof Error ? error.message : 'Unknown error occurred'
            };
            console.error(errorResponse);
            setExecutionStats({ ...executionStats, status: 'Failed' });
        }
    };

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const response = await axios.get('/api/metrics');
                const { analytics, tokens, server } = response.data;

                // Safely set analytics data with defaults
                setAnalyticsData(prevData => ({
                    bar: analytics?.bar || prevData.bar,
                    pie: analytics?.pie || prevData.pie,
                    line: analytics?.line || prevData.line
                }));

                setTokenMetrics(tokens);
                setServerStatus(server);
            } catch (error) {
                const errorResponse = {
                    error: 'Metrics fetch failed',
                    message: error instanceof Error ? error.message : 'Unknown error occurred'
                };
                console.error(errorResponse);
            }
        };

        fetchMetrics();
    }, []);

    return (
        <Box p={2}>
            <Grid container spacing={2}>
                <Grid item xs={9}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="NLP Query Input"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </Grid>
                <Grid item xs={3}>
                    <Button variant="contained" color="primary" fullWidth onClick={handleRunQuery}>
                        Run Query
                    </Button>
                </Grid>
            </Grid>

            <Grid container spacing={2} mt={2}>
                <Grid item xs={4}>
                    <Paper elevation={3}>
                        <Box p={2}>
                            <Typography variant="h6">Query History</Typography>
                            <Box mt={1} style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {queryHistory.map((q, index) => (
                                    <Typography key={index}>{index + 1}. {q}</Typography>
                                ))}
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={8}>
                    <Paper elevation={3}>
                        <Box p={2}>
                            <Typography variant="h6">Live Query Results</Typography>
                            <Box mt={1} style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {liveResults.map((result, index) => (
                                    <Typography key={index}>{result}</Typography>
                                ))}
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            <Grid container spacing={2} mt={2}>
                <Grid item xs={6}>
                    <Paper elevation={3}>
                        <Box p={2}>
                            <Typography variant="h6">Execution Time & Status</Typography>
                            <Typography>Query Timing: {executionStats.time} ms</Typography>
                            <Typography>Execution Status: {executionStats.status}</Typography>
                            <CircularProgress variant="determinate" value={executionStats.progress} />
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={6}>
                    <Paper elevation={3}>
                        <Box p={2}>
                            <Typography variant="h6">Analytics</Typography>
                            <Bar data={analyticsData.bar} />
                            <Pie data={analyticsData.pie} />
                            <Line data={analyticsData.line} />
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            <Grid container spacing={2} mt={2}>
                <Grid item xs={12}>
                    <Paper elevation={3}>
                        <Box p={2}>
                            <Typography variant="h6">Token Metrics</Typography>
                            <Typography>Token Count: {tokenMetrics.count}</Typography>
                            <Typography>Token Usage: {tokenMetrics.usage} / Day</Typography>
                            <Typography>Tokens Cost: ${tokenMetrics.cost}</Typography>
                            <Typography>Projection for 30 Days: ${tokenMetrics.projection}</Typography>
                            <Typography>Threshold: {tokenMetrics.threshold}</Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;