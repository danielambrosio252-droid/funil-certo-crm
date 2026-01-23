import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Safety timeouts to prevent executions getting stuck and blocking new flows
const RUNNING_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (running should be short-lived)
const WAITING_RESPONSE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface FlowNode {
  id: string;
  flow_id: string;
  company_id: string;
  node_type: string;
  position_x: number;
  position_y: number;
  config: Record<string, unknown>;
}

interface ChatbotFlow {
  id: string;
  company_id: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
  trigger_keywords: string[];
}

// Get the first name of the company owner (person responsible for messages)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOwnerFirstName(supabase: any, companyId: string): Promise<string> {
  try {
    const { data: ownerProfile, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("company_id", companyId)
      .eq("role", "owner")
      .limit(1)
      .single();

    if (error || !ownerProfile?.full_name) {
      console.log("⚠️ Could not find owner profile, using empty name");
      return "";
    }

    // Extract first name only
    const firstName = ownerProfile.full_name.trim().split(/\s+/)[0];
    console.log(`👤 Owner first name: ${firstName}`);
    return firstName;
  } catch (err) {
    console.error("Error getting owner name:", err);
    return "";
  }
}

// Replace template variables in message text
function replaceMessageVariables(text: string, variables: { ownerFirstName?: string; contactName?: string }): string {
  let result = text;
  
  // Replace owner/attendant name variables
  if (variables.ownerFirstName) {
    result = result.replace(/\{\{nome\}\}/gi, variables.ownerFirstName);
    result = result.replace(/\{\{atendente\}\}/gi, variables.ownerFirstName);
    result = result.replace(/\{\{responsavel\}\}/gi, variables.ownerFirstName);
    result = result.replace(/\{\{owner\}\}/gi, variables.ownerFirstName);
  }
  
  // Replace contact name if available
  if (variables.contactName) {
    result = result.replace(/\{\{cliente\}\}/gi, variables.contactName);
    result = result.replace(/\{\{contato\}\}/gi, variables.contactName);
    result = result.replace(/\{\{contact\}\}/gi, variables.contactName);
  }
  
  return result;
}

// Send text message via WhatsApp Cloud API
async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("WhatsApp API error:", error);
      return false;
    }

    console.log(`✅ Message sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return false;
  }
}

// Send media message via WhatsApp Cloud API
async function sendWhatsAppMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  mediaType: "image" | "audio" | "video" | "document",
  mediaUrl: string,
  caption?: string
): Promise<boolean> {
  try {
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to,
      type: mediaType,
    };

    // Different media types have different structures
    if (mediaType === "image") {
      payload.image = { link: mediaUrl, caption: caption || undefined };
    } else if (mediaType === "video") {
      payload.video = { link: mediaUrl, caption: caption || undefined };
    } else if (mediaType === "audio") {
      payload.audio = { link: mediaUrl };
    } else if (mediaType === "document") {
      payload.document = { link: mediaUrl, caption: caption || undefined };
    }

    console.log(`📤 Sending ${mediaType}:`, JSON.stringify(payload, null, 2));

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`WhatsApp API error (${mediaType}):`, error);
      return false;
    }

    console.log(`✅ ${mediaType} sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`Error sending WhatsApp ${mediaType}:`, error);
    return false;
  }
}

