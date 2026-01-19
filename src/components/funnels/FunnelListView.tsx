import { useState, useMemo } from "react";
import { Plus, Phone, MessageCircle, Mail, ArrowUpDown, MoreHorizontal, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useFunnelStages, useFunnelLeads, FunnelLead } from "@/hooks/useFunnels";
import { CreateStageDialog } from "./CreateStageDialog";
import { CreateLeadDialog } from "./CreateLeadDialog";
import { LeadDetailsDialog } from "./LeadDetailsDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const sourceColors: Record<string, string> = {
  "Meta Ads": "bg-info/10 text-info",
  "WhatsApp": "bg-success/10 text-success",
  "Formulário": "bg-warning/10 text-warning",
  "Indicação": "bg-purple-500/10 text-purple-500",
  "LinkedIn": "bg-blue-600/10 text-blue-600",
  "Google Ads": "bg-red-500/10 text-red-500",
  "Orgânico": "bg-green-600/10 text-green-600",
  "Outro": "bg-gray-500/10 text-gray-500",
};

import { FunnelFiltersState } from "./FunnelFilters";

interface FunnelListViewProps {
  funnelId: string | null;
  filters?: FunnelFiltersState;
}

type SortField = "name" | "value" | "created_at" | "stage";
type SortOrder = "asc" | "desc";

export function FunnelListView({ funnelId, filters }: FunnelListViewProps) {
  const { stages, loadingStages } = useFunnelStages(funnelId);
  const stageIds = useMemo(() => stages.map(s => s.id), [stages]);
  const { leads, loadingLeads, deleteLead } = useFunnelLeads(stageIds);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showNewLead, setShowNewLead] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<FunnelLead | null>(null);
  const [selectedLeadStage, setSelectedLeadStage] = useState<string | undefined>();

  // Get stage name by ID
  const getStageById = (stageId: string) => stages.find(s => s.id === stageId);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Apply external filters
    if (filters) {
      // Filter by source
      if (filters.sources.length > 0) {
        result = result.filter(lead => lead.source && filters.sources.includes(lead.source));
      }

      // Filter by stage
      if (filters.stages.length > 0) {
        result = result.filter(lead => filters.stages.includes(lead.stage_id));
      }

      // Filter by min value
      if (filters.minValue) {
        result = result.filter(lead => (lead.value || 0) >= parseFloat(filters.minValue));
      }

      // Filter by max value
      if (filters.maxValue) {
        result = result.filter(lead => (lead.value || 0) <= parseFloat(filters.maxValue));
      }

      // Filter by tags
      if (filters.tags.length > 0) {
        result = result.filter(lead => 
          lead.tags && filters.tags.some(tag => lead.tags.includes(tag))
        );
      }
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(lead => 
        lead.name.toLowerCase().includes(term) ||
        lead.email?.toLowerCase().includes(term) ||
        lead.phone?.includes(term) ||
        lead.source?.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "value":
          comparison = (a.value || 0) - (b.value || 0);
          break;
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "stage":
          const stageA = getStageById(a.stage_id);
          const stageB = getStageById(b.stage_id);
          comparison = (stageA?.position || 0) - (stageB?.position || 0);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [leads, searchTerm, sortField, sortOrder, stages, filters]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleLeadClick = (lead: FunnelLead) => {
    const stage = getStageById(lead.stage_id);
    setSelectedLead(lead);
    setSelectedLeadStage(stage?.name);
  };

  if (!funnelId) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/30 rounded-xl border border-border">
        <p className="text-muted-foreground">Selecione ou crie um funil para começar</p>
      </div>
    );
  }

  if (loadingStages || loadingLeads) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalValue = filteredLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filteredLeads.length}</span> leads •{" "}
              <span className="font-medium text-foreground">R$ {totalValue.toLocaleString("pt-BR")}</span>
            </p>
            {stages.length > 0 && (
              <Button size="sm" onClick={() => setShowNewLead(stages[0].id)}>
                <Plus className="w-4 h-4 mr-1" />
                Novo Lead
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => handleSort("name")}
                  >
                    Lead
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => handleSort("stage")}
                  >
                    Etapa
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => handleSort("value")}
                  >
                    Valor
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => handleSort("created_at")}
                  >
                    Criado em
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Nenhum lead encontrado" : "Nenhum lead neste funil"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => {
                  const stage = getStageById(lead.stage_id);
                  return (
                    <TableRow 
                      key={lead.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleLeadClick(lead)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                              {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{lead.name}</p>
                            {lead.tags && lead.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {lead.tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                                    {tag}
                                  </Badge>
                                ))}
                                {lead.tags.length > 2 && (
                                  <Badge variant="secondary" className="text-xs px-1 py-0">
                                    +{lead.tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {lead.phone && (
                            <>
                              <Button variant="ghost" size="icon" className="w-7 h-7" asChild>
                                <a href={`tel:${lead.phone}`}>
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              </Button>
                              <Button variant="ghost" size="icon" className="w-7 h-7" asChild>
                                <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              </Button>
                            </>
                          )}
                          {lead.email && (
                            <Button variant="ghost" size="icon" className="w-7 h-7" asChild>
                              <a href={`mailto:${lead.email}`}>
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {stage && (
                          <Badge 
                            variant="outline" 
                            className="gap-1.5"
                            style={{ borderColor: stage.color, color: stage.color }}
                          >
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.value > 0 ? (
                          <span className="font-medium">
                            R$ {Number(lead.value).toLocaleString("pt-BR")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.source ? (
                          <Badge variant="outline" className={cn("text-xs", sourceColors[lead.source] || sourceColors["Outro"])}>
                            {lead.source}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-8 h-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleLeadClick(lead)}>
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => deleteLead.mutate(lead.id)}
                            >
                              Excluir lead
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialogs */}
      {showNewLead && (
        <CreateLeadDialog
          open={!!showNewLead}
          onOpenChange={(open) => !open && setShowNewLead(null)}
          stageId={showNewLead}
          stageIds={stageIds}
        />
      )}

      <LeadDetailsDialog
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        lead={selectedLead}
        stageIds={stageIds}
        stageName={selectedLeadStage}
      />
    </>
  );
}
