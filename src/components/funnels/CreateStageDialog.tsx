import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFunnelStages } from "@/hooks/useFunnels";

const COLORS = [
  "#3b82f6", // Blue (info)
  "#f97316", // Orange (warning)
  "#6366f1", // Indigo (primary)
  "#8b5cf6", // Purple
  "#22c55e", // Green (success)
  "#ef4444", // Red
  "#ec4899", // Pink
  "#06b6d4", // Cyan
];

interface CreateStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId: string;
}

export function CreateStageDialog({ open, onOpenChange, funnelId }: CreateStageDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const { createStage } = useFunnelStages(funnelId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createStage.mutateAsync({ name, color });
    setName("");
    setColor(COLORS[0]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Etapa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stage-name">Nome da Etapa</Label>
              <Input
                id="stage-name"
                placeholder="Ex: Qualificação"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? "ring-2 ring-offset-2 ring-primary" : ""
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || createStage.isPending}>
              {createStage.isPending ? "Criando..." : "Criar Etapa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
