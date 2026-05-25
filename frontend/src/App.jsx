import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { SSEProvider } from './context/SSEContext';
import { WebSocketProvider } from './context/WebSocketContext';
import ErrorBoundary from './components/ErrorBoundary';
import { lazy, Suspense, useState, useEffect } from 'react';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const TaskHistory = lazy(() => import('./pages/TaskHistory'));
const Vault = lazy(() => import('./pages/Vault'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const Workspaces = lazy(() => import('./pages/Workspaces'));
const Templates = lazy(() => import('./pages/Templates'));
const Monitor = lazy(() => import('./pages/Monitor'));
const WorkflowCanvas = lazy(() => import('./pages/WorkflowCanvas'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminSEO = lazy(() => import('./pages/AdminSEO'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const Insights = lazy(() => import('./pages/Insights'));
const Workers = lazy(() => import('./pages/Workers'));
import DashboardLayout from './components/DashboardLayout';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import DocumentationLayout from './components/DocumentationLayout';
import NotificationHub from './components/NotificationHub';
import CommandPalette from './components/shared/CommandPalette';
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
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex-1 w-full flex flex-col min-h-0 bg-zinc-950"
    >
      {children}
    </motion.div>
  );
};

const PublicLayout = () => {
  const location = useLocation();
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Navbar />
      <main className="flex-1 flex flex-col pt-16 relative">
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

const ProtectedRoute = ({ roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white font-sans">
        <div className="flex flex-col items-center gap-4">
           <div className="w-10 h-10 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 animate-pulse">Establishing Connection...</span>
        </div>
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
      {/* 1. Public Routes Group */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        {/* Documentation Nested Routes (Inside PublicLayout) */}
        <Route path="/docs" element={<DocumentationLayout />}>
          <Route path="overview" element={<Overview />} />
          <Route path="quickstart" element={<QuickStart />} />
          <Route path="installation" element={<InstallationDocs />} />
          <Route path="concepts" element={<CoreConcepts />} />
          <Route path="api-reference" element={<ApiReference />} />
          <Route path="architecture" element={<WorkerArchitecture />} />
          <Route path="protocol-spec" element={<ProtocolSpecDoc />} />
          <Route path="security" element={<SecurityDocs />} />
        </Route>
      </Route>

      {/* 2. User Protected Routes Group */}
      <Route element={<ProtectedRoute roles={['user', 'staff', 'admin']} />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/:id/history" element={<TaskHistory />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/workspaces" element={<Workspaces />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/canvas" element={<WorkflowCanvas />} />
      </Route>
      
      {/* 3. Staff/Admin Routes Group */}
      <Route element={<ProtectedRoute roles={['staff', 'admin']} />}>
        <Route path="/monitor" element={<Monitor />} />
      </Route>
      
      {/* 4. Admin Only Routes Group */}
      <Route element={<ProtectedRoute roles={['admin']} />}>
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
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AuthProvider>
          <SSEProvider>
            <WebSocketProvider>
              <Router>
                <Suspense fallback={
                  <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white font-sans">
                    <div className="flex flex-col items-center gap-4">
                       <div className="w-10 h-10 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
                       <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 animate-pulse">Loading View...</span>
                    </div>
                  </div>
                }>
                  <AppRoutes />
                </Suspense>
                <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
              </Router>
              <NotificationHub />
            </WebSocketProvider>
          </SSEProvider>
        </AuthProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;