export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

type Primitive = string | number | boolean | null | undefined;

type LogPayload = Primitive | Record<string, unknown> | Array<unknown> | object;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const DEFAULT_MASK = '[REDACTED]';

const DEFAULT_SENSITIVE_KEYS = ['api', 'token', 'secret', 'key', 'password'];

const shouldMask = (key?: string, value?: unknown): boolean => {
  if (!value) return false;
  if (typeof value !== 'string') return false;

  const lowerKey = key?.toLowerCase() ?? '';
  if (lowerKey && DEFAULT_SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
    return true;
  }

  // mask long hex/base64-ish strings
  if (value.length >= 12 && /[A-Za-z0-9+/=-]{12,}/.test(value)) {
    return true;
  }

  return false;
};

const maskValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return `${value.slice(0, 4)}${DEFAULT_MASK}`;
  }
  return DEFAULT_MASK;
};

const maskObject = (payload: unknown): unknown => {
  if (Array.isArray(payload)) {
    return payload.map(item => maskObject(item));
  }

  if (payload && typeof payload === 'object') {
    const maskedEntries = Object.entries(payload as Record<string, unknown>).map(([key, value]) => {
      if (shouldMask(key, value)) {
        return [key, maskValue(value)];
      }
      return [key, maskObject(value)];
    });
    return Object.fromEntries(maskedEntries);
  }

  return payload;
};

const sanitize = (payload: LogPayload): LogPayload => {
  if (typeof payload === 'string') {
    return DEFAULT_SENSITIVE_KEYS.reduce((acc, key) => {
      const regex = new RegExp(`${key}[^\s"']*`, 'gi');
      return acc.replace(regex, match => `${match.slice(0, Math.min(4, match.length))}${DEFAULT_MASK}`);
    }, payload);
  }
  return maskObject(payload) as LogPayload;
};

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[this.level];
  }

  private format(level: LogLevel, message: string, payload?: LogPayload) {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (payload === undefined) return base;
    const sanitizedPayload = sanitize(payload);
    return `${base} ${typeof sanitizedPayload === 'string' ? sanitizedPayload : JSON.stringify(sanitizedPayload)}`;
  }

  error(message: string, payload?: LogPayload) {
    if (!this.shouldLog('error')) return;
    console.error(this.format('error', message, payload));
  }

  warn(message: string, payload?: LogPayload) {
    if (!this.shouldLog('warn')) return;
    console.warn(this.format('warn', message, payload));
  }

  info(message: string, payload?: LogPayload) {
    if (!this.shouldLog('info')) return;
    console.info(this.format('info', message, payload));
  }

  debug(message: string, payload?: LogPayload) {
    if (!this.shouldLog('debug')) return;
    console.debug(this.format('debug', message, payload));
  }
}

const envLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
export const logger = new Logger(envLevel);

export const maskSecrets = <T>(payload: T): T => sanitize(payload as unknown as LogPayload) as T;
