import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import TaskHistory from './pages/TaskHistory';
import Vault from './pages/Vault';
import Webhooks from './pages/Webhooks';
import Workspaces from './pages/Workspaces';
import Templates from './pages/Templates';
import Monitor from './pages/Monitor';
import WorkflowCanvas from './pages/WorkflowCanvas';
import AdminUsers from './pages/AdminUsers';
import AdminSEO from './pages/AdminSEO';
import AdminSettings from './pages/AdminSettings';
import Insights from './pages/Insights';
import Workers from './pages/Workers';
import DashboardLayout from './components/DashboardLayout';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AnimatePresence, motion } from 'framer-motion';

import { 
  Overview, 
  QuickStart, 
  InstallationDocs, 
  CoreConcepts, 
  ApiReference, 
  WorkerArchitecture, 
  ProtocolSpecDoc, 
  SecurityDocs 
} from './pages/Docs';

// Premium Page Wrapper for transitions
const PageWrapper = ({ children }) => {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-full h-full flex flex-col"
    >
      {children}
    </motion.div>
  );
};

const PublicLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Navbar />
      <main className="flex-1 flex flex-col pt-20">
        <AnimatePresence mode="wait">
          <Outlet />
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
};

const ProtectedLayout = ({ roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <AnimatePresence mode="wait">
        <Outlet />
      </AnimatePresence>
    </DashboardLayout>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PageWrapper><Landing /></PageWrapper>} />
        <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/signup" element={<PageWrapper><Signup /></PageWrapper>} />
        
        {/* Documentation Routes */}
        <Route path="/docs/overview" element={<PageWrapper><Overview /></PageWrapper>} />
        <Route path="/docs/quickstart" element={<PageWrapper><QuickStart /></PageWrapper>} />
        <Route path="/docs/installation" element={<PageWrapper><InstallationDocs /></PageWrapper>} />
        <Route path="/docs/concepts" element={<PageWrapper><CoreConcepts /></PageWrapper>} />
        <Route path="/docs/api-reference" element={<PageWrapper><ApiReference /></PageWrapper>} />
        <Route path="/docs/architecture" element={<PageWrapper><WorkerArchitecture /></PageWrapper>} />
        <Route path="/docs/protocol-spec" element={<PageWrapper><ProtocolSpecDoc /></PageWrapper>} />
        <Route path="/docs/security" element={<PageWrapper><SecurityDocs /></PageWrapper>} />
      </Route>

      {/* User Protected Routes */}
      <Route element={<ProtectedLayout roles={['user', 'staff', 'admin']} />}>
        <Route path="/dashboard" element={<PageWrapper><Dashboard /></PageWrapper>} />
        <Route path="/tasks" element={<PageWrapper><Tasks /></PageWrapper>} />
        <Route path="/tasks/:id/history" element={<PageWrapper><TaskHistory /></PageWrapper>} />
        <Route path="/vault" element={<PageWrapper><Vault /></PageWrapper>} />
        <Route path="/webhooks" element={<PageWrapper><Webhooks /></PageWrapper>} />
        <Route path="/workspaces" element={<PageWrapper><Workspaces /></PageWrapper>} />
        <Route path="/templates" element={<PageWrapper><Templates /></PageWrapper>} />
        <Route path="/canvas" element={<PageWrapper><WorkflowCanvas /></PageWrapper>} />
      </Route>
      
      {/* Staff/Admin Routes */}
      <Route element={<ProtectedLayout roles={['staff', 'admin']} />}>
        <Route path="/monitor" element={<PageWrapper><Monitor /></PageWrapper>} />
      </Route>
      
      {/* Admin Only Routes */}
      <Route element={<ProtectedLayout roles={['admin']} />}>
        <Route path="/admin/users" element={<PageWrapper><AdminUsers /></PageWrapper>} />
        <Route path="/admin/seo" element={<PageWrapper><AdminSEO /></PageWrapper>} />
        <Route path="/admin/settings" element={<PageWrapper><AdminSettings /></PageWrapper>} />
        <Route path="/admin/insights" element={<PageWrapper><Insights /></PageWrapper>} />
        <Route path="/admin/workers" element={<PageWrapper><Workers /></PageWrapper>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;