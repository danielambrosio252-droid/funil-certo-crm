/**
 * =====================================================
 * SERVIDOR WHATSAPP WEB - ESCALA CERTO PRO
 * =====================================================
 * 
 * Servidor Node.js com Baileys para gerenciamento de
 * sessões WhatsApp Web com suporte a multi-tenant.
 * 
 * VERSÃO DEFINITIVA:
 * - Endpoint /api/whatsapp/qr com status explícito
 * - Nunca retorna WAITING infinito
 * - Timeout automático para sessões travadas
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { SessionManager } = require('./managers/SessionManager');
const { WebhookService } = require('./services/WebhookService');
const { appLogger } = require('./utils/logger');

// =====================================================
// CONFIGURAÇÃO (com fallback para nomes antigos)
// =====================================================

const PORT = process.env.PORT || 3001;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Aceitar múltiplas variantes de nomes (retrocompatibilidade)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET 
  || process.env.WHATSAPP_WEBHOOK_SECRET 
  || process.env.SERVER_SECRET;

const SERVER_SECRET = process.env.WHATSAPP_SERVER_SECRET 
  || process.env.SERVER_SECRET;

const SESSIONS_DIR = process.env.SESSIONS_DIR 
  || process.env.SESSION_DIR 
  || './sessions';

// Criar diretórios necessários
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs', { recursive: true });
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

const app = express();
app.use(cors());
app.use(express.json());

// Serviços
const webhookService = new WebhookService(WEBHOOK_URL, WEBHOOK_SECRET);
const sessionManager = new SessionManager(SESSIONS_DIR, webhookService);

// =====================================================
// MIDDLEWARE DE LOGS
// =====================================================

app.use((req, res, next) => {
  appLogger.info(`${req.method} ${req.path}`, { 
    ip: req.ip,
    body: req.method === 'POST' ? req.body : undefined 
  });
  next();
});

// =====================================================
// MIDDLEWARE DE AUTENTICAÇÃO (opcional)
// =====================================================

const validateServerToken = (req, res, next) => {
  // Se não há secret configurado, pular validação
  if (!SERVER_SECRET) {
    return next();
  }
  
  const token = req.headers['x-server-token'] || req.query.token;
  
  if (token !== SERVER_SECRET) {
    appLogger.warn(`Tentativa de acesso não autorizado: ${req.path}`);
    return res.status(401).json({ 
      success: false, 
      error: 'Token inválido' 
    });
  }
  
  next();
};

// =====================================================
// ENDPOINTS
// =====================================================

/**
 * POST /connect
 * Inicia uma nova sessão WhatsApp para a empresa
 * FORÇA reset da sessão anterior
 */
