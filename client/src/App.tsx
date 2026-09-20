import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import PageTransition from "./components/PageTransition";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
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
// No AnimatePresence here: it tracks exit-animation completion to decide when
// to swap in the next page, and that tracking got stuck often enough in
// practice to leave the content area permanently blank until a reload. Keying
// PageTransition by pathname still gives every page a fade-in on mount via
// plain React reconciliation (old page unmounts, new one mounts), with no
// dependency on framer-motion's presence bookkeeping — just no fade-out for
// the page being left.
function AppLayout() {
  const location = useLocation();
  return (
    <Layout>
      <RouteErrorBoundary key={location.pathname}>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </RouteErrorBoundary>
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
