import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Handle MetaMask extension conflict
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('Cannot redefine property: ethereum')) {
    event.preventDefault();
    console.warn('Ignored MetaMask extension conflict error');
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


