import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles/global.css';
import Landing from './pages/Landing';
import DashboardLayout from './components/layout/DashboardLayout';
import TwitchCallback from './pages/TwitchCallback';
import ChatOverlayPage from './pages/ChatOverlayPage';
import NowPlayingOverlay from './pages/NowPlayingOverlay';
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

// A data router (rather than <BrowserRouter>) so the overlay editor can use useBlocker
// to ask before leaving with unsaved changes.
const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login/', element: <Login /> },
  { path: '/dashboard/*', element: <DashboardLayout /> },
  { path: '/auth/twitch/callback', element: <TwitchCallback /> },
  { path: '/overlays/chat/:token', element: <ChatOverlayPage /> },
  // the old /overlays/nowplaying?user=... links keep working; /:token is the new per-overlay URL
  { path: '/overlays/nowplaying', element: <NowPlayingOverlay /> },
  { path: '/overlays/nowplaying/:token', element: <NowPlayingOverlay /> },
  { path: '/commands/:login', element: <CommandsList /> },
]);

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
