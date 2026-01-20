import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { FunnelOverview } from "@/components/dashboard/FunnelOverview";
import { RecentLeads } from "@/components/dashboard/RecentLeads";
import { MetaAdsChart } from "@/components/dashboard/MetaAdsChart";
import { AdsMetricsCard } from "@/components/dashboard/AdsMetricsCard";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { Users, MessageCircle, TrendingUp, DollarSign, RefreshCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { metrics, isLoading } = useDashboardMetrics();

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}K`;
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  if (isLoading) {
    return (
      <MainLayout title="Dashboard" subtitle="Visão geral do seu CRM">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Dashboard"
      subtitle="Visão geral do seu CRM"
    >
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard
          title="Total de Leads"
          value={formatNumber(metrics.totalLeads)}
          change={metrics.leadsChange}
          icon={Users}
          variant="primary"
        />
        <MetricCard
          title="Conversas WhatsApp"
          value={formatNumber(metrics.totalConversas)}
          change={metrics.conversasChange}
          icon={MessageCircle}
          variant="success"
        />
        <MetricCard
          title="Taxa de Conversão"
          value={`${metrics.conversionRate.toFixed(1)}%`}
          change={metrics.conversionChange}
          icon={TrendingUp}
          variant="default"
        />
        <MetricCard
          title="Valor no Funil"
          value={formatCurrency(metrics.funnelValue)}
          change={metrics.valueChange}
          icon={DollarSign}
          variant="warning"
        />
        <MetricCard
          title="Reentradas"
          value={formatNumber(metrics.reentryLeads)}
          change={metrics.reentryChange}
          icon={RefreshCcw}
          variant="primary"
        />
      </div>

      {/* Ads Metrics */}
      <div className="mb-6">
        <AdsMetricsCard metrics={metrics} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MetaAdsChart dailyData={metrics.dailyData} metrics={metrics} />
          <RecentLeads />
        </div>
        <div>
          <FunnelOverview />
        </div>
      </div>
    </MainLayout>
  );
}
