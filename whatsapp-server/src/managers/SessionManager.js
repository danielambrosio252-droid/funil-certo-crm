/**
 * =====================================================
 * GERENCIADOR DE SESSÕES WHATSAPP
 * =====================================================
 * 
 * Responsável por criar, gerenciar e manter sessões
 * WhatsApp Web usando a biblioteca Baileys.
 */

const { 
  makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

const RECONNECT_TIMEOUT = parseInt(process.env.RECONNECT_TIMEOUT) || 5000;
const MAX_RECONNECT_ATTEMPTS = parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10;

class SessionManager {
  constructor(sessionsDir, webhookService) {
    this.sessionsDir = sessionsDir;
    this.webhookService = webhookService;
    this.sessions = new Map(); // Map<companyId, socket>
    this.sessionMeta = new Map(); // Map<companyId, metadata>
    this.reconnectAttempts = new Map(); // Map<companyId, count>
  }

  /**
   * Cria uma nova sessão WhatsApp
   */
  async createSession(companyId) {
    // Verificar se já existe sessão ativa
    if (this.sessions.has(companyId)) {
      const existingSocket = this.sessions.get(companyId);
      if (existingSocket?.user) {
        logger.info(`[${companyId}] Sessão já existe e está conectada`);
        return { status: 'already_connected' };
      }
      // Se existe mas não está conectada, remover e recriar
      this.sessions.delete(companyId);
    }

    const sessionPath = path.join(this.sessionsDir, companyId);
    
    // Criar diretório da sessão se não existir
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    try {
      // Carregar estado de autenticação
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      
      // Buscar versão mais recente do Baileys
      const { version } = await fetchLatestBaileysVersion();

      // Criar socket
      const socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        printQRInTerminal: true,
        browser: ['Escala Certo Pro', 'Chrome', '120.0.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        emitOwnEvents: true,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined
      });

      // Armazenar socket e metadata
      this.sessions.set(companyId, socket);
      this.sessionMeta.set(companyId, {
        createdAt: new Date(),
        connected: false,
        phoneNumber: null,
        reconnecting: false
      });
      this.reconnectAttempts.set(companyId, 0);

      // Configurar eventos
      this._setupEventHandlers(companyId, socket, saveCreds);

      return { status: 'connecting' };
    } catch (error) {
      logger.error(`[${companyId}] Erro ao criar sessão:`, error);
      throw error;
    }
  }

  /**
   * Configura os handlers de eventos do socket
   */
  _setupEventHandlers(companyId, socket, saveCreds) {
    // ========== EVENTO: connection.update ==========
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR Code recebido
      if (qr) {
        try {
          const qrImage = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 3,
            width: 256
          });

          logger.info(`[${companyId}] 📱 QR Code gerado`);
          
          await this.webhookService.send(companyId, 'qr_code', {
            qr_code: qrImage
          });

          // Atualizar metadata
          const meta = this.sessionMeta.get(companyId);
          if (meta) {
            meta.lastQrCode = new Date();
          }
        } catch (error) {
          logger.error(`[${companyId}] Erro ao gerar QR Code:`, error);
        }
      }

      // Conexão aberta
      if (connection === 'open') {
        const phoneNumber = socket.user?.id?.split(':')[0] || '';
        
        logger.info(`[${companyId}] ✅ Conectado: ${phoneNumber}`);
        
        // Atualizar metadata
        const meta = this.sessionMeta.get(companyId);
        if (meta) {
          meta.connected = true;
          meta.phoneNumber = phoneNumber;
          meta.lastConnectedAt = new Date();
          meta.reconnecting = false;
        }
        
        // Resetar tentativas de reconexão
        this.reconnectAttempts.set(companyId, 0);

        await this.webhookService.send(companyId, 'connected', {
          phone_number: phoneNumber
        });
      }

      // Conexão fechada
      if (connection === 'close') {
        const meta = this.sessionMeta.get(companyId);
        if (meta) {
          meta.connected = false;
        }

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = DisconnectReason[statusCode] || statusCode;
        
        logger.warn(`[${companyId}] ❌ Desconectado: ${reason} (${statusCode})`);

        // Verificar se deve reconectar
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          const attempts = this.reconnectAttempts.get(companyId) || 0;
          
          if (attempts < MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts.set(companyId, attempts + 1);
            
            if (meta) {
              meta.reconnecting = true;
            }
            
            logger.info(`[${companyId}] 🔄 Reconectando... (tentativa ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
            
            // Limpar sessão atual
            this.sessions.delete(companyId);
            
            // Reconectar após delay
            setTimeout(() => {
              this.createSession(companyId).catch(err => {
                logger.error(`[${companyId}] Erro na reconexão:`, err);
              });
            }, RECONNECT_TIMEOUT);
          } else {
            logger.error(`[${companyId}] Máximo de tentativas de reconexão atingido`);
            
            await this.webhookService.send(companyId, 'disconnected', {
              reason: 'max_reconnect_attempts'
            });
            
            this.sessions.delete(companyId);
          }
        } else {
          // Logout - limpar sessão completamente
          logger.info(`[${companyId}] 🚪 Logout realizado`);
          
          await this.webhookService.send(companyId, 'disconnected', {
            reason: 'logged_out'
          });
          
          this.sessions.delete(companyId);
          this.sessionMeta.delete(companyId);
          
          // Opcional: remover arquivos de sessão após logout
          // await this._removeSessionFiles(companyId);
        }
      }
    });

    // ========== EVENTO: creds.update ==========
    socket.ev.on('creds.update', saveCreds);

    // ========== EVENTO: messages.upsert ==========
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          await this._processIncomingMessage(companyId, msg);
        } catch (error) {
          logger.error(`[${companyId}] Erro ao processar mensagem:`, error);
        }
      }
    });

    // ========== EVENTO: messages.update ==========
    socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        try {
          await this._processMessageUpdate(companyId, update);
        } catch (error) {
          logger.error(`[${companyId}] Erro ao processar atualização:`, error);
        }
      }
    });
  }

  /**
   * Processa mensagem recebida
   */
  async _processIncomingMessage(companyId, msg) {
    // Ignorar mensagens enviadas por mim
    if (msg.key.fromMe) return;
    
    // Ignorar status/stories
    if (msg.key.remoteJid === 'status@broadcast') return;
    
    // Ignorar mensagens de grupo por enquanto
    if (msg.key.remoteJid?.endsWith('@g.us')) return;

    const phone = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || '';
    const senderName = msg.pushName || '';
    
    // Extrair conteúdo da mensagem
    let content = '';
    let messageType = 'text';
    let mediaUrl = undefined;

    if (msg.message?.conversation) {
      content = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
      content = msg.message.extendedTextMessage.text;
    } else if (msg.message?.imageMessage) {
      content = msg.message.imageMessage.caption || '[Imagem]';
      messageType = 'image';
    } else if (msg.message?.videoMessage) {
      content = msg.message.videoMessage.caption || '[Vídeo]';
      messageType = 'video';
    } else if (msg.message?.audioMessage) {
      content = '[Áudio]';
      messageType = 'audio';
    } else if (msg.message?.documentMessage) {
      content = msg.message.documentMessage.fileName || '[Documento]';
      messageType = 'document';
    } else if (msg.message?.stickerMessage) {
      content = '[Sticker]';
      messageType = 'sticker';
    } else if (msg.message?.locationMessage) {
      content = '[Localização]';
      messageType = 'location';
    } else if (msg.message?.contactMessage) {
      content = msg.message.contactMessage.displayName || '[Contato]';
      messageType = 'contact';
    } else {
      content = '[Mensagem não suportada]';
    }

    logger.info(`[${companyId}] 📩 Mensagem de ${phone}: ${content.substring(0, 50)}...`);

    await this.webhookService.send(companyId, 'message_received', {
      message_id: msg.key.id,
      from: phone,
      content,
      sender_name: senderName,
      message_type: messageType,
      media_url: mediaUrl,
      timestamp: msg.messageTimestamp
    });
  }

  /**
   * Processa atualização de status de mensagem
   */
  async _processMessageUpdate(companyId, update) {
    if (!update.update.status) return;

    const statusMap = {
      1: 'pending',
      2: 'sent',
      3: 'delivered',
      4: 'read'
    };

    const status = statusMap[update.update.status];
    if (!status) return;

    logger.info(`[${companyId}] 📊 Status atualizado: ${update.key.id} -> ${status}`);

    await this.webhookService.send(companyId, 'message_status', {
      message_id: update.key.id,
      status
    });
  }

  /**
   * Envia mensagem de texto
   */
  async sendMessage(companyId, phone, content, messageType, localMessageId) {
    const socket = this.sessions.get(companyId);
    
    if (!socket) {
      throw new Error('Sessão não encontrada');
    }

    if (!socket.user) {
      throw new Error('WhatsApp não conectado');
    }

    // Formatar número
    const jid = this._formatJid(phone);

    try {
      let result;

      if (messageType === 'text' || !messageType) {
        result = await socket.sendMessage(jid, { text: content });
      } else {
        // Por enquanto, só suportamos texto
        result = await socket.sendMessage(jid, { text: content });
      }

      logger.info(`[${companyId}] 📤 Mensagem enviada para ${phone}: ${result.key.id}`);

      // Notificar webhook sobre mensagem enviada
      if (localMessageId) {
        await this.webhookService.send(companyId, 'message_sent', {
          local_id: localMessageId,
          message_id: result.key.id
        });
      }

      return {
        messageId: localMessageId,
        whatsappMessageId: result.key.id
      };
    } catch (error) {
      logger.error(`[${companyId}] Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  /**
   * Formata número de telefone para JID do WhatsApp
   */
  _formatJid(phone) {
    // Remover caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '');
    
    // Se não tiver código do país, adicionar Brasil (55)
    if (cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }
    
    return `${cleaned}@s.whatsapp.net`;
  }

  /**
   * Desconecta uma sessão
   */
  async disconnectSession(companyId) {
    const socket = this.sessions.get(companyId);
    
    if (socket) {
      try {
        await socket.logout();
      } catch (error) {
        logger.warn(`[${companyId}] Erro ao fazer logout:`, error);
      }
      
      this.sessions.delete(companyId);
    }

    const meta = this.sessionMeta.get(companyId);
    if (meta) {
      meta.connected = false;
    }
  }

  /**
   * Reinicia uma sessão
   */
  async restartSession(companyId) {
    await this.disconnectSession(companyId);
    
    // Aguardar um pouco antes de reconectar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return await this.createSession(companyId);
  }

  /**
   * Remove uma sessão completamente (incluindo arquivos)
   */
  async removeSession(companyId) {
    await this.disconnectSession(companyId);
    
    this.sessionMeta.delete(companyId);
    this.reconnectAttempts.delete(companyId);
    
    await this._removeSessionFiles(companyId);
  }

  /**
   * Remove arquivos de sessão do disco
   */
  async _removeSessionFiles(companyId) {
    const sessionPath = path.join(this.sessionsDir, companyId);
    
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      logger.info(`[${companyId}] Arquivos de sessão removidos`);
    }
  }

  /**
   * Restaura todas as sessões existentes na inicialização
   */
  async restoreAllSessions() {
    if (!fs.existsSync(this.sessionsDir)) return;

    const sessionDirs = fs.readdirSync(this.sessionsDir);
    
    logger.info(`Restaurando ${sessionDirs.length} sessão(ões)...`);

    for (const companyId of sessionDirs) {
      const sessionPath = path.join(this.sessionsDir, companyId);
      
      if (fs.statSync(sessionPath).isDirectory()) {
        // Verificar se tem arquivos de credenciais
        const credsFile = path.join(sessionPath, 'creds.json');
        
        if (fs.existsSync(credsFile)) {
          try {
            logger.info(`[${companyId}] Restaurando sessão...`);
            await this.createSession(companyId);
          } catch (error) {
            logger.error(`[${companyId}] Erro ao restaurar:`, error);
          }
        }
      }
    }
  }

  /**
   * Desconecta todas as sessões (usado no shutdown)
   */
  async disconnectAllSessions() {
    const companyIds = Array.from(this.sessions.keys());
    
    for (const companyId of companyIds) {
      try {
        const socket = this.sessions.get(companyId);
        if (socket) {
          socket.end();
        }
        this.sessions.delete(companyId);
      } catch (error) {
        logger.warn(`[${companyId}] Erro ao desconectar:`, error);
      }
    }
  }

  /**
   * Retorna lista de company_ids com sessões ativas
   */
  getActiveSessions() {
    const active = [];
    
    for (const [companyId, socket] of this.sessions.entries()) {
      if (socket?.user) {
        active.push(companyId);
      }
    }
    
    return active;
  }

  /**
   * Retorna status de uma sessão específica
   */
  getSessionStatus(companyId) {
    const socket = this.sessions.get(companyId);
    const meta = this.sessionMeta.get(companyId) || {};
    
    return {
      exists: this.sessions.has(companyId),
      connected: !!socket?.user,
      phoneNumber: socket?.user?.id?.split(':')[0] || meta.phoneNumber || null,
      reconnecting: meta.reconnecting || false,
      createdAt: meta.createdAt || null,
      lastConnectedAt: meta.lastConnectedAt || null
    };
  }

  /**
   * Retorna status de todas as sessões
   */
  getAllSessionsStatus() {
    const result = {};
    
    for (const companyId of this.sessions.keys()) {
      result[companyId] = this.getSessionStatus(companyId);
    }
    
    return result;
  }
}

module.exports = { SessionManager };
