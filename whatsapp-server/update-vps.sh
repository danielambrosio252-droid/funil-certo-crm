#!/bin/bash
#===============================================================================
# Script de Update Automático - WhatsApp Server
# Escala Certo Pro
#
# Uso: curl -sSL URL_DO_SCRIPT | bash
# Ou:  bash update-vps.sh [REPO_URL]
#===============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
INSTALL_DIR="/root/whatsapp-server"
BACKUP_DIR="/root/whatsapp-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPO_URL="${1:-}"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

#-------------------------------------------------------------------------------
# 1. Verificar pré-requisitos
#-------------------------------------------------------------------------------
log_step "1/6 - Verificando ambiente"

if [ ! -d "$INSTALL_DIR" ]; then
  log_error "Diretório $INSTALL_DIR não encontrado!"
  log_error "Execute primeiro o script de instalação (setup-vps-v3.sh)"
  exit 1
fi

if ! command -v pm2 &> /dev/null; then
  log_error "PM2 não instalado!"
  exit 1
fi

log_info "✓ Ambiente verificado"

#-------------------------------------------------------------------------------
# 2. Parar servidor para update seguro
#-------------------------------------------------------------------------------
log_step "2/6 - Parando servidor"

pm2 stop escala-whatsapp 2>/dev/null || log_warn "Servidor já estava parado"
log_info "✓ Servidor parado"

#-------------------------------------------------------------------------------
# 3. Backup das sessões
#-------------------------------------------------------------------------------
log_step "3/6 - Backup das sessões"

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/sessions_$TIMESTAMP.tar.gz"

if [ -d "$INSTALL_DIR/sessions" ] && [ "$(ls -A $INSTALL_DIR/sessions 2>/dev/null)" ]; then
  tar -czf "$BACKUP_FILE" -C "$INSTALL_DIR" sessions/
  log_info "✓ Sessões salvas em: $BACKUP_FILE"
  
  # Manter apenas os últimos 5 backups
  ls -t "$BACKUP_DIR"/sessions_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm
  log_info "✓ Backups antigos limpos (mantidos últimos 5)"
else
  log_warn "Nenhuma sessão para backup"
fi

# Backup do .env atual
if [ -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env" "$BACKUP_DIR/.env_$TIMESTAMP"
  log_info "✓ .env salvo"
fi

#-------------------------------------------------------------------------------
# 4. Atualizar código fonte
#-------------------------------------------------------------------------------
log_step "4/6 - Atualizando código fonte"

# Criar diretório temporário
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Método 1: Se tiver repositório Git configurado
if [ -n "$REPO_URL" ]; then
  log_info "Clonando de: $REPO_URL"
  git clone --depth 1 "$REPO_URL" repo
  
  # Copiar apenas src/
  rm -rf "$INSTALL_DIR/src"
  cp -r repo/whatsapp-server/src "$INSTALL_DIR/src"
  
  # Copiar package.json se mudou
  cp repo/whatsapp-server/package.json "$INSTALL_DIR/package.json"
  
  log_info "✓ Código atualizado via Git"

# Método 2: Atualizar via heredoc (código embutido)
else
  log_info "Atualizando código embutido..."
  
  # Recriar estrutura src/
  rm -rf "$INSTALL_DIR/src"
  mkdir -p "$INSTALL_DIR/src/utils"
  mkdir -p "$INSTALL_DIR/src/managers"
  mkdir -p "$INSTALL_DIR/src/services"
  
  #-----------------------------------------------------------------------------
  # src/utils/logger.js
  #-----------------------------------------------------------------------------
  cat > "$INSTALL_DIR/src/utils/logger.js" << 'LOGGER_EOF'
const pino = require('pino');

// Logger principal para a aplicação
const appLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

// Logger específico para Baileys (FLAT - sem child)
const baileysLogger = {
  level: 'silent',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: (msg) => appLogger.warn({ baileys: true }, msg),
  error: (msg) => appLogger.error({ baileys: true }, msg),
  fatal: (msg) => appLogger.fatal({ baileys: true }, msg),
  child: () => baileysLogger
};

module.exports = { appLogger, baileysLogger };
LOGGER_EOF

  #-----------------------------------------------------------------------------
  # src/utils/phoneNormalizer.js
  #-----------------------------------------------------------------------------
  cat > "$INSTALL_DIR/src/utils/phoneNormalizer.js" << 'PHONE_EOF'
function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.endsWith('@s.whatsapp.net')) {
    cleaned = cleaned.replace('@s.whatsapp.net', '');
  }
  if (cleaned.startsWith('55') && cleaned.length === 13) {
    const ddd = cleaned.substring(2, 4);
    const dddNum = parseInt(ddd, 10);
    if (dddNum >= 11 && dddNum <= 28) {
      cleaned = cleaned.substring(0, 4) + cleaned.substring(5);
    }
  }
  if (!cleaned.startsWith('55') && cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

module.exports = { normalizePhone };
PHONE_EOF

  #-----------------------------------------------------------------------------
  # src/services/WebhookService.js
  #-----------------------------------------------------------------------------
  cat > "$INSTALL_DIR/src/services/WebhookService.js" << 'WEBHOOK_EOF'
const { appLogger } = require('../utils/logger');

class WebhookService {
  constructor(webhookUrl, webhookSecret) {
    this.webhookUrl = webhookUrl;
    this.webhookSecret = webhookSecret;
  }

  async send(event, data) {
    if (!this.webhookUrl) {
      appLogger.warn('Webhook URL não configurada');
      return false;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': this.webhookSecret || ''
        },
        body: JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      appLogger.info(`Webhook enviado: ${event}`);
      return true;
    } catch (error) {
      appLogger.error(`Erro webhook ${event}:`, error.message);
      return false;
    }
  }
}

