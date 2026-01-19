import { ReactNode } from "react";
import { Sidebar, SidebarProvider, useSidebar } from "./Sidebar";
import { Header } from "./Header";
import { motion } from "framer-motion";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  onNewLead?: () => void;
}

function MainContent({ children, title, subtitle, onNewLead }: MainLayoutProps) {
  const { collapsed, isMobile } = useSidebar();

  // Calculate padding based on sidebar state
  const paddingLeft = isMobile ? 0 : (collapsed ? 80 : 280);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <motion.div 
        className="min-h-screen transition-all duration-300"
        animate={{ paddingLeft }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <Header title={title} subtitle={subtitle} onNewLead={onNewLead} />
        <main className="p-4 sm:p-6">
          {children}
        </main>
      </motion.div>
    </div>
  );
}

export function MainLayout(props: MainLayoutProps) {
  return (
    <SidebarProvider>
      <MainContent {...props} />
    </SidebarProvider>
  );
}
