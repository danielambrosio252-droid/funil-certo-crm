import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Search,
  Download,
  Upload,
  Plus,
  MoreHorizontal,
  Phone,
  Mail,
  MessageCircle,
  Trash2,
  Eye,
  Users,
  Loader2,
} from "lucide-react";
import { useAllLeads } from "@/hooks/useAllLeads";
import { ImportLeadsDialog } from "@/components/leads/ImportLeadsDialog";
import { ExportLeadsDialog } from "@/components/leads/ExportLeadsDialog";
import { CreateLeadDialogGlobal } from "@/components/leads/CreateLeadDialogGlobal";
import { BulkActionsBar } from "@/components/leads/BulkActionsBar";
import { BulkEmailDialog } from "@/components/leads/BulkEmailDialog";
import { LeadDetailsDialog } from "@/components/funnels/LeadDetailsDialog";
import { LeadFilters, initialLeadFilters, type LeadFiltersState } from "@/components/leads/LeadFilters";
import { WhatsAppChoiceDialog, useWhatsAppChoice } from "@/components/whatsapp/WhatsAppChoiceDialog";
import type { FunnelLead } from "@/hooks/useFunnels";

const sourceColors: Record<string, string> = {
  "Meta Ads": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "WhatsApp": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "Formulário": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  "Indicação": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  "LinkedIn": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  "Google Ads": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  "Orgânico": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Outro": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function Leads() {
  const { 
    leads, 
    stages, 
    loadingLeads, 
    loadingStages, 
    createLead, 
    importLeads, 
    deleteLead, 
    getStageById,
    bulkMoveToStage,
    bulkAddTags,
    bulkRemoveTags,
    bulkDelete,
  } = useAllLeads();
  const [searchParams] = useSearchParams();
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Sync search query from URL params
  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<FunnelLead | null>(null);
  const [filters, setFilters] = useState<LeadFiltersState>(initialLeadFilters);
  const whatsAppChoice = useWhatsAppChoice();

  const filteredLeads = useMemo(() => {
    let result = leads;

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (lead) =>
          lead.name.toLowerCase().includes(query) ||
          lead.email?.toLowerCase().includes(query) ||
          lead.phone?.toLowerCase().includes(query) ||
          lead.source?.toLowerCase().includes(query)
      );
    }

    // Source filter
    if (filters.sources.length > 0) {
      result = result.filter((lead) => lead.source && filters.sources.includes(lead.source));
    }

    // Stage filter
    if (filters.stages.length > 0) {
      result = result.filter((lead) => filters.stages.includes(lead.stage_id));
    }

    // Value filter
    if (filters.minValue) {
      const min = parseFloat(filters.minValue);
      result = result.filter((lead) => (lead.value || 0) >= min);
    }
    if (filters.maxValue) {
      const max = parseFloat(filters.maxValue);
      result = result.filter((lead) => (lead.value || 0) <= max);
    }

    // Date filter
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((lead) => new Date(lead.created_at) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((lead) => new Date(lead.created_at) <= to);
    }

    // Tags filter
    if (filters.tags.length > 0) {
      result = result.filter((lead) => {
        const leadTags = lead.tags || [];
        return filters.tags.some((tag) => leadTags.includes(tag));
      });
    }

    return result;
  }, [leads, searchQuery, filters]);

  // Extract all unique tags from leads
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    leads.forEach((lead) => {
      (lead.tags || []).forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [leads]);

  const selectedLeadsData = useMemo(() => {
    return leads.filter((lead) => selectedLeadIds.includes(lead.id));
  }, [leads, selectedLeadIds]);

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkMoveToStage = async (stageId: string) => {
    await bulkMoveToStage.mutateAsync({ leadIds: selectedLeadIds, stageId });
    setSelectedLeadIds([]);
  };

  const handleBulkAddTags = async (tags: string[]) => {
    await bulkAddTags.mutateAsync({ leadIds: selectedLeadIds, tags });
    setSelectedLeadIds([]);
  };

  const handleBulkRemoveTags = async (tags: string[]) => {
    await bulkRemoveTags.mutateAsync({ leadIds: selectedLeadIds, tags });
    setSelectedLeadIds([]);
  };

  const handleBulkDelete = async () => {
    await bulkDelete.mutateAsync(selectedLeadIds);
    setSelectedLeadIds([]);
  };

  const formatLastContact = (date: string | null) => {
    if (!date) return "-";
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoje";
    if (days === 1) return "Ontem";
    return `${days} dias`;
  };

  const totalValue = useMemo(() => {
    return filteredLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
  }, [filteredLeads]);

  const stageIds = useMemo(() => stages.map(s => s.id), [stages]);

  const isLoading = loadingLeads || loadingStages;
  const isProcessing = bulkMoveToStage.isPending || bulkAddTags.isPending || bulkRemoveTags.isPending || bulkDelete.isPending;

  return (
    <MainLayout title="Leads" subtitle="Gerencie todos os seus leads em um só lugar">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por nome, email, telefone..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <LeadFilters
            stages={stages}
            filters={filters}
            onFiltersChange={setFilters}
            availableTags={availableTags}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{filteredLeads.length} leads</span>
          </div>
          <div>
            Valor total: <span className="font-medium text-foreground">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue)}
            </span>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedLeadIds.length > 0 && (
          <BulkActionsBar
            selectedCount={selectedLeadIds.length}
            selectedLeads={selectedLeadsData}
            stages={stages}
            onCancel={() => setSelectedLeadIds([])}
            onMoveToStage={handleBulkMoveToStage}
            onAddTags={handleBulkAddTags}
            onRemoveTags={handleBulkRemoveTags}
            onDelete={handleBulkDelete}
            onSendEmail={() => setShowEmailDialog(true)}
            isProcessing={isProcessing}
          />
        )}

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum lead encontrado</p>
              <p className="text-sm">Comece adicionando seu primeiro lead</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Lead
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Último contato</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const stage = getStageById(lead.stage_id);
                  return (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="group cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLeadIds.includes(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-sm text-muted-foreground">{lead.email || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.phone || "-"}
                      </TableCell>
                      <TableCell>
                        {lead.source && (
                          <Badge
                            variant="secondary"
                            className={sourceColors[lead.source] || sourceColors["Outro"]}
                          >
                            {lead.source}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {stage && (
                          <Badge
                            variant="outline"
                            style={{ 
                              borderColor: stage.color,
                              color: stage.color 
                            }}
                          >
                            {stage.name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.value ? (
                          <span className="font-medium">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.value)}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatLastContact(lead.last_contact_at)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedLead(lead)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                            {lead.phone && (
                              <DropdownMenuItem asChild>
                                <a href={`tel:${lead.phone}`}>
                                  <Phone className="w-4 h-4 mr-2" />
                                  Ligar
                                </a>
                              </DropdownMenuItem>
                            )}
                            {lead.phone && (
                              <DropdownMenuItem
                                onClick={() => whatsAppChoice.openDialog(lead.phone!, lead.name)}
                              >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                WhatsApp
                              </DropdownMenuItem>
                            )}
                            {lead.email && (
                              <DropdownMenuItem asChild>
                                <a href={`mailto:${lead.email}`}>
                                  <Mail className="w-4 h-4 mr-2" />
                                  E-mail
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => deleteLead.mutate(lead.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination info */}
        {filteredLeads.length > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Mostrando {filteredLeads.length} de {leads.length} leads
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ImportLeadsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        stages={stages}
        onImport={async (leadsToImport) => {
          await importLeads.mutateAsync(leadsToImport);
        }}
        isImporting={importLeads.isPending}
      />

      <ExportLeadsDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        leads={filteredLeads}
        stages={stages}
      />

      <CreateLeadDialogGlobal
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        stages={stages}
        onCreate={async (lead) => {
          await createLead.mutateAsync(lead);
        }}
        isCreating={createLead.isPending}
      />

      {selectedLead && (
        <LeadDetailsDialog
          open={!!selectedLead}
          onOpenChange={(open) => !open && setSelectedLead(null)}
          lead={selectedLead}
          stageIds={stageIds}
          stageName={getStageById(selectedLead.stage_id)?.name || ""}
          funnelId={null}
        />
      )}

      <BulkEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        leads={selectedLeadsData}
      />

      <WhatsAppChoiceDialog
        open={whatsAppChoice.isOpen}
        onOpenChange={whatsAppChoice.setIsOpen}
        phone={whatsAppChoice.targetPhone}
        contactName={whatsAppChoice.targetName}
      />
    </MainLayout>
  );
}
