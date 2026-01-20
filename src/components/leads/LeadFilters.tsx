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
import { Calendar } from "@/components/ui/calendar";
import { Filter, X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { FunnelStage } from "@/hooks/useFunnels";

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

export interface LeadFiltersState {
  sources: string[];
  stages: string[];
  minValue: string;
  maxValue: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export const initialLeadFilters: LeadFiltersState = {
  sources: [],
  stages: [],
  minValue: "",
  maxValue: "",
  dateFrom: undefined,
  dateTo: undefined,
};

interface LeadFiltersProps {
  stages: FunnelStage[];
  filters: LeadFiltersState;
  onFiltersChange: (filters: LeadFiltersState) => void;
}

export function LeadFilters({ stages, filters, onFiltersChange }: LeadFiltersProps) {
  const [open, setOpen] = useState(false);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const activeFiltersCount =
    filters.sources.length +
    filters.stages.length +
    (filters.minValue ? 1 : 0) +
    (filters.maxValue ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  const handleSourceToggle = (source: string) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];
    onFiltersChange({ ...filters, sources: newSources });
  };

  const handleStageToggle = (stageId: string) => {
    const newStages = filters.stages.includes(stageId)
      ? filters.stages.filter((s) => s !== stageId)
      : [...filters.stages, stageId];
    onFiltersChange({ ...filters, stages: newStages });
  };

  const handleClearFilters = () => {
    onFiltersChange(initialLeadFilters);
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
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filtros Avançados</h4>
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
              <div className="space-y-2 max-h-40 overflow-y-auto">
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

          {/* Data de criação */}
          <div className="space-y-2">
            <Label>Data de criação</Label>
            <div className="flex gap-2">
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateFrom ? (
                      format(filters.dateFrom, "dd/MM/yy", { locale: ptBR })
                    ) : (
                      <span className="text-muted-foreground">De</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => {
                      onFiltersChange({ ...filters, dateFrom: date });
                      setDateFromOpen(false);
                    }}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateTo ? (
                      format(filters.dateTo, "dd/MM/yy", { locale: ptBR })
                    ) : (
                      <span className="text-muted-foreground">Até</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => {
                      onFiltersChange({ ...filters, dateTo: date });
                      setDateToOpen(false);
                    }}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {(filters.dateFrom || filters.dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => onFiltersChange({ ...filters, dateFrom: undefined, dateTo: undefined })}
              >
                <X className="w-3 h-3 mr-1" />
                Limpar datas
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
