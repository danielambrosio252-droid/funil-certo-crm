import { useState, useMemo } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus, MoreHorizontal, Phone, MessageCircle, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useFunnelStages, useFunnelLeads, FunnelLead, FunnelStage } from "@/hooks/useFunnels";
import { CreateStageDialog } from "./CreateStageDialog";
import { CreateLeadDialog } from "./CreateLeadDialog";
import { LeadDetailsDialog } from "./LeadDetailsDialog";
import { EditStageDialog } from "./EditStageDialog";
import { FunnelFiltersState } from "./FunnelFilters";

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

interface KanbanBoardProps {
  funnelId: string | null;
  filters?: FunnelFiltersState;
}

export function KanbanBoard({ funnelId, filters }: KanbanBoardProps) {
  const { stages, loadingStages, deleteStage } = useFunnelStages(funnelId);
  const stageIds = useMemo(() => stages.map(s => s.id), [stages]);
  const { leads, loadingLeads, moveLead, deleteLead } = useFunnelLeads(stageIds, funnelId);
  
  const [showNewStage, setShowNewStage] = useState(false);
  const [showNewLead, setShowNewLead] = useState<string | null>(null);
  const [stageToEdit, setStageToEdit] = useState<FunnelStage | null>(null);
  const [selectedLead, setSelectedLead] = useState<FunnelLead | null>(null);
  const [selectedLeadStage, setSelectedLeadStage] = useState<string | undefined>();

  const handleLeadClick = (lead: FunnelLead, stageName: string) => {
    setSelectedLead(lead);
    setSelectedLeadStage(stageName);
  };

  // Apply filters to leads
  const filteredLeads = useMemo(() => {
    let result = [...leads];

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

    return result;
  }, [leads, filters]);

  // Agrupar leads por etapa
  const leadsByStage = useMemo(() => {
    const grouped: Record<string, FunnelLead[]> = {};
    stages.forEach(stage => {
      grouped[stage.id] = filteredLeads.filter(l => l.stage_id === stage.id).sort((a, b) => a.position - b.position);
    });
    return grouped;
  }, [stages, filteredLeads]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Atualizar no banco
    await moveLead.mutateAsync({
      leadId: draggableId,
      newStageId: destination.droppableId,
      newPosition: destination.index,
    });
  };

  const getTotalValue = (stageId: string) => {
    const stageLeads = leadsByStage[stageId] || [];
    return stageLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
  };

  if (!funnelId) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/30 rounded-xl border border-border">
        <p className="text-muted-foreground">Selecione ou crie um funil para começar</p>
      </div>
    );
  }

  if (loadingStages) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-280px)] sm:min-h-[calc(100vh-200px)] -mx-4 px-4 sm:mx-0 sm:px-0">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="flex-shrink-0 w-72 sm:w-80 bg-muted/30 rounded-xl border border-border"
            >
              {/* Stage Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3 className="font-semibold text-foreground">{stage.name}</h3>
                    <Badge variant="secondary" className="ml-1">
                      {(leadsByStage[stage.id] || []).length}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setStageToEdit(stage)}>
                        Editar etapa
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowNewLead(stage.id)}>
                        Adicionar lead
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => deleteStage.mutate(stage.id)}
                      >
                        Excluir etapa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {getTotalValue(stage.id) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Valor: <span className="font-medium text-foreground">R$ {getTotalValue(stage.id).toLocaleString('pt-BR')}</span>
                  </p>
                )}
              </div>

              {/* Leads */}
              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "p-2 min-h-[200px] transition-colors",
                      snapshot.isDraggingOver && "bg-primary/5"
                    )}
                  >
                    {(leadsByStage[stage.id] || []).map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => handleLeadClick(lead, stage.name)}
                            className={cn(
                              "bg-card border border-border rounded-lg p-4 mb-2 cursor-pointer shadow-sm hover:shadow-md transition-shadow",
                              snapshot.isDragging && "shadow-lg ring-2 ring-primary/20"
                            )}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-8 h-8">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                    {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{lead.name}</p>
                                  {lead.email && (
                                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                                  )}
                                </div>
                              </div>
                              {lead.source && (
                                <Badge variant="outline" className={cn("text-xs", sourceColors[lead.source] || sourceColors["Outro"])}>
                                  {lead.source}
                                </Badge>
                              )}
                            </div>

                            {lead.value > 0 && (
                              <p className="text-sm font-semibold text-foreground mb-2">
                                R$ {Number(lead.value).toLocaleString('pt-BR')}
                              </p>
                            )}

                            {lead.tags && lead.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {lead.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {lead.last_contact_at && (
                              <p className="text-xs text-muted-foreground mb-2">
                                Último contato: {new Date(lead.last_contact_at).toLocaleDateString('pt-BR')}
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-border">
                              <div className="flex items-center gap-1">
                                {lead.phone && (
                                  <Button variant="ghost" size="icon" className="w-7 h-7" asChild>
                                    <a href={`tel:${lead.phone}`}>
                                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                    </a>
                                  </Button>
                                )}
                                {lead.phone && (
                                  <Button variant="ghost" size="icon" className="w-7 h-7" asChild>
                                    <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                      <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                    </a>
                                  </Button>
                                )}
                                {lead.email && (
                                  <Button variant="ghost" size="icon" className="w-7 h-7" asChild>
                                    <a href={`mailto:${lead.email}`}>
                                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="w-7 h-7">
                                    <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => deleteLead.mutate(lead.id)}
                                  >
                                    Excluir lead
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Add Lead Button */}
              <div className="p-2">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewLead(stage.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar lead
                </Button>
              </div>
            </div>
          ))}

          {/* Add Stage */}
          <div className="flex-shrink-0 w-80">
            <Button
              variant="outline"
              className="w-full h-12 border-dashed text-muted-foreground hover:text-foreground"
              onClick={() => setShowNewStage(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova etapa
            </Button>
          </div>
        </div>
      </DragDropContext>

      {/* Dialogs */}
      {funnelId && (
        <CreateStageDialog
          open={showNewStage}
          onOpenChange={setShowNewStage}
          funnelId={funnelId}
        />
      )}

      {showNewLead && (
        <CreateLeadDialog
          open={!!showNewLead}
          onOpenChange={(open) => !open && setShowNewLead(null)}
          stageId={showNewLead}
          stageIds={stageIds}
          funnelId={funnelId}
        />
      )}

      <LeadDetailsDialog
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        lead={selectedLead}
        stageIds={stageIds}
        stageName={selectedLeadStage}
        funnelId={funnelId}
      />

      {funnelId && (
        <EditStageDialog
          open={!!stageToEdit}
          onOpenChange={(open) => !open && setStageToEdit(null)}
          stage={stageToEdit}
          funnelId={funnelId}
        />
      )}
    </>
  );
}
