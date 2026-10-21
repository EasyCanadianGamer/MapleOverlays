import { Route, Routes } from 'react-router-dom';
import OverlayFiles from './OverlayFiles';
import OverlayEditorPage from './OverlayEditorPage';
import OverlaysHome from './OverlaysHome';

// Rendered inside the dashboard's /dashboard/* route, so these paths are relative to /dashboard.
export default function OverlaysArea() {
  return (
    <Routes>
      <Route path="overlays" element={<OverlaysHome />} />
      <Route path="overlays/files" element={<OverlayFiles />} />
      <Route path="overlays/:id" element={<OverlayEditorPage />} />
    </Routes>
  );
}
