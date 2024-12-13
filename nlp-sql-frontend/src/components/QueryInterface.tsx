import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  TextField,
  Button,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  styled
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import queryData from './../queries';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { useSession } from './SessionContext';
import IndexPerformanceTable from './FormatResponse.js';
import { Sparkles } from 'lucide-react';
import InteractiveDashboard from './Interactive-Dashboard';
import { 
  Analytics as InsightsIcon, 
  Dashboard as DashboardIcon, 
  Report as ReportIcon, 
  Settings as SettingsIcon 
} from '@mui/icons-material';

// Define the props for our tile component
interface TileProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
}

// Tile component with a clean, modern design
const DashboardTile: React.FC<TileProps> = ({ icon, title, onClick }) => {
  return (
    <Box 
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'start',
        padding: 2,
        borderRadius: 3,
        background: 'linear-gradient(145deg, #f0f0f0, #ffffff)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        height: '100%',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 6px 8px rgba(0, 0, 0, 0.15)',
        }
      }}
    >
      {React.cloneElement(icon as React.ReactElement, {
        sx: { 
          fontSize: 40, 
          marginRight: 2, 
          color: '#1F5EFFFF' 
        }
      })}
      <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
        {title}
      </Typography>
    </Box>
  );
};

// Dashboard Top Section Component
const DashboardTopSection: React.FC = () => {
  // Sample onClick handlers - replace with your actual logic
  const handleGetInsights = () => {
    console.log('Get Insights clicked');
  };

  const handleIndexDashboard = () => {
    console.log('Index Dashboard clicked');
  };

  const handleReports = () => {
    console.log('Reports clicked');
  };

  const handleSettings = () => {
    console.log('Settings clicked');
  };

  return (
    <Box sx={{ flexGrow: 1, marginBottom: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardTile 
            icon={<InsightsIcon />}
            title="Get Insights"
            onClick={handleGetInsights}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardTile 
            icon={<DashboardIcon />}
            title="Index Dashboard"
            onClick={handleIndexDashboard}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardTile 
            icon={<ReportIcon />}
            title="Reports"
            onClick={handleReports}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardTile 
            icon={<SettingsIcon />}
            title="Settings"
            onClick={handleSettings}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

// Define types
type QueryResult = any; // Update this based on your actual result type
type AvailableQuery = string;

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-root': {
    backgroundColor: '#FFFFFFFF',
    fontWeight: 'bold',
    fontFamily: '"Roboto", sans-serif',
    fontSize: '1.1rem',
    paddingRight: '60px'
  },
  '& .MuiInputBase-root.Mui-focused': {
    minHeight: '100px',
  },
  '& .MuiInputBase-input': {
    paddingRight: '60px',
  },
  '& .MuiInputBase-multiline': {
    paddingRight: '140px',
  },
  '& .MuiOutlinedInput-root': {
    transition: 'border-color 0.4s ease-in-out',
  }
}));

const StyledButton = styled(Button)(() => ({
  background: 'linear-gradient(45deg, #18025F 30%, #3B9FEB 90%)',
  transition: 'all 0.3s',
  boxShadow: '0 3px 5px 2px rgba(33, 150, 243, 0.3)',
  fontWeight: 'bold',
  color: '#FFFFFF',
  
  '&.Mui-disabled': {
    background: 'linear-gradient(45deg, #18025F 30%, #3B9FEB 90%)',
    opacity: 0.7,
    color: '#FFFFFF',
  },

  '&:hover': {
    background: 'linear-gradient(45deg, #095474 30%, #468CD7 90%)',
    boxShadow: '0 4px 6px 2px rgba(33, 150, 243, 0.3)',
  },

  '& .loading-text': {
    color: '#FFFFFF',
    visibility: 'visible',
    opacity: 1,
  },

  '& .MuiCircularProgress-root': {
    color: '#FFFFFF',
    marginLeft: '8px',
  },
}));

const QueryTile = styled(Paper)(({ theme }) => ({
  cursor: 'pointer',
  padding: theme.spacing(2),
  transition: 'all 0.3s ease-in-out',
  position: 'sticky',
  top: '72px', // Adjust based on title's height
  zIndex: 9,
  background: 'linear-gradient(45deg, #F0F7FF 30%, #E3F2FD 90%)',
  '&:hover': {
    transform: 'translateY(-4px)',
    background: 'linear-gradient(45deg, #E3F2FD 30%, #BBDEFB 90%)',
    boxShadow: '0 4px 8px rgba(33, 150, 243, 0.2)',
  },
}));

const MessageContainer = styled(Paper)(({ isUser }: { isUser: boolean }) => ({
  margin: '8px 0',
  padding: '12px 10px',
  alignSelf: isUser ? 'flex-end' : 'flex-start',
  backgroundColor: isUser ? '#E3F2FD' : '#FFFFFF',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
}));

