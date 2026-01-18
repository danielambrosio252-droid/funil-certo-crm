import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { FunnelOverview } from "@/components/dashboard/FunnelOverview";
import { RecentLeads } from "@/components/dashboard/RecentLeads";
import { MetaAdsChart } from "@/components/dashboard/MetaAdsChart";
import { Users, MessageCircle, TrendingUp, DollarSign } from "lucide-react";

export default function Dashboard() {
  return (
    <MainLayout
      title="Dashboard"
      subtitle="Visão geral do seu CRM"
    >
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total de Leads"
          value="1.248"
          change={12}
          icon={Users}
          variant="primary"
        />
        <MetricCard
          title="Conversas WhatsApp"
          value="456"
          change={8}
          icon={MessageCircle}
          variant="success"
        />
        <MetricCard
          title="Taxa de Conversão"
          value="23.5%"
          change={-3}
          icon={TrendingUp}
          variant="default"
        />
        <MetricCard
          title="Valor no Funil"
          value="R$ 89.4K"
          change={18}
          icon={DollarSign}
          variant="warning"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MetaAdsChart />
          <RecentLeads />
        </div>
        <div>
          <FunnelOverview />
        </div>
      </div>
    </MainLayout>
  );
}
