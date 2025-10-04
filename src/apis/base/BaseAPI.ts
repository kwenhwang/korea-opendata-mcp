import { setTimeout as delay } from 'timers/promises';
import { logger as defaultLogger, Logger, maskSecrets } from '../../utils/logger';
import type { APIConfig, AuthContext, RequestContext, RequestOptions, RetryOptions } from './types';
import { AuthStrategy } from './types';

const DEFAULT_RETRY: RetryOptions = {
  attempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 2000,
};

type XMLParserCtor = new (options?: Record<string, unknown>) => {
  parse<T = unknown>(data: string): T;
};

let cachedXmlParserCtor: XMLParserCtor | null = null;

/**
 * BaseAPI provides shared HTTP request handling, retry logic, logging,
 * and authentication scaffolding for Korean public data sources.
 *
 * TConfig: shape of the concrete API configuration object.
 * TResponse: canonical response type returned by `parseResponse`.
 */
export abstract class BaseAPI<TConfig extends APIConfig, TResponse> {
  protected readonly config: TConfig;
  protected logger: Logger;

  protected constructor(config: TConfig, logger: Logger = defaultLogger) {
    this.config = config;
    this.logger = logger;
  }

  /** Returns the base URL the API should call (e.g. https://api.example.com). */
  protected abstract getBaseUrl(): string;

  /**
   * Apply authentication for the outbound request. Implementations can
   * modify query parameters or headers (e.g. append ServiceKey).
   */
  protected abstract authenticate(context: AuthContext): AuthContext;

  /** Parse the raw payload into the canonical response type. */
  protected abstract parseResponse(data: unknown): TResponse;

  /**
   * Issue an HTTP request with retry and error handling. Concrete clients
   * should call this helper and post-process the typed result as needed.
   */
  protected async request(options: RequestOptions): Promise<TResponse> {
    const retryAttempts = options.retryAttempts ?? this.config.retryAttempts ?? DEFAULT_RETRY.attempts;
    return this.retry(() => this.performRequest(options), retryAttempts);
  }

  /** Hook for centralised error handling. Can be overridden by subclasses. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected handleError(error: unknown, _context?: RequestContext): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error('API request failed', { message });
  }

  /**
   * Retry wrapper with exponential backoff. Each attempt delegates to the
   * provided async function. Throws the last error if all attempts fail.
   */
  protected async retry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
    let delayMs = DEFAULT_RETRY.initialDelayMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt >= attempts) break;
        this.logger.warn('Retrying API request', { attempt, remaining: attempts - attempt });
        await delay(delayMs);
        delayMs = Math.min(delayMs * 2, DEFAULT_RETRY.maxDelayMs);
      }
    }

    throw lastError;
  }

  private async performRequest(options: RequestOptions): Promise<TResponse> {
    const method = options.method ?? 'GET';
    const params = { ...(options.params ?? {}) };
    const headers: Record<string, string> = {
      Accept: options.expects === 'xml' ? 'application/xml' : 'application/json',
      ...(options.headers ?? {}),
    };

    const authenticated = this.authenticate({ params, headers });
    const url = this.buildUrl(authenticated.params, options.endpoint);

    const controller = new AbortController();
    const timeoutMs = options.timeout ?? this.config.timeout ?? 10000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const context: RequestContext = {
      attempt: 1,
      url,
      method,
      maskedParams: maskSecrets(authenticated.params),
      maskedHeaders: maskSecrets(authenticated.headers),
    };

    this.logger.debug('Dispatching API request', { context: maskSecrets(context) });

    try {
      const response = await fetch(url, {
        method,
        headers: authenticated.headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const err = new Error(`요청이 실패했습니다: ${response.status} ${response.statusText}`);
        this.handleError(err, context);
        throw err;
      }

      const rawPayload = await this.extractPayload(response, options.expects);
      const parsed = this.parseResponse(rawPayload);

      this.logger.debug('API request completed', {
        url,
        status: response.status,
        payload: maskSecrets(rawPayload),
      });

      return parsed;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutError = new Error('요청 시간이 초과되었습니다. 나중에 다시 시도해주세요.');
        this.handleError(timeoutError, context);
        throw timeoutError;
      }

      this.handleError(error, context);
      throw error;
    }
  }

  private buildUrl(params: Record<string, any>, endpoint: string): string {
    const base = this.getBaseUrl().replace(/\/$/, '');
    const path = endpoint.replace(/^\//, '');
    const url = new URL(`${base}/${path}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  private async extractPayload(response: Response, expects: RequestOptions['expects']): Promise<unknown> {
    if (expects === 'text') {
      return response.text();
    }

    if (expects === 'xml') {
      const text = await response.text();
      return this.parseXml(text);
    }

    // default to JSON
    return response.json().catch(async () => {
      const fallback = await response.text();
      this.logger.warn('JSON parsing failed; returning raw text', { payload: maskSecrets(fallback) });
      return fallback;
    });
  }

  private async parseXml(text: string): Promise<unknown> {
    if (!cachedXmlParserCtor) {
      try {
        const module = await import('fast-xml-parser');
        cachedXmlParserCtor = module.XMLParser as XMLParserCtor;
      } catch (error) {
        this.logger.error('Failed to load XML parser module', { error });
        throw new Error('XML 파서 초기화에 실패했습니다. 관리자에게 문의하세요.');
      }
    }

    const parser = new cachedXmlParserCtor({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseTagValue: true,
      trimValues: true,
    });

    return parser.parse(text);
  }
}