const MemoizedQueryTile = React.memo(QueryTile);

interface InteractiveDashboardButtonProps {
  onClick: () => void;
}

const InteractiveDashboardButton: React.FC<InteractiveDashboardButtonProps> = ({ onClick }) => {
  return (
    <Button
      onClick={onClick}
      variant="contained"
      sx={{
        position: 'absolute', // Change to fixed to stick to viewport
        top: 0.5,
        right: 16,
        zIndex: 1000, // Ensure it's above other elements
        background: 'linear-gradient(to right, #96C0FEFF, #1F5EFFFF)',
        color: 'white',
        fontWeight: 'bold',
        px: 2,
        py: 0.5,
        borderRadius: '9999px',
        minHeight: 'auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s',
        '&:hover': {
          transform: 'scale(1.05)',
          boxShadow: '0 6px 8px rgba(0, 0, 0, 0.15)'
        }
      }}
    >
      <Sparkles style={{ width: '18px', height: '19px', marginRight: '9px' }} />
      Index Dashboard
    </Button>
  );
 };

const QueryInterface: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<boolean>(false);
  const [availableQueries, setAvailableQueries] = useState<AvailableQuery[]>(queryData.queries);
  const [tileQueries, setTileQueries] = useState<AvailableQuery[]>([]);
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { sessions, currentSessionId, addQueryToSession } = useSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);  

  // Get current session's messages
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const sessionMessages = currentSession?.queries || [];

  const toggleDashboard = () => {
    setShowDashboard((prev) => !prev);
  };

  useEffect(() => {
    refreshTiles();
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionMessages]);

  const refreshTiles = (): void => {
    const shuffled = [...availableQueries].sort(() => 0.5 - Math.random());
    setTileQueries(shuffled.slice(0, 4));
  };

  const handleTileClick = (selectedQuery: AvailableQuery): void => {
    setError(null);
    setQuery(selectedQuery);
    setAvailableQueries(availableQueries.filter((q) => q !== selectedQuery));
    setTileQueries(tileQueries.map((q) =>
      q === selectedQuery ? getRandomQuery(selectedQuery) : q
    ));
  };

  const getRandomQuery = (excludeQuery: AvailableQuery): AvailableQuery => {
    const remainingQueries = availableQueries.filter((q) => q !== excludeQuery);
    if (remainingQueries.length === 0) return 'No more queries available';
    return remainingQueries[Math.floor(Math.random() * remainingQueries.length)];
  };

  const playTone = (frequency: number, duration: number) => {
    if (!audioContextRef.current) return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    
    gainNode.gain.setValueAtTime(0.5, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    oscillator.start();
    oscillator.stop(audioContextRef.current.currentTime + duration);
  };

  const handleVoiceInput = (): void => {
    setError(null);
    if (!('webkitSpeechRecognition' in window)) {
      setError('Voice input not supported in this browser');
      return;
    }

    if (!recording) {
      setQuery('');
      playTone(440, 0.2);
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;

    recognition.onstart = () => setRecording(true);
    recognition.onend = () => {
      setRecording(false);
      playTone(392, 0.2);
    };
    recognition.onerror = (event: any) => {
      playTone(277.18, 0.5);
      setError(event.error === 'no-speech' ? 'No speech detected' : 'Voice input failed');
      setRecording(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      const sentenceCaseTranscript = transcript.charAt(0).toUpperCase() + transcript.slice(1).toLowerCase();
      setQuery((prevQuery) => `${prevQuery} ${sentenceCaseTranscript}`.trim());
    };

    recording ? recognition.stop() : recognition.start();
  };

  const handleSubmit = async (): Promise<void> => {
    if (!query.trim()) return;

    const currentQuery = query.trim();
    setLoading(true);
    setError(null);
    
    // Immediately clear the input and add query to display
    setQuery('');
    addQueryToSession(currentQuery, null); // Add query immediately with null result

    try {
      const response = await fetch('http://localhost:5000/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: currentQuery }),
      });

      if (!response.ok) {
        throw new Error('Query failed. Please try again.');
      }

      const data = await response.json();
      
      // Update the session with the result
      addQueryToSession(currentQuery, data.qr);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Remove the query if there was an error
      addQueryToSession(currentQuery, 'Error processing query');
    } finally {
      setLoading(false);
      // Focus back on textarea after response
      inputRef.current?.focus();
    }
  };

  const isPerformanceData = (result: any): boolean => {
    if (typeof result === 'string') {
      return result.includes('### Month to Date') ||
             result.includes('### Quarter to Date') ||
             result.includes('### Year to Date');
    } else if (typeof result === 'object') {
      // Check if the object has specific properties indicating performance data
      return (
        result?.hasOwnProperty('Month to Date (MTD)') &&
        result?.hasOwnProperty('Quarter to Date (QTD)') &&
        result?.hasOwnProperty('Year to Date (YTD)')
      );
    }
    return false;
  };

  // In your component

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const renderResult = (result: any) => {
    console.log(isPerformanceData(result)) 
    if (isPerformanceData(result)) {
      return <IndexPerformanceTable performanceText={result}/>;
    }
    
    return (
      <Typography
        sx={{
          whiteSpace: 'pre-wrap',
          fontFamily: '"Roboto", sans-serif',
          fontSize: '1.1rem',
          color: '#0f23ba',
        }}
      >
        {result}
      </Typography>
    );
  };

  return (
    <Box sx={{ 
      height: '100vh',
      marginTop: 4,
      bgcolor: '#fcf9f6', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <InteractiveDashboardButton onClick={toggleDashboard} />
      {showDashboard ? (
        <InteractiveDashboard />

      ) : (
        <Container maxWidth="lg" sx={{ 
          flex: 1, 
          width: '100%',
          height: '100%',
          display: 'flex', 
          flexDirection: 'column', 
          bgcolor: '#ffffff', 
          borderRadius: 2,
          overflow: 'hidden'
        }}>
            <Box sx={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              bgcolor: '#ffffff',
              borderBottom: 1,
              borderColor: 'divider',
              py: 2
            }}>
              <Typography
                variant="h4"
                sx={{
                  flex: 1,
                  fontSize: '1.7rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  p: 3,
                  background: 'linear-gradient(90deg, rgb(44, 11, 244), rgb(44, 39, 176), rgb(11, 30, 99), rgb(44, 67, 54))',
                  backgroundSize: '300%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'colorRotate 4s linear infinite',
                  '@keyframes colorRotate': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                  },
                }}
              >
                NLP-SQL - AssestEdgeAI
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.7rem',
                    verticalAlign: 'super',
                    fontWeight: 'bold',
                  }}
                >
                  - Voice enabled  - Query Interface
                </Typography>
              </Typography>
              <Box sx={{ px: 3, mb: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                  {tileQueries.map((tileQuery, index) => (
                    <MemoizedQueryTile
                      key={index}
                      elevation={2}
                      onClick={() => handleTileClick(tileQuery)}
                    >
                      <Typography variant="body2" sx={{ color: 'rgb(37,82,147)', fontWeight: 'medium' }}>
                        {tileQuery}
                      </Typography>
                    </MemoizedQueryTile>
                  ))}
                </Box>
              </Box>
            </Box>

            {/* Scrollable Content Section */}
            <Box sx={{ 
              flex: 1, 
              overflowY: 'auto', 
              px: 3, 
              display: 'flex', 
              flexDirection: 'column',
            }}>
              {sessionMessages.length > 0 && (
                sessionMessages.map((msg, index) => (
                  <React.Fragment key={index}>
                    <MessageContainer isUser={true}>
                      <Typography sx={{ fontWeight: 'medium' }}>{msg.query}</Typography>
                    </MessageContainer>
                    <MessageContainer isUser={false}>
                      {renderResult(msg.result)}
                    </MessageContainer>
                  </React.Fragment>
                ))
              )}
              {sessionMessages.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
                  No messages yet
                </Typography>
              )}
              {sessionMessages.length > 0 && <div ref={messagesEndRef} />}
            </Box>

            {/* Sticky Footer Section */}
            <Box sx={{ 
              p: 3, 
              borderTop: 1, 
              borderColor: 'divider',
              position: 'sticky', 
              bottom: 0,
              backgroundColor: '#ffffff',
              zIndex: 1
            }}>
              {error && (
                <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: '#ffebee' }}>
                  <Typography color="error">{error}</Typography>
                </Paper>
              )}
              
              <Box sx={{ position: 'relative' }}>
                <StyledTextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={4}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your question here..."
                  variant="outlined"
                  inputRef={inputRef}
                  InputProps={{
                    endAdornment: (
                      <Box sx={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                          onClick={handleVoiceInput}
                          variant="outlined"
                          size="small"
                          sx={{
                            color: recording ? '#ff0000' : 'primary.main',
                            borderColor: recording ? '#ff0000' : 'primary.main',
                            '&:hover': {
                              backgroundColor: recording ? 'rgba(0,0,0,0.04)' : 'rgba(25,118,210,0.04)',
                              borderColor: recording ? '#ff0000' : 'primary.main',
                            },
                            transition: 'all 0.3s ease',
                          }}
                          startIcon={recording ? <MicOffIcon /> : <MicIcon />}
                        >
                          {recording ? 'Stop' : 'Speak'}
                        </Button>
                        <StyledButton
                          variant="contained"
                          onClick={handleSubmit}
                          disabled={loading || !query.trim()}
                          size="small"
                          endIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                        >
                          {loading ? 'Processing...' : 'Submit'}
                        </StyledButton>
                      </Box>
                    )
                  }}
                />
              </Box>
            </Box>
        </Container>
      )}
    </Box>
  );
};

export default QueryInterface;