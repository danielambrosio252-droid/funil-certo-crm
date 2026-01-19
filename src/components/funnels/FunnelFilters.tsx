import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, X } from "lucide-react";
import { FunnelStage } from "@/hooks/useFunnels";

const SOURCES = [
  "Meta Ads",
  "WhatsApp",
  "Formulário",
  "Indicação",
  "LinkedIn",
  "Google Ads",
  "Orgânico",
  "Outro",
];

export interface FunnelFiltersState {
  sources: string[];
  stages: string[];
  minValue: string;
  maxValue: string;
  tags: string[];
}

interface FunnelFiltersProps {
  stages: FunnelStage[];
  filters: FunnelFiltersState;
  onFiltersChange: (filters: FunnelFiltersState) => void;
}

export function FunnelFilters({ stages, filters, onFiltersChange }: FunnelFiltersProps) {
  const [open, setOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const activeFiltersCount = 
    filters.sources.length + 
    filters.stages.length + 
    filters.tags.length +
    (filters.minValue ? 1 : 0) +
    (filters.maxValue ? 1 : 0);

  const handleSourceToggle = (source: string) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter(s => s !== source)
      : [...filters.sources, source];
    onFiltersChange({ ...filters, sources: newSources });
  };

  const handleStageToggle = (stageId: string) => {
    const newStages = filters.stages.includes(stageId)
      ? filters.stages.filter(s => s !== stageId)
      : [...filters.stages, stageId];
    onFiltersChange({ ...filters, stages: newStages });
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !filters.tags.includes(tagInput.trim())) {
      onFiltersChange({ ...filters, tags: [...filters.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    onFiltersChange({ ...filters, tags: filters.tags.filter(t => t !== tag) });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      sources: [],
      stages: [],
      minValue: "",
      maxValue: "",
      tags: [],
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filtros</h4>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Limpar
              </Button>
            )}
          </div>

          {/* Origem */}
          <div className="space-y-2">
            <Label>Origem</Label>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((source) => (
                <Badge
                  key={source}
                  variant={filters.sources.includes(source) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleSourceToggle(source)}
                >
                  {source}
                </Badge>
              ))}
            </div>
          </div>

          {/* Etapa */}
          {stages.length > 0 && (
            <div className="space-y-2">
              <Label>Etapa</Label>
              <div className="space-y-2">
                {stages.map((stage) => (
                  <div key={stage.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`stage-${stage.id}`}
                      checked={filters.stages.includes(stage.id)}
                      onCheckedChange={() => handleStageToggle(stage.id)}
                    />
                    <label
                      htmlFor={`stage-${stage.id}`}
                      className="text-sm flex items-center gap-2 cursor-pointer"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valor */}
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Mín"
                value={filters.minValue}
                onChange={(e) => onFiltersChange({ ...filters, minValue: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Máx"
                value={filters.maxValue}
                onChange={(e) => onFiltersChange({ ...filters, maxValue: e.target.value })}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
              />
              <Button variant="secondary" size="sm" onClick={handleAddTag}>
                +
              </Button>
            </div>
            {filters.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {filters.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
