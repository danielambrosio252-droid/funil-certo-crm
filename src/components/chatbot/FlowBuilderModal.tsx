import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Bot, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Play, 
  Pause,
  Workflow,
  X,
  Loader2,
} from "lucide-react";
import { useChatbotFlows, ChatbotFlow } from "@/hooks/useChatbotFlows";
import { FlowBuilderCanvas } from "./FlowBuilderCanvas";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FlowBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FlowBuilderModal({ isOpen, onClose }: FlowBuilderModalProps) {
  const { flows, loadingFlows, createFlow, deleteFlow, toggleFlow } = useChatbotFlows();
  const [editingFlow, setEditingFlow] = useState<ChatbotFlow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [flowToDelete, setFlowToDelete] = useState<ChatbotFlow | null>(null);

  const handleCreateFlow = async () => {
    if (!newFlowName.trim()) return;
    
    const flow = await createFlow.mutateAsync({ name: newFlowName.trim() });
    setNewFlowName("");
    setShowCreateDialog(false);
    setEditingFlow(flow);
  };

  const handleDeleteFlow = async () => {
    if (!flowToDelete) return;
    await deleteFlow.mutateAsync(flowToDelete.id);
    setFlowToDelete(null);
  };

  // If editing a flow, show the canvas
  if (editingFlow) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900"
          >
            <FlowBuilderCanvas
              flowId={editingFlow.id}
              flowName={editingFlow.name}
              onClose={() => setEditingFlow(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 h-full w-full max-w-xl bg-background border-l shadow-xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">Fluxos do Chatbot</h2>
                    <p className="text-sm text-muted-foreground">
                      Gerencie as automações do bot
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 p-6">
                {loadingFlows ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : flows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Workflow className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Nenhum fluxo criado</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mb-4">
                      Crie seu primeiro fluxo para automatizar as respostas do chatbot.
                    </p>
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Fluxo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button 
                      onClick={() => setShowCreateDialog(true)} 
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Fluxo
                    </Button>

                    {flows.map((flow) => (
                      <div
                        key={flow.id}
                        className="group p-4 bg-card border rounded-xl hover:shadow-md transition-all cursor-pointer"
                        onClick={() => setEditingFlow(flow)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Workflow className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium">{flow.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                Criado {formatDistanceToNow(new Date(flow.created_at), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Badge 
                              variant={flow.is_active ? "default" : "secondary"}
                              className={flow.is_active ? "bg-emerald-500" : ""}
                            >
                              {flow.is_active ? (
                                <>
                                  <Play className="w-3 h-3 mr-1" />
                                  Ativo
                                </>
                              ) : (
                                <>
                                  <Pause className="w-3 h-3 mr-1" />
                                  Pausado
                                </>
                              )}
                            </Badge>
                            <Switch
                              checked={flow.is_active}
                              onCheckedChange={(checked) => 
                                toggleFlow.mutate({ id: flow.id, is_active: checked })
                              }
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingFlow(flow)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => setFlowToDelete(flow)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {flow.trigger_keywords && flow.trigger_keywords.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {flow.trigger_keywords.map((kw, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Flow Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Fluxo</DialogTitle>
            <DialogDescription>
              Dê um nome para o seu fluxo de chatbot.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Ex: Atendimento Inicial"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFlow();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateFlow}
              disabled={!newFlowName.trim() || createFlow.isPending}
            >
              {createFlow.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!flowToDelete} onOpenChange={() => setFlowToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O fluxo "{flowToDelete?.name}" será
              excluído permanentemente.
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
    </>
  );
}
