import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import PageTransition from "./components/PageTransition.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CreatePoll from "./pages/CreatePoll.jsx";
import PollView from "./pages/PollView.jsx";
import PollAnalytics from "./pages/PollAnalytics.jsx";

const Protected = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

function AppRoutes() {
  const { isLoggedIn } = useAuth();

  return (
    <PageTransition>
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
        <Route
          path="/"
          element={
            <Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageTransition>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
