import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FunnelStage } from "@/hooks/useFunnels";

const SOURCES = [
  "Meta Ads",
  "WhatsApp",
  "Formulário",
  "Indicação",
  "LinkedIn",
  "Google Ads",
  "Orgânico",
  "Outro",
];

interface CreateLeadDialogGlobalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: FunnelStage[];
  onCreate: (lead: {
    stage_id: string;
    name: string;
    email?: string;
    phone?: string;
    value?: number;
    source?: string;
  }) => Promise<void>;
  isCreating: boolean;
}

export function CreateLeadDialogGlobal({ open, onOpenChange, stages, onCreate, isCreating }: CreateLeadDialogGlobalProps) {
  const [stageId, setStageId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [value, setValue] = useState("");
  const [source, setSource] = useState("");

  const resetForm = () => {
    setStageId("");
    setName("");
    setEmail("");
    setPhone("");
    setValue("");
    setSource("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !stageId) return;

    await onCreate({
      stage_id: stageId,
      name,
      email: email || undefined,
      phone: phone || undefined,
      value: value ? parseFloat(value) : undefined,
      source: source || undefined,
    });
    
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lead-stage">Etapa *</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-name">Nome *</Label>
              <Input
                id="lead-name"
                placeholder="Nome do lead"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead-email">E-mail</Label>
                <Input
                  id="lead-email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-phone">Telefone</Label>
                <Input
                  id="lead-phone"
                  placeholder="(11) 99999-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead-value">Valor (R$)</Label>
                <Input
                  id="lead-value"
                  type="number"
                  placeholder="0,00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-source">Origem</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || !stageId || isCreating}>
              {isCreating ? "Criando..." : "Adicionar Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
