import { memo } from "react";
import { 
  MessageSquare, 
  HelpCircle, 
  GitBranch, 
  Clock, 
  Pause,
  Zap, 
  UserCheck, 
  Flag,
  ArrowRight
} from "lucide-react";
import { NodeType } from "@/hooks/useChatbotFlows";

interface BlockOption {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const blockOptions: BlockOption[] = [
  { 
    type: "message", 
    label: "Enviar Mensagem", 
    description: "Envie texto, imagem ou botões",
    icon: MessageSquare, 
    color: "text-blue-500",
    bgColor: "bg-blue-500/10 hover:bg-blue-500/20"
  },
  { 
    type: "question", 
    label: "Fazer Pergunta", 
    description: "Aguarde resposta do usuário",
    icon: HelpCircle, 
    color: "text-purple-500",
    bgColor: "bg-purple-500/10 hover:bg-purple-500/20"
  },
  { 
    type: "condition", 
    label: "Condição", 
    description: "Crie ramificações com regras",
    icon: GitBranch, 
    color: "text-amber-500",
    bgColor: "bg-amber-500/10 hover:bg-amber-500/20"
  },
  { 
    type: "action", 
    label: "Ação", 
    description: "Tags, funis, webhooks",
    icon: Zap, 
    color: "text-violet-500",
    bgColor: "bg-violet-500/10 hover:bg-violet-500/20"
  },
  { 
    type: "delay", 
    label: "Delay", 
    description: "Aguarde antes de continuar",
    icon: Clock, 
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10 hover:bg-cyan-500/20"
  },
  { 
    type: "pause", 
    label: "Pausa", 
    description: "Aguarde mensagem do contato",
    icon: Pause, 
    color: "text-orange-500",
    bgColor: "bg-orange-500/10 hover:bg-orange-500/20"
  },
  { 
    type: "transfer", 
    label: "Transferir", 
    description: "Passe para atendente humano",
    icon: UserCheck, 
    color: "text-rose-500",
    bgColor: "bg-rose-500/10 hover:bg-rose-500/20"
  },
  { 
    type: "end", 
    label: "Encerrar", 
    description: "Finalize o fluxo",
    icon: Flag, 
    color: "text-slate-400",
    bgColor: "bg-slate-500/10 hover:bg-slate-500/20"
  },
];

interface BlockSelectionMenuProps {
  onSelect: (type: NodeType) => void;
  onClose: () => void;
}

export const BlockSelectionMenu = memo(function BlockSelectionMenu({ 
  onSelect, 
  onClose 
}: BlockSelectionMenuProps) {
  return (
    <div 
      className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-3 w-64 animate-in fade-in zoom-in-95 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 px-2">
        Adicionar Bloco
      </div>
      
      <div className="space-y-1">
        {blockOptions.map((option) => (
          <button
            key={option.type}
            onClick={() => onSelect(option.type)}
            className={`
              w-full flex items-center gap-3 p-2.5 rounded-lg
              ${option.bgColor}
              transition-all duration-150
              group
            `}
          >
            <div className={`w-9 h-9 rounded-lg ${option.bgColor} flex items-center justify-center`}>
              <option.icon className={`w-5 h-5 ${option.color}`} />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-white text-sm">{option.label}</div>
              <div className="text-xs text-slate-400">{option.description}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  );
});
