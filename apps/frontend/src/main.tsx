import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/global.css';
import Landing from './pages/Landing';
import DashboardLayout from './components/layout/DashboardLayout';
import TwitchCallback from './pages/TwitchCallback';
import OverlaySource from './pages/OverlaySource';
import CommandsList from './pages/CommandsList';
import Login from './pages/AuthGate';


// Overlay pages must be transparent for OBS browser source.
// Inject this before React renders so OBS sees transparent on the very first paint —
// a useEffect-based approach fires too late (after the first frame is committed).
if (window.location.pathname.startsWith('/overlays/')) {
  const s = document.createElement('style');
  s.textContent = 'html,body,#root{background:transparent!important;overflow:hidden!important}';
  document.head.appendChild(s);
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login/" element={<Login />} />
        <Route path="/dashboard/*" element={<DashboardLayout />} />
        <Route path="/auth/twitch/callback" element={<TwitchCallback />} />
        <Route path="/overlays/:id" element={<OverlaySource />} />
        <Route path="/commands/:login" element={<CommandsList />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
