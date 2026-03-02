import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

import WelcomePage from './pages/Welcome';
import HomePage from './pages/Home';
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
import MoneyLeadersPage from './pages/MoneyLeaders';
import QRPage from './pages/QRPage';
import AddFriendQR from './pages/AddFriendQR';
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
  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div className="w-8 h-8 border-2 border-bloodRed border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user || isGuest) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Any signed-in user (including guests) — used for view-only match routes
function ViewerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div className="w-8 h-8 border-2 border-bloodRed border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const pageVariants = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 }
};

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial="initial"
    animate="animate"
    exit="exit"
    variants={pageVariants}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="flex-1 flex flex-col overflow-hidden h-full"
  >
    {children}
  </motion.div>
);

function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><WelcomePage /></PageWrapper>} />
        <Route path="/home" element={<ProtectedRoute><PageWrapper><HomePage /></PageWrapper></ProtectedRoute>} />
        <Route path="/reset-password" element={<PageWrapper><ResetPasswordPage /></PageWrapper>} />
        <Route path="/auth/callback" element={<PageWrapper><AuthCallbackPage /></PageWrapper>} />
        <Route path="/onboarding" element={<ProtectedRoute><PageWrapper><OnboardingPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><PageWrapper><DashboardPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/setup" element={<ProtectedRoute><PageWrapper><MatchSetupPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/play/:hole" element={<ViewerRoute><PageWrapper><LiveScorecardPage /></PageWrapper></ViewerRoute>} />
        <Route path="/ledger" element={<ViewerRoute><PageWrapper><LedgerPage /></PageWrapper></ViewerRoute>} />
        <Route path="/leaderboard" element={<ViewerRoute><PageWrapper><LeaderboardPage /></PageWrapper></ViewerRoute>} />
        <Route path="/add-player" element={<ProtectedRoute><PageWrapper><AddPlayerPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><PageWrapper><SettingsPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/join" element={<ViewerRoute><PageWrapper><JoinMatchPage /></PageWrapper></ViewerRoute>} />
        <Route path="/money-leaders" element={<ProtectedRoute><PageWrapper><MoneyLeadersPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/qr" element={<ProtectedRoute><PageWrapper><QRPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/add-friend/:userId" element={<ProtectedRoute><PageWrapper><AddFriendQR /></PageWrapper></ProtectedRoute>} />
        <Route path="/friends" element={<ProtectedRoute><PageWrapper><FriendsPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><PageWrapper><MatchHistoryPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/history/:matchId" element={<ProtectedRoute><PageWrapper><PastMatchScorecardPage /></PageWrapper></ProtectedRoute>} />
        <Route path="/player/:userId" element={<ProtectedRoute><PageWrapper><PlayerProfilePage /></PageWrapper></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="matches" element={<MatchManagement />} />
          <Route path="courses" element={<CourseManagement />} />
        </Route>

        {/* Wildcard Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
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

