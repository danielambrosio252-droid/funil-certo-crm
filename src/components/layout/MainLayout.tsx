import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  onNewLead?: () => void;
}

export function MainLayout({ children, title, subtitle, onNewLead }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-[280px] min-h-screen">
        <Header title={title} subtitle={subtitle} onNewLead={onNewLead} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
