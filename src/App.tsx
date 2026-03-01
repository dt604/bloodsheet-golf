import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import WelcomePage from './pages/Welcome';
import DashboardPage from './pages/Dashboard';
import MatchSetupPage from './pages/MatchSetup';
import LiveScorecardPage from './pages/LiveScorecard';
import LedgerPage from './pages/Ledger';
import LeaderboardPage from './pages/Leaderboard';
import AddPlayerPage from './pages/AddPlayer';
import SettingsPage from './pages/Settings';
import JoinMatchPage from './pages/JoinMatch';
import PastMatchScorecardPage from './pages/PastMatchScorecard';
import MatchHistoryPage from './pages/MatchHistory';
import FriendsPage from './pages/Friends';
import PlayerProfilePage from './pages/PlayerProfile';
import ResetPasswordPage from './pages/ResetPassword';
import AuthCallbackPage from './pages/AuthCallback';
import OnboardingPage from './pages/Onboarding';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import MatchManagement from './pages/admin/MatchManagement';
import CourseManagement from './pages/admin/CourseManagement';
import { AdminRoute } from './components/admin/AdminRoute';

// Full auth required — guests are redirected to welcome
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isGuest } = useAuth();
  if (loading) return null;
  if (!user || isGuest) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Any signed-in user (including guests) — used for view-only match routes
function ViewerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/setup" element={<ProtectedRoute><MatchSetupPage /></ProtectedRoute>} />
      <Route path="/play/:hole" element={<ViewerRoute><LiveScorecardPage /></ViewerRoute>} />
      <Route path="/ledger" element={<ViewerRoute><LedgerPage /></ViewerRoute>} />
      <Route path="/leaderboard" element={<ViewerRoute><LeaderboardPage /></ViewerRoute>} />
      <Route path="/add-player" element={<ProtectedRoute><AddPlayerPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/join" element={<ViewerRoute><JoinMatchPage /></ViewerRoute>} />
      <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><MatchHistoryPage /></ProtectedRoute>} />
      <Route path="/history/:matchId" element={<ProtectedRoute><PastMatchScorecardPage /></ProtectedRoute>} />
      <Route path="/player/:userId" element={<ProtectedRoute><PlayerProfilePage /></ProtectedRoute>} />

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="matches" element={<MatchManagement />} />
        <Route path="courses" element={<CourseManagement />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="h-[100dvh] bg-background text-primaryText font-sans overflow-hidden">
      <div className="w-full max-w-md landscape:max-w-none lg:landscape:max-w-md mx-auto bg-background h-full shadow-2xl relative flex flex-col overflow-hidden safe-x">
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </div>
    </div>
  );
}

export default App;
