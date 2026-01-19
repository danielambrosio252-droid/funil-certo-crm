import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { KanbanBoard } from "@/components/funnels/KanbanBoard";
import { CreateFunnelDialog } from "@/components/funnels/CreateFunnelDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Kanban, List, Filter, Download, Loader2, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFunnels } from "@/hooks/useFunnels";
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
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [funnelToDelete, setFunnelToDelete] = useState<string | null>(null);
  
  const { funnels, loadingFunnels, deleteFunnel } = useFunnels();

  // Selecionar primeiro funil automaticamente
  const currentFunnelId = selectedFunnelId || (funnels.length > 0 ? funnels[0].id : null);
  const currentFunnel = funnels.find(f => f.id === currentFunnelId);

  const handleDeleteFunnel = async () => {
    if (!funnelToDelete) return;
    await deleteFunnel.mutateAsync(funnelToDelete);
    if (selectedFunnelId === funnelToDelete) {
      setSelectedFunnelId(null);
    }
    setFunnelToDelete(null);
  };

  return (
    <MainLayout
      title="Funis"
      subtitle="Gerencie suas etapas de vendas"
    >
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setFunnelToDelete(currentFunnel.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
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

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
          <Button variant="outline" className="gap-2">
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
        <KanbanBoard funnelId={currentFunnelId} />
      ) : (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <List className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Visualização em Lista</h3>
          <p className="text-muted-foreground">Em breve disponível</p>
        </div>
      )}

      {/* Create Funnel Dialog */}
      <CreateFunnelDialog
        open={showCreateFunnel}
        onOpenChange={setShowCreateFunnel}
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
    </MainLayout>
  );
}
