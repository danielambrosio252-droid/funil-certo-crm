import { supabase } from "@/integrations/supabase/client";
import { FunnelLead } from "@/hooks/useFunnels";
import { 
  FunnelAutomation, 
  AutomationCondition,
  TriggerType 
} from "@/hooks/useFunnelAutomations";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

type TriggerEvent = "lead_created" | "lead_updated" | "tag_added" | "value_changed";

interface TriggerContext {
  event: TriggerEvent;
  lead: FunnelLead;
  previousLead?: FunnelLead;
  addedTag?: string;
}

// Evaluate a single condition
function evaluateCondition(condition: AutomationCondition, lead: FunnelLead): boolean {
  const fieldValue = getFieldValue(lead, condition.field);
  
  switch (condition.operator) {
    case "equals":
      return String(fieldValue).toLowerCase() === condition.value.toLowerCase();
    case "not_equals":
      return String(fieldValue).toLowerCase() !== condition.value.toLowerCase();
    case "contains":
      return String(fieldValue).toLowerCase().includes(condition.value.toLowerCase());
    case "greater_than":
      return Number(fieldValue) > Number(condition.value);
    case "less_than":
      return Number(fieldValue) < Number(condition.value);
    case "is_empty":
      return fieldValue === null || fieldValue === undefined || fieldValue === "" || 
             (Array.isArray(fieldValue) && fieldValue.length === 0);
    case "is_not_empty":
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== "" &&
             !(Array.isArray(fieldValue) && fieldValue.length === 0);
    default:
      return false;
  }
}

// Get field value from lead
function getFieldValue(lead: FunnelLead, field: string): unknown {
  switch (field) {
    case "name": return lead.name;
    case "email": return lead.email;
    case "phone": return lead.phone;
    case "value": return lead.value;
    case "source": return lead.source;
    case "tags": return lead.tags;
    default: return null;
  }
}

// Check if automation trigger matches the event
function matchesTrigger(automation: FunnelAutomation, context: TriggerContext): boolean {
  const { event, lead, previousLead, addedTag } = context;
  const config = automation.trigger_config;
  
  switch (automation.trigger_type) {
    case "lead_created":
      if (event !== "lead_created") return false;
      // Check if specific stage is configured
      if (config.stage_id && config.stage_id !== lead.stage_id) return false;
      return true;

    case "lead_updated":
      return event === "lead_updated";

    case "tag_added":
      if (event !== "tag_added") return false;
      // Check if specific tag is configured
      if (config.tag && config.tag !== addedTag) return false;
      return true;

    case "value_changed":
      if (event !== "value_changed" && event !== "lead_updated") return false;
      if (previousLead && previousLead.value === lead.value) return false;
      return true;

    case "time_in_stage":
      // Time-based triggers are handled separately by a scheduled job
      return false;

    default:
      return false;
  }
}

// Evaluate all conditions for an automation
function evaluateConditions(automation: FunnelAutomation, lead: FunnelLead): boolean {
  if (!automation.conditions || automation.conditions.length === 0) {
    return true; // No conditions means always match
  }
  
  // All conditions must be true (AND logic)
  return automation.conditions.every(condition => evaluateCondition(condition, lead));
}

// Execute the automation action
async function executeAction(
  automation: FunnelAutomation, 
  lead: FunnelLead,
  companyId: string
): Promise<boolean> {
  const config = automation.action_config;
  
  try {
    switch (automation.action_type) {
      case "move_to_stage": {
        const targetStageId = config.target_stage_id as string;
        if (!targetStageId || targetStageId === lead.stage_id) return false;
        
        const { error } = await supabase
          .from("funnel_leads")
          .update({ stage_id: targetStageId, position: 0 })
          .eq("id", lead.id);
        
        if (error) throw error;
        
        toast.success(`Automação "${automation.name}": Lead movido automaticamente`);
        return true;
      }

      case "add_tag": {
        const tag = config.tag as string;
        if (!tag) return false;
        
        const currentTags = lead.tags || [];
        if (currentTags.includes(tag)) return false;
        
        const { error } = await supabase
          .from("funnel_leads")
          .update({ tags: [...currentTags, tag] })
          .eq("id", lead.id);
        
        if (error) throw error;
        
        toast.success(`Automação "${automation.name}": Tag "${tag}" adicionada`);
        return true;
      }

      case "remove_tag": {
        const tag = config.tag as string;
        if (!tag) return false;
        
        const currentTags = lead.tags || [];
        if (!currentTags.includes(tag)) return false;
        
        const { error } = await supabase
          .from("funnel_leads")
          .update({ tags: currentTags.filter(t => t !== tag) })
          .eq("id", lead.id);
        
        if (error) throw error;
        
        toast.success(`Automação "${automation.name}": Tag "${tag}" removida`);
        return true;
      }

      case "send_notification": {
        const message = config.message as string;
        if (!message) return false;
        
        // For now, show a toast notification
        // In the future, this could send emails, WhatsApp, etc.
        toast.info(`🔔 ${message.replace("{lead_name}", lead.name)}`);
        return true;
      }

      default:
        return false;
    }
  } catch (error) {
    console.error(`Error executing automation ${automation.name}:`, error);
    return false;
  }
}

// Log automation execution
async function logExecution(
  automationId: string,
  leadId: string,
  companyId: string,
  success: boolean,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from("automation_logs").insert([{
      automation_id: automationId,
      lead_id: leadId,
      company_id: companyId,
      success,
      details: details as Json,
    }]);
  } catch (error) {
    console.error("Error logging automation execution:", error);
  }
}

// Main function to run automations for a lead
export async function runAutomations(
  context: TriggerContext,
  companyId: string,
  funnelId: string
): Promise<void> {
  try {
    // Fetch active automations for this funnel
    const { data: automations, error } = await supabase
      .from("funnel_automations")
      .select("*")
      .eq("funnel_id", funnelId)
      .eq("company_id", companyId)
      .eq("is_active", true);
    
    if (error) throw error;
    if (!automations || automations.length === 0) return;
    
    // Process each automation
    for (const automationRow of automations) {
      // Map to proper types
      const automation: FunnelAutomation = {
        ...automationRow,
        trigger_type: automationRow.trigger_type as TriggerType,
        trigger_config: (automationRow.trigger_config || {}) as Record<string, unknown>,
        conditions: (Array.isArray(automationRow.conditions) ? automationRow.conditions : []) as unknown as AutomationCondition[],
        action_type: automationRow.action_type as FunnelAutomation["action_type"],
        action_config: (automationRow.action_config || {}) as Record<string, unknown>,
      };
      
      // Check if trigger matches
      if (!matchesTrigger(automation, context)) continue;
      
      // Evaluate conditions
      if (!evaluateConditions(automation, context.lead)) continue;
      
      // Execute action
      const success = await executeAction(automation, context.lead, companyId);
      
      // Log execution
      await logExecution(
        automation.id,
        context.lead.id,
        companyId,
        success,
        { event: context.event, action: automation.action_type }
      );
    }
  } catch (error) {
    console.error("Error running automations:", error);
  }
}

// Helper to detect what changed between lead versions
export function detectChanges(
  newLead: FunnelLead,
  oldLead?: FunnelLead
): { tagsAdded: string[]; valueChanged: boolean } {
  if (!oldLead) {
    return { tagsAdded: newLead.tags || [], valueChanged: false };
  }
  
  const oldTags = oldLead.tags || [];
  const newTags = newLead.tags || [];
  const tagsAdded = newTags.filter(tag => !oldTags.includes(tag));
  const valueChanged = oldLead.value !== newLead.value;
  
  return { tagsAdded, valueChanged };
}
