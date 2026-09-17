import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import PageTransition from "./components/PageTransition";
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

function AppRoutes() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={location.pathname}>
        <Routes location={location}>
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
          <Route path="/poll/:id" element={<PollView />} />
          <Route path="/discover" element={<PollDiscovery />} />
          <Route
            path="/"
            element={
              <Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
    </AnimatePresence>
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
