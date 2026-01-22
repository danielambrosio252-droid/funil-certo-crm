import { memo, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpCircle, Trash2, Plus, X } from "lucide-react";

interface QuestionNodeData {
  question?: string;
  options?: string[];
  variable?: string;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
}

function QuestionNode({ data }: NodeProps) {
  const nodeData = data as QuestionNodeData;
  const [editing, setEditing] = useState(false);
  const [localQuestion, setLocalQuestion] = useState(nodeData?.question || "");
  const options = nodeData?.options || [];

  const handleBlur = useCallback(() => {
    setEditing(false);
    nodeData?.onUpdate?.({ 
      question: localQuestion, 
      options,
      variable: nodeData?.variable 
    });
  }, [localQuestion, options, nodeData]);

  const handleAddOption = () => {
    const newOptions = [...options, `Opção ${options.length + 1}`];
    nodeData?.onUpdate?.({ 
      question: localQuestion, 
      options: newOptions,
      variable: nodeData?.variable 
    });
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    nodeData?.onUpdate?.({ 
      question: localQuestion, 
      options: newOptions,
      variable: nodeData?.variable 
    });
  };

  const handleUpdateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    nodeData?.onUpdate?.({ 
      question: localQuestion, 
      options: newOptions,
      variable: nodeData?.variable 
    });
  };

  return (
    <Card className="w-[350px] bg-white border shadow-lg rounded-2xl overflow-hidden">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-white" />
          <span className="font-medium text-white text-sm">Pergunta</span>
        </div>
        {nodeData?.onDelete && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/20"
            onClick={() => nodeData?.onDelete?.()}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Question */}
        <div 
          className="bg-purple-50 rounded-xl p-3 cursor-text min-h-[50px]"
          onClick={() => setEditing(true)}
        >
          {editing ? (
            <textarea
              autoFocus
              className="w-full bg-transparent border-none outline-none resize-none text-sm"
              placeholder="Digite sua pergunta..."
              value={localQuestion}
              onChange={(e) => setLocalQuestion(e.target.value)}
              onBlur={handleBlur}
              rows={2}
            />
          ) : (
            <p className="text-sm">
              {localQuestion || <span className="text-muted-foreground">Clique para adicionar pergunta...</span>}
            </p>
          )}
        </div>

        {/* Options with individual handles */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Opções de resposta:</p>
          {options.map((opt, idx) => (
            <div key={idx} className="relative flex items-center gap-2">
              <Input
                value={opt}
                onChange={(e) => handleUpdateOption(idx, e.target.value)}
                className="flex-1 h-9 text-sm"
                placeholder={`Opção ${idx + 1}`}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 shrink-0" 
                onClick={() => handleRemoveOption(idx)}
              >
                <X className="w-3 h-3" />
              </Button>
              {/* Option-specific output handle */}
              <Handle
                type="source"
                position={Position.Right}
                id={`option-${idx}`}
                className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white hover:!scale-125 transition-transform"
                style={{ top: 'auto', right: -6 }}
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed"
            onClick={handleAddOption}
          >
            <Plus className="w-3 h-3 mr-1" />
            Adicionar opção
          </Button>
        </div>
      </CardContent>

      {/* Default output (free text) */}
      {options.length === 0 && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-4 !h-4 !bg-purple-400 !border-2 !border-white hover:!scale-125 transition-transform"
        />
      )}
    </Card>
  );
}

export default memo(QuestionNode);