app.post('/connect', validateServerToken, async (req, res) => {
  const { company_id, force_reset } = req.body;

  if (!company_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'company_id é obrigatório' 
    });
  }

  try {
    appLogger.info(`[${company_id}] POST /connect - force_reset: ${force_reset}`);
    
    // Se force_reset, remover sessão completamente antes
    if (force_reset) {
      await sessionManager.removeSession(company_id);
    }
    
    const result = await sessionManager.createSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Conexão iniciada. Aguarde o QR Code.',
      status: result.status,
      phone_number: result.phone_number || null
    });
  } catch (error) {
    appLogger.error(`[${company_id}] Erro ao conectar:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/whatsapp/qr
 * ENDPOINT DETERMINÍSTICO para polling
 * 
 * Retorna status EXPLÍCITO:
 * - CONNECTING: Sessão iniciando, aguarde
 * - QR: QR Code disponível (inclui qr base64)
 * - CONNECTED: Já conectado (inclui phone_number)
 * - ERROR: Erro ocorreu (inclui reason)
 * - DISCONNECTED: Sem sessão ativa
 * 
 * NUNCA retorna WAITING infinito!
 */
app.get('/api/whatsapp/qr', (req, res) => {
  const companyId = req.query.company_id || req.query.companyId;

  if (!companyId) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'company_id é obrigatório'
    });
  }

  // Usar o novo método determinístico
  const sessionStatus = sessionManager.getSessionStatus(companyId);
  const qr = sessionManager.getQrCode(companyId);

  appLogger.info(`[${companyId}] GET /api/whatsapp/qr - status: ${sessionStatus.status}, hasQR: ${!!qr}`);

  // 1. CONNECTED
  if (sessionStatus.connected || sessionStatus.status === 'connected') {
    return res.json({
      status: 'CONNECTED',
      phone_number: sessionStatus.phoneNumber
    });
  }

  // 2. QR disponível
  if (qr || sessionStatus.status === 'qr') {
    return res.json({
      status: 'QR',
      qr: qr || null
    });
  }

  // 3. ERROR
  if (sessionStatus.status === 'error') {
    return res.json({
      status: 'ERROR',
      reason: sessionStatus.error_reason || 'unknown'
    });
  }

  // 4. CONNECTING (com idade)
  if (sessionStatus.status === 'connecting' || sessionStatus.connecting) {
    return res.json({
      status: 'CONNECTING',
      pending_age_ms: sessionStatus.pending_age_ms || 0
    });
  }

  // 5. DISCONNECTED
  return res.json({ 
    status: 'DISCONNECTED' 
  });
});

/**
 * POST /disconnect
 * Desconecta uma sessão WhatsApp
 */
app.post('/disconnect', validateServerToken, async (req, res) => {
  const { company_id } = req.body;

  if (!company_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'company_id é obrigatório' 
    });
  }

  try {
    appLogger.info(`[${company_id}] Desconectando...`);
    
    await sessionManager.disconnectSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Sessão desconectada com sucesso' 
    });
  } catch (error) {
    appLogger.error(`[${company_id}] Erro ao desconectar:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /send
 * Envia uma mensagem de texto
 */
app.post('/send', validateServerToken, async (req, res) => {
  const { company_id, message_id, phone, content, message_type = 'text' } = req.body;

  if (!phone || !content) {
    return res.status(400).json({ 
      success: false, 
      error: 'phone e content são obrigatórios' 
    });
  }

  try {
    let targetCompanyId = company_id;
    
    if (!targetCompanyId) {
      const activeSessions = sessionManager.getActiveSessions();
      if (activeSessions.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Nenhuma sessão ativa encontrada' 
        });
      }
      targetCompanyId = activeSessions[0];
    }

    appLogger.info(`[${targetCompanyId}] Enviando mensagem para ${phone}`);

    const result = await sessionManager.sendMessage(
      targetCompanyId,
      phone,
      content,
      message_type,
      message_id
    );

    res.json({ 
      success: true, 
      message_id: result.messageId,
      whatsapp_message_id: result.whatsappMessageId
    });
  } catch (error) {
    appLogger.error(`Erro ao enviar mensagem:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /status
 * Retorna o status de todas as sessões
 */
app.get('/status', (req, res) => {
  const sessions = sessionManager.getAllSessionsStatus();

  res.json({
    status: 'online',
    webhook_url: WEBHOOK_URL,
    sessions,
    total_sessions: Object.keys(sessions).length,
    active_sessions: Object.values(sessions).filter(s => s.connected).length
  });
});

/**
 * GET /status/:company_id
 * Retorna o status de uma sessão específica
 */
app.get('/status/:company_id', (req, res) => {
  const { company_id } = req.params;
  
  const session = sessionManager.getSessionStatus(company_id);
  
  res.json({
    success: true,
    session
  });
});

/**
 * GET /health
 * Health check para load balancers e monitoramento
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

/**
 * POST /restart/:company_id
 * Reinicia uma sessão específica (mantém credenciais)
 */
app.post('/restart/:company_id', validateServerToken, async (req, res) => {
  const { company_id } = req.params;

  try {
    appLogger.info(`[${company_id}] Reiniciando sessão...`);
    
    const result = await sessionManager.restartSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Sessão reiniciada',
      status: result.status
    });
  } catch (error) {
    appLogger.error(`[${company_id}] Erro ao reiniciar:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /session/:company_id
 * Remove completamente uma sessão (incluindo arquivos)
 * Permite conectar um novo número
 */
app.delete('/session/:company_id', validateServerToken, async (req, res) => {
  const { company_id } = req.params;

  try {
    appLogger.info(`[${company_id}] Removendo sessão completamente...`);
    
    await sessionManager.removeSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Sessão removida completamente' 
    });
  } catch (error) {
    appLogger.error(`[${company_id}] Erro ao remover:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(PORT, async () => {
  appLogger.info('=========================================');
  appLogger.info('🚀 SERVIDOR WHATSAPP - ESCALA CERTO PRO');
  appLogger.info('=========================================');
  appLogger.info(`📡 Porta: ${PORT}`);
  appLogger.info(`🔗 Webhook: ${WEBHOOK_URL || 'NÃO CONFIGURADO'}`);
  appLogger.info(`🔐 Auth: ${SERVER_SECRET ? 'ATIVO' : 'DESATIVADO'}`);
  appLogger.info(`📁 Sessões: ${path.resolve(SESSIONS_DIR)}`);
  appLogger.info('=========================================');

  // Restaurar sessões existentes na inicialização
  await sessionManager.restoreAllSessions();
});

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

process.on('uncaughtException', (error) => {
  appLogger.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  appLogger.error('Promise rejeitada não tratada:', reason);
});

process.on('SIGINT', async () => {
  appLogger.info('Encerrando servidor...');
  await sessionManager.disconnectAllSessions();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  appLogger.info('Recebido SIGTERM, encerrando...');
  await sessionManager.disconnectAllSessions();
  process.exit(0);
});
