import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { FunnelLead, FunnelStage } from "@/hooks/useFunnels";
import { toast } from "sonner";

interface ExportLeadsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: FunnelLead[];
  stages: FunnelStage[];
}

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

export function ExportLeads({ open, onOpenChange, leads, stages }: ExportLeadsProps) {
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
                  <FileText className="w-4 h-4" />
                  JSON
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Campos a exportar</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedFields(
                    selectedFields.length === EXPORT_FIELDS.length
                      ? []
                      : EXPORT_FIELDS.map((f) => f.key)
                  )
                }
              >
                {selectedFields.length === EXPORT_FIELDS.length
                  ? "Desmarcar todos"
                  : "Selecionar todos"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`field-${field.key}`}
                    checked={selectedFields.includes(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  <label
                    htmlFor={`field-${field.key}`}
                    className="text-sm cursor-pointer"
                  >
                    {field.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={exportData}
            disabled={isExporting || selectedFields.length === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
