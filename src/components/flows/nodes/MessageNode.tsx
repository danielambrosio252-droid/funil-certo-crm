import { memo, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Trash2, Plus, X, Zap } from "lucide-react";

interface MessageNodeData {
  message?: string;
  buttons?: string[];
  ai_enabled?: boolean;
  onUpdate?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
}

function MessageNode({ data, id }: NodeProps) {
  const nodeData = data as MessageNodeData;
  const [editingMessage, setEditingMessage] = useState(false);
  const [localMessage, setLocalMessage] = useState(nodeData?.message || "");
  const buttons = nodeData?.buttons || [];
  const isAI = nodeData?.ai_enabled;

  const handleMessageBlur = useCallback(() => {
    setEditingMessage(false);
    nodeData?.onUpdate?.({ 
      message: localMessage, 
      buttons, 
      ai_enabled: isAI 
    });
  }, [localMessage, buttons, isAI, nodeData]);

  const handleAddButton = () => {
    const newButtons = [...buttons, `Botão ${buttons.length + 1}`];
    nodeData?.onUpdate?.({ 
      message: localMessage, 
      buttons: newButtons, 
      ai_enabled: isAI 
    });
  };

  const handleRemoveButton = (index: number) => {
    const newButtons = buttons.filter((_, i) => i !== index);
    nodeData?.onUpdate?.({ 
      message: localMessage, 
      buttons: newButtons, 
      ai_enabled: isAI 
    });
  };

  const handleUpdateButton = (index: number, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = value;
    nodeData?.onUpdate?.({ 
      message: localMessage, 
      buttons: newButtons, 
      ai_enabled: isAI 
    });
  };

  return (
    <Card className="w-[380px] bg-white border shadow-xl rounded-2xl overflow-hidden">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAI ? 'bg-purple-500' : 'bg-blue-500'}`}>
            {isAI ? <Zap className="w-5 h-5 text-white" /> : <MessageSquare className="w-5 h-5 text-white" />}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">WhatsApp</p>
            <p className="font-semibold">{isAI ? "Resposta IA" : "Enviar Mensagem"}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => nodeData?.onDelete?.()}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Message Bubble */}
        <div 
          className="bg-slate-100 rounded-2xl rounded-tl-sm p-4 cursor-text min-h-[60px]"
          onClick={() => setEditingMessage(true)}
        >
          {editingMessage ? (
            <textarea
              autoFocus
              className="w-full bg-transparent border-none outline-none resize-none text-sm"
              placeholder="Digite sua mensagem..."
              value={localMessage}
              onChange={(e) => setLocalMessage(e.target.value)}
              onBlur={handleMessageBlur}
              rows={3}
            />
          ) : (
            <p className="text-sm">
              {localMessage || <span className="text-muted-foreground">Clique para adicionar texto...</span>}
            </p>
          )}
        </div>

        {/* Buttons with individual handles */}
        {buttons.map((btn, idx) => (
          <div key={idx} className="relative flex items-center gap-2">
            <div className="flex-1 flex items-center border rounded-xl overflow-hidden bg-white">
              <Input
                value={btn}
                onChange={(e) => handleUpdateButton(idx, e.target.value)}
                className="border-0 text-center font-medium"
                placeholder="Texto do botão..."
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0" 
                onClick={() => handleRemoveButton(idx)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {/* Button-specific output handle */}
            <Handle
              type="source"
              position={Position.Right}
              id={`button-${idx}`}
              className="!w-4 !h-4 !bg-blue-400 !border-2 !border-white hover:!bg-primary hover:!scale-125 transition-all"
              style={{ top: 'auto', right: -8 }}
            />
          </div>
        ))}

        {/* Add Button */}
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={handleAddButton}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Botão
        </Button>
      </CardContent>

      {/* Default output handle (when no buttons) */}
      {buttons.length === 0 && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-4 !h-4 !bg-slate-400 !border-2 !border-white hover:!bg-primary hover:!scale-125 transition-all"
        />
      )}
    </Card>
  );
}

export default memo(MessageNode);
