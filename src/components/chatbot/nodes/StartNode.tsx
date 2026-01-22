import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, Plus, Zap, X, Sparkles } from "lucide-react";
import { BlockSelectionMenu } from "../menus/BlockSelectionMenu";
import { NodeType } from "@/hooks/useChatbotFlows";

interface StartNodeData {
  label?: string;
  hasConnections?: boolean;
  triggerKeywords?: string[];
  isDefault?: boolean;
  onAddNode?: (nodeType: NodeType, sourceNodeId: string) => void;
  onUpdateTriggers?: (keywords: string[], isDefault: boolean) => void;
}

function StartNode({ id, data }: NodeProps) {
  const nodeData = data as StartNodeData;
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showTriggerConfig, setShowTriggerConfig] = useState(false);
  const [keywords, setKeywords] = useState<string[]>(nodeData.triggerKeywords || []);
  const [newKeyword, setNewKeyword] = useState("");
  const [isDefault, setIsDefault] = useState(nodeData.isDefault || false);
  
  const isHighlighted = !nodeData.hasConnections;

  // Sync from props when they change
  useEffect(() => {
    setKeywords(nodeData.triggerKeywords || []);
    setIsDefault(nodeData.isDefault || false);
  }, [nodeData.triggerKeywords, nodeData.isDefault]);

  const handleSelectBlock = (type: NodeType) => {
    nodeData.onAddNode?.(type, id);
    setShowMenu(false);
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim().toLowerCase())) {
      const updated = [...keywords, newKeyword.trim().toLowerCase()];
      setKeywords(updated);
      setNewKeyword("");
      nodeData.onUpdateTriggers?.(updated, isDefault);
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    const updated = keywords.filter(k => k !== keyword);
    setKeywords(updated);
    nodeData.onUpdateTriggers?.(updated, isDefault);
  };

  const handleToggleDefault = (checked: boolean) => {
    setIsDefault(checked);
    nodeData.onUpdateTriggers?.(keywords, checked);
  };

  return (
    <Card className="w-[320px] bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-xl rounded-2xl overflow-visible">
      {/* Header */}
      <div 
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setShowTriggerConfig(!showTriggerConfig)}
      >
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white text-base">Início</p>
          <p className="text-sm text-white/80">
            {isDefault 
              ? "Responde a qualquer mensagem" 
              : keywords.length > 0 
                ? `${keywords.length} gatilho(s)` 
                : "Clique para configurar gatilhos"}
          </p>
        </div>
        <div className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
          <Zap className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Trigger Configuration Panel */}
      {showTriggerConfig && (
        <div className="bg-white/95 backdrop-blur-sm p-4 space-y-4 border-t border-emerald-400/30">
          {/* Default toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-slate-700">Fluxo padrão</span>
            </div>
            <Switch 
              checked={isDefault} 
              onCheckedChange={handleToggleDefault}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
          
          {isDefault && (
            <p className="text-xs text-slate-500 bg-emerald-50 p-2 rounded-lg">
              ✓ Este fluxo será ativado para qualquer mensagem que não corresponda a outros gatilhos.
            </p>
          )}

          {/* Keywords section */}
          {!isDefault && (
            <>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Palavras-chave de gatilho:</p>
                <div className="flex gap-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                    placeholder="Ex: oi, olá, preço..."
                    className="h-9 text-sm bg-white border-slate-300"
                  />
                  <button
                    onClick={handleAddKeyword}
                    className="px-3 h-9 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors text-sm font-medium"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Keywords list */}
              {keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <Badge 
                      key={keyword} 
                      variant="secondary"
                      className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 gap-1 pr-1"
                    >
                      {keyword}
                      <button
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="ml-1 hover:bg-emerald-300 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Nenhuma palavra-chave configurada. O fluxo não será ativado automaticamente.
                </p>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Output handle with + button */}
      <div 
        className="absolute right-0 top-[32px] translate-x-1/2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!showMenu) setShowMenu(false);
        }}
      >
        <Handle
          type="source"
          position={Position.Right}
          className={`
            !w-5 !h-5 !border-2 !border-white !bg-emerald-400
            transition-all duration-200
            ${isHighlighted ? '!shadow-lg !shadow-emerald-300/50' : ''}
          `}
        />
        
        {/* Plus button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`
            absolute top-1/2 -translate-y-1/2 left-4
            w-7 h-7 rounded-full bg-white
            flex items-center justify-center
            text-emerald-600 shadow-lg
            transition-all duration-200
            hover:scale-110 hover:bg-emerald-50
            ${(isHovered || showMenu || isHighlighted) ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
            ${isHighlighted ? 'animate-pulse' : ''}
            z-10
          `}
        >
          <Plus className="w-5 h-5" strokeWidth={3} />
        </button>

        {/* Block selection menu */}
        {showMenu && (
          <div className="absolute top-1/2 -translate-y-1/2 left-14 z-50">
            <BlockSelectionMenu 
              onSelect={handleSelectBlock} 
              onClose={() => setShowMenu(false)} 
            />
          </div>
        )}
      </div>
    </Card>
  );
}

export default memo(StartNode);
