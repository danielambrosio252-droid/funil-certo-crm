/**
 * =====================================================
 * SERVIDOR WHATSAPP WEB - ESCALA CERTO PRO
 * =====================================================
 * 
 * Servidor Node.js com Baileys para gerenciamento de
 * sessões WhatsApp Web com suporte a multi-tenant.
 * 
 * Autor: Escala Certo Pro
 * Versão: 1.0.0
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { SessionManager } = require('./managers/SessionManager');
const { WebhookService } = require('./services/WebhookService');
const { logger } = require('./utils/logger');

// =====================================================
// CONFIGURAÇÃO
// =====================================================

const PORT = process.env.PORT || 3001;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SESSIONS_DIR = process.env.SESSIONS_DIR || './sessions';

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
  logger.info(`${req.method} ${req.path}`, { 
    ip: req.ip,
    body: req.method === 'POST' ? req.body : undefined 
  });
  next();
});

// =====================================================
// ENDPOINTS
// =====================================================

/**
 * POST /connect
 * Inicia uma nova sessão WhatsApp para a empresa
 */
app.post('/connect', async (req, res) => {
  const { company_id } = req.body;

  if (!company_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'company_id é obrigatório' 
    });
  }

  try {
    logger.info(`[${company_id}] Iniciando conexão...`);
    
    const result = await sessionManager.createSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Conexão iniciada. Aguarde o QR Code.',
      status: result.status
    });
  } catch (error) {
    logger.error(`[${company_id}] Erro ao conectar:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /disconnect
 * Desconecta uma sessão WhatsApp
 */
app.post('/disconnect', async (req, res) => {
  const { company_id } = req.body;

  if (!company_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'company_id é obrigatório' 
    });
  }

  try {
    logger.info(`[${company_id}] Desconectando...`);
    
    await sessionManager.disconnectSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Sessão desconectada com sucesso' 
    });
  } catch (error) {
    logger.error(`[${company_id}] Erro ao desconectar:`, error);
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
app.post('/send', async (req, res) => {
  const { company_id, message_id, phone, content, message_type = 'text' } = req.body;

  if (!phone || !content) {
    return res.status(400).json({ 
      success: false, 
      error: 'phone e content são obrigatórios' 
    });
  }

  try {
    // Se company_id não for fornecido, tentar encontrar sessão ativa
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

    logger.info(`[${targetCompanyId}] Enviando mensagem para ${phone}`);

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
    logger.error(`Erro ao enviar mensagem:`, error);
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
  
  if (!session) {
    return res.status(404).json({ 
      success: false, 
      error: 'Sessão não encontrada' 
    });
  }

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
 * Reinicia uma sessão específica
 */
app.post('/restart/:company_id', async (req, res) => {
  const { company_id } = req.params;

  try {
    logger.info(`[${company_id}] Reiniciando sessão...`);
    
    await sessionManager.restartSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Sessão reiniciada' 
    });
  } catch (error) {
    logger.error(`[${company_id}] Erro ao reiniciar:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /session/:company_id
 * Remove completamente uma sessão (incluindo arquivos)
 */
app.delete('/session/:company_id', async (req, res) => {
  const { company_id } = req.params;

  try {
    logger.info(`[${company_id}] Removendo sessão...`);
    
    await sessionManager.removeSession(company_id);
    
    res.json({ 
      success: true, 
      message: 'Sessão removida completamente' 
    });
  } catch (error) {
    logger.error(`[${company_id}] Erro ao remover:`, error);
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
  logger.info('=========================================');
  logger.info('🚀 SERVIDOR WHATSAPP - ESCALA CERTO PRO');
  logger.info('=========================================');
  logger.info(`📡 Porta: ${PORT}`);
  logger.info(`🔗 Webhook: ${WEBHOOK_URL || 'NÃO CONFIGURADO'}`);
  logger.info(`📁 Sessões: ${path.resolve(SESSIONS_DIR)}`);
  logger.info('=========================================');

  // Restaurar sessões existentes na inicialização
  await sessionManager.restoreAllSessions();
});

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

process.on('uncaughtException', (error) => {
  logger.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promise rejeitada não tratada:', reason);
});

process.on('SIGINT', async () => {
  logger.info('Encerrando servidor...');
  await sessionManager.disconnectAllSessions();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Recebido SIGTERM, encerrando...');
  await sessionManager.disconnectAllSessions();
  process.exit(0);
});
