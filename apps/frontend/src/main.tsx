import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

// Warm up the Supabase origin (auth + storage previews) as early as possible.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
  try {
    const { origin } = new URL(supabaseUrl);
    for (const rel of ['preconnect', 'dns-prefetch']) {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = origin;
      if (rel === 'preconnect') link.crossOrigin = '';
      document.head.appendChild(link);
    }
  } catch {
    // Ignore malformed URL — non-fatal preconnect hint.
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
