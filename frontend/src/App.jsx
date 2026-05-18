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
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
};

const PublicLayout = () => {
  const location = useLocation();
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Navbar />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <PageWrapper key={location.pathname}>
            <Outlet />
          </PageWrapper>
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
        <PageWrapper key={location.pathname}>
          <Outlet />
        </PageWrapper>
      </AnimatePresence>
    </DashboardLayout>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        {/* Documentation Routes */}
        <Route path="/docs/overview" element={<Overview />} />
        <Route path="/docs/quickstart" element={<QuickStart />} />
        <Route path="/docs/installation" element={<InstallationDocs />} />
        <Route path="/docs/concepts" element={<CoreConcepts />} />
        <Route path="/docs/api-reference" element={<ApiReference />} />
        <Route path="/docs/architecture" element={<WorkerArchitecture />} />
        <Route path="/docs/protocol-spec" element={<ProtocolSpecDoc />} />
        <Route path="/docs/security" element={<SecurityDocs />} />
      </Route>

      {/* User Protected Routes */}
      <Route element={<ProtectedLayout roles={['user', 'staff', 'admin']} />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/:id/history" element={<TaskHistory />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/workspaces" element={<Workspaces />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/canvas" element={<WorkflowCanvas />} />
      </Route>
      
      {/* Staff/Admin Routes */}
      <Route element={<ProtectedLayout roles={['staff', 'admin']} />}>
        <Route path="/monitor" element={<Monitor />} />
      </Route>
      
      {/* Admin Only Routes */}
      <Route element={<ProtectedLayout roles={['admin']} />}>
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/seo" element={<AdminSEO />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/insights" element={<Insights />} />
        <Route path="/admin/workers" element={<Workers />} />
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