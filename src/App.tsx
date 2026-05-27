import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { OwnerPreviewProvider } from "@/contexts/OwnerPreviewContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Owners from "./pages/Owners";
import Reservations from "./pages/Reservations";

import SettingsPage from "./pages/SettingsPage";
import TeamManagement from "./pages/TeamManagement";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import YoYPerformance from "./pages/YoYPerformance";
import OccupancyHeatmap from "./pages/OccupancyHeatmap";
import PricingStrategy from "./pages/PricingStrategy";
import ManagementRevenue from "./pages/ManagementRevenue";
import FuturePipeline from "./pages/FuturePipeline";
import RevenuePacing from "./pages/RevenuePacing";
import RevenueForecaster from "./pages/RevenueForecaster";
import OrinIntelligence from "./pages/OrinIntelligence";
import ComingSoon from "./pages/ComingSoon";
import Today from "./pages/Today";
import SyncHealth from "./pages/SyncHealth";
import MonthlyReport from "./pages/MonthlyReport";
import CleaningSchedule from "./pages/CleaningSchedule";
import CleaningNumbers from "./pages/CleaningNumbers";
import CleanerPortal from "./pages/CleanerPortal";
import OwnerPortfolio from "./pages/owner/OwnerPortfolio";
import OwnerReservations from "./pages/owner/OwnerReservations";
import OwnerStatements from "./pages/owner/OwnerStatements";
import OwnerGraphs from "./pages/owner/OwnerGraphs";
import PropertyKnowledge from "./pages/PropertyKnowledge";
import PropertyKnowledgeDetail from "./pages/PropertyKnowledgeDetail";
import Amenities from "./pages/Amenities";
import GuestPortal from "./pages/GuestPortal";
import CleanReset from "./pages/CleanReset";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60, // 1 hour
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/stay/:slug" element={<GuestPortal />} />
            <Route path="/cleaner" element={<CleanerPortal />} />
            <Route path="/owner" element={<ProtectedRoute requiredRoles={["client", "super", "senior"]}><OwnerPreviewProvider><OwnerPortfolio /></OwnerPreviewProvider></ProtectedRoute>} />
            <Route path="/owner/reservations" element={<ProtectedRoute requiredRoles={["client", "super", "senior"]}><OwnerPreviewProvider><OwnerReservations /></OwnerPreviewProvider></ProtectedRoute>} />
            <Route path="/owner/statements" element={<ProtectedRoute requiredRoles={["client", "super", "senior"]}><OwnerPreviewProvider><OwnerStatements /></OwnerPreviewProvider></ProtectedRoute>} />
            <Route path="/owner/graphs" element={<ProtectedRoute requiredRoles={["client", "super", "senior"]}><OwnerPreviewProvider><OwnerGraphs /></OwnerPreviewProvider></ProtectedRoute>} />
            <Route path="/today" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><Today /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><Index /></ProtectedRoute>} />
            <Route path="/orin" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><OrinIntelligence /></ProtectedRoute>} />
            <Route path="/yoy" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><YoYPerformance /></ProtectedRoute>} />
            <Route path="/heatmap" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><OccupancyHeatmap /></ProtectedRoute>} />
            <Route path="/pricing" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><PricingStrategy /></ProtectedRoute>} />
            <Route path="/reservations" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><Reservations /></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><FuturePipeline /></ProtectedRoute>} />
            <Route path="/pacing" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><RevenuePacing /></ProtectedRoute>} />
            <Route path="/forecast" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><RevenueForecaster /></ProtectedRoute>} />
            <Route path="/properties" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><Properties /></ProtectedRoute>} />
            <Route path="/properties/:id" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><PropertyDetail /></ProtectedRoute>} />
            <Route path="/owners" element={<ProtectedRoute requiredRoles={["super", "senior"]}><Owners /></ProtectedRoute>} />
            
            <Route path="/management" element={<ProtectedRoute requiredRoles={["super", "senior"]}><ManagementRevenue /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRoles={["super"]}><SettingsPage /></ProtectedRoute>} />
            <Route path="/settings/team" element={<ProtectedRoute requiredRoles={["super"]}><TeamManagement /></ProtectedRoute>} />
            <Route path="/settings/clean-reset" element={<ProtectedRoute requiredRoles={["super", "senior", "admin"]}><CleanReset /></ProtectedRoute>} />
            <Route path="/sync-health" element={<ProtectedRoute requiredRoles={["super", "senior"]}><SyncHealth /></ProtectedRoute>} />
            <Route path="/operations/schedule" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><CleaningSchedule /></ProtectedRoute>} />
            <Route path="/operations/cleaning" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><CleaningSchedule /></ProtectedRoute>} />
            <Route path="/operations/numbers" element={<ProtectedRoute requiredRoles={["super", "senior"]}><CleaningNumbers /></ProtectedRoute>} />
            <Route path="/property-knowledge" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><PropertyKnowledge /></ProtectedRoute>} />
            <Route path="/property-knowledge/:listingId" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><PropertyKnowledgeDetail /></ProtectedRoute>} />
            <Route path="/amenities" element={<ProtectedRoute requiredRoles={["super", "senior", "admin"]}><Amenities /></ProtectedRoute>} />
            <Route path="/owner-reports" element={<ProtectedRoute requiredRoles={["super", "senior"]}><MonthlyReport /></ProtectedRoute>} />
            <Route path="/owner-reports/invoice" element={<ProtectedRoute requiredRoles={["super", "senior"]}><ComingSoon title="Owner Reports — Invoice Generator" /></ProtectedRoute>} />
            <Route path="/xero-sync" element={<ProtectedRoute requiredRoles={["super", "senior"]}><ComingSoon title="Xero Sync" /></ProtectedRoute>} />
            <Route path="/guests" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><ComingSoon title="Guest Database" /></ProtectedRoute>} />
            <Route path="/campaigns" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><ComingSoon title="Active Campaigns" /></ProtectedRoute>} />
            <Route path="/campaigns/segments" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><ComingSoon title="Campaign Segments" /></ProtectedRoute>} />
            <Route path="/campaigns/history" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><ComingSoon title="Campaign History" /></ProtectedRoute>} />
            <Route path="/mailchimp-sync" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><ComingSoon title="Mailchimp Sync" /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute excludeRoles={["client", "cleaner"]}><ComingSoon title="Leads & Enquiries" /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
