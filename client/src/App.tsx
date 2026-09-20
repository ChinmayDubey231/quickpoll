import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import PageTransition from "./components/PageTransition";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CreatePoll from "./pages/CreatePoll";
import PollView from "./pages/PollView";
import PollAnalytics from "./pages/PollAnalytics";
import PollDiscovery from "./pages/PollDiscovery";

const Protected = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

// Keeps the header/sidebar mounted once and only transitions the routed page content,
// so switching tabs doesn't remount (and re-animate) the whole shell.
//
// Deliberately NOT mode="wait": that gates mounting the new page on the old
// page's exit animation finishing. If that exit-complete signal ever misfires
// (framer-motion + fast/StrictMode-y re-renders can do this), the new page
// never mounts and the content area is stuck blank until a full reload. The
// default mode mounts the new page immediately regardless of the old one's
// exit animation, so that failure mode can't happen.
function AppLayout() {
  const location = useLocation();
  return (
    <Layout>
      <AnimatePresence initial={false}>
        <PageTransition key={location.pathname}>
          <Outlet />
        </PageTransition>
      </AnimatePresence>
    </Layout>
  );
}

function AppRoutes() {
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isLoggedIn ? <Navigate to="/dashboard" replace /> : <Login />
        }
      />
      <Route
        path="/register"
        element={
          isLoggedIn ? <Navigate to="/dashboard" replace /> : <Register />
        }
      />
      <Route path="/poll/:id" element={<PollView />} />
      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/create"
          element={
            <Protected>
              <CreatePoll />
            </Protected>
          }
        />
        <Route
          path="/polls/:id/analytics"
          element={
            <Protected>
              <PollAnalytics />
            </Protected>
          }
        />
        <Route path="/discover" element={<PollDiscovery />} />
      </Route>
      <Route
        path="/"
        element={
          <Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
