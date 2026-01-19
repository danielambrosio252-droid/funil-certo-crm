/**
 * =====================================================
 * UTILITÁRIO DE LOGS - COMPATÍVEL COM BAILEYS
 * =====================================================
 * 
 * Dois loggers distintos:
 * - appLogger: usado pelo servidor (info, warn, error, debug)
 * - baileysLogger: usado APENAS pelo Baileys (trace, child, fatal)
 * 
 * REQUISITOS OBRIGATÓRIOS do baileysLogger:
 * - trace(), child(), fatal() devem existir
 * - child() DEVE retornar ele mesmo (flat)
 * - NÃO depende de contexto (companyId, etc)
 * - NÃO usa pino-pretty
 */

const pino = require('pino');

let baseLogger;
try {
  baseLogger = pino({ level: process.env.LOG_LEVEL || 'info' });
} catch {
  baseLogger = console;
}

// Logger para o app/servidor
const appLogger = {
  info: (...a) => baseLogger.info?.(...a) ?? console.log(...a),
  warn: (...a) => baseLogger.warn?.(...a) ?? console.warn(...a),
  error: (...a) => baseLogger.error?.(...a) ?? console.error(...a),
  debug: (...a) => baseLogger.debug?.(...a) ?? console.debug(...a),
};

// Logger para Baileys - FLAT, sem child dinâmico
const baileysLogger = {
  level: 'silent',
  info: () => {},
  debug: () => {},
  trace: () => {},
  warn: (...a) => appLogger.warn(...a),
  error: (...a) => appLogger.error(...a),
  fatal: (...a) => appLogger.error(...a),
  child: () => baileysLogger,
};

module.exports = { appLogger, baileysLogger };
