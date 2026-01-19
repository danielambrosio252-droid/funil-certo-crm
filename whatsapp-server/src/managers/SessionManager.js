/**
 * =====================================================
 * GERENCIADOR DE SESSÕES WHATSAPP - VERSÃO DEFINITIVA
 * =====================================================
 * 
 * Responsável por criar, gerenciar e manter sessões
 * WhatsApp Web usando a biblioteca Baileys.
 * 
 * MUDANÇAS ESTRUTURAIS:
 * - Timeout automático para pendingConnections (30s)
 * - Limpeza garantida em TODOS os cenários
 * - Auto-cleanup após loggedOut
 * - Status explícito e determinístico
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
const { logger, baileysLogger } = require('../utils/logger');
const { normalizePhone, isLid, phoneToJid } = require('../utils/phoneNormalizer');

const RECONNECT_TIMEOUT = parseInt(process.env.RECONNECT_TIMEOUT) || 5000;
const MAX_RECONNECT_ATTEMPTS = parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10;
const QR_TIMEOUT_MS = 30000; // 30 segundos para gerar QR
const PENDING_MAX_AGE_MS = 60000; // 60 segundos máximo para pendingConnections

class SessionManager {
  constructor(sessionsDir, webhookService) {
    this.sessionsDir = sessionsDir;
    this.webhookService = webhookService;
    this.sessions = new Map(); // Map<companyId, socket>
    this.sessionMeta = new Map(); // Map<companyId, metadata>
    this.reconnectAttempts = new Map(); // Map<companyId, count>

    // Cache em memória do QR por empresa
    // Map<companyId, { qr: string; createdAt: Date }>
    this.qrStore = new Map();
    
    // Track sessions que estão sendo criadas (com timestamp)
    // Map<companyId, number> - timestamp em ms quando conexão foi requisitada
    this.pendingConnections = new Map();
    
    // Track de erros para cada empresa
    // Map<companyId, { reason: string; timestamp: Date }>
    this.errorStore = new Map();
  }

  /**
   * Limpa TODOS os estados de uma empresa (reset completo)
   */
  _cleanupCompanyState(companyId) {
    this.pendingConnections.delete(companyId);
    this.qrStore.delete(companyId);
    this.errorStore.delete(companyId);
    logger.info(`[${companyId}] 🧹 Estado limpo (pending, qr, error)`);
  }

  /**
   * Marca erro para uma empresa
   */
  _setError(companyId, reason) {
    this.errorStore.set(companyId, { reason, timestamp: new Date() });
    this._cleanupCompanyState(companyId);
    this.errorStore.set(companyId, { reason, timestamp: new Date() }); // Re-set após cleanup
    logger.warn(`[${companyId}] ❌ Erro registrado: ${reason}`);
  }

  /**
   * Cria uma nova sessão WhatsApp
   * GARANTIAS:
   * - Limpa estado anterior completamente
   * - Timeout automático de 30s para gerar QR
   * - Nunca fica em estado "pendente" eternamente
   */
  async createSession(companyId) {
    logger.info(`[${companyId}] 🚀 Iniciando createSession...`);
    
    // PASSO 1: Limpar TUDO antes de começar
    this._cleanupCompanyState(companyId);

    // Verificar se já existe sessão CONECTADA
    if (this.sessions.has(companyId)) {
      const existingSocket = this.sessions.get(companyId);
      if (existingSocket?.user) {
        logger.info(`[${companyId}] ✅ Sessão já existe e está conectada`);
        return { status: 'already_connected', phone_number: existingSocket.user.id?.split(':')[0] };
      }
      // Existe mas não está conectada - remover
      logger.info(`[${companyId}] 🗑️ Removendo sessão existente não conectada`);
      try {
        existingSocket?.end?.();
      } catch (e) {
        logger.warn(`[${companyId}] Erro ao encerrar socket existente:`, e.message);
      }
      this.sessions.delete(companyId);
      this.sessionMeta.delete(companyId);
    }

    // PASSO 2: Marcar como pendente COM timestamp
    const now = Date.now();
    this.pendingConnections.set(companyId, now);
    logger.info(`[${companyId}] ⏳ Marcado como pending: ${now}`);

    // PASSO 3: Configurar TIMEOUT automático (30s)
    // Se não gerar QR em 30s, limpa e marca como erro
    const qrTimeoutId = setTimeout(() => {
      const pendingTime = this.pendingConnections.get(companyId);
      const hasQr = this.qrStore.has(companyId);
      const socket = this.sessions.get(companyId);
      const isConnected = !!socket?.user;
      
      // Só dispara timeout se ainda está pendente, sem QR e não conectado
      if (pendingTime === now && !hasQr && !isConnected) {
        logger.error(`[${companyId}] ⏰ TIMEOUT: QR não gerado em ${QR_TIMEOUT_MS/1000}s`);
        this._setError(companyId, 'qr_timeout');
        
        // Notificar webhook
        this.webhookService.send(companyId, 'error', {
          reason: 'qr_timeout',
          message: 'QR Code não foi gerado no tempo esperado'
        }).catch(e => logger.error(`[${companyId}] Erro ao enviar webhook de timeout:`, e));
        
        // Limpar socket se existir
        if (socket && !isConnected) {
          try {
            socket.end?.();
          } catch (e) {
            logger.warn(`[${companyId}] Erro ao encerrar socket no timeout:`, e.message);
          }
          this.sessions.delete(companyId);
          this.sessionMeta.delete(companyId);
        }
      }
    }, QR_TIMEOUT_MS);

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

      // Criar socket com baileysLogger (compatível com trace/child/fatal)
      const socket = makeWASocket({
        version,
        logger: baileysLogger.child({ companyId }),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger.child({ companyId, module: 'keys' }))
        },
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
        reconnecting: false,
        qrTimeoutId // Guardar para poder cancelar
      });
      this.reconnectAttempts.set(companyId, 0);

      // Configurar eventos
      this._setupEventHandlers(companyId, socket, saveCreds, qrTimeoutId);

      return { status: 'connecting' };
    } catch (error) {
      // SEMPRE limpar em caso de erro
      clearTimeout(qrTimeoutId);
      this._setError(companyId, 'create_session_error');
      logger.error(`[${companyId}] 💥 Erro ao criar sessão:`, error);
      throw error;
    }
  }

  /**
   * Configura os handlers de eventos do socket
   */
  _setupEventHandlers(companyId, socket, saveCreds, qrTimeoutId) {
    // ========== EVENTO: connection.update ==========
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR Code recebido - SUCESSO parcial
      if (qr) {
        try {
          const qrImage = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 3,
            width: 256
          });

          // ✅ Cancelar timeout - QR foi gerado com sucesso
          if (qrTimeoutId) {
            clearTimeout(qrTimeoutId);
          }

          // ✅ Cache em memória (fonte de verdade para polling)
          this.qrStore.set(companyId, { qr: qrImage, createdAt: new Date() });
          
          // ✅ Limpar erro anterior se havia
          this.errorStore.delete(companyId);
          
          // ✅ Manter pendingConnections ATIVO (ainda aguardando scan)

          logger.info(`[${companyId}] 📱 QR Code gerado com sucesso`);

          // Webhook para atualizar o backend
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
          this._setError(companyId, 'qr_generation_error');
        }
      }

      // Conexão aberta - SUCESSO TOTAL
      if (connection === 'open') {
        const phoneNumber = socket.user?.id?.split(':')[0] || '';

        // ✅ Cancelar timeout
        if (qrTimeoutId) {
          clearTimeout(qrTimeoutId);
        }

        // ✅ Limpar estados temporários
        this.qrStore.delete(companyId);
        this.pendingConnections.delete(companyId);
        this.errorStore.delete(companyId);

        logger.info(`[${companyId}] ✅ CONECTADO: ${phoneNumber}`);

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

        // ✅ Cancelar timeout
        if (qrTimeoutId) {
          clearTimeout(qrTimeoutId);
        }

        // ✅ Limpar QR e pending
        this.qrStore.delete(companyId);
        this.pendingConnections.delete(companyId);

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
                this._setError(companyId, 'reconnect_failed');
              });
            }, RECONNECT_TIMEOUT);
          } else {
            logger.error(`[${companyId}] Máximo de tentativas de reconexão atingido`);
            this._setError(companyId, 'max_reconnect_attempts');

            await this.webhookService.send(companyId, 'disconnected', {
              reason: 'max_reconnect_attempts'
            });

            this.sessions.delete(companyId);
          }
        } else {
          // ========== LOGOUT - LIMPAR TUDO ==========
          logger.info(`[${companyId}] 🚪 LOGOUT: Limpando sessão completamente`);

          this._setError(companyId, 'logged_out');

          await this.webhookService.send(companyId, 'disconnected', {
            reason: 'logged_out'
          });

          this.sessions.delete(companyId);
          this.sessionMeta.delete(companyId);
          this.reconnectAttempts.delete(companyId);

          // ✅ CRÍTICO: Remover arquivos de sessão após logout
          // Isso permite que o usuário conecte um novo número
          try {
            await this._removeSessionFiles(companyId);
            logger.info(`[${companyId}] 🗑️ Arquivos de sessão removidos após logout`);
          } catch (e) {
            logger.error(`[${companyId}] Erro ao remover arquivos após logout:`, e);
          }
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

    // ========== EVENTO: presence.update (digitando...) ==========
    socket.ev.on('presence.update', async ({ id, presences }) => {
      try {
        const normalizedChatPhone = normalizePhone(id);
        
        for (const [participantJid, presence] of Object.entries(presences)) {
          const normalizedParticipantPhone = normalizePhone(participantJid);
          const isTyping = presence.lastKnownPresence === 'composing';
          const isRecording = presence.lastKnownPresence === 'recording';
          
          if ((isTyping || isRecording) && normalizedParticipantPhone) {
            await this.webhookService.send(companyId, 'presence_update', {
              phone: normalizedParticipantPhone,
              chat_jid: id,
              presence: presence.lastKnownPresence,
            });
          }
        }
      } catch (error) {
        logger.error(`[${companyId}] Erro ao processar presença:`, error);
      }
    });
  }

  /**
   * Processa mensagem recebida
   */
  async _processIncomingMessage(companyId, msg) {
    if (msg.key.fromMe) return;
    if (msg.key.remoteJid === 'status@broadcast') return;
    if (msg.key.remoteJid?.endsWith('@g.us')) return;

    const rawJid = msg.key.remoteJid || '';
    const normalizedPhone = normalizePhone(rawJid);
    
    if (!normalizedPhone && isLid(rawJid)) {
      logger.warn(`[${companyId}] ⚠️ Ignorando mensagem de LID sem número real: ${rawJid}`);
      return;
    }
    
    const phone = normalizedPhone || rawJid.replace(/@.*$/, '');
    const senderName = msg.pushName || '';
    
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
      raw_jid: rawJid,
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

    const jid = this._formatJid(phone);

    try {
      let result;

      if (messageType === 'text' || !messageType) {
        result = await socket.sendMessage(jid, { text: content });
      } else {
        result = await socket.sendMessage(jid, { text: content });
      }

      logger.info(`[${companyId}] 📤 Mensagem enviada para ${phone}: ${result.key.id}`);

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
    return phoneToJid(phone);
  }

  /**
   * Desconecta uma sessão
   */
  async disconnectSession(companyId) {
    // Limpar estados temporários
    this._cleanupCompanyState(companyId);
    
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
   * Reinicia uma sessão (mantém credenciais)
   */
  async restartSession(companyId) {
    logger.info(`[${companyId}] 🔄 Reiniciando sessão...`);
    
    // Limpar estados
    this._cleanupCompanyState(companyId);
    
    const socket = this.sessions.get(companyId);
    if (socket) {
      try {
        socket.end?.();
      } catch (e) {
        logger.warn(`[${companyId}] Erro ao encerrar socket:`, e.message);
      }
      this.sessions.delete(companyId);
    }
    
    this.sessionMeta.delete(companyId);
    
    // Aguardar um pouco antes de reconectar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return await this.createSession(companyId);
  }

  /**
   * Remove uma sessão completamente (incluindo arquivos)
   * Permite conectar um novo número
   */
  async removeSession(companyId) {
    logger.info(`[${companyId}] 🗑️ Removendo sessão completamente...`);
    
    // Limpar todos os estados
    this._cleanupCompanyState(companyId);
    
    const socket = this.sessions.get(companyId);
    if (socket) {
      try {
        socket.end?.();
      } catch (e) {
        logger.warn(`[${companyId}] Erro ao encerrar socket:`, e.message);
      }
    }
    
    this.sessions.delete(companyId);
    this.sessionMeta.delete(companyId);
    this.reconnectAttempts.delete(companyId);
    
    await this._removeSessionFiles(companyId);
    
    return { status: 'removed' };
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
        this._cleanupCompanyState(companyId);
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
   * Retorna o último QR Code cacheado para a empresa
   */
  getQrCode(companyId) {
    const entry = this.qrStore.get(companyId);
    return entry?.qr || null;
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
   * Retorna status DETERMINÍSTICO de uma sessão
   * NUNCA retorna WAITING infinito - sempre retorna status claro
   */
  getSessionStatus(companyId) {
    const socket = this.sessions.get(companyId);
    const meta = this.sessionMeta.get(companyId) || {};
    const pendingTime = this.pendingConnections.get(companyId);
    const error = this.errorStore.get(companyId);
    const qr = this.qrStore.get(companyId);
    
    // 1. CONNECTED - tem socket com user
    if (socket?.user) {
      return {
        status: 'connected',
        exists: true,
        connecting: false,
        connected: true,
        phoneNumber: socket.user.id?.split(':')[0] || meta.phoneNumber || null,
        reconnecting: false,
        createdAt: meta.createdAt || null,
        lastConnectedAt: meta.lastConnectedAt || null
      };
    }
    
    // 2. QR_READY - tem QR no cache
    if (qr) {
      return {
        status: 'qr',
        exists: true,
        connecting: false,
        connected: false,
        hasQr: true,
        phoneNumber: null,
        reconnecting: false,
        createdAt: meta.createdAt || null
      };
    }
    
    // 3. ERROR - teve erro registrado
    if (error) {
      // Limpar erro antigo (mais de 5 minutos)
      const errorAge = Date.now() - error.timestamp.getTime();
      if (errorAge > 300000) {
        this.errorStore.delete(companyId);
      } else {
        return {
          status: 'error',
          exists: false,
          connecting: false,
          connected: false,
          error_reason: error.reason,
          phoneNumber: null,
          reconnecting: false
        };
      }
    }
    
    // 4. CONNECTING - tem pending recente (menos de 60s)
    if (pendingTime) {
      const pendingAge = Date.now() - pendingTime;
      
      if (pendingAge < PENDING_MAX_AGE_MS) {
        return {
          status: 'connecting',
          exists: true,
          connecting: true,
          connected: false,
          pending_age_ms: pendingAge,
          phoneNumber: null,
          reconnecting: meta.reconnecting || false,
          createdAt: meta.createdAt || null
        };
      } else {
        // Pending expirou - limpar e retornar erro
        this.pendingConnections.delete(companyId);
        this._setError(companyId, 'connection_stale');
        return {
          status: 'error',
          exists: false,
          connecting: false,
          connected: false,
          error_reason: 'connection_stale',
          phoneNumber: null,
          reconnecting: false
        };
      }
    }
    
    // 5. DISCONNECTED - nenhum estado
    return {
      status: 'disconnected',
      exists: false,
      connecting: false,
      connected: false,
      phoneNumber: null,
      reconnecting: false
    };
  }

  /**
   * Retorna status de todas as sessões
   */
  getAllSessionsStatus() {
    const result = {};
    
    // Incluir todas as sessões conhecidas
    const allCompanyIds = new Set([
      ...this.sessions.keys(),
      ...this.pendingConnections.keys(),
      ...this.qrStore.keys(),
      ...this.errorStore.keys()
    ]);
    
    for (const companyId of allCompanyIds) {
      result[companyId] = this.getSessionStatus(companyId);
    }
    
    return result;
  }
}

module.exports = { SessionManager };
