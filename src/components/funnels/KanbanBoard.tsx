import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { Plus, MoreHorizontal, Phone, MessageCircle, Mail, User } from "lucide-react";
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

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  value?: number;
  source: string;
  tags: string[];
  lastContact?: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  leads: Lead[];
}

const initialStages: Stage[] = [
  {
    id: "new",
    name: "Novos Leads",
    color: "bg-info",
    leads: [
      { id: "1", name: "Maria Santos", email: "maria@email.com", phone: "(11) 99999-0001", value: 2500, source: "Meta Ads", tags: ["Interessado", "Urgente"] },
      { id: "2", name: "Pedro Lima", email: "pedro@corp.com", phone: "(21) 98888-0002", value: 4800, source: "WhatsApp", tags: ["B2B"] },
      { id: "3", name: "Julia Costa", email: "julia@gmail.com", phone: "(31) 97777-0003", source: "Formulário", tags: ["Orçamento"] },
    ],
  },
  {
    id: "qualification",
    name: "Qualificação",
    color: "bg-warning",
    leads: [
      { id: "4", name: "Roberto Almeida", email: "roberto@empresa.com", phone: "(41) 96666-0004", value: 8500, source: "Meta Ads", tags: ["Premium"], lastContact: "Ontem" },
      { id: "5", name: "Ana Paula", email: "ana@tech.com", phone: "(51) 95555-0005", value: 3200, source: "WhatsApp", tags: ["Retorno"] },
    ],
  },
  {
    id: "proposal",
    name: "Proposta",
    color: "bg-primary",
    leads: [
      { id: "6", name: "Carlos Oliveira", email: "carlos@big.com", phone: "(61) 94444-0006", value: 15000, source: "Indicação", tags: ["Negociando", "VIP"] },
    ],
  },
  {
    id: "negotiation",
    name: "Negociação",
    color: "bg-purple-500",
    leads: [
      { id: "7", name: "Fernanda Dias", email: "fernanda@startup.io", phone: "(71) 93333-0007", value: 22000, source: "LinkedIn", tags: ["Fechamento"], lastContact: "Hoje" },
    ],
  },
  {
    id: "closed",
    name: "Fechamento",
    color: "bg-success",
    leads: [],
  },
];

const sourceColors: Record<string, string> = {
  "Meta Ads": "bg-info/10 text-info",
  "WhatsApp": "bg-success/10 text-success",
  "Formulário": "bg-warning/10 text-warning",
  "Indicação": "bg-purple-500/10 text-purple-500",
  "LinkedIn": "bg-blue-600/10 text-blue-600",
};

export function KanbanBoard() {
  const [stages, setStages] = useState<Stage[]>(initialStages);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const newStages = [...stages];
    const sourceStage = newStages.find((s) => s.id === source.droppableId);
    const destStage = newStages.find((s) => s.id === destination.droppableId);

    if (!sourceStage || !destStage) return;

    const [movedLead] = sourceStage.leads.splice(source.index, 1);
    destStage.leads.splice(destination.index, 0, movedLead);

    setStages(newStages);
  };

  const getTotalValue = (leads: Lead[]) => {
    return leads.reduce((sum, lead) => sum + (lead.value || 0), 0);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex-shrink-0 w-80 bg-muted/30 rounded-xl border border-border"
          >
            {/* Stage Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", stage.color)} />
                  <h3 className="font-semibold text-foreground">{stage.name}</h3>
                  <Badge variant="secondary" className="ml-1">
                    {stage.leads.length}
                  </Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Editar etapa</DropdownMenuItem>
                    <DropdownMenuItem>Adicionar lead</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Excluir etapa</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {getTotalValue(stage.leads) > 0 && (
                <p className="text-sm text-muted-foreground">
                  Valor: <span className="font-medium text-foreground">R$ {getTotalValue(stage.leads).toLocaleString('pt-BR')}</span>
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
                  {stage.leads.map((lead, index) => (
                    <Draggable key={lead.id} draggableId={lead.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            "bg-card border border-border rounded-lg p-4 mb-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow",
                            snapshot.isDragging && "shadow-lg ring-2 ring-primary/20"
                          )}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                  {lead.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground text-sm">{lead.name}</p>
                                <p className="text-xs text-muted-foreground">{lead.email}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={cn("text-xs", sourceColors[lead.source])}>
                              {lead.source}
                            </Badge>
                          </div>

                          {lead.value && (
                            <p className="text-sm font-semibold text-foreground mb-2">
                              R$ {lead.value.toLocaleString('pt-BR')}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1 mb-3">
                            {lead.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          {lead.lastContact && (
                            <p className="text-xs text-muted-foreground mb-2">
                              Último contato: {lead.lastContact}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-border">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="w-7 h-7">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="w-7 h-7">
                                <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="w-7 h-7">
                                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                            <Button variant="ghost" size="icon" className="w-7 h-7">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
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
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
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
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova etapa
          </Button>
        </div>
      </div>
    </DragDropContext>
  );
}
