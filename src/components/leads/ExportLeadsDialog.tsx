import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, FileSpreadsheet, FileJson } from "lucide-react";
import { toast } from "sonner";
import type { FunnelLead, FunnelStage } from "@/hooks/useFunnels";

type ExportFormat = "csv" | "json";

const EXPORT_FIELDS = [
  { key: "name", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "value", label: "Valor" },
  { key: "source", label: "Origem" },
  { key: "tags", label: "Tags" },
  { key: "stage", label: "Etapa" },
  { key: "created_at", label: "Data de criação" },
  { key: "notes", label: "Notas" },
];

interface ExportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: FunnelLead[];
  stages: FunnelStage[];
}

export function ExportLeadsDialog({ open, onOpenChange, leads, stages }: ExportLeadsDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.map(f => f.key)
  );
  const [isExporting, setIsExporting] = useState(false);

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field]
    );
  };

  const getStageNameById = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.name || "";
  };

  const exportData = () => {
    if (leads.length === 0) {
      toast.error("Nenhum lead para exportar");
      return;
    }

    setIsExporting(true);

    try {
      // Prepare data
      const data = leads.map((lead) => {
        const row: Record<string, string> = {};
        
        if (selectedFields.includes("name")) row["Nome"] = lead.name;
        if (selectedFields.includes("email")) row["E-mail"] = lead.email || "";
        if (selectedFields.includes("phone")) row["Telefone"] = lead.phone || "";
        if (selectedFields.includes("value")) row["Valor"] = lead.value?.toString() || "0";
        if (selectedFields.includes("source")) row["Origem"] = lead.source || "";
        if (selectedFields.includes("tags")) row["Tags"] = lead.tags?.join(", ") || "";
        if (selectedFields.includes("stage")) row["Etapa"] = getStageNameById(lead.stage_id);
        if (selectedFields.includes("created_at")) row["Data de criação"] = new Date(lead.created_at).toLocaleDateString("pt-BR");
        if (selectedFields.includes("notes")) row["Notas"] = lead.notes?.replace(/\n/g, " ") || "";

        return row;
      });

      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === "csv") {
        // Generate CSV
        const headers = Object.keys(data[0] || {});
        const csvRows = [
          headers.join(";"),
          ...data.map((row) =>
            headers.map((h) => `"${(row[h] || "").replace(/"/g, '""')}"`).join(";")
          ),
        ];
        content = csvRows.join("\n");
        filename = `leads-${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv;charset=utf-8;";
      } else {
        // Generate JSON
        content = JSON.stringify(data, null, 2);
        filename = `leads-${new Date().toISOString().split("T")[0]}.json`;
        mimeType = "application/json";
      }

      // Download file
      const blob = new Blob(["\ufeff" + content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${leads.length} leads exportados com sucesso!`);
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao exportar leads");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exportar Leads
          </DialogTitle>
          <DialogDescription>
            Exporte {leads.length} leads para CSV ou JSON
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format */}
          <div className="space-y-3">
            <Label>Formato</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="cursor-pointer flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV (Excel)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="cursor-pointer flex items-center gap-2">
                  <FileJson className="w-4 h-4" />
                  JSON
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Campos para exportar</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFields(EXPORT_FIELDS.map(f => f.key))}
                >
                  Selecionar todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFields([])}
                >
                  Limpar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <Checkbox
                    id={field.key}
                    checked={selectedFields.includes(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  <Label htmlFor={field.key} className="cursor-pointer text-sm">
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={exportData}
            disabled={selectedFields.length === 0 || leads.length === 0 || isExporting}
          >
            {isExporting ? "Exportando..." : "Exportar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
