import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles,
  Check,
  Wand2,
  Briefcase,
  Heart,
  Minimize2,
  Maximize2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TextImproveMenuProps {
  text: string;
  onTextImproved: (newText: string) => void;
  disabled?: boolean;
}

type ActionType = "correct" | "improve" | "formal" | "friendly" | "shorten" | "expand";

const actions: { id: ActionType; label: string; icon: React.ElementType; description: string }[] = [
  { id: "correct", label: "Corrigir texto", icon: Check, description: "Corrige erros de gramática e ortografia" },
  { id: "improve", label: "Melhorar texto", icon: Wand2, description: "Torna o texto mais claro e profissional" },
  { id: "formal", label: "Tom formal", icon: Briefcase, description: "Reescreve em tom formal" },
  { id: "friendly", label: "Tom amigável", icon: Heart, description: "Reescreve em tom acolhedor" },
  { id: "shorten", label: "Resumir", icon: Minimize2, description: "Encurta mantendo a essência" },
  { id: "expand", label: "Expandir", icon: Maximize2, description: "Adiciona mais detalhes" },
];

export function TextImproveMenu({ text, onTextImproved, disabled }: TextImproveMenuProps) {
  const [loading, setLoading] = useState<ActionType | null>(null);

  const handleAction = async (action: ActionType) => {
    if (!text.trim()) {
      toast.error("Digite uma mensagem primeiro");
      return;
    }

    setLoading(action);

    try {
      const { data, error } = await supabase.functions.invoke("text-improve", {
        body: { text, action },
      });

      if (error) throw error;

      if (data?.result) {
        onTextImproved(data.result);
        toast.success("Texto atualizado!");
      }
    } catch (error) {
      console.error("Error improving text:", error);
      toast.error("Erro ao processar texto");
    } finally {
      setLoading(null);
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-full shrink-0 transition-all",
            hasText 
              ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" 
              : "text-muted-foreground"
          )}
          disabled={disabled || !hasText}
          title="Melhorar texto com IA"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2 text-emerald-600">
          <Sparkles className="w-4 h-4" />
          Melhorar com IA
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action) => {
          const Icon = action.icon;
          const isLoading = loading === action.id;
          return (
            <DropdownMenuItem
              key={action.id}
              onClick={() => handleAction(action.id)}
              disabled={!!loading}
              className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 w-full">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                ) : (
                  <Icon className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="font-medium">{action.label}</span>
              </div>
              <span className="text-xs text-muted-foreground ml-6">
                {action.description}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
