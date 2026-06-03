import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AnalyticsRouteTracker from './components/AnalyticsRouteTracker';
import Layout from './components/Layout';
import AppPage from './pages/AppPage';

// Off the hot path — code-split so it doesn't ship in the main chunk.
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <Layout>
      <AnalyticsRouteTracker />
      <Routes>
        <Route path="/" element={<AppPage />} />
        <Route path="/workspace" element={<Navigate to="/" replace />} />
        <Route
          path="*"
          element={
            <Suspense fallback={null}>
              <NotFoundPage />
            </Suspense>
          }
        />
      </Routes>
    </Layout>
  );
}
