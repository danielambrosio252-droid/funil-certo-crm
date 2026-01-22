import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Zap, Plus } from "lucide-react";
import { TriggerSelector } from "./TriggerSelector";
import { ActionBuilder } from "./ActionBuilder";
import { useFlowEditor, TriggerType } from "@/hooks/useWhatsAppFlows";

interface FlowEditorProps {
  flowId: string;
  flowName: string;
  onBack: () => void;
}

export function FlowEditor({ flowId, flowName, onBack }: FlowEditorProps) {
  const { nodes, edges, loadingNodes, addNode, addEdge, updateNode, deleteNode, deleteEdge } = useFlowEditor(flowId);
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType | null>(null);

  // Check if we have a start node with trigger configured
  const startNode = nodes.find(n => n.node_type === "start");
  const hasTriggerConfigured = startNode && Object.keys(startNode.config || {}).length > 0;

  // Get action nodes (non-start nodes)
  const actionNodes = nodes.filter(n => n.node_type !== "start");

  if (loadingNodes) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{flowName}</h1>
            <p className="text-sm text-muted-foreground">Editor de Automação</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            Cancelar
          </Button>
          <Button>Publicar</Button>
        </div>
      </div>

      {/* Main Content - ManyChat Style */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* WHEN Section - Trigger */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>Quando...</span>
            </div>
            
            <TriggerSelector
              flowId={flowId}
              startNode={startNode}
              onTriggerSelect={setSelectedTrigger}
            />
          </div>

          {/* THEN Section - Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-600">
              <span>Então...</span>
            </div>

            <ActionBuilder
              flowId={flowId}
              nodes={actionNodes}
              edges={edges}
              startNodeId={startNode?.id}
              addNode={addNode}
              addEdge={addEdge}
              updateNode={updateNode}
              deleteNode={deleteNode}
              deleteEdge={deleteEdge}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
