import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { KanbanBoard } from "@/components/funnels/KanbanBoard";
import { FunnelListView } from "@/components/funnels/FunnelListView";
import { CreateFunnelDialog } from "@/components/funnels/CreateFunnelDialog";
import { CreateLeadDialog } from "@/components/funnels/CreateLeadDialog";
import { EditFunnelDialog } from "@/components/funnels/EditFunnelDialog";
import { FunnelFilters, FunnelFiltersState } from "@/components/funnels/FunnelFilters";
import { ExportLeads } from "@/components/funnels/ExportLeads";
import { AutomationsDialog } from "@/components/funnels/AutomationsDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Kanban, List, Download, Loader2, Trash2, Pencil, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFunnels, useFunnelStages, useFunnelLeads, Funnel } from "@/hooks/useFunnels";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Funnels() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showCreateFunnel, setShowCreateFunnel] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showNewLeadFromHeader, setShowNewLeadFromHeader] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [funnelToEdit, setFunnelToEdit] = useState<Funnel | null>(null);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [funnelToDelete, setFunnelToDelete] = useState<string | null>(null);
  const [filters, setFilters] = useState<FunnelFiltersState>({
    sources: [],
    stages: [],
    minValue: "",
    maxValue: "",
    tags: [],
  });
  
  const { funnels, loadingFunnels, deleteFunnel } = useFunnels();

  // Selecionar primeiro funil automaticamente
  const currentFunnelId = selectedFunnelId || (funnels.length > 0 ? funnels[0].id : null);
  const currentFunnel = funnels.find(f => f.id === currentFunnelId);

  // Get stages and leads for current funnel (for export and filters)
  const { stages } = useFunnelStages(currentFunnelId);
  const stageIds = useMemo(() => stages.map(s => s.id), [stages]);
  const { leads } = useFunnelLeads(stageIds);

  // Apply filters to leads
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Filter by source
    if (filters.sources.length > 0) {
      result = result.filter(lead => lead.source && filters.sources.includes(lead.source));
    }

    // Filter by stage
    if (filters.stages.length > 0) {
      result = result.filter(lead => filters.stages.includes(lead.stage_id));
    }

    // Filter by min value
    if (filters.minValue) {
      result = result.filter(lead => (lead.value || 0) >= parseFloat(filters.minValue));
    }

    // Filter by max value
    if (filters.maxValue) {
      result = result.filter(lead => (lead.value || 0) <= parseFloat(filters.maxValue));
    }

    // Filter by tags
    if (filters.tags.length > 0) {
      result = result.filter(lead => 
        lead.tags && filters.tags.some(tag => lead.tags.includes(tag))
      );
    }

    return result;
  }, [leads, filters]);

  const handleDeleteFunnel = async () => {
    if (!funnelToDelete) return;
    await deleteFunnel.mutateAsync(funnelToDelete);
    if (selectedFunnelId === funnelToDelete) {
      setSelectedFunnelId(null);
    }
    setFunnelToDelete(null);
  };

  // Handle new lead from header button
  const handleNewLeadFromHeader = () => {
    if (stages.length > 0) {
      setShowNewLeadFromHeader(true);
    } else if (funnels.length === 0) {
      setShowCreateFunnel(true);
    }
  };

  return (
    <MainLayout
      title="Funis"
      subtitle="Gerencie suas etapas de vendas"
      onNewLead={handleNewLeadFromHeader}
    >
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {loadingFunnels ? (
            <div className="w-48 h-10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : funnels.length > 0 ? (
            <div className="flex items-center gap-2">
              <Select 
                value={currentFunnelId || undefined} 
                onValueChange={setSelectedFunnelId}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecionar funil" />
                </SelectTrigger>
                <SelectContent>
                  {funnels.map((funnel) => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: funnel.color }}
                        />
                        {funnel.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {currentFunnel && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setFunnelToEdit(currentFunnel)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setFunnelToDelete(currentFunnel.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum funil criado</p>
          )}
          
          <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "list")}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <Kanban className="w-4 h-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="w-4 h-4" />
                Lista
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <FunnelFilters
            stages={stages}
            filters={filters}
            onFiltersChange={setFilters}
          />
          {currentFunnel && (
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => setShowAutomations(true)}
            >
              <Zap className="w-4 h-4" />
              Automações
            </Button>
          )}
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => setShowExport(true)}
            disabled={filteredLeads.length === 0}
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          <Button 
            className="gap-2 gradient-primary text-primary-foreground"
            onClick={() => setShowCreateFunnel(true)}
          >
            <Plus className="w-4 h-4" />
            Novo Funil
          </Button>
        </div>
      </div>

      {/* Content */}
      {view === "kanban" ? (
        <KanbanBoard funnelId={currentFunnelId} filters={filters} />
      ) : (
        <FunnelListView funnelId={currentFunnelId} filters={filters} />
      )}

      {/* Create Funnel Dialog */}
      <CreateFunnelDialog
        open={showCreateFunnel}
        onOpenChange={setShowCreateFunnel}
      />

      {/* Export Dialog */}
      <ExportLeads
        open={showExport}
        onOpenChange={setShowExport}
        leads={filteredLeads}
        stages={stages}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!funnelToDelete} onOpenChange={(open) => !open && setFunnelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as etapas e leads deste funil serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteFunnel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Lead from Header */}
      {showNewLeadFromHeader && stages.length > 0 && (
        <CreateLeadDialog
          open={showNewLeadFromHeader}
          onOpenChange={setShowNewLeadFromHeader}
          stageId={stages[0].id}
          stageIds={stageIds}
        />
      )}

      {/* Edit Funnel Dialog */}
      <EditFunnelDialog
        open={!!funnelToEdit}
        onOpenChange={(open) => !open && setFunnelToEdit(null)}
        funnel={funnelToEdit}
      />

      {/* Automations Dialog */}
      {currentFunnel && (
        <AutomationsDialog
          open={showAutomations}
          onOpenChange={setShowAutomations}
          funnelId={currentFunnelId}
          funnelName={currentFunnel.name}
          stages={stages}
        />
      )}
    </MainLayout>
  );
}
