/**
 * =====================================================
 * NORMALIZADOR DE TELEFONE - FRONTEND
 * =====================================================
 * 
 * Funções para normalizar e formatar números de telefone
 * do WhatsApp para exibição consistente na UI.
 */

/**
 * Normaliza qualquer identificador do WhatsApp para formato E.164 puro
 * @param input - JID, número de telefone ou qualquer formato
 * @returns Número normalizado (apenas dígitos com DDI)
 */
export function normalizePhone(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let phone = input.trim();

  // 1. Remover sufixos do WhatsApp
  phone = phone
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@c\.us$/i, '')
    .replace(/@lid$/i, '')
    .replace(/@g\.us$/i, '')
    .replace(/@broadcast$/i, '');

  // 2. Remover parte do device ID (ex: "5583999999999:45" -> "5583999999999")
  phone = phone.split(':')[0];

  // 3. Remover todos os caracteres não numéricos
  phone = phone.replace(/\D/g, '');

  // 4. Se o número é muito longo (>15 dígitos), provavelmente é um LID
  if (phone.length > 15) {
    return '';
  }

  // 5. Garantir DDI do Brasil se número curto
  if (phone.length >= 10 && phone.length <= 11) {
    phone = '55' + phone;
  }

  // 6. Corrigir números brasileiros (adicionar 9 se necessário)
  if (phone.startsWith('55') && phone.length === 12) {
    const ddi = phone.substring(0, 2);
    const ddd = phone.substring(2, 4);
    const number = phone.substring(4);
    phone = `${ddi}${ddd}9${number}`;
  }

  return phone;
}

/**
 * Verifica se é um LID (Link ID) do WhatsApp
 * LIDs não são números de telefone reais
 */
export function isLid(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }
  return input.includes('@lid');
}

/**
 * Formata número para exibição amigável
 * Ex: 5583999999999 -> +55 83 99999-9999
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  
  if (normalized.startsWith('55') && normalized.length === 13) {
    // Formato brasileiro: +55 XX XXXXX-XXXX
    return `+${normalized.substring(0, 2)} ${normalized.substring(2, 4)} ${normalized.substring(4, 9)}-${normalized.substring(9)}`;
  }
  
  // Formato genérico: +CÓDIGO NÚMERO
  return `+${normalized}`;
}

/**
 * Retorna apenas a parte local do número (sem DDI)
 * Ex: 5583999999999 -> 83 99999-9999
 */
export function formatLocalPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  
  if (normalized.startsWith('55') && normalized.length === 13) {
    // Formato brasileiro: XX XXXXX-XXXX
    return `${normalized.substring(2, 4)} ${normalized.substring(4, 9)}-${normalized.substring(9)}`;
  }
  
  // Retornar número sem formatação se não reconhecido
  return normalized;
}
