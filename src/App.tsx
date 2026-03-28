import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Properties from "./pages/Properties";
import Owners from "./pages/Owners";
import Reservations from "./pages/Reservations";
import UploadData from "./pages/UploadData";
import SettingsPage from "./pages/SettingsPage";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import YoYPerformance from "./pages/YoYPerformance";
import OccupancyHeatmap from "./pages/OccupancyHeatmap";
import PricingStrategy from "./pages/PricingStrategy";
import ManagementRevenue from "./pages/ManagementRevenue";
import FuturePipeline from "./pages/FuturePipeline";
import RevenuePacing from "./pages/RevenuePacing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/yoy" element={<ProtectedRoute><YoYPerformance /></ProtectedRoute>} />
            <Route path="/heatmap" element={<ProtectedRoute><OccupancyHeatmap /></ProtectedRoute>} />
            <Route path="/pricing" element={<ProtectedRoute><PricingStrategy /></ProtectedRoute>} />
            <Route path="/reservations" element={<ProtectedRoute><Reservations /></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute><FuturePipeline /></ProtectedRoute>} />
            <Route path="/properties" element={<ProtectedRoute><Properties /></ProtectedRoute>} />
            <Route path="/owners" element={<ProtectedRoute requiredRoles={["super", "senior"]}><Owners /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute requiredRoles={["super", "senior"]}><UploadData /></ProtectedRoute>} />
            <Route path="/management" element={<ProtectedRoute requiredRoles={["super", "senior"]}><ManagementRevenue /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRoles={["super"]}><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
