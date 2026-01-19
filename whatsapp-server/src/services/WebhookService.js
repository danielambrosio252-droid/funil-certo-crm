/**
 * =====================================================
 * SERVIÇO DE WEBHOOK
 * =====================================================
 * 
 * Responsável por enviar eventos para o Escala Certo Pro
 * via webhook HTTP.
 */

const { appLogger } = require('../utils/logger');

class WebhookService {
  constructor(webhookUrl, webhookSecret = null) {
    this.webhookUrl = webhookUrl;
    this.webhookSecret = webhookSecret;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  /**
   * Envia um evento para o webhook
   */
  async send(companyId, eventType, data) {
    if (!this.webhookUrl) {
      appLogger.warn(`[${companyId}] Webhook URL não configurado, evento ignorado: ${eventType}`);
      return false;
    }

    const payload = {
      type: eventType,
      company_id: companyId,
      data,
      timestamp: new Date().toISOString()
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const headers = {
          'Content-Type': 'application/json'
        };

        // Adicionar secret se configurado
        if (this.webhookSecret) {
          headers['X-Webhook-Secret'] = this.webhookSecret;
        }

        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000) // 10s timeout
        });

        if (response.ok) {
          appLogger.debug(`[${companyId}] Webhook enviado: ${eventType}`);
          return true;
        }

        const errorText = await response.text();
        appLogger.warn(`[${companyId}] Webhook falhou (${response.status}): ${errorText}`);

        if (response.status >= 400 && response.status < 500) {
          // Erro do cliente, não tentar novamente
          return false;
        }
      } catch (error) {
        appLogger.error(`[${companyId}] Erro no webhook (tentativa ${attempt}):`, error.message);
      }

      // Aguardar antes de tentar novamente
      if (attempt < this.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }

    appLogger.error(`[${companyId}] Webhook falhou após ${this.retryAttempts} tentativas: ${eventType}`);
    return false;
  }

  /**
   * Verifica se o webhook está acessível
   */
  async healthCheck() {
    if (!this.webhookUrl) {
      return { status: 'not_configured' };
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'OPTIONS',
        signal: AbortSignal.timeout(5000)
      });

      return {
        status: 'ok',
        statusCode: response.status
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = { WebhookService };
