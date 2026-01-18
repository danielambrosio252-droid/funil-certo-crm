import { useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  MoreHorizontal,
  Phone,
  MessageCircle,
  Mail,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  stage: string;
  tags: string[];
  value?: number;
  createdAt: string;
  lastContact?: string;
}

const leads: Lead[] = [
  { id: "1", name: "Maria Santos", email: "maria@email.com", phone: "(11) 99999-0001", source: "Meta Ads", stage: "Qualificação", tags: ["Interessado", "Urgente"], value: 2500, createdAt: "2024-01-15", lastContact: "Hoje" },
  { id: "2", name: "Carlos Oliveira", email: "carlos@empresa.com", phone: "(21) 98888-0002", source: "WhatsApp", stage: "Proposta", tags: ["B2B", "VIP"], value: 15000, createdAt: "2024-01-14", lastContact: "Ontem" },
  { id: "3", name: "Ana Paula", email: "ana.paula@gmail.com", phone: "(31) 97777-0003", source: "Formulário", stage: "Novo Lead", tags: ["Orçamento"], createdAt: "2024-01-14" },
  { id: "4", name: "Roberto Almeida", email: "roberto@corp.com", phone: "(41) 96666-0004", source: "Meta Ads", stage: "Negociação", tags: ["Premium"], value: 8500, createdAt: "2024-01-13", lastContact: "3 dias" },
  { id: "5", name: "Fernanda Dias", email: "fernanda@startup.io", phone: "(51) 95555-0005", source: "LinkedIn", stage: "Fechamento", tags: ["Fechando"], value: 22000, createdAt: "2024-01-12", lastContact: "Hoje" },
  { id: "6", name: "Pedro Lima", email: "pedro@tech.com", phone: "(61) 94444-0006", source: "Indicação", stage: "Qualificação", tags: ["Retorno"], value: 4800, createdAt: "2024-01-11" },
  { id: "7", name: "Julia Costa", email: "julia@design.com", phone: "(71) 93333-0007", source: "Meta Ads", stage: "Novo Lead", tags: [], createdAt: "2024-01-10" },
  { id: "8", name: "Lucas Mendes", email: "lucas@agency.com", phone: "(81) 92222-0008", source: "WhatsApp", stage: "Proposta", tags: ["Interessado"], value: 6200, createdAt: "2024-01-09", lastContact: "5 dias" },
];

const sourceColors: Record<string, string> = {
  "Meta Ads": "bg-info/10 text-info border-info/20",
  "WhatsApp": "bg-success/10 text-success border-success/20",
  "Formulário": "bg-warning/10 text-warning border-warning/20",
  "Indicação": "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "LinkedIn": "bg-blue-600/10 text-blue-600 border-blue-600/20",
};

const stageColors: Record<string, string> = {
  "Novo Lead": "bg-info text-info-foreground",
  "Qualificação": "bg-warning text-warning-foreground",
  "Proposta": "bg-primary text-primary-foreground",
  "Negociação": "bg-purple-500 text-white",
  "Fechamento": "bg-success text-success-foreground",
};

export default function Leads() {
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery)
  );

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map((l) => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <MainLayout title="Leads" subtitle="Gerencie todos os seus contatos">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="w-4 h-4" />
            Importar
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          <Button className="gap-2 gradient-primary text-primary-foreground">
            <Plus className="w-4 h-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Selected Actions */}
      {selectedLeads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 mb-4 bg-primary/5 border border-primary/20 rounded-lg"
        >
          <span className="text-sm font-medium text-foreground">
            {selectedLeads.length} lead(s) selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">Mover para etapa</Button>
            <Button variant="outline" size="sm">Adicionar tag</Button>
            <Button variant="outline" size="sm" className="text-destructive">Excluir</Button>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Último Contato</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map((lead, index) => (
              <motion.tr
                key={lead.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  selectedLeads.includes(lead.id) && "bg-primary/5"
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={() => toggleSelect(lead.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {lead.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{lead.name}</p>
                      <p className="text-sm text-muted-foreground">{lead.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{lead.phone}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={sourceColors[lead.source]}>
                    {lead.source}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={stageColors[lead.stage]}>{lead.stage}</Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {lead.value ? `R$ ${lead.value.toLocaleString("pt-BR")}` : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.lastContact || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="w-8 h-8">
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Phone className="w-4 h-4 mr-2" /> Ligar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="w-4 h-4 mr-2" /> Enviar e-mail
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredLeads.length} de {leads.length} leads
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Anterior
          </Button>
          <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
            1
          </Button>
          <Button variant="outline" size="sm">
            2
          </Button>
          <Button variant="outline" size="sm">
            Próximo
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
