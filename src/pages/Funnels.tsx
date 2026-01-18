import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { KanbanBoard } from "@/components/funnels/KanbanBoard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Kanban, List, Filter, Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Funnels() {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  return (
    <MainLayout
      title="Funis"
      subtitle="Gerencie suas etapas de vendas"
    >
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Select defaultValue="sales">
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecionar funil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Funil de Vendas</SelectItem>
              <SelectItem value="followup">Funil de Follow-up</SelectItem>
              <SelectItem value="marketing">Funil de Marketing</SelectItem>
              <SelectItem value="postsale">Funil Pós-venda</SelectItem>
            </SelectContent>
          </Select>
          
          <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "list")}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <Kanban className="w-4 h-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="w-4 h-4" />
                Lista
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          <Button className="gap-2 gradient-primary text-primary-foreground">
            <Plus className="w-4 h-4" />
            Novo Funil
          </Button>
        </div>
      </div>

      {/* Content */}
      {view === "kanban" ? (
        <KanbanBoard />
      ) : (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <List className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Visualização em Lista</h3>
          <p className="text-muted-foreground">Em breve disponível</p>
        </div>
      )}
    </MainLayout>
  );
}
