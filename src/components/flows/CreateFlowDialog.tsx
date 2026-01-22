import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWhatsAppFlows } from "@/hooks/useWhatsAppFlows";

interface CreateFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (flowId: string) => void;
}

export function CreateFlowDialog({ open, onOpenChange, onSuccess }: CreateFlowDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { createFlow } = useWhatsAppFlows();

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      const flow = await createFlow.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        trigger_type: "new_lead", // Default, will be configured in editor
      });

      setName("");
      setDescription("");
      onOpenChange(false);
      onSuccess(flow.id);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Fluxo de Automação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Fluxo</Label>
            <Input
              id="name"
              placeholder="Ex: Boas-vindas Novos Leads"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descreva o objetivo deste fluxo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createFlow.isPending}>
            {createFlow.isPending ? "Criando..." : "Criar Fluxo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
