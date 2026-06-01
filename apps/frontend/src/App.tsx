import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AppPage from './pages/AppPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<AppPage />} />
        <Route path="/workspace" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
