import React from 'react';
import { Button, ButtonProps, CircularProgress } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { Insights } from '@mui/icons-material';

const shimmer = keyframes`
  0% {
    left: -150%;
  }
  100% {
    left: 100%;
  }
`;

const ShimmerButton = styled(Button)<ButtonProps & { isLoading?: boolean }>(({ theme, isLoading }) => ({
  position: 'relative',
  backgroundColor: isLoading ? '#FFFB17FF' : 'rgba(255, 255, 255, 0.2)',
  color: '#ffffff',
  fontWeight: 'bold',
  opacity: isLoading ? 0.9 : 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  '&:hover': {
    backgroundColor: isLoading
      ? '#BCD0E4FF'
      : 'rgba(255, 255, 255, 0.3)',
  },
  '& .MuiButton-startIcon': {
    opacity: isLoading ? 0 : 1,
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '-150%',
    width: '200%',
    height: '100%',
    background: 'linear-gradient(120deg, rgba(255, 255, 255, 0) 30%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 255, 255, 0) 70%)',
    transform: 'skewX(-30deg)',
    animation: `${shimmer} 2s infinite`,
    zIndex: 1,
  },
  zIndex: 2,
}));

interface GenInsightsButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick: () => void;
  isLoading: boolean;
  performanceDataLength: number;
}

const GenInsightsButton: React.FC<GenInsightsButtonProps> = ({ 
  onClick, 
  isLoading, 
  performanceDataLength,
  ...props 
}) => {
  return (
    <ShimmerButton
      variant="contained"
      color="primary"
      startIcon={!isLoading && <Insights />}
      onClick={onClick}
      disabled={isLoading || performanceDataLength === 0}
      isLoading={isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <CircularProgress size={20} sx={{ color: '#ffffff', marginRight: 1 }} />
          <span style={{ color: '#ffffff' }}>Generating Insights...</span>
        </>
      ) : (
        'Get Insights'
      )}
    </ShimmerButton>
  );
};

export default GenInsightsButton;

