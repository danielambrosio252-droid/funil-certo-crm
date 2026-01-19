import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Zap, 
  Trash2, 
  Pencil, 
  ArrowRight,
  Clock,
  Tag,
  Bell,
  UserPlus,
  RefreshCw
} from "lucide-react";
import { useFunnelAutomations, FunnelAutomation, TriggerType, ActionType } from "@/hooks/useFunnelAutomations";
import { CreateAutomationDialog } from "./CreateAutomationDialog";
import { FunnelStage } from "@/hooks/useFunnels";
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

interface AutomationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId: string | null;
  funnelName: string;
  stages: FunnelStage[];
}

const triggerLabels: Record<TriggerType, { label: string; icon: React.ReactNode }> = {
  lead_created: { label: "Lead criado", icon: <UserPlus className="w-4 h-4" /> },
  lead_updated: { label: "Lead atualizado", icon: <RefreshCw className="w-4 h-4" /> },
  time_in_stage: { label: "Tempo na etapa", icon: <Clock className="w-4 h-4" /> },
  value_changed: { label: "Valor alterado", icon: <RefreshCw className="w-4 h-4" /> },
  tag_added: { label: "Tag adicionada", icon: <Tag className="w-4 h-4" /> },
};

const actionLabels: Record<ActionType, { label: string; icon: React.ReactNode }> = {
  move_to_stage: { label: "Mover para etapa", icon: <ArrowRight className="w-4 h-4" /> },
  add_tag: { label: "Adicionar tag", icon: <Tag className="w-4 h-4" /> },
  remove_tag: { label: "Remover tag", icon: <Tag className="w-4 h-4" /> },
  send_notification: { label: "Enviar notificação", icon: <Bell className="w-4 h-4" /> },
};

export function AutomationsDialog({
  open,
  onOpenChange,
  funnelId,
  funnelName,
  stages,
}: AutomationsDialogProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [automationToEdit, setAutomationToEdit] = useState<FunnelAutomation | null>(null);
  const [automationToDelete, setAutomationToDelete] = useState<string | null>(null);
  
  const { automations, loadingAutomations, toggleAutomation, deleteAutomation } = useFunnelAutomations(funnelId);

  const handleToggle = (automation: FunnelAutomation) => {
    toggleAutomation.mutate({ id: automation.id, is_active: !automation.is_active });
  };

  const handleDelete = async () => {
    if (!automationToDelete) return;
    await deleteAutomation.mutateAsync(automationToDelete);
    setAutomationToDelete(null);
  };

  const getStageName = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.name || "Etapa desconhecida";
  };

  const getActionDescription = (automation: FunnelAutomation) => {
    const config = automation.action_config;
    switch (automation.action_type) {
      case "move_to_stage":
        return `→ ${getStageName(config.target_stage_id as string)}`;
      case "add_tag":
        return `+ ${config.tag as string}`;
      case "remove_tag":
        return `- ${config.tag as string}`;
      case "send_notification":
        return config.message as string;
      default:
        return "";
    }
  };

  const getTriggerDescription = (automation: FunnelAutomation) => {
    const config = automation.trigger_config;
    switch (automation.trigger_type) {
      case "time_in_stage":
        const hours = config.hours as number;
        const stageId = config.stage_id as string;
        return `${hours}h em ${getStageName(stageId)}`;
      case "lead_created":
        if (config.stage_id) {
          return `na etapa ${getStageName(config.stage_id as string)}`;
        }
        return "em qualquer etapa";
      case "tag_added":
        return `tag "${config.tag}"`;
      default:
        return "";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Automações - {funnelName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Automação
            </Button>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {loadingAutomations ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : automations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-2">
                  Nenhuma automação configurada
                </p>
                <p className="text-sm text-muted-foreground/70">
                  Crie automações para mover leads automaticamente entre etapas
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {automations.map((automation) => (
                  <div
                    key={automation.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      automation.is_active 
                        ? "bg-card border-border" 
                        : "bg-muted/50 border-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className={`font-medium ${!automation.is_active && "text-muted-foreground"}`}>
                            {automation.name}
                          </h4>
                          {!automation.is_active && (
                            <Badge variant="secondary" className="text-xs">
                              Inativa
                            </Badge>
                          )}
                        </div>
                        
                        {automation.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {automation.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="outline" className="gap-1">
                            {triggerLabels[automation.trigger_type].icon}
                            {triggerLabels[automation.trigger_type].label}
                            {getTriggerDescription(automation) && (
                              <span className="text-muted-foreground ml-1">
                                {getTriggerDescription(automation)}
                              </span>
                            )}
                          </Badge>
                          
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          
                          <Badge variant="outline" className="gap-1">
                            {actionLabels[automation.action_type].icon}
                            {actionLabels[automation.action_type].label}
                            <span className="text-primary font-medium ml-1">
                              {getActionDescription(automation)}
                            </span>
                          </Badge>
                        </div>

                        {automation.conditions && automation.conditions.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {automation.conditions.length} condição(ões) configurada(s)
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={automation.is_active}
                          onCheckedChange={() => handleToggle(automation)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setAutomationToEdit(automation)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setAutomationToDelete(automation.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <CreateAutomationDialog
        open={showCreate || !!automationToEdit}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setAutomationToEdit(null);
          }
        }}
        funnelId={funnelId}
        stages={stages}
        automationToEdit={automationToEdit}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!automationToDelete} onOpenChange={(open) => !open && setAutomationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A automação será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
