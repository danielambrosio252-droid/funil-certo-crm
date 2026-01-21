import { useState, useEffect, useRef, useCallback } from "react";
import { Textarea } from "./textarea";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { User, Phone, Mail, Tag, Calendar, Hash, MessageSquare, Building } from "lucide-react";

export interface Variable {
  key: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

// Default variables available for leads/contacts
export const DEFAULT_VARIABLES: Variable[] = [
  { key: "nome", label: "Nome do Lead/Contato", description: "Nome completo do contato", icon: <User className="w-4 h-4" /> },
  { key: "primeiro_nome", label: "Primeiro Nome", description: "Apenas o primeiro nome", icon: <User className="w-4 h-4" /> },
  { key: "telefone", label: "Telefone", description: "Número de telefone", icon: <Phone className="w-4 h-4" /> },
  { key: "email", label: "E-mail", description: "Endereço de e-mail", icon: <Mail className="w-4 h-4" /> },
  { key: "empresa", label: "Empresa", description: "Nome da empresa", icon: <Building className="w-4 h-4" /> },
  { key: "tags", label: "Tags", description: "Tags do lead", icon: <Tag className="w-4 h-4" /> },
  { key: "data_criacao", label: "Data de Criação", description: "Data de entrada do lead", icon: <Calendar className="w-4 h-4" /> },
  { key: "ultima_mensagem", label: "Última Mensagem", description: "Texto da última mensagem", icon: <MessageSquare className="w-4 h-4" /> },
];

// Template specific variables ({{1}}, {{2}}, etc.)
export const TEMPLATE_VARIABLES: Variable[] = [
  { key: "1", label: "Variável {{1}}", description: "Primeira variável do template", icon: <Hash className="w-4 h-4" /> },
  { key: "2", label: "Variável {{2}}", description: "Segunda variável do template", icon: <Hash className="w-4 h-4" /> },
  { key: "3", label: "Variável {{3}}", description: "Terceira variável do template", icon: <Hash className="w-4 h-4" /> },
  { key: "4", label: "Variável {{4}}", description: "Quarta variável do template", icon: <Hash className="w-4 h-4" /> },
];

interface VariablePickerProps {
  value: string;
  onChange: (value: string) => void;
  variables?: Variable[];
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  useDoubleBraces?: boolean; // For Meta templates: {{1}} vs {nome}
  maxLength?: number;
}

export function VariablePicker({
  value,
  onChange,
  variables = DEFAULT_VARIABLES,
  placeholder,
  multiline = false,
  rows = 4,
  className,
  useDoubleBraces = false,
  maxLength,
}: VariablePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const [filterText, setFilterText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Filter variables based on typed text after {
  const filteredVariables = variables.filter((v) =>
    v.label.toLowerCase().includes(filterText.toLowerCase()) ||
    v.key.toLowerCase().includes(filterText.toLowerCase())
  );

  // Handle input change and detect { trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(cursorPos);

    // Check if we just typed { or {{
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const openBraceMatch = useDoubleBraces 
      ? textBeforeCursor.match(/\{\{([^}]*)$/)
      : textBeforeCursor.match(/\{([^}]*)$/);

    if (openBraceMatch) {
      setFilterText(openBraceMatch[1] || "");
      setShowPicker(true);
      setSelectedIndex(0);
      
      // Calculate position for picker
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setPickerPosition({
          top: rect.height + 4,
          left: 0,
        });
      }
    } else {
      setShowPicker(false);
      setFilterText("");
    }
  };

  // Insert selected variable
  const insertVariable = useCallback((variable: Variable) => {
    if (!inputRef.current) return;

    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    
    // Find where the { started
    const openBraceIndex = useDoubleBraces
      ? textBeforeCursor.lastIndexOf("{{")
      : textBeforeCursor.lastIndexOf("{");
    
    if (openBraceIndex === -1) return;

    const textBefore = value.slice(0, openBraceIndex);
    const variableText = useDoubleBraces 
      ? `{{${variable.key}}}`
      : `{${variable.key}}`;
    
    const newValue = textBefore + variableText + textAfterCursor;
    onChange(newValue);
    
    setShowPicker(false);
    setFilterText("");

    // Focus back and set cursor after variable
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = textBefore.length + variableText.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [value, cursorPosition, onChange, useDoubleBraces]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showPicker) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredVariables.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev > 0 ? prev - 1 : filteredVariables.length - 1
        );
        break;
      case "Enter":
      case "Tab":
        if (filteredVariables[selectedIndex]) {
          e.preventDefault();
          insertVariable(filteredVariables[selectedIndex]);
        }
        break;
      case "Escape":
        setShowPicker(false);
        setFilterText("");
        break;
    }
  };

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current && 
        !pickerRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filterText]);

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className="relative">
      <InputComponent
        ref={inputRef as any}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={multiline ? rows : undefined}
        maxLength={maxLength}
      />
      
      {showPicker && filteredVariables.length > 0 && (
        <div
          ref={pickerRef}
          className="absolute z-50 w-full max-h-64 overflow-auto bg-popover border border-border rounded-md shadow-lg"
          style={{ top: pickerPosition.top, left: pickerPosition.left }}
        >
          <div className="p-1">
            <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
              Variáveis disponíveis
            </p>
            {filteredVariables.map((variable, index) => (
              <button
                key={variable.key}
                className={cn(
                  "w-full flex items-center gap-3 px-2 py-2 text-sm rounded-sm transition-colors text-left",
                  index === selectedIndex 
                    ? "bg-accent text-accent-foreground" 
                    : "hover:bg-muted"
                )}
                onClick={() => insertVariable(variable)}
                onMouseEnter={() => setSelectedIndex(index)}
                type="button"
              >
                <span className="flex-shrink-0 text-muted-foreground">
                  {variable.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{variable.label}</p>
                  {variable.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {variable.description}
                    </p>
                  )}
                </div>
                <span className="flex-shrink-0 text-xs font-mono text-muted-foreground">
                  {useDoubleBraces ? `{{${variable.key}}}` : `{${variable.key}}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-1">
        Digite <code className="px-1 py-0.5 bg-muted rounded text-foreground">{useDoubleBraces ? "{{" : "{"}</code> para inserir variáveis
      </p>
    </div>
  );
}
