import { availableNodeTypes } from "./FlowNodeTypes";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onSelect: (type: string) => void;
};

/**
 * Menu flutuante para adicionar a próxima etapa ao soltar uma conexão no vazio.
 * Intencionalmente simples e sólido (sem transparência) para evitar bugs de UI.
 */
export function ConnectionAddMenu({ open, x, y, onClose, onSelect }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999]"
      onMouseDown={(e) => {
        // clique fora fecha
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="fixed"
        style={{ left: x, top: y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="w-72 rounded-xl border border-slate-700 bg-slate-800 shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700">
            <p className="text-xs font-medium text-slate-300 uppercase tracking-wide">
              Próxima etapa
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Escolha o que acontece em seguida
            </p>
          </div>

          <div className="p-2 grid gap-1">
            {availableNodeTypes.map((nodeType) => {
              const Icon = nodeType.icon;
              return (
                <button
                  key={nodeType.type}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-slate-200 hover:bg-slate-700 focus:bg-slate-700 outline-none"
                  onClick={() => onSelect(nodeType.type)}
                >
                  <div className={cn("p-2 rounded-xl", nodeType.bgColor)}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium">{nodeType.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