module.exports = WebhookService;
WEBHOOK_EOF

  #-----------------------------------------------------------------------------
  # src/managers/SessionManager.js
  #-----------------------------------------------------------------------------
  cat > "$INSTALL_DIR/src/managers/SessionManager.js" << 'SESSION_EOF'
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { appLogger, baileysLogger } = require('../utils/logger');
const { normalizePhone } = require('../utils/phoneNormalizer');

class SessionManager {
  constructor(sessionsDir, webhookService) {
    this.sessionsDir = sessionsDir;
    this.webhookService = webhookService;
    this.sessions = new Map();
    this.qrCodes = new Map();
    this.sessionStatus = new Map();
    this.sessionMeta = new Map();
    this.pendingConnections = new Map();
    this.errorStore = new Map();
  }

  async createSession(companyId, forceNew = false) {
    appLogger.info(`[${companyId}] Criando sessão (forceNew: ${forceNew})`);

    if (this.sessions.has(companyId) && !forceNew) {
      const status = this.sessionStatus.get(companyId);
      if (status === 'connected') {
        return { success: true, status: 'already_connected' };
      }
    }

    if (forceNew && this.sessions.has(companyId)) {
      await this.disconnectSession(companyId);
    }

    const sessionDir = path.join(this.sessionsDir, companyId);
    
    if (forceNew && fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      appLogger.info(`[${companyId}] Sessão anterior removida`);
    }

    fs.mkdirSync(sessionDir, { recursive: true });

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      const socket = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger)
        },
        printQRInTerminal: false,
        logger: baileysLogger,
        browser: ['Escala Certo Pro', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        emitOwnEvents: true,
        markOnlineOnConnect: true
      });

      this.sessions.set(companyId, socket);
      this.sessionStatus.set(companyId, 'connecting');
      this.sessionMeta.set(companyId, {
        createdAt: new Date(),
        lastQrCode: null,
        phoneNumber: null
      });

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, { width: 256 });
            this.qrCodes.set(companyId, qrDataUrl);
            this.sessionStatus.set(companyId, 'waiting_qr');
            this.pendingConnections.set(companyId, true);

            await this.webhookService.send('qr_code', { company_id: companyId, qr_code: qrDataUrl });
            appLogger.info(`[${companyId}] QR Code gerado`);

            const meta = this.sessionMeta.get(companyId);
            if (meta) {
              meta.lastQrCode = new Date();
            }
          } catch (error) {
            appLogger.error(`[${companyId}] Erro ao gerar QR Code:`, error);
            this._setError(companyId, 'qr_generation_error');
          }
        }

        if (connection === 'open') {
          const phoneNumber = socket.user?.id?.split(':')[0] || socket.user?.id?.split('@')[0] || 'unknown';
          this.sessionStatus.set(companyId, 'connected');
          this.qrCodes.delete(companyId);
          this.pendingConnections.delete(companyId);
          this.errorStore.delete(companyId);

          appLogger.info(`[${companyId}] ✅ CONECTADO: ${phoneNumber}`);

          const meta = this.sessionMeta.get(companyId);
          if (meta) {
            meta.phoneNumber = phoneNumber;
          }

          await this.webhookService.send('connected', {
            company_id: companyId,
            phone_number: phoneNumber
          });
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 500;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          appLogger.warn(`[${companyId}] Desconectado (código: ${statusCode})`);
          this.sessionStatus.set(companyId, 'disconnected');

          if (statusCode === DisconnectReason.loggedOut) {
            this.sessions.delete(companyId);
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            }
            await this.webhookService.send('logged_out', { company_id: companyId });
          } else if (shouldReconnect) {
            appLogger.info(`[${companyId}] Tentando reconexão...`);
            setTimeout(() => this.createSession(companyId, false), 5000);
          }
        }
      });

      socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (msg.key.fromMe) continue;

          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || remoteJid === 'status@broadcast') continue;

          const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
          const normalizedPhone = normalizePhone(phone);
          const content = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || 
                         '[mídia]';

          await this.webhookService.send('message_received', {
            company_id: companyId,
            message_id: msg.key.id,
            phone: phone,
            normalized_phone: normalizedPhone,
            content: content,
            push_name: msg.pushName || null,
            timestamp: msg.messageTimestamp,
            is_group: remoteJid.includes('@g.us')
          });
        }
      });

      return { success: true, status: 'connecting' };
    } catch (error) {
      appLogger.error(`[${companyId}] Erro ao criar sessão:`, error);
      this._setError(companyId, error.message);
      return { success: false, error: error.message };
    }
  }

  _setError(companyId, error) {
    this.sessionStatus.set(companyId, 'error');
    this.errorStore.set(companyId, error);
  }

  async disconnectSession(companyId) {
    const socket = this.sessions.get(companyId);
    if (socket) {
      try {
        await socket.logout();
      } catch (e) {
        appLogger.warn(`[${companyId}] Erro ao fazer logout:`, e.message);
      }
      try {
        socket.end();
      } catch (e) {}
      this.sessions.delete(companyId);
    }
    this.qrCodes.delete(companyId);
    this.sessionStatus.set(companyId, 'disconnected');
    this.pendingConnections.delete(companyId);
    return { success: true };
  }

  async sendMessage(companyId, phone, message) {
    const socket = this.sessions.get(companyId);
    if (!socket) {
      return { success: false, error: 'Sessão não encontrada' };
    }

    const status = this.sessionStatus.get(companyId);
    if (status !== 'connected') {
      return { success: false, error: `Sessão não conectada (status: ${status})` };
    }

    try {
      const normalizedPhone = normalizePhone(phone);
      const jid = `${normalizedPhone}@s.whatsapp.net`;

      const result = await socket.sendMessage(jid, { text: message });

      appLogger.info(`[${companyId}] Mensagem enviada para ${normalizedPhone}`);

      return {
        success: true,
        message_id: result.key.id,
        phone: normalizedPhone
      };
    } catch (error) {
      appLogger.error(`[${companyId}] Erro ao enviar mensagem:`, error);
      return { success: false, error: error.message };
    }
  }

  getStatus(companyId) {
    if (!companyId) {
      const allStatus = {};
      for (const [id, status] of this.sessionStatus) {
        allStatus[id] = {
          status,
          hasQr: this.qrCodes.has(id),
          meta: this.sessionMeta.get(id) || null,
          error: this.errorStore.get(id) || null
        };
      }
      return allStatus;
    }

    return {
      status: this.sessionStatus.get(companyId) || 'not_found',
      qr_code: this.qrCodes.get(companyId) || null,
      meta: this.sessionMeta.get(companyId) || null,
      error: this.errorStore.get(companyId) || null
    };
  }

  async restoreAllSessions() {
    if (!fs.existsSync(this.sessionsDir)) {
      appLogger.info('Nenhuma sessão para restaurar');
      return;
    }

    const dirs = fs.readdirSync(this.sessionsDir).filter(f => {
      return fs.statSync(path.join(this.sessionsDir, f)).isDirectory();
    });

    appLogger.info(`Restaurando ${dirs.length} sessões...`);

    for (const companyId of dirs) {
      try {
        await this.createSession(companyId, false);
        appLogger.info(`[${companyId}] Sessão restaurada`);
      } catch (error) {
        appLogger.error(`[${companyId}] Erro ao restaurar:`, error);
      }
    }
  }
}

