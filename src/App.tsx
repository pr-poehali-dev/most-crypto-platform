
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

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;