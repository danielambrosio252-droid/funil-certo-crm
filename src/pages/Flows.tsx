import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Play, 
  Pause,
  UserPlus,
  MessageSquare,
  Calendar,
  GitBranch,
  Workflow,
} from "lucide-react";
import { useWhatsAppFlows, WhatsAppFlow, TriggerType } from "@/hooks/useWhatsAppFlows";
import { CreateFlowDialog } from "@/components/flows/CreateFlowDialog";
import { FlowEditor } from "@/components/flows/FlowEditor";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const triggerIcons: Record<TriggerType, React.ComponentType<{ className?: string }>> = {
  new_lead: UserPlus,
  keyword: MessageSquare,
  schedule: Calendar,
  stage_change: GitBranch,
};

const triggerLabels: Record<TriggerType, string> = {
  new_lead: "Novo Lead",
  keyword: "Palavra-chave",
  schedule: "Agendamento",
  stage_change: "Mudança de Etapa",
};

export default function Flows() {
  const { flows, loadingFlows, toggleFlow, deleteFlow } = useWhatsAppFlows();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFlow, setEditingFlow] = useState<WhatsAppFlow | null>(null);
  const [flowToDelete, setFlowToDelete] = useState<WhatsAppFlow | null>(null);

  const handleToggleFlow = async (flow: WhatsAppFlow) => {
    await toggleFlow.mutateAsync({ id: flow.id, is_active: !flow.is_active });
  };

  const handleDeleteFlow = async () => {
    if (!flowToDelete) return;
    await deleteFlow.mutateAsync(flowToDelete.id);
    setFlowToDelete(null);
  };

  const handleFlowCreated = (flowId: string) => {
    const flow = flows.find((f) => f.id === flowId);
    if (flow) {
      setEditingFlow(flow);
    }
  };

  // If editing a flow, show the editor
  if (editingFlow) {
    return (
      <MainLayout title="Fluxos de Automação" subtitle="Editor visual estilo ManyChat">
        <div className="h-[calc(100vh-4rem)]">
          <FlowEditor
            flowId={editingFlow.id}
            flowName={editingFlow.name}
            onBack={() => setEditingFlow(null)}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Fluxos de Automação" subtitle="Editor visual estilo ManyChat">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fluxos de Automação</h1>
            <p className="text-muted-foreground">
              Crie agentes automáticos para WhatsApp no estilo ManyChat
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Fluxo
          </Button>
        </div>

        {/* Flows Grid */}
        {loadingFlows ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : flows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Workflow className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhum fluxo criado</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Crie seu primeiro fluxo de automação para enviar mensagens automáticas,
                templates e mídias para seus leads no WhatsApp.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Fluxo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flows.map((flow) => {
              const TriggerIcon = triggerIcons[flow.trigger_type];
              return (
                <Card
                  key={flow.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setEditingFlow(flow)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Workflow className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{flow.name}</CardTitle>
                          {flow.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {flow.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setEditingFlow(flow);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar Fluxo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFlowToDelete(flow);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <TriggerIcon className="w-3 h-3" />
                          {triggerLabels[flow.trigger_type]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {flow.is_active ? (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1">
                            <Play className="w-3 h-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Pause className="w-3 h-3" />
                            Pausado
                          </Badge>
                        )}
                        <Switch
                          checked={flow.is_active}
                          onCheckedChange={() => handleToggleFlow(flow)}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Criado {formatDistanceToNow(new Date(flow.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <CreateFlowDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleFlowCreated}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!flowToDelete} onOpenChange={() => setFlowToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O fluxo "{flowToDelete?.name}" será
              excluído permanentemente, incluindo todos os blocos e conexões.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFlow}
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
