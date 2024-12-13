import React from 'react';
import {
  Paper,
  List,
  ListItem,
  ListItemText,
  Button,
  IconButton,
  Typography,
  Box,
  Divider,
  Menu,
  MenuItem,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useSession } from './components/SessionContext';
import { format } from 'date-fns';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  width: 280,
  height: '100vh',
  borderRadius: 0,
  borderRight: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
}));

const StyledListItem = styled(ListItem)<{ active?: boolean }>(({ theme, active }) => ({
  marginBottom: theme.spacing(0.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: active ? theme.palette.action.selected : 'transparent',
  '&:hover': {
    backgroundColor: active 
      ? theme.palette.action.selected 
      : theme.palette.action.hover,
  },
}));

const SessionHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}));

interface SessionMenuProps {
  sessionId: string;
  anchorEl: null | HTMLElement;
  onClose: () => void;
  onDelete: () => void;
  onRename: () => void;
}

const SessionMenu: React.FC<SessionMenuProps> = ({
  sessionId,
  anchorEl,
  onClose,
  onDelete,
  onRename,
}) => (
  <Menu
    id={`session-menu-${sessionId}`}
    anchorEl={anchorEl}
    open={Boolean(anchorEl)}
    onClose={onClose}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'right',
    }}
    transformOrigin={{
      vertical: 'top',
      horizontal: 'right',
    }}
  >
    <MenuItem onClick={onRename}>
      <EditIcon fontSize="small" sx={{ mr: 1 }} />
      Rename
    </MenuItem>
    <MenuItem onClick={onDelete} sx={{ color: 'error.main' }}>
      <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
      Delete
    </MenuItem>
  </Menu>
);

const App: React.FC = () => {
  const { 
    sessions, 
    currentSessionId, 
    addSession, 
    removeSession, 
    setCurrentSessionId,
    clearSession
  } = useSession();
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>('');

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, sessionId: string) => {
    event.stopPropagation();
    setSelectedSessionId(sessionId);
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedSessionId('');
  };

  const handleDeleteSession = () => {
    if (selectedSessionId) {
      removeSession(selectedSessionId);
      handleMenuClose();
    }
  };

  const handleRenameSession = () => {
    if (selectedSessionId) {
      const session = sessions.find(s => s.id === selectedSessionId);
      if (session) {
        const newName = window.prompt('Enter new session name:', session.name);
        if (newName && newName.trim()) {
          // Note: You'll need to add a renameSession function to your SessionContext
          // renameSession(selectedSessionId, newName.trim());
        }
      }
      handleMenuClose();
    }
  };

  const handleAddSession = () => {
    const sessionNumber = sessions.length + 1;
    const newSessionName = `Session ${sessionNumber}`;
    addSession(newSessionName);
  };

  const handleClearSession = (sessionId: string) => {
    clearSession(sessionId);
  };

  return (
    <StyledPaper elevation={3}>
      <SessionHeader>
        <Typography variant="h6" component="div">
          Sessions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddSession}
          size="small"
        >
          New Session
        </Button>
      </SessionHeader>
      
      <Divider />
      
      <List sx={{ flex: 1, overflow: 'auto', px: 1 }}>
        {sessions.map((session) => (
          <StyledListItem
            key={session.id}
            active={session.id === currentSessionId}
            onClick={() => setCurrentSessionId(session.id)}>
            <ListItemText
              primary={session.name}
              secondary={format(new Date(session.timestamp), 'MMM d, yyyy h:mm a')}
              primaryTypographyProps={{
                variant: 'body1',
                fontWeight: session.id === currentSessionId ? 'bold' : 'normal',
              }}
              secondaryTypographyProps={{
                variant: 'caption',
                sx: { fontSize: '0.75rem' }
              }}
            />
            <ListItemSecondaryAction>
              <IconButton 
                edge="end" 
                size="small"
                onClick={(e) => handleMenuOpen(e, session.id)}
              >
               
              </IconButton>
            </ListItemSecondaryAction>
          </StyledListItem>
        ))}
      </List>

      <SessionMenu
        sessionId={selectedSessionId}
        anchorEl={menuAnchorEl}
        onClose={handleMenuClose}
        onDelete={handleDeleteSession}
        onRename={handleRenameSession}
      />

      <Divider />
      
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </Typography>
      </Box>
    </StyledPaper>
  );
};

export default App;