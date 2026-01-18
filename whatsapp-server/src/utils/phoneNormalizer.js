/**
 * =====================================================
 * NORMALIZADOR DE TELEFONE - REGRA DE OURO
 * =====================================================
 * 
 * Converte QUALQUER formato de JID do WhatsApp para 
 * formato E.164 puro (apenas dígitos).
 * 
 * Exemplos de entrada:
 * - "558381579397@s.whatsapp.net" -> "558381579397"
 * - "231924207509546@lid" -> "558381579397" (precisa resolver via WhatsApp)
 * - "5583999999999:45@s.whatsapp.net" -> "5583999999999"
 * - "+55 83 9 9999-9999" -> "5583999999999"
 * - "83999999999" -> "5583999999999"
 */

const { logger } = require('./logger');

/**
 * Normaliza qualquer identificador do WhatsApp para formato E.164 puro
 * @param {string} input - JID, número de telefone ou qualquer formato
 * @returns {string} Número normalizado (apenas dígitos com DDI)
 */
function normalizePhone(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let phone = input.trim();

  // 1. Remover sufixos do WhatsApp
  phone = phone
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@c\.us$/i, '')
    .replace(/@lid$/i, '')
    .replace(/@g\.us$/i, '') // grupos
    .replace(/@broadcast$/i, '');

  // 2. Se tinha @lid, é um LID (Link ID) - não é um número real
  // LIDs são identificadores internos do WhatsApp que não correspondem a números
  // Vamos manter como está para logging mas isso não deveria ser usado como phone
  const wasLid = input.includes('@lid');
  
  // 3. Remover parte do device ID (ex: "5583999999999:45" -> "5583999999999")
  phone = phone.split(':')[0];

  // 4. Remover todos os caracteres não numéricos
  phone = phone.replace(/\D/g, '');

  // 5. Se o número é muito longo (>15 dígitos), provavelmente é um LID
  // LIDs têm formato como "231924207509546" que são 15+ dígitos
  if (phone.length > 15) {
    logger.warn(`[PhoneNormalizer] Número muito longo (possível LID): ${phone}`);
    // Retornar vazio para LIDs - eles não são números válidos
    return '';
  }

  // 6. Garantir DDI do Brasil se número curto
  if (phone.length >= 10 && phone.length <= 11) {
    // Número brasileiro sem DDI (ex: 83999999999)
    phone = '55' + phone;
  }

  // 7. Corrigir números brasileiros (adicionar 9 se necessário)
  // Celulares brasileiros: 55 + 2 dígitos DDD + 9 + 8 dígitos
  // Ex: 5583981579397 (13 dígitos) está correto
  // Ex: 558381579397 (12 dígitos) precisa do 9
  if (phone.startsWith('55') && phone.length === 12) {
    // Número brasileiro com 8 dígitos depois do DDD - adicionar o 9
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
 * @param {string} input - String a verificar
 * @returns {boolean}
 */
function isLid(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }
  return input.includes('@lid');
}

/**
 * Extrai o número normalizado de um JID completo
 * Para LIDs, retorna null (não é um número válido)
 * @param {string} jid - JID completo do WhatsApp
 * @returns {string|null} Número normalizado ou null se LID
 */
function extractPhoneFromJid(jid) {
  if (!jid) return null;
  
  if (isLid(jid)) {
    logger.warn(`[PhoneNormalizer] Ignorando LID (não é número real): ${jid}`);
    return null;
  }
  
  const normalized = normalizePhone(jid);
  return normalized || null;
}

/**
 * Formata número normalizado para JID do WhatsApp (para envio)
 * @param {string} phone - Número normalizado
 * @returns {string} JID no formato correto para envio
 */
function phoneToJid(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error(`Número inválido para converter em JID: ${phone}`);
  }
  return `${normalized}@s.whatsapp.net`;
}

/**
 * Formata número para exibição amigável
 * Ex: 5583999999999 -> +55 83 99999-9999
 * @param {string} phone - Número normalizado
 * @returns {string} Número formatado para exibição
 */
function formatForDisplay(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  
  if (normalized.startsWith('55') && normalized.length === 13) {
    // Formato brasileiro: +55 XX XXXXX-XXXX
    return `+${normalized.substring(0, 2)} ${normalized.substring(2, 4)} ${normalized.substring(4, 9)}-${normalized.substring(9)}`;
  }
  
  // Formato genérico: +CÓDIGO NÚMERO
  return `+${normalized}`;
}

module.exports = {
  normalizePhone,
  isLid,
  extractPhoneFromJid,
  phoneToJid,
  formatForDisplay
};
