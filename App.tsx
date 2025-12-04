
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/Dashboard';
import ReceptionPage from './pages/Reception';
import ProcessPage from './pages/Process';
import InventoryPage from './pages/Inventory';
import DispatchPage from './pages/Dispatch';
import StockPage from './pages/Stock';
import ReportsPage from './pages/Reports';
import LoginPage from './pages/Login';
import UsersPage from './pages/Users';
import RRHHPage from './pages/RRHH';
import IqfManagementPage from './pages/IqfManagement';
import { AppProvider, useApp } from './store/AppContext';
import { Menu } from 'lucide-react';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useApp();
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

// Main Layout Component (Sidebar + Content)
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
     const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
     const { currentUser } = useApp();

     if (!currentUser) {
         return <div className="min-h-screen bg-white">{children}</div>;
     }

     return (
        <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-sans text-gray-900">
          {/* Desktop Sidebar (Fixed Width) */}
          <div className="hidden md:block h-full flex-shrink-0 z-20 shadow-xl">
             <Sidebar />
          </div>

          {/* Mobile Header */}
          <div className="md:hidden fixed top-0 w-full bg-white border-b z-50 flex justify-between items-center p-4 shadow-sm">
             <span className="font-bold text-primary text-lg">Rio Donguil</span>
             <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg hover:bg-gray-100">
               <Menu />
             </button>
          </div>

          {/* Mobile Menu Overlay */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
              <div className="bg-white w-72 h-full pt-16 shadow-2xl">
                 <Sidebar />
              </div>
            </div>
          )}

          {/* Main Content Area (Scrollable) */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
              <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/50 md:pt-0 pt-16 scroll-smooth">
                {/* Content Wrapper for Ultra-Wide Screens */}
                <div className="max-w-[1920px] mx-auto min-h-full w-full">
                    {children}
                </div>
              </main>
          </div>
        </div>
     );
}

const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <MainLayout>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                
                <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/reception" element={<ProtectedRoute><ReceptionPage /></ProtectedRoute>} />
                <Route path="/process" element={<ProtectedRoute><ProcessPage /></ProtectedRoute>} />
                <Route path="/stock" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
                <Route path="/dispatch" element={<ProtectedRoute><DispatchPage /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
                <Route path="/rrhh" element={<ProtectedRoute><RRHHPage /></ProtectedRoute>} />
                <Route path="/iqf-management" element={<ProtectedRoute><IqfManagementPage /></ProtectedRoute>} />
                
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </MainLayout>
      </Router>
    </AppProvider>
  );
};

export default App;