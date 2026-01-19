import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { EmailEditor, EmailContent } from "./EmailEditor";
import { CampaignScheduler, ScheduleData } from "./CampaignScheduler";
import { useEmailCampaigns } from "@/hooks/useEmailCampaigns";
import { 
  Mail, 
  Zap, 
  Newspaper,
  Megaphone,
  Gift,
  Heart,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  ShoppingCart,
  Cake,
  ClipboardList,
  Rocket,
  Loader2,
} from "lucide-react";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const campaignTypes = [
  { 
    id: "campaign", 
    label: "Campanha", 
    description: "Envio único para uma lista de contatos",
    icon: Megaphone,
  },
  { 
    id: "automation", 
    label: "Automação", 
    description: "Envio automático baseado em gatilhos",
    icon: Zap,
  },
  { 
    id: "newsletter", 
    label: "Newsletter", 
    description: "Boletim informativo periódico",
    icon: Newspaper,
  },
];

const templates = [
  {
    id: "welcome",
    name: "Boas-vindas",
    description: "Email de boas-vindas para novos leads",
    icon: Heart,
    category: "Onboarding",
  },
  {
    id: "promotion",
    name: "Promoção",
    description: "Divulgue ofertas e descontos especiais",
    icon: Gift,
    category: "Vendas",
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Compartilhe novidades e conteúdos",
    icon: Newspaper,
    category: "Engajamento",
  },
  {
    id: "follow-up",
    name: "Follow-up",
    description: "Acompanhamento de propostas e leads",
    icon: CheckCircle,
    category: "Vendas",
  },
  {
    id: "abandoned-cart",
    name: "Carrinho Abandonado",
    description: "Recupere vendas de carrinhos não finalizados",
    icon: ShoppingCart,
    category: "Recuperação",
  },
  {
    id: "birthday",
    name: "Aniversário",
    description: "Parabenize clientes no aniversário deles",
    icon: Cake,
    category: "Relacionamento",
  },
  {
    id: "survey",
    name: "Pesquisa de Satisfação",
    description: "Colete feedback dos seus clientes",
    icon: ClipboardList,
    category: "Engajamento",
  },
  {
    id: "product-launch",
    name: "Lançamento de Produto",
    description: "Anuncie novos produtos ou serviços",
    icon: Rocket,
    category: "Vendas",
  },
];

export function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const [step, setStep] = useState(1);
  const [campaignType, setCampaignType] = useState("");
  const [template, setTemplate] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [emailContent, setEmailContent] = useState<EmailContent | null>(null);
  const [schedule, setSchedule] = useState<ScheduleData>({ type: "now", scheduledAt: null });

  const { createCampaign } = useEmailCampaigns();
  const totalSteps = 5;

  const handleNext = () => {
    if (step === 1 && !campaignType) {
      toast.error("Selecione um tipo de campanha");
      return;
    }
    if (step === 2 && !template) {
      toast.error("Selecione um template");
      return;
    }
    if (step === 3) {
      if (!name) {
        toast.error("Digite o nome da campanha");
        return;
      }
      if (!subject) {
        toast.error("Digite o assunto do e-mail");
        return;
      }
    }
    if (step === 4 && !emailContent) {
      toast.error("Configure o conteúdo do e-mail");
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleCreate = async () => {
    if (!emailContent) {
      toast.error("Configure o conteúdo do e-mail");
      return;
    }

    try {
      await createCampaign.mutateAsync({
        name,
        subject,
        preheader: preheader || undefined,
        template,
        campaign_type: campaignType,
        content: emailContent,
        status: schedule.type === "scheduled" ? "scheduled" : "draft",
        scheduled_at: schedule.scheduledAt?.toISOString() || null,
      });

      const message = schedule.type === "scheduled" 
        ? "Campanha agendada com sucesso!"
        : "Campanha criada com sucesso!";
      
      toast.success(message, {
        description: schedule.type === "scheduled" 
          ? `Será enviada em ${schedule.scheduledAt?.toLocaleDateString("pt-BR")}`
          : "Configure o provedor de e-mail para enviar.",
      });
      
      handleReset();
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao criar campanha");
    }
  };

  const handleReset = () => {
    setStep(1);
    setCampaignType("");
    setTemplate("");
    setName("");
    setSubject("");
    setPreheader("");
    setEmailContent(null);
    setSchedule({ type: "now", scheduledAt: null });
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      handleReset();
    }
    onOpenChange(open);
  };

  const getDialogSize = () => {
    if (step === 4) return "sm:max-w-[95vw] sm:max-h-[90vh]";
    return "sm:max-w-[600px]";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`${getDialogSize()} overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Nova Campanha
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Escolha o tipo de campanha que deseja criar"}
            {step === 2 && "Selecione um template para começar"}
            {step === 3 && "Configure os detalhes da campanha"}
            {step === 4 && "Personalize o conteúdo do seu e-mail"}
            {step === 5 && "Escolha quando enviar sua campanha"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : s < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </div>
          ))}
        </div>

        {/* Step 1: Campaign Type */}
        {step === 1 && (
          <RadioGroup value={campaignType} onValueChange={setCampaignType} className="space-y-3">
            {campaignTypes.map((type) => (
              <Label
                key={type.id}
                htmlFor={type.id}
                className="cursor-pointer"
              >
                <Card className={`transition-all hover:border-primary ${campaignType === type.id ? "border-primary bg-primary/5" : ""}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <RadioGroupItem value={type.id} id={type.id} />
                    <div className="p-2 rounded-lg bg-primary/10">
                      <type.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{type.label}</p>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Label>
            ))}
          </RadioGroup>
        )}

        {/* Step 2: Template Selection */}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
            {templates.map((t) => (
              <Card
                key={t.id}
                className={`cursor-pointer transition-all hover:border-primary ${template === t.id ? "border-primary bg-primary/5" : ""}`}
                onClick={() => setTemplate(t.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <t.icon className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-medium mb-1">{t.name}</p>
                  <p className="text-xs text-muted-foreground mb-2">{t.description}</p>
                  <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step 3: Campaign Details */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Campanha</Label>
              <Input
                id="name"
                placeholder="Ex: Promoção de Janeiro"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Assunto do E-mail</Label>
              <Input
                id="subject"
                placeholder="Ex: 🎉 Oferta especial para você!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preheader">Texto de Pré-visualização (opcional)</Label>
              <Textarea
                id="preheader"
                placeholder="Texto que aparece junto ao assunto na caixa de entrada"
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step 4: Email Editor */}
        {step === 4 && (
          <EmailEditor
            template={template}
            subject={subject}
            preheader={preheader}
            onContentChange={setEmailContent}
          />
        )}

        {/* Step 5: Schedule */}
        {step === 5 && (
          <CampaignScheduler onScheduleChange={setSchedule} />
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={step === 1 ? () => handleClose(false) : handleBack}
            disabled={createCampaign.isPending}
          >
            {step === 1 ? "Cancelar" : (
              <>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </>
            )}
          </Button>
          <Button
            onClick={step === totalSteps ? handleCreate : handleNext}
            className="gradient-primary text-primary-foreground"
            disabled={createCampaign.isPending}
          >
            {createCampaign.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : step === totalSteps ? (
              schedule.type === "scheduled" ? "Agendar Campanha" : "Criar Campanha"
            ) : (
              <>
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}