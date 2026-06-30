import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Dashboard2 from '@/pages/Dashboard2';
import Dashboard3 from '@/pages/Dashboard3';
import TestSuite from '@/pages/TestSuite';
import IntegrationDocs from '@/pages/IntegrationDocs';
import Dashboard4 from '@/pages/Dashboard4';
import CardManagement from '@/pages/CardManagement';
import InvoicesAndEmployees from '@/pages/InvoicesAndEmployees';
import PasswordGate from '@/components/PasswordGate';
import BankLookupPage from '@/pages/features/BankLookupPage';
import IbanPage from '@/pages/features/IbanPage';
import CashPickupPage from '@/pages/features/CashPickupPage';
import RatesPage from '@/pages/features/RatesPage';
import EndpointGuidePage from '@/pages/features/EndpointGuidePage';
import QuoteLifecyclePage from '@/pages/features/QuoteLifecyclePage';
import PaymentTrackerPage from '@/pages/features/PaymentTrackerPage';
import RfiPage from '@/pages/features/RfiPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          {/* XBS Logo */}
          <div className="w-20 h-20 rounded-full bg-primary shadow-2xl shadow-primary/30 flex flex-col items-center justify-center gap-1">
            <span className="text-white font-black text-xl leading-none tracking-tight">XBS</span>
            <div className="flex items-center -space-x-2">
              <div className="w-4 h-4 rounded-full bg-red-500 opacity-90" />
              <div className="w-4 h-4 rounded-full bg-yellow-400 opacity-90" />
            </div>
          </div>
          {/* Spinner */}
          <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard2" element={<Dashboard2 />} />
        <Route path="/dashboard3" element={<Dashboard3 />} />
        <Route path="/test" element={<TestSuite />} />
        <Route path="/integration-docs" element={<IntegrationDocs />} />
        <Route path="/dashboard4" element={<Dashboard4 />} />
        <Route path="/cards" element={<CardManagement />} />
        <Route path="/invoices-employees" element={<InvoicesAndEmployees />} />

        {/* Features — standalone Mastercard cross-border tools */}
        <Route path="/features/bank-lookup" element={<BankLookupPage />} />
        <Route path="/features/iban" element={<IbanPage />} />
        <Route path="/features/cash-pickup" element={<CashPickupPage />} />
        <Route path="/features/rates" element={<RatesPage />} />
        <Route path="/features/endpoint-guide" element={<EndpointGuidePage />} />
        <Route path="/features/quote-lifecycle" element={<QuoteLifecyclePage />} />
        <Route path="/features/payment-tracker" element={<PaymentTrackerPage />} />
        <Route path="/features/rfi" element={<RfiPage />} />

      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <PasswordGate>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </PasswordGate>
  )
}

export default App