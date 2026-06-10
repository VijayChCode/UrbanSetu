import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n';
import App from './App.jsx'
import { store, persistor } from './redux/store.js'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import { HelmetProvider } from 'react-helmet-async';
import { toast } from 'react-toastify';
import { getErrorCode } from './utils/errorRegistry';

// Global interceptor for toast.error to display error codes
const originalToastError = toast.error;
toast.error = (content, options) => {
  if (typeof content === 'string') {
    const code = getErrorCode(content);
    return originalToastError(`${content} [Code: ${code}]`, options);
  }
  return originalToastError(content, options);
};

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      {bootstrapped => (
        <HelmetProvider>
          <GlobalErrorBoundary>
            <App bootstrapped={bootstrapped} />
          </GlobalErrorBoundary>
        </HelmetProvider>
      )}
    </PersistGate>
  </Provider>,
)