module.exports = SessionManager;
SESSION_EOF

  #-----------------------------------------------------------------------------
  # src/index.js
  #-----------------------------------------------------------------------------
  cat > "$INSTALL_DIR/src/index.js" << 'INDEX_EOF'
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { appLogger, baileysLogger } = require('./utils/logger');
const WebhookService = require('./services/WebhookService');
const SessionManager = require('./managers/SessionManager');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.SERVER_SECRET;
const SERVER_SECRET = process.env.WHATSAPP_SERVER_SECRET || process.env.SERVER_SECRET;
const SESSIONS_DIR = process.env.SESSIONS_DIR || process.env.SESSION_DIR || './sessions';
const SERVER_VERSION = '2.1.0';

// Garantir diretórios
[SESSIONS_DIR, './logs'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const webhookService = new WebhookService(WEBHOOK_URL, WEBHOOK_SECRET);
const sessionManager = new SessionManager(SESSIONS_DIR, webhookService);

// Middleware de log
app.use((req, res, next) => {
  appLogger.info(`${req.method} ${req.path}`);
  next();
});

// Middleware de autenticação (opcional)
const validateToken = (req, res, next) => {
  if (!SERVER_SECRET) return next();
  const token = req.headers['x-server-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (token !== SERVER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: SERVER_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Diagnóstico completo
app.get('/diagnostics', validateToken, (req, res) => {
  res.json({
    server: {
      version: SERVER_VERSION,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node: process.version
    },
    config: {
      port: PORT,
      webhookConfigured: !!WEBHOOK_URL,
      authEnabled: !!SERVER_SECRET,
      sessionsDir: SESSIONS_DIR
    },
    sessions: sessionManager.getStatus()
  });
});

// Conectar WhatsApp
app.post('/connect', validateToken, async (req, res) => {
  const { company_id, force_new } = req.body;
  
  if (!company_id) {
    return res.status(400).json({ error: 'company_id é obrigatório' });
  }

  const result = await sessionManager.createSession(company_id, force_new === true);
  res.json(result);
});

// Obter QR Code / Status
app.get('/api/whatsapp/qr', validateToken, (req, res) => {
  const { company_id } = req.query;
  
  if (!company_id) {
    return res.status(400).json({ error: 'company_id é obrigatório' });
  }

  const status = sessionManager.getStatus(company_id);
  
  if (status.status === 'not_found') {
    return res.json({ status: 'DISCONNECTED', message: 'Sessão não iniciada' });
  }
  
  if (status.status === 'connecting') {
    return res.json({ status: 'CONNECTING', message: 'Aguardando QR Code...' });
  }
  
  if (status.status === 'waiting_qr' && status.qr_code) {
    return res.json({ status: 'QR', qr_code: status.qr_code });
  }
  
  if (status.status === 'connected') {
    return res.json({ 
      status: 'CONNECTED', 
      phone_number: status.meta?.phoneNumber 
    });
  }
  
  if (status.status === 'error') {
    return res.json({ status: 'ERROR', error: status.error });
  }
  
  res.json({ status: status.status.toUpperCase() });
});

// Desconectar
app.post('/disconnect', validateToken, async (req, res) => {
  const { company_id } = req.body;
  
  if (!company_id) {
    return res.status(400).json({ error: 'company_id é obrigatório' });
  }

  const result = await sessionManager.disconnectSession(company_id);
  res.json(result);
});

// Enviar mensagem
app.post('/send', validateToken, async (req, res) => {
  const { company_id, phone, message } = req.body;
  
  if (!company_id || !phone || !message) {
    return res.status(400).json({ error: 'company_id, phone e message são obrigatórios' });
  }

  const result = await sessionManager.sendMessage(company_id, phone, message);
  res.json(result);
});

// Status de todas as sessões
app.get('/status', validateToken, (req, res) => {
  res.json(sessionManager.getStatus());
});

// Status de uma sessão específica
app.get('/status/:company_id', validateToken, (req, res) => {
  const status = sessionManager.getStatus(req.params.company_id);
  res.json(status);
});

// Restart de uma sessão
app.post('/restart/:company_id', validateToken, async (req, res) => {
  const { company_id } = req.params;
  await sessionManager.disconnectSession(company_id);
  const result = await sessionManager.createSession(company_id, false);
  res.json(result);
});

// Deletar sessão completamente
app.delete('/session/:company_id', validateToken, async (req, res) => {
  const { company_id } = req.params;
  await sessionManager.disconnectSession(company_id);
  
  const sessionDir = path.join(SESSIONS_DIR, company_id);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
  
  res.json({ success: true, message: 'Sessão removida completamente' });
});

// Iniciar servidor
app.listen(PORT, () => {
  appLogger.info(`===========================================`);
  appLogger.info(`WhatsApp Server v${SERVER_VERSION}`);
  appLogger.info(`Porta: ${PORT}`);
  appLogger.info(`Webhook: ${WEBHOOK_URL || 'NÃO CONFIGURADO'}`);
  appLogger.info(`Auth: ${SERVER_SECRET ? 'ATIVADO' : 'DESATIVADO'}`);
  appLogger.info(`===========================================`);
  
  sessionManager.restoreAllSessions();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  appLogger.info('Encerrando servidor...');
  for (const [companyId] of sessionManager.sessions) {
    await sessionManager.disconnectSession(companyId);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  appLogger.info('Encerrando servidor...');
  for (const [companyId] of sessionManager.sessions) {
    await sessionManager.disconnectSession(companyId);
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  appLogger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  appLogger.error('Unhandled Rejection:', reason);
});
INDEX_EOF

  log_info "✓ Código atualizado via heredoc"
fi

# Limpar temp
rm -rf "$TEMP_DIR"

#-------------------------------------------------------------------------------
# 5. Instalar dependências
#-------------------------------------------------------------------------------
log_step "5/6 - Instalando dependências"

cd "$INSTALL_DIR"

# Usar npm ci para instalação limpa (mais rápido e determinístico)
if [ -f "package-lock.json" ]; then
  npm ci --production 2>/dev/null || npm install --production
else
  npm install --production
fi

log_info "✓ Dependências instaladas"

#-------------------------------------------------------------------------------
# 6. Reiniciar servidor
#-------------------------------------------------------------------------------
log_step "6/6 - Reiniciando servidor"

pm2 restart escala-whatsapp || pm2 start ecosystem.config.js --env production

# Aguardar inicialização
sleep 3

# Verificar status
pm2 status escala-whatsapp

log_info ""
log_info "=========================================="
log_info "     ✅ UPDATE CONCLUÍDO COM SUCESSO"
log_info "=========================================="
log_info ""
log_info "Versão: $(grep SERVER_VERSION $INSTALL_DIR/src/index.js | head -1)"
log_info "Backup: $BACKUP_FILE"
log_info ""
log_info "Comandos úteis:"
log_info "  pm2 logs escala-whatsapp --lines 50"
log_info "  curl http://localhost:3001/health"
log_info "  curl http://localhost:3001/diagnostics"
log_info ""

# Mostrar logs recentes
pm2 logs escala-whatsapp --lines 20 --nostream
