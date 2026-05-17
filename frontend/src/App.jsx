import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

const PublicLayout = ({ children }) => (
  <div className="flex flex-col min-h-screen">
    <Navbar />
    <main className="flex-1">
      <PageWrapper>{children}</PageWrapper>
    </main>
    <Footer />
  </div>
);

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-950 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <DashboardLayout>
      <PageWrapper>{children}</PageWrapper>
    </DashboardLayout>
  );
};

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/" element={<PublicLayout><Landing /></PublicLayout>} />
        <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
        <Route path="/signup" element={<PublicLayout><Signup /></PublicLayout>} />
        
        {/* Documentation Routes */}
        <Route path="/docs/overview" element={<PublicLayout><Overview /></PublicLayout>} />
        <Route path="/docs/quickstart" element={<PublicLayout><QuickStart /></PublicLayout>} />
        <Route path="/docs/installation" element={<PublicLayout><InstallationDocs /></PublicLayout>} />
        <Route path="/docs/concepts" element={<PublicLayout><CoreConcepts /></PublicLayout>} />
        <Route path="/docs/api-reference" element={<PublicLayout><ApiReference /></PublicLayout>} />
        <Route path="/docs/architecture" element={<PublicLayout><WorkerArchitecture /></PublicLayout>} />
        <Route path="/docs/protocol-spec" element={<PublicLayout><ProtocolSpecDoc /></PublicLayout>} />
        <Route path="/docs/security" element={<PublicLayout><SecurityDocs /></PublicLayout>} />

        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={<ProtectedRoute roles={['user', 'staff', 'admin']}><Dashboard /></ProtectedRoute>} 
        />
        <Route 
          path="/tasks" 
          element={<ProtectedRoute roles={['user', 'staff', 'admin']}><Tasks /></ProtectedRoute>} 
        />
        <Route 
          path="/tasks/:id/history" 
          element={<ProtectedRoute roles={['user', 'staff', 'admin']}><TaskHistory /></ProtectedRoute>} 
        />
        <Route 
          path="/vault" 
          element={<ProtectedRoute roles={['user', 'staff', 'admin']}><Vault /></ProtectedRoute>} 
        />
        <Route 
          path="/webhooks" 
          element={<ProtectedRoute roles={['user', 'staff', 'admin']}><Webhooks /></ProtectedRoute>} 
        />
        <Route 
          path="/workspaces" 
          element={<ProtectedRoute roles={['user', 'staff', 'admin']}><Workspaces /></ProtectedRoute>} 
        />
        <Route 
          path="/templates" 
          element={<ProtectedRoute roles={['user', 'staff', 'admin']}><Templates /></ProtectedRoute>} 
        />
        <Route 
          path="/canvas" 
          element={<ProtectedRoute roles={['user', 'staff', 'admin']}><WorkflowCanvas /></ProtectedRoute>} 
        />
        <Route 
          path="/monitor" 
          element={<ProtectedRoute roles={['staff', 'admin']}><Monitor /></ProtectedRoute>} 
        />
        
        {/* Admin Routes */}
        <Route 
          path="/admin/users" 
          element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} 
        />
        <Route 
          path="/admin/seo" 
          element={<ProtectedRoute roles={['admin']}><AdminSEO /></ProtectedRoute>} 
        />
        <Route 
          path="/admin/settings" 
          element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>} 
        />
        <Route 
          path="/admin/insights" 
          element={<ProtectedRoute roles={['admin']}><Insights /></ProtectedRoute>} 
        />
        <Route 
          path="/admin/workers" 
          element={<ProtectedRoute roles={['admin']}><Workers /></ProtectedRoute>} 
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AnimatedRoutes />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;