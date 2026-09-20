import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// StrictMode's double-invoked effects in dev confuse framer-motion's
// AnimatePresence enter/exit tracking (see motiondivision/motion#3746),
// causing route transitions to get stuck mid-exit and never mount the
// next page — a blank screen until a manual reload.
createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
