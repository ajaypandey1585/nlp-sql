// src/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FF5733', // Customize as needed
    },
    secondary: {
      main: '#E0C2FF', // Customize as needed
    },
  },
});

export default theme;