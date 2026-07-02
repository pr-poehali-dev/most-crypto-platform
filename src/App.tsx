
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Compliance from "./pages/Compliance";
import Dashboard from "./pages/Dashboard";
import ComplianceOfficer from "./pages/ComplianceOfficer";
import RegulatorCabinet from "./pages/RegulatorCabinet";
import AdminPanel from "./pages/AdminPanel";
import About    from "./pages/About";
import Pricing  from "./pages/Pricing";
import Docs     from "./pages/Docs";
import ApiRef   from "./pages/ApiRef";
import Sdk      from "./pages/Sdk";
import Sandbox  from "./pages/Sandbox";
import Security from "./pages/Security";
import Contacts from "./pages/Contacts";
import KycAml   from "./pages/KycAml";
import Terms    from "./pages/Terms";
import Press    from "./pages/Press";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />

            <Route path="/dashboard" element={
              <ProtectedRoute roles={['user', 'superadmin']}>
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/compliance" element={
              <ProtectedRoute roles={['compliance', 'admin', 'finance', 'superadmin']}>
                <Compliance />
              </ProtectedRoute>
            } />

            <Route path="/compliance-officer" element={
              <ProtectedRoute roles={['compliance', 'admin', 'superadmin']}>
                <ComplianceOfficer />
              </ProtectedRoute>
            } />

            <Route path="/regulator" element={<RegulatorCabinet />} />

            <Route path="/admin" element={
              <ProtectedRoute roles={['superadmin', 'admin', 'finance', 'devops']}>
                <AdminPanel />
              </ProtectedRoute>
            } />

            {/* ── Публичные информационные страницы ── */}
            <Route path="/about"    element={<About    />} />
            <Route path="/pricing"  element={<Pricing  />} />
            <Route path="/docs"     element={<Docs     />} />
            <Route path="/api-ref"  element={<ApiRef   />} />
            <Route path="/sdk"      element={<Sdk      />} />
            <Route path="/sandbox"  element={<Sandbox  />} />
            <Route path="/security" element={<Security />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/kyc-aml"  element={<KycAml   />} />
            <Route path="/terms"    element={<Terms    />} />
            <Route path="/press"    element={<Press    />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;