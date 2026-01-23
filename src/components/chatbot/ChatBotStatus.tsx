import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, User, Square, Power, Tag } from "lucide-react";
import { useChatbotStatus } from "@/hooks/useChatbotFlows";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatBotStatusProps {
  contactId: string | null;
}

export function ChatBotStatus({ contactId }: ChatBotStatusProps) {
  const { 
    execution, 
    isLoading, 
    isBotActive, 
    isHumanTakeover,
    hasHumanTakeoverTag,
    toggleHumanTakeover, 
    stopExecution,
    removeHumanTag,
  } = useChatbotStatus(contactId);

  // Show status bar if there's an active execution OR if contact has human takeover tag
  if (isLoading || (!execution && !hasHumanTakeoverTag)) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b flex-wrap">
      {isBotActive ? (
        <>
          <Badge variant="default" className="bg-emerald-500 gap-1">
            <Bot className="w-3 h-3" />
            Bot ativo
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggleHumanTakeover.mutate(true)}
              >
                <User className="w-3 h-3 mr-1" />
                Assumir
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Pausar bot e assumir atendimento
            </TooltipContent>
          </Tooltip>
        </>
      ) : isHumanTakeover ? (
        <>
          <Badge variant="secondary" className="bg-blue-500 text-white gap-1">
            <User className="w-3 h-3" />
            Atendimento humano
          </Badge>
          {hasHumanTakeoverTag && (
            <Badge variant="outline" className="gap-1 text-xs border-blue-300 text-blue-600">
              <Tag className="w-3 h-3" />
              em_atendimento
            </Badge>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                onClick={() => toggleHumanTakeover.mutate(false)}
                disabled={toggleHumanTakeover.isPending}
              >
                <Power className="w-3 h-3 mr-1" />
                Liberar para Bot
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Remove a tag "em_atendimento" e libera o bot para atuar
            </TooltipContent>
          </Tooltip>
        </>
      ) : (
        <>
          <Badge variant="secondary" className="gap-1">
            <Square className="w-3 h-3" />
            Bot pausado
          </Badge>
          {hasHumanTakeoverTag && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                  onClick={() => removeHumanTag.mutate()}
                  disabled={removeHumanTag.isPending}
                >
                  <Tag className="w-3 h-3 mr-1" />
                  Remover tag
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Remove a tag "em_atendimento" para liberar o bot
              </TooltipContent>
            </Tooltip>
          )}
        </>
      )}

      {execution && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs ml-auto text-destructive hover:text-destructive"
              onClick={() => stopExecution.mutate()}
              disabled={stopExecution.isPending}
            >
              <Square className="w-3 h-3 mr-1" />
              Encerrar
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Encerrar fluxo completamente
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}