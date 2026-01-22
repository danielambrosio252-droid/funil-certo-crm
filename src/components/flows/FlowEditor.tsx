import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TriggerSelector } from "./TriggerSelector";
import { useFlowEditor, TriggerType } from "@/hooks/useWhatsAppFlows";
import { useState } from "react";

interface FlowEditorProps {
  flowId: string;
  flowName: string;
  onBack: () => void;
}

export function FlowEditor({ flowId, flowName, onBack }: FlowEditorProps) {
  const { nodes, loadingNodes } = useFlowEditor(flowId);
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType | null>(null);

  // Get start node
  const startNode = nodes.find(n => n.node_type === "start");

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
            Voltar
          </Button>
        </div>
      </div>

      {/* Main Content - Only Trigger */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto">
          <TriggerSelector
            flowId={flowId}
            startNode={startNode}
            onTriggerSelect={setSelectedTrigger}
          />
        </div>
      </div>
    </div>
  );
}
