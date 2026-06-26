import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Patch window.fetch to automatically include auth token from localStorage for /api/* requests
try {
  const originalFetch = window.fetch;
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function(input: any, init: any) {
      const token = localStorage.getItem('clear_advance_auth_token');
      const isApi = typeof input === 'string' && input.startsWith('/api/');
      
      if (token && isApi) {
        // Clone init to avoid mutating a frozen/readonly RequestInit object
        const newInit = { ...init };
        
        if (newInit.headers instanceof Headers) {
          const newHeaders = new Headers(newInit.headers);
          if (!newHeaders.has('Authorization')) {
            newHeaders.set('Authorization', `Bearer ${token}`);
          }
          newInit.headers = newHeaders;
        } else if (Array.isArray(newInit.headers)) {
          const newHeaders = [...newInit.headers];
          const hasAuth = newHeaders.some(([k]) => k.toLowerCase() === 'authorization');
          if (!hasAuth) {
            newHeaders.push(['Authorization', `Bearer ${token}`]);
          }
          newInit.headers = newHeaders;
        } else if (newInit.headers) {
          const newHeaders = { ...newInit.headers } as any;
          const keys = Object.keys(newHeaders);
          const hasAuth = keys.some(k => k.toLowerCase() === 'authorization');
          if (!hasAuth) {
            newHeaders['Authorization'] = `Bearer ${token}`;
          }
          newInit.headers = newHeaders;
        } else {
          newInit.headers = { 'Authorization': `Bearer ${token}` };
        }
        
        return originalFetch.call(this, input, newInit);
      }
      return originalFetch.call(this, input, init);
    }
  });
} catch (e) {
  console.warn('Failed to patch window.fetch automatically:', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
