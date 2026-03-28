import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Background3D from './components/Background3D';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import ReactorPage from './pages/ReactorPage';
import MarketplacePage from './pages/MarketplacePage';
import MarketLoginPage from './pages/MarketLoginPage';

function ProtectedMarketplace() {
  const { user } = useAuth();
  if (!user) return <MarketLoginPage />;
  return <MarketplacePage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AuthProvider>
          <BrowserRouter>
            <Background3D />
            <Navbar />
            <Routes>
              <Route path="/"            element={<HomePage />} />
              <Route path="/reactor"     element={<ReactorPage />} />
              <Route path="/marketplace" element={<ProtectedMarketplace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