// Send interactive button message via WhatsApp Cloud API
async function sendWhatsAppInteractiveButtons(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
): Promise<boolean> {
  try {
    // WhatsApp limits: max 3 buttons, max 20 chars per button title
    const validButtons = buttons.slice(0, 3).map((btn, idx) => ({
      type: "reply",
      reply: {
        id: btn.id || `option-${idx}`,
        title: btn.title.substring(0, 20), // Max 20 chars
      },
    }));

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: bodyText.substring(0, 1024), // Max 1024 chars for body
        },
        action: {
          buttons: validButtons,
        },
      },
    };

    console.log(`📤 Sending interactive buttons:`, JSON.stringify(payload, null, 2));

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("WhatsApp API error (interactive):", error);
      return false;
    }

    console.log(`✅ Interactive buttons sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Error sending WhatsApp interactive message:", error);
    return false;
  }
}

// Find matching flow for a message
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findMatchingFlow(
  supabase: any,
  companyId: string,
  messageContent: string
): Promise<ChatbotFlow | null> {
  console.log(`🔍 Finding flow for company: ${companyId}, message: "${messageContent}"`);
  
  // Get all active flows for the company
  const { data: flows, error } = await supabase
    .from("chatbot_flows")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching flows:", error);
    return null;
  }

  console.log(`📋 Found ${flows?.length || 0} active flows`);

  if (!flows || flows.length === 0) {
    // Also try without is_active filter to see if flows exist
    const { data: allFlows } = await supabase
      .from("chatbot_flows")
      .select("id, name, is_active, is_default")
      .eq("company_id", companyId);
    
    console.log(`📋 Total flows (any status): ${allFlows?.length || 0}`, allFlows);
    return null;
  }

  const messageLower = messageContent.toLowerCase().trim();

  // First, check for keyword matches
  for (const flow of flows) {
    const f = flow as ChatbotFlow;
    console.log(`  - Flow "${f.name}": is_default=${f.is_default}, keywords=${JSON.stringify(f.trigger_keywords)}`);
    
    if (f.trigger_keywords && f.trigger_keywords.length > 0) {
      for (const keyword of f.trigger_keywords) {
        if (messageLower.includes(keyword.toLowerCase())) {
          console.log(`✅ Keyword match: "${keyword}" -> Flow: ${f.name}`);
          return f;
        }
      }
    }
  }

  // IMPORTANTE: Se não houve match de keyword, verificar se é uma PRIMEIRA mensagem do contato
  // O fluxo default só deve disparar para primeiras mensagens ou mensagens que explicitamente 
  // contêm keywords. Isso evita que o bot responda a QUALQUER mensagem.
  
  // Por enquanto, remover o fallback para default flow para evitar spam
  // O default flow só será usado se explicitamente ativado pelo operador
  // ou se a mensagem contiver uma keyword configurada
  
  // If no keyword match, check if there's a default flow
  // DEFAULT FLOW: Only trigger if this is likely a greeting/first contact
  const greetingPatterns = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "hello", "hi", "hey", "e ai", "eai"];
  const isGreeting = greetingPatterns.some(g => messageLower.includes(g));
  
  if (isGreeting) {
    const defaultFlow = flows.find((f: ChatbotFlow) => f.is_default);
    if (defaultFlow) {
      console.log(`✅ Greeting detected + default flow: ${defaultFlow.name}`);
      return defaultFlow as ChatbotFlow;
    }
  }

  console.log("❌ No matching flow found (no keyword match and not a greeting)");
  return null;
}

// Get the start node and its first connected node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getStartNode(
  supabase: any,
  flowId: string
): Promise<{ startNode: FlowNode; firstNode: FlowNode | null } | null> {
  const { data: nodes } = await supabase
    .from("chatbot_flow_nodes")
    .select("*")
    .eq("flow_id", flowId)
    .eq("node_type", "start")
    .limit(1);

  if (!nodes || nodes.length === 0) {
    console.error("No start node found");
    return null;
  }

  const startNode = nodes[0] as FlowNode;

  // Get the first connected node
  const { data: edges } = await supabase
    .from("chatbot_flow_edges")
    .select("*")
    .eq("flow_id", flowId)
    .eq("source_node_id", startNode.id)
    .limit(1);

  if (!edges || edges.length === 0) {
    return { startNode, firstNode: null };
  }

  const { data: targetNodes } = await supabase
    .from("chatbot_flow_nodes")
    .select("*")
    .eq("id", edges[0].target_node_id)
    .limit(1);

  return {
    startNode,
    firstNode: targetNodes?.[0] as FlowNode || null,
  };
}

// Get next node after current
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getNextNode(
  supabase: any,
  flowId: string,
  currentNodeId: string,
  sourceHandle?: string | null
): Promise<FlowNode | null> {
  let query = supabase
    .from("chatbot_flow_edges")
    .select("*")
    .eq("flow_id", flowId)
    .eq("source_node_id", currentNodeId);

  if (sourceHandle) {
    query = query.eq("source_handle", sourceHandle);
  }

  const { data: edges } = await query.limit(1);

  if (!edges || edges.length === 0) {
    return null;
  }

  const { data: nodes } = await supabase
    .from("chatbot_flow_nodes")
    .select("*")
    .eq("id", edges[0].target_node_id)
    .limit(1);

  return nodes?.[0] as FlowNode || null;
}

// Process a single node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processNode(
  supabase: any,
  node: FlowNode,
  context: {
    companyId: string;
    contactId: string;
    contactPhone: string;
    phoneNumberId: string;
    accessToken: string;
    executionId: string;
    lastUserMessage?: string;
    ownerFirstName?: string;
    contactName?: string;
  }
): Promise<{
  shouldContinue: boolean;
  nextNode: FlowNode | null;
  waitForResponse?: boolean;
  delaySeconds?: number;
  sourceHandle?: string;
}> {
  console.log(`📦 Processing node: ${node.node_type} (${node.id})`);

  const config = node.config || {};

  switch (node.node_type) {
    case "message": {
      const rawMessage = (config.message as string) || "";
      const mediaType = (config.mediaType as string) || "text";
      const mediaUrl = (config.mediaUrl as string) || "";
      
      // Replace template variables with actual values
      const message = replaceMessageVariables(rawMessage, {
        ownerFirstName: context.ownerFirstName,
        contactName: context.contactName,
      });

      // Check if this is a media message
      if (mediaType !== "text" && mediaUrl) {
        const validMediaTypes = ["image", "audio", "video", "document"] as const;
        if (validMediaTypes.includes(mediaType as typeof validMediaTypes[number])) {
          await sendWhatsAppMediaMessage(
            context.phoneNumberId,
            context.accessToken,
            context.contactPhone,
            mediaType as "image" | "audio" | "video" | "document",
            mediaUrl,
            message || undefined // caption
          );

          // Save outgoing media message to DB
          await supabase.from("whatsapp_messages").insert({
            company_id: context.companyId,
            contact_id: context.contactId,
            content: message || `[${mediaType}]`,
            message_type: mediaType,
            media_url: mediaUrl,
            is_from_me: true,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        }
      } else if (message) {
        // Text-only message
        await sendWhatsAppMessage(
          context.phoneNumberId,
          context.accessToken,
          context.contactPhone,
          message
        );

        // Save outgoing message to DB
        await supabase.from("whatsapp_messages").insert({
          company_id: context.companyId,
          contact_id: context.contactId,
          content: message,
          message_type: "text",
          is_from_me: true,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }

      const nextNode = await getNextNode(supabase, node.flow_id, node.id);
      return { shouldContinue: true, nextNode };
    }

    case "question": {
      const rawQuestion = (config.question as string) || "";
      const options = (config.options as string[]) || [];
      
      // Replace template variables in question
      const question = replaceMessageVariables(rawQuestion, {
        ownerFirstName: context.ownerFirstName,
        contactName: context.contactName,
      });

      // Use interactive buttons if we have 1-3 options (WhatsApp limit)
      if (options.length > 0 && options.length <= 3) {
        const buttons = options.map((opt, idx) => ({
          id: `option-${idx}`,
          title: opt,
        }));

        await sendWhatsAppInteractiveButtons(
          context.phoneNumberId,
          context.accessToken,
          context.contactPhone,
          question,
          buttons
        );

        // Persist in DB using an allowed message_type.
        // The whatsapp_messages table has a CHECK constraint that only allows:
        // text | image | audio | video | document | sticker
        await supabase.from("whatsapp_messages").insert({
          company_id: context.companyId,
          contact_id: context.contactId,
          content: `${question}\n\n[Botões: ${options.join(" | ")}]`,
          message_type: "text",
          is_from_me: true,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      } else {
        // Fallback to text with numbered options for 4+ options or no options
        let fullMessage = question;
        if (options.length > 0) {
          fullMessage += "\n\n";
          options.forEach((opt, idx) => {
            fullMessage += `${idx + 1}. ${opt}\n`;
          });
        }

        if (fullMessage) {
          await sendWhatsAppMessage(
            context.phoneNumberId,
            context.accessToken,
            context.contactPhone,
            fullMessage
          );

          await supabase.from("whatsapp_messages").insert({
            company_id: context.companyId,
            contact_id: context.contactId,
            content: fullMessage,
            message_type: "text",
            is_from_me: true,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        }
      }

      // Update execution to wait for response
      await supabase
        .from("chatbot_flow_executions")
        .update({
          current_node_id: node.id,
          status: "waiting_response",
          context: { ...config, waiting_for: "question_response" },
        })
        .eq("id", context.executionId);

      return { shouldContinue: false, nextNode: null, waitForResponse: true };
    }

    case "delay": {
      const delayValue = (config.delay_value as number) || 1;
      const delayUnit = (config.delay_unit as string) || "seconds";

      let delaySeconds = delayValue;
      if (delayUnit === "minutes") delaySeconds = delayValue * 60;
      else if (delayUnit === "hours") delaySeconds = delayValue * 3600;

      // For short delays (< 30s), just wait
      if (delaySeconds <= 30) {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
        const nextNode = await getNextNode(supabase, node.flow_id, node.id);
        return { shouldContinue: true, nextNode };
      }

      // For longer delays, schedule and pause execution
      const nextActionAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
      await supabase
        .from("chatbot_flow_executions")
        .update({
          current_node_id: node.id,
          status: "paused",
          next_action_at: nextActionAt,
        })
        .eq("id", context.executionId);

      return { shouldContinue: false, nextNode: null, delaySeconds };
    }

    case "pause": {
      // Pause node - wait for any message from the contact before continuing
      console.log(`⏸️ Pause node: waiting for message from contact`);

      // Update execution to wait for response
      await supabase
        .from("chatbot_flow_executions")
        .update({
          current_node_id: node.id,
          status: "waiting_response",
          context: { waiting_for: "pause_message" },
        })
        .eq("id", context.executionId);

      return { shouldContinue: false, nextNode: null, waitForResponse: true };
    }

    case "condition": {
      // Simple condition check based on last message
      const conditionField = (config.field as string) || "last_message";
      const conditionOperator = (config.operator as string) || "contains";
      const conditionValue = (config.value as string) || "";

      let conditionMet = false;

      if (conditionField === "last_message" && context.lastUserMessage) {
        const msgLower = context.lastUserMessage.toLowerCase();
        const valueLower = conditionValue.toLowerCase();

        switch (conditionOperator) {
          case "contains":
            conditionMet = msgLower.includes(valueLower);
            break;
          case "equals":
            conditionMet = msgLower === valueLower;
            break;
          case "starts_with":
            conditionMet = msgLower.startsWith(valueLower);
            break;
          case "ends_with":
            conditionMet = msgLower.endsWith(valueLower);
            break;
          default:
            conditionMet = true;
        }
      }

      // Get next node based on condition result
      const sourceHandle = conditionMet ? "true" : "false";
      const nextNode = await getNextNode(supabase, node.flow_id, node.id, sourceHandle);

      return { shouldContinue: true, nextNode, sourceHandle };
    }

    case "action": {
      const actionType = (config.action_type as string) || "";
      const actionValue = (config.action_value as string) || "";
      const funnelId = (config.funnel_id as string) || "";
      const stageId = (config.stage_id as string) || "";
      
      console.log(`🎬 Executing action: ${actionType}`, { actionValue, funnelId, stageId });

      try {
        switch (actionType) {
          case "move_stage": {
            if (stageId) {
              // First, find a lead associated with this contact's phone
              const { data: contact } = await supabase
                .from("whatsapp_contacts")
                .select("phone, normalized_phone, name")
                .eq("id", context.contactId)
                .single();

              if (contact) {
                const phoneToSearch = contact.normalized_phone || contact.phone;
                // Extract last 9 digits for flexible matching
                const phoneSuffix = phoneToSearch.replace(/\D/g, '').slice(-9);
                console.log(`📱 Looking for lead with phone: ${phoneToSearch} (suffix: ${phoneSuffix})`);

                // Find ALL leads matching this phone (to detect duplicates)
                const { data: leads } = await supabase
                  .from("funnel_leads")
                  .select("id, name, stage_id, phone, created_at")
                  .eq("company_id", context.companyId)
                  .ilike("phone", `%${phoneSuffix}`)
                  .order("created_at", { ascending: true });

                console.log(`📋 Found ${leads?.length || 0} leads with matching phone`);

                if (leads && leads.length > 0) {
                  // IMPORTANT: Use OLDEST lead to avoid working with duplicates
                  const leadToMove = leads[0];
                  console.log(`📦 Moving lead "${leadToMove.name}" (${leadToMove.id}) to stage ${stageId}`);

                  const { error: moveError } = await supabase
                    .from("funnel_leads")
                    .update({ 
                      stage_id: stageId,
                      updated_at: new Date().toISOString()
                    })
                    .eq("id", leadToMove.id);

                  if (moveError) {
                    console.error("❌ Error moving lead:", moveError);
                  } else {
                    console.log(`✅ Lead moved successfully to stage ${stageId}`);
                  }

                  // If there are duplicate leads, log a warning
                  if (leads.length > 1) {
                    console.warn(`⚠️ WARNING: ${leads.length} duplicate leads found for phone ${phoneSuffix}. IDs: ${leads.map((l: { id: string }) => l.id).join(', ')}`);
                  }
                } else {
                  console.log(`⚠️ No lead found with phone ${phoneToSearch} - checking again before creating`);
                  
                  // DOUBLE CHECK: Search with exact phone match before creating
                  const { data: exactMatch } = await supabase
                    .from("funnel_leads")
                    .select("id")
                    .eq("company_id", context.companyId)
                    .eq("phone", contact.phone)
                    .limit(1)
                    .maybeSingle();

                  if (exactMatch) {
                    console.log(`✅ Found existing lead with exact phone match, moving it instead`);
                    await supabase
                      .from("funnel_leads")
                      .update({ 
                        stage_id: stageId,
                        updated_at: new Date().toISOString()
                      })
                      .eq("id", exactMatch.id);
                  } else {
                    // Create a new lead in the target stage
                    const { error: createError } = await supabase
                      .from("funnel_leads")
                      .insert({
                        company_id: context.companyId,
                        stage_id: stageId,
                        name: contact.name || contact.phone,
                        phone: contact.phone,
                        source: "whatsapp_chatbot",
                        position: 0,
                      });

                    if (createError) {
                      console.error("❌ Error creating lead:", createError);
                    } else {
                      console.log(`✅ New lead created in stage ${stageId}`);
                    }
                  }
                }
              }
            } else {
              console.log(`⚠️ No stage_id configured for move_stage action`);
            }
            break;
          }

          case "add_tag": {
            if (actionValue) {
              // Find lead by contact phone and add tag
              const { data: contact } = await supabase
                .from("whatsapp_contacts")
                .select("phone, normalized_phone")
                .eq("id", context.contactId)
                .single();

              if (contact) {
                const phoneToSearch = contact.normalized_phone || contact.phone;
                
                const { data: leads } = await supabase
                  .from("funnel_leads")
                  .select("id, tags")
                  .eq("company_id", context.companyId)
                  .or(`phone.eq.${phoneToSearch},phone.ilike.%${phoneToSearch.slice(-9)}%`);

                if (leads && leads.length > 0) {
                  const lead = leads[0];
                  const currentTags = lead.tags || [];
                  
                  if (!currentTags.includes(actionValue)) {
                    await supabase
                      .from("funnel_leads")
                      .update({ 
                        tags: [...currentTags, actionValue],
                        updated_at: new Date().toISOString()
                      })
                      .eq("id", lead.id);
                    
                    console.log(`✅ Tag "${actionValue}" added to lead`);
                  }
                }
              }
            }
            break;
          }

          case "remove_tag": {
            if (actionValue) {
              const { data: contact } = await supabase
                .from("whatsapp_contacts")
                .select("phone, normalized_phone")
                .eq("id", context.contactId)
                .single();

              if (contact) {
                const phoneToSearch = contact.normalized_phone || contact.phone;
                
                const { data: leads } = await supabase
                  .from("funnel_leads")
                  .select("id, tags")
                  .eq("company_id", context.companyId)
                  .or(`phone.eq.${phoneToSearch},phone.ilike.%${phoneToSearch.slice(-9)}%`);

                if (leads && leads.length > 0) {
                  const lead = leads[0];
                  const currentTags = lead.tags || [];
                  
                  if (currentTags.includes(actionValue)) {
                    await supabase
                      .from("funnel_leads")
                      .update({ 
                        tags: currentTags.filter((t: string) => t !== actionValue),
                        updated_at: new Date().toISOString()
                      })
                      .eq("id", lead.id);
                    
                    console.log(`✅ Tag "${actionValue}" removed from lead`);
                  }
                }
              }
            }
            break;
          }

          default:
            console.log(`⚠️ Action type "${actionType}" not implemented yet`);
        }
      } catch (actionError) {
        console.error(`❌ Error executing action ${actionType}:`, actionError);
      }

      const nextNode = await getNextNode(supabase, node.flow_id, node.id);
      return { shouldContinue: true, nextNode };
    }

    case "transfer": {
      // Mark as human takeover
      await supabase
        .from("chatbot_flow_executions")
        .update({
          status: "completed",
          is_human_takeover: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", context.executionId);

      // Add "em_atendimento" tag to the contact to block bot execution
      try {
        const { data: contactData } = await supabase
          .from("whatsapp_contacts")
          .select("tags")
          .eq("id", context.contactId)
          .single();
        
        const currentTags = contactData?.tags || [];
        if (!currentTags.includes("em_atendimento")) {
          await supabase
            .from("whatsapp_contacts")
            .update({ 
              tags: [...currentTags, "em_atendimento"],
              updated_at: new Date().toISOString()
            })
            .eq("id", context.contactId);
          console.log(`🏷️ Tag "em_atendimento" added to contact ${context.contactId}`);
        }
      } catch (tagError) {
        console.error("Error adding em_atendimento tag:", tagError);
      }

      const rawTransferMessage = (config.message as string) || "Você será atendido por um humano em breve.";
      const transferMessage = replaceMessageVariables(rawTransferMessage, {
        ownerFirstName: context.ownerFirstName,
        contactName: context.contactName,
      });
      await sendWhatsAppMessage(
        context.phoneNumberId,
        context.accessToken,
        context.contactPhone,
        transferMessage
      );

      return { shouldContinue: false, nextNode: null };
    }

    case "end": {
      // Complete execution
      await supabase
        .from("chatbot_flow_executions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", context.executionId);

      return { shouldContinue: false, nextNode: null };
    }

    default:
      console.log(`Unknown node type: ${node.node_type}`);
      const nextNode = await getNextNode(supabase, node.flow_id, node.id);
      return { shouldContinue: true, nextNode };
  }
}

// Main execution loop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeFlow(
  supabase: any,
  flow: ChatbotFlow,
  contactId: string,
  contactPhone: string,
  phoneNumberId: string,
  accessToken: string,
  triggerMessage?: string
) {
  console.log(`🚀 Starting flow execution: ${flow.name}`);

  // Create execution record
  const { data: execution, error: execError } = await supabase
    .from("chatbot_flow_executions")
    .insert({
      flow_id: flow.id,
      company_id: flow.company_id,
      contact_id: contactId,
      status: "running",
      context: { trigger_message: triggerMessage },
    })
    .select()
    .single();

  if (execError || !execution) {
    console.error("Failed to create execution:", execError);
    return;
  }

  console.log(`📝 Execution created: ${execution.id}`);

  try {
    // Get owner first name for message personalization
    const ownerFirstName = await getOwnerFirstName(supabase, flow.company_id);
    
    // Get contact name for personalization
    const { data: contactData } = await supabase
      .from("whatsapp_contacts")
      .select("name")
      .eq("id", contactId)
      .single();
    const contactName = contactData?.name || "";
    
    // Get start node and first connected node
    const startInfo = await getStartNode(supabase, flow.id);
    if (!startInfo || !startInfo.firstNode) {
      console.log("No nodes to execute after start");
      await supabase
        .from("chatbot_flow_executions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", execution.id);
      return;
    }

    // Process nodes
    let currentNode: FlowNode | null = startInfo.firstNode;
    let iterationCount = 0;
    const maxIterations = 50; // Prevent infinite loops

    while (currentNode && iterationCount < maxIterations) {
      iterationCount++;

      // Log node execution
      await supabase.from("chatbot_flow_logs").insert({
        execution_id: execution.id,
        company_id: flow.company_id,
        node_id: currentNode.id,
        node_type: currentNode.node_type,
        action: "executed",
        details: { iteration: iterationCount },
      });

      const result = await processNode(supabase, currentNode, {
        companyId: flow.company_id,
        contactId,
        contactPhone,
        phoneNumberId,
        accessToken,
        executionId: execution.id,
        lastUserMessage: triggerMessage,
        ownerFirstName,
        contactName,
      });

      if (!result.shouldContinue) {
        console.log("⏸️ Execution paused or completed");
        break;
      }

      currentNode = result.nextNode;

      // Small delay between nodes to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (iterationCount >= maxIterations) {
      console.error("⚠️ Max iterations reached, stopping execution");
      await supabase
        .from("chatbot_flow_executions")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", execution.id);
      return;
    }

    // CRITICAL: If the flow naturally ended (no next node), finalize the execution
    // Otherwise it can remain as "running" and block new flows.
    if (!currentNode) {
      await supabase
        .from("chatbot_flow_executions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", execution.id);
      console.log("✅ Execution completed (no next node)");
    }
  } catch (err) {
    console.error("❌ executeFlow error:", err);
    await supabase
      .from("chatbot_flow_executions")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", execution.id);
  }
}

// Handle continuing an execution (after user response or delay)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function continueExecution(
  supabase: any,
  executionId: string,
  userResponse?: string,
  buttonId?: string // Direct button ID from interactive response
) {
  console.log(`🔄 Continuing execution ${executionId} with response: "${userResponse}", buttonId: "${buttonId}"`);
  
  const { data: execution, error: execError } = await supabase
    .from("chatbot_flow_executions")
    .select("*, chatbot_flows(*)")
    .eq("id", executionId)
    .single();

  if (execError) {
    console.error("Error fetching execution:", execError);
    return;
  }

  if (!execution || !execution.current_node_id) {
    console.log("Execution not found or no current node");
    return;
  }

  console.log(`📍 Current node: ${execution.current_node_id}, Status: ${execution.status}`);

  // Safety: auto-finalize truly stale executions so they don't block the contact forever
  try {
    const startedAt = execution.started_at ? new Date(execution.started_at).getTime() : 0;
    const ageMs = startedAt ? Date.now() - startedAt : 0;
    const isStaleWaiting = execution.status === "waiting_response" && ageMs > WAITING_RESPONSE_TIMEOUT_MS;
    const isStaleRunning = execution.status === "running" && ageMs > RUNNING_TIMEOUT_MS;
    if (isStaleWaiting || isStaleRunning) {
      console.log(`⚠️ Stale execution detected (${execution.status}, ageMs=${ageMs}). Marking as failed.`);
      await supabase
        .from("chatbot_flow_executions")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", executionId);
      return;
    }
  } catch (e) {
    console.error("Failed stale-execution guard:", e);
  }

  // Get current node
  const { data: currentNode } = await supabase
    .from("chatbot_flow_nodes")
    .select("*")
    .eq("id", execution.current_node_id)
    .single();

  if (!currentNode) {
    console.log("Current node not found");
    return;
  }

  console.log(`📦 Current node type: ${currentNode.node_type}`);

  // Get contact info
  const { data: contact } = await supabase
    .from("whatsapp_contacts")
    .select("phone, normalized_phone, name")
    .eq("id", execution.contact_id)
    .single();

  if (!contact) {
    console.log("Contact not found");
    return;
  }
  
  // Get owner first name for message personalization
  const ownerFirstName = await getOwnerFirstName(supabase, execution.company_id);
  const contactName = contact.name || "";

  // Get company info
  const { data: company } = await supabase
    .from("companies")
    .select("whatsapp_phone_number_id")
    .eq("id", execution.company_id)
    .single();

  if (!company?.whatsapp_phone_number_id) {
    console.log("Company phone_number_id not found");
    return;
  }

  const accessToken = Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN") || "";

  // If it's a pause node, any message continues the flow
  if (currentNode.node_type === "pause") {
    console.log(`⏸️ Pause node received message - continuing flow`);
    
    const nextNode = await getNextNode(supabase, currentNode.flow_id, currentNode.id);
    
    if (nextNode) {
      console.log(`➡️ Next node after pause: ${nextNode.node_type} (${nextNode.id})`);
      
      // Update execution status
      await supabase
        .from("chatbot_flow_executions")
        .update({ status: "running", current_node_id: nextNode.id })
        .eq("id", executionId);

      // Process the remaining nodes
      let currentProcessNode: FlowNode | null = nextNode;
      let iterationCount = 0;
      const maxIterations = 50;

      while (currentProcessNode && iterationCount < maxIterations) {
        iterationCount++;
        console.log(`📦 Processing continued node: ${currentProcessNode.node_type}`);

        // Log node execution
        await supabase.from("chatbot_flow_logs").insert({
          execution_id: executionId,
          company_id: execution.company_id,
          node_id: currentProcessNode.id,
          node_type: currentProcessNode.node_type,
          action: "executed",
          details: { iteration: iterationCount, continued_from_pause: true },
        });

        const result = await processNode(supabase, currentProcessNode, {
          companyId: execution.company_id,
          contactId: execution.contact_id,
          contactPhone: contact.normalized_phone || contact.phone,
          phoneNumberId: company.whatsapp_phone_number_id,
          accessToken,
          executionId,
          lastUserMessage: userResponse,
          ownerFirstName,
          contactName,
        });

        if (!result.shouldContinue) {
          if (!result.waitForResponse && !result.delaySeconds) {
            // Flow has ended
            await supabase
              .from("chatbot_flow_executions")
              .update({ status: "completed", completed_at: new Date().toISOString() })
              .eq("id", executionId);
            console.log("✅ Execution completed after pause");
          }
          break;
        }

        currentProcessNode = result.nextNode;
      }
    } else {
      // No next node - end the flow
      await supabase
        .from("chatbot_flow_executions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", executionId);
      console.log("✅ Execution completed (no next node after pause)");
    }
    return;
  }

  // If it's a question node, determine the next path based on response
  if (currentNode.node_type === "question") {
    const options = (currentNode.config?.options as string[]) || [];
    const hasInteractiveButtons = options.length > 0 && options.length <= 3;

    console.log(`🤔 Question options: ${JSON.stringify(options)}, buttonId: "${buttonId}", Response: "${userResponse}", hasButtons: ${hasInteractiveButtons}`);

    let sourceHandle: string | null = null;

    // CRITICAL: If we have interactive buttons (1-3 options), ONLY accept button_id responses
    // Do NOT accept text responses for button-based questions
    if (hasInteractiveButtons) {
      // ONLY accept buttonId from interactive responses
      if (buttonId && buttonId.startsWith("option-")) {
        sourceHandle = buttonId;
        console.log(`✅ Button clicked: ${sourceHandle}`);
      } else {
        // User sent text instead of clicking a button
        // NÃO reenviar botões para evitar spam/duplicação - apenas aguardar silenciosamente
        console.log(`⚠️ Text response received but question requires button click. Waiting silently for button.`);
        // Manter status waiting_response - não fazer nada
        return;
      }
    } else if (options.length > 3) {
      // For 4+ options (numbered text response), accept text matching
      if (userResponse) {
        const responseLower = userResponse.toLowerCase().trim();
        const responseNum = parseInt(responseLower);
        
        if (!isNaN(responseNum) && responseNum >= 1 && responseNum <= options.length) {
          sourceHandle = `option-${responseNum - 1}`;
          console.log(`✅ Matched by number: ${responseNum} -> ${sourceHandle}`);
        } else {
          // Try to match by content
          const matchedIndex = options.findIndex((opt: string) =>
            responseLower.includes(opt.toLowerCase()) || opt.toLowerCase().includes(responseLower)
          );
          if (matchedIndex >= 0) {
            sourceHandle = `option-${matchedIndex}`;
            console.log(`✅ Matched by content: "${options[matchedIndex]}" -> ${sourceHandle}`);
          }
        }
        
        // If no match, resend the numbered options
        if (!sourceHandle) {
          console.log(`⚠️ No match for text response. Resending options.`);
          
          let fullMessage = "Por favor, responda com o número da opção desejada:\n\n";
          fullMessage += (currentNode.config?.question as string) || "";
          fullMessage += "\n\n";
          options.forEach((opt, idx) => {
            fullMessage += `${idx + 1}. ${opt}\n`;
          });
          
          await sendWhatsAppMessage(
            company.whatsapp_phone_number_id,
            accessToken,
            contact.normalized_phone || contact.phone,
            fullMessage
          );
          
          console.log(`🔄 Re-sent numbered options - waiting for valid response`);
          return;
        }
      }
    }

    if (sourceHandle) {
      console.log(`🔍 Looking for edge with source_handle: ${sourceHandle}`);
      
      const nextNode = await getNextNode(supabase, currentNode.flow_id, currentNode.id, sourceHandle);

      if (nextNode) {
        console.log(`➡️ Next node found: ${nextNode.node_type} (${nextNode.id})`);
        
        // Update execution status
        await supabase
          .from("chatbot_flow_executions")
          .update({ status: "running", current_node_id: nextNode.id })
          .eq("id", executionId);

        // IMPORTANT: Actually process the remaining nodes!
        let currentProcessNode: FlowNode | null = nextNode;
        let iterationCount = 0;
        const maxIterations = 50;

        while (currentProcessNode && iterationCount < maxIterations) {
          iterationCount++;
          console.log(`📦 Processing continued node: ${currentProcessNode.node_type}`);

          // Log node execution
          await supabase.from("chatbot_flow_logs").insert({
            execution_id: executionId,
            company_id: execution.company_id,
            node_id: currentProcessNode.id,
            node_type: currentProcessNode.node_type,
            action: "executed",
            details: { iteration: iterationCount, continued: true },
          });

          const result = await processNode(supabase, currentProcessNode, {
            companyId: execution.company_id,
            contactId: execution.contact_id,
            contactPhone: contact.normalized_phone || contact.phone,
            phoneNumberId: company.whatsapp_phone_number_id,
            accessToken,
            executionId,
            lastUserMessage: userResponse,
            ownerFirstName,
            contactName,
          });

          if (!result.shouldContinue) {
            console.log("⏸️ Execution paused or completed after continue");
            break;
          }

          currentProcessNode = result.nextNode;

          // Small delay between nodes
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // If the flow naturally ended (no next node), finalize execution.
        if (!currentProcessNode) {
          await supabase
            .from("chatbot_flow_executions")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", executionId);
          console.log("✅ Continued execution completed (no next node)");
        } else {
          console.log(`✅ Continued execution finished after ${iterationCount} nodes`);
        }
      } else {
        console.log(`❌ No next node found for handle: ${sourceHandle}`);
        
        // Mark as completed if no next node
        await supabase
          .from("chatbot_flow_executions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", executionId);
      }
    } else {
      console.log(`❌ No valid response received - staying in waiting_response state`);
      // Don't change status - keep waiting for proper response
    }
  } else {
    console.log(`⚠️ Not a question node or no user response`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const accessToken = Deno.env.get("WHATSAPP_CLOUD_ACCESS_TOKEN") || "";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { trigger_type, company_id, contact_id, message_content, execution_id } = body;

    console.log(`📨 Flow executor called: ${trigger_type}`);

    if (trigger_type === "keyword" && company_id && contact_id && message_content) {
      // CRITICAL: Check if contact has "em_atendimento" tag - block bot execution
      const { data: contactTags } = await supabase
        .from("whatsapp_contacts")
        .select("tags")
        .eq("id", contact_id)
        .single();

      const tags = contactTags?.tags || [];
      if (tags.includes("em_atendimento")) {
        console.log(`🚫 Contact has "em_atendimento" tag - bot execution blocked`);
        return new Response(JSON.stringify({ status: "blocked", reason: "human_takeover" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if there's already an active execution for this contact
      const { data: existingExecution } = await supabase
        .from("chatbot_flow_executions")
        .select("id, status, started_at")
        .eq("company_id", company_id)
        .eq("contact_id", contact_id)
        .in("status", ["running", "waiting_response"])
        .order("started_at", { ascending: false })
        .maybeSingle();

      if (existingExecution) {
        const startedAt = existingExecution.started_at
          ? new Date(existingExecution.started_at).getTime()
          : 0;
        const ageMs = startedAt ? Date.now() - startedAt : 0;
        const isStaleWaiting = existingExecution.status === "waiting_response" && ageMs > WAITING_RESPONSE_TIMEOUT_MS;
        const isStaleRunning = existingExecution.status === "running" && ageMs > RUNNING_TIMEOUT_MS;

        if (isStaleWaiting || isStaleRunning) {
          console.log(`⚠️ Active execution is stale (${existingExecution.status}, ageMs=${ageMs}). Finalizing and starting a new flow.`);
          await supabase
            .from("chatbot_flow_executions")
            .update({ status: "failed", completed_at: new Date().toISOString() })
            .eq("id", existingExecution.id);
        } else {
          console.log("Active execution exists, skipping new flow start");
          return new Response(JSON.stringify({ status: "skipped", reason: "active_execution" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Find matching flow
      const flow = await findMatchingFlow(supabase, company_id, message_content);

      if (!flow) {
        return new Response(JSON.stringify({ status: "no_flow" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get contact phone
      const { data: contact } = await supabase
        .from("whatsapp_contacts")
        .select("phone, normalized_phone")
        .eq("id", contact_id)
        .single();

      if (!contact) {
        return new Response(JSON.stringify({ status: "contact_not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get company phone_number_id
      const { data: company } = await supabase
        .from("companies")
        .select("whatsapp_phone_number_id")
        .eq("id", company_id)
        .single();

      if (!company?.whatsapp_phone_number_id) {
        return new Response(JSON.stringify({ status: "no_whatsapp_config" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Execute flow
      await executeFlow(
        supabase,
        flow,
        contact_id,
        contact.normalized_phone || contact.phone,
        company.whatsapp_phone_number_id,
        accessToken,
        message_content
      );

      return new Response(JSON.stringify({ status: "started", flow_id: flow.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trigger_type === "continue_execution" && execution_id) {
      const { button_id, user_response } = body;
      
      // Get the last message from contact if no user_response provided
      const { data: execution } = await supabase
        .from("chatbot_flow_executions")
        .select("contact_id")
        .eq("id", execution_id)
        .single();

      if (execution) {
        let responseContent = user_response;
        
        // If no user_response was passed, fetch from last message
        if (!responseContent) {
          const { data: lastMessage } = await supabase
            .from("whatsapp_messages")
            .select("content")
            .eq("contact_id", execution.contact_id)
            .eq("is_from_me", false)
            .order("sent_at", { ascending: false })
            .limit(1)
            .single();
          
          responseContent = lastMessage?.content;
        }

        await continueExecution(supabase, execution_id, responseContent, button_id);
      }

      return new Response(JSON.stringify({ status: "continued" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "invalid_request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Flow executor error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
