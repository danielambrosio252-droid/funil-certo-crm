import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { FunnelStage } from "@/hooks/useFunnels";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: FunnelStage[];
  onImport: (leads: {
    stage_id: string;
    name: string;
    email?: string;
    phone?: string;
    value?: number;
    source?: string;
    tags?: string[];
  }[]) => Promise<void>;
  isImporting: boolean;
}

interface ParsedLead {
  name: string;
  email?: string;
  phone?: string;
  value?: number;
  source?: string;
  tags?: string[];
}

export function ImportLeadsDialog({ open, onOpenChange, stages, onImport, isImporting }: ImportLeadsDialogProps) {
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setParsedLeads([]);
    setFileName("");
    setParseError("");
    setSelectedStageId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        
        if (file.name.endsWith(".json")) {
          const jsonData = JSON.parse(content);
          const leads = Array.isArray(jsonData) ? jsonData : [jsonData];
          const parsed: ParsedLead[] = leads.map((item: Record<string, unknown>) => ({
            name: String(item.name || item.Nome || item.nome || ""),
            email: String(item.email || item.Email || item["E-mail"] || "") || undefined,
            phone: String(item.phone || item.telefone || item.Telefone || item.Phone || "") || undefined,
            value: parseFloat(String(item.value || item.valor || item.Valor || 0)) || undefined,
            source: String(item.source || item.origem || item.Origem || "") || undefined,
            tags: Array.isArray(item.tags) ? item.tags.map(String) : (item.Tags ? String(item.Tags).split(",").map((t: string) => t.trim()) : undefined),
          })).filter((l: ParsedLead) => l.name);
          
          setParsedLeads(parsed);
        } else {
          // CSV parsing
          const lines = content.split(/\r?\n/).filter(line => line.trim());
          if (lines.length < 2) {
            setParseError("Arquivo CSV deve ter cabeçalho e pelo menos uma linha de dados");
            return;
          }

          const headers = lines[0].split(/[;,]/).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
          const nameIndex = headers.findIndex(h => ["name", "nome"].includes(h));
          const emailIndex = headers.findIndex(h => ["email", "e-mail"].includes(h));
          const phoneIndex = headers.findIndex(h => ["phone", "telefone", "tel"].includes(h));
          const valueIndex = headers.findIndex(h => ["value", "valor"].includes(h));
          const sourceIndex = headers.findIndex(h => ["source", "origem"].includes(h));
          const tagsIndex = headers.findIndex(h => ["tags"].includes(h));

          if (nameIndex === -1) {
            setParseError("Coluna 'Nome' não encontrada no arquivo");
            return;
          }

          const parsed = lines.slice(1).map(line => {
            const values = line.split(/[;,]/).map(v => v.trim().replace(/^"|"$/g, ""));
            return {
              name: values[nameIndex] || "",
              email: emailIndex >= 0 ? values[emailIndex] || undefined : undefined,
              phone: phoneIndex >= 0 ? values[phoneIndex] || undefined : undefined,
              value: valueIndex >= 0 ? parseFloat(values[valueIndex]) || undefined : undefined,
              source: sourceIndex >= 0 ? values[sourceIndex] || undefined : undefined,
              tags: tagsIndex >= 0 && values[tagsIndex] ? values[tagsIndex].split(",").map(t => t.trim()) : undefined,
            };
          }).filter(l => l.name);

          setParsedLeads(parsed);
        }
      } catch (error) {
        console.error("Parse error:", error);
        setParseError("Erro ao processar arquivo. Verifique o formato.");
        setParsedLeads([]);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!selectedStageId) {
      toast.error("Selecione uma etapa para os leads");
      return;
    }
    if (parsedLeads.length === 0) {
      toast.error("Nenhum lead para importar");
      return;
    }

    const leadsToImport = parsedLeads.map(lead => ({
      ...lead,
      stage_id: selectedStageId,
    }));

    await onImport(leadsToImport);
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetState(); onOpenChange(val); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Leads
          </DialogTitle>
          <DialogDescription>
            Importe leads a partir de um arquivo CSV ou JSON
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Arquivo (CSV ou JSON)</Label>
            <div 
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              {fileName ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-primary" />
                  <span className="font-medium">{fileName}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Clique para selecionar ou arraste o arquivo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Colunas aceitas: Nome*, Email, Telefone, Valor, Origem, Tags
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {parseError}
            </div>
          )}

          {/* Parsed Results */}
          {parsedLeads.length > 0 && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              {parsedLeads.length} leads encontrados no arquivo
            </div>
          )}

          {/* Stage Selection */}
          <div className="space-y-2">
            <Label>Etapa de destino *</Label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
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

          {/* Preview */}
          {parsedLeads.length > 0 && (
            <div className="space-y-2">
              <Label>Prévia dos leads</Label>
              <div className="max-h-40 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Telefone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedLeads.slice(0, 5).map((lead, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{lead.name}</td>
                        <td className="p-2 text-muted-foreground">{lead.email || "-"}</td>
                        <td className="p-2 text-muted-foreground">{lead.phone || "-"}</td>
                      </tr>
                    ))}
                    {parsedLeads.length > 5 && (
                      <tr className="border-t">
                        <td colSpan={3} className="p-2 text-center text-muted-foreground">
                          ... e mais {parsedLeads.length - 5} leads
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={parsedLeads.length === 0 || !selectedStageId || isImporting}
          >
            {isImporting ? "Importando..." : `Importar ${parsedLeads.length} leads`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
