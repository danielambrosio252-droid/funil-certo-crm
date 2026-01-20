import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Tags,
  Mail,
  Trash2,
  X,
  Plus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type { FunnelStage, FunnelLead } from "@/hooks/useFunnels";

interface BulkActionsBarProps {
  selectedCount: number;
  selectedLeads: FunnelLead[];
  stages: FunnelStage[];
  onCancel: () => void;
  onMoveToStage: (stageId: string) => Promise<void>;
  onAddTags: (tags: string[]) => Promise<void>;
  onRemoveTags: (tags: string[]) => Promise<void>;
  onDelete: () => Promise<void>;
  onSendEmail: () => void;
  isProcessing: boolean;
}

export function BulkActionsBar({
  selectedCount,
  selectedLeads,
  stages,
  onCancel,
  onMoveToStage,
  onAddTags,
  onRemoveTags,
  onDelete,
  onSendEmail,
  isProcessing,
}: BulkActionsBarProps) {
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [tagMode, setTagMode] = useState<"add" | "remove">("add");
  const [newTag, setNewTag] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Get all unique tags from selected leads
  const existingTags = Array.from(
    new Set(selectedLeads.flatMap((lead) => lead.tags || []))
  );

  const handleAddTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      setSelectedTags([...selectedTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTagFromSelection = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  const handleConfirmTags = async () => {
    if (selectedTags.length === 0) {
      toast.error("Selecione pelo menos uma tag");
      return;
    }

    if (tagMode === "add") {
      await onAddTags(selectedTags);
    } else {
      await onRemoveTags(selectedTags);
    }

    setShowTagDialog(false);
    setSelectedTags([]);
  };

  const openTagDialog = (mode: "add" | "remove") => {
    setTagMode(mode);
    setSelectedTags([]);
    setNewTag("");
    setShowTagDialog(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20"
      >
        <span className="text-sm font-medium">
          {selectedCount} selecionado{selectedCount > 1 ? "s" : ""}
        </span>

        <div className="h-4 w-px bg-border" />

        {/* Move to Stage */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isProcessing}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Mover para
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Selecione a etapa</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {stages.map((stage) => (
              <DropdownMenuItem
                key={stage.id}
                onClick={() => onMoveToStage(stage.id)}
              >
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: stage.color }}
                />
                {stage.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tags */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isProcessing}>
              <Tags className="w-4 h-4 mr-2" />
              Tags
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => openTagDialog("add")}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar tags
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openTagDialog("remove")}>
              <X className="w-4 h-4 mr-2" />
              Remover tags
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Send Email */}
        <Button variant="outline" size="sm" onClick={onSendEmail} disabled={isProcessing}>
          <Mail className="w-4 h-4 mr-2" />
          Enviar e-mail
        </Button>

        <div className="flex-1" />

        {/* Cancel */}
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isProcessing}>
          Cancelar
        </Button>

        {/* Delete */}
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={isProcessing}>
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir
        </Button>
      </motion.div>

      {/* Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tagMode === "add" ? "Adicionar Tags" : "Remover Tags"}
            </DialogTitle>
            <DialogDescription>
              {tagMode === "add"
                ? `Adicione tags aos ${selectedCount} leads selecionados`
                : `Remova tags dos ${selectedCount} leads selecionados`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tag Input (only for add mode) */}
            {tagMode === "add" && (
              <div className="flex gap-2">
                <Input
                  placeholder="Digite uma nova tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                />
                <Button onClick={handleAddTag} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Existing Tags (for remove mode) */}
            {tagMode === "remove" && existingTags.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Tags existentes nos leads selecionados:
                </p>
                <div className="flex flex-wrap gap-2">
                  {existingTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() =>
                        selectedTags.includes(tag)
                          ? handleRemoveTagFromSelection(tag)
                          : setSelectedTags([...selectedTags, tag])
                      }
                    >
                      {selectedTags.includes(tag) && (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {tagMode === "remove" && existingTags.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma tag encontrada nos leads selecionados
              </p>
            )}

            {/* Selected Tags Preview */}
            {selectedTags.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Tags a {tagMode === "add" ? "adicionar" : "remover"}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => handleRemoveTagFromSelection(tag)}
                    >
                      {tag}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmTags}
              disabled={selectedTags.length === 0 || isProcessing}
            >
              {isProcessing
                ? "Processando..."
                : tagMode === "add"
                ? "Adicionar"
                : "Remover"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
