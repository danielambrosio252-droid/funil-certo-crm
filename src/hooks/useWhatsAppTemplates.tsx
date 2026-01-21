import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface WhatsAppTemplate {
  id?: string;
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  components: TemplateComponent[];
  quality_score?: {
    score: string;
    reasons?: string[];
  };
  rejected_reason?: string;
}

export function useWhatsAppTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "list", status, limit: 100 },
      });

      if (error) throw error;

      if (data?.templates) {
        setTemplates(data.templates);
      }

      return data?.templates || [];
    } catch (err) {
      console.error("Error fetching templates:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os templates.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createTemplate = useCallback(async (
    name: string,
    language: string,
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION",
    components: TemplateComponent[]
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: {
          action: "create",
          name,
          language,
          category,
          components,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Erro",
          description: data.error_user_msg || data.error,
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Template criado",
        description: "O template foi enviado para análise do Meta.",
      });

      // Refresh list
      await fetchTemplates();

      return data;
    } catch (err) {
      console.error("Error creating template:", err);
      toast({
        title: "Erro",
        description: "Não foi possível criar o template.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchTemplates]);

  const deleteTemplate = useCallback(async (templateName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "delete", template_name: templateName },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Template excluído",
        description: "O template foi removido com sucesso.",
      });

      // Refresh list
      await fetchTemplates();

      return true;
    } catch (err) {
      console.error("Error deleting template:", err);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o template.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, fetchTemplates]);

  const sendTemplate = useCallback(async (
    contactId: string,
    templateName: string,
    templateLanguage: string,
    components?: Array<{
      type: "header" | "body" | "button";
      parameters?: Array<{
        type: "text" | "image" | "video" | "document";
        text?: string;
        image?: { link: string };
        video?: { link: string };
        document?: { link: string; filename?: string };
      }>;
      sub_type?: "quick_reply" | "url";
      index?: string;
    }>
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: {
          action: "send",
          contact_id: contactId,
          template_name: templateName,
          template_language: templateLanguage,
          components,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Template enviado",
        description: "A mensagem foi enviada com sucesso.",
      });

      return true;
    } catch (err) {
      console.error("Error sending template:", err);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o template.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  return {
    templates,
    loading,
    fetchTemplates,
    createTemplate,
    deleteTemplate,
    sendTemplate,
  };
}
