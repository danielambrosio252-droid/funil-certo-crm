import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FunnelStage, useFunnelStages } from "@/hooks/useFunnels";

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

interface EditStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: FunnelStage | null;
  funnelId: string;
}

export function EditStageDialog({ open, onOpenChange, stage, funnelId }: EditStageDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const { updateStage } = useFunnelStages(funnelId);

  useEffect(() => {
    if (stage) {
      setName(stage.name);
      setColor(stage.color || COLORS[0]);
    }
  }, [stage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !stage) return;

    await updateStage.mutateAsync({ id: stage.id, name, color });
    onOpenChange(false);
  };

  if (!stage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Etapa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-stage-name">Nome da Etapa</Label>
              <Input
                id="edit-stage-name"
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

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || updateStage.isPending}>
              {updateStage.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
