import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './components/authconfig';
import { QueryClient, QueryClientProvider } from 'react-query';

const msalInstance = new PublicClientApplication(msalConfig);
const queryClient = new QueryClient();
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
     <QueryClientProvider client={queryClient}>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
