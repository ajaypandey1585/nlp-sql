import React from 'react';
import { marked } from 'marked';
import { Typography } from '@mui/material';

const MarkdownTemplate = ({ markdownText }) => {
  // Convert markdown to HTML
  const htmlContent = marked(markdownText);

  return (
    <Typography
      variant="body1"
      component="div"
      sx={{
        lineHeight: 1.6,
        letterSpacing: '0.5px',
        whiteSpace: 'pre-wrap',
        color: '#37474f',
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }} // Render HTML
    />
  );
};

export default MarkdownTemplate;
