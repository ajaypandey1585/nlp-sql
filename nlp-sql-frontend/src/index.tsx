import React from 'react';
import ReactDOM from 'react-dom';
import { SessionProvider } from './components/SessionContext';
import QueryInterface from './components/QueryInterface';
import Dashboard from './components/AIDashboard';
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <SessionProvider>
    <div
  style={{
    display: 'flex',
    height: '100vh',
    margin: 0,
    padding: 0,
    boxSizing: 'border-box',
  }}
>
  <div style={{ flex: '0 0 280px', height: '100vh', borderRight: '1px solid #ccc' }}>
    <App />
  </div>
  <div style={{ flex: 1, height: '100vh', overflow: 'auto' }}>
    <QueryInterface />
    {/* <Dashboard /> */}
  </div>
</div>


    </SessionProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
