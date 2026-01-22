import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { FlowBuilderModal } from "@/components/chatbot/FlowBuilderModal";
import { useChatbotFlows } from "@/hooks/useChatbotFlows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Bot, 
  Zap, 
  MessageSquare, 
  GitBranch,
  Clock,
  Users,
  MoreVertical,
  Pencil,
  Trash2,
  Copy
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Chatbot() {
  const [flowBuilderOpen, setFlowBuilderOpen] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const { flows, loadingFlows, toggleFlow, deleteFlow } = useChatbotFlows();

  const handleEditFlow = (flowId: string) => {
    setSelectedFlowId(flowId);
    setFlowBuilderOpen(true);
  };

  const handleCreateFlow = () => {
    setSelectedFlowId(null);
    setFlowBuilderOpen(true);
  };

  const activeFlows = flows?.filter(f => f.is_active) || [];
  const totalFlows = flows?.length || 0;

  return (
    <MainLayout title="Fluxos do Chatbot" subtitle="Construa automações inteligentes para seu atendimento">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Bot className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalFlows}</p>
                <p className="text-sm text-muted-foreground">Total de Fluxos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Zap className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeFlows.length}</p>
                <p className="text-sm text-muted-foreground">Fluxos Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <MessageSquare className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Execuções Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Users className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Leads Impactados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Meus Fluxos
            </CardTitle>
            <CardDescription>
              Crie e gerencie fluxos de automação para o chatbot
            </CardDescription>
          </div>
          <Button onClick={handleCreateFlow} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Fluxo
          </Button>
        </CardHeader>
        <CardContent>
          {loadingFlows ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : flows && flows.length > 0 ? (
            <div className="grid gap-4">
              {flows.map((flow) => (
                <div
                  key={flow.id}
                  className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${flow.is_active ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                      <Bot className={`w-5 h-5 ${flow.is_active ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{flow.name}</h3>
                        {flow.is_default && (
                          <Badge variant="secondary" className="text-xs">Padrão</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {flow.description || "Sem descrição"}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Atualizado {format(new Date(flow.updated_at), "dd MMM", { locale: ptBR })}
                        </span>
                        {flow.trigger_keywords && flow.trigger_keywords.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {flow.trigger_keywords.length} gatilho(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={flow.is_active}
                      onCheckedChange={(checked) => toggleFlow.mutate({ id: flow.id, is_active: checked })}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditFlow(flow.id)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteFlow.mutate(flow.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Bot className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Nenhum fluxo criado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie seu primeiro fluxo de automação para o chatbot
              </p>
              <Button onClick={handleCreateFlow} className="gap-2">
                <Plus className="w-4 h-4" />
                Criar Primeiro Fluxo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flow Builder Modal */}
      <FlowBuilderModal
        isOpen={flowBuilderOpen}
        onClose={() => setFlowBuilderOpen(false)}
      />
    </MainLayout>
  );
}
