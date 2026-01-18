import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Funnels from "./pages/Funnels";
import Leads from "./pages/Leads";
import WhatsApp from "./pages/WhatsApp";
import EmailMarketing from "./pages/EmailMarketing";
import MetaAds from "./pages/MetaAds";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/funnels" element={<Funnels />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/whatsapp" element={<WhatsApp />} />
          <Route path="/email" element={<EmailMarketing />} />
          <Route path="/meta-ads" element={<MetaAds />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
