/**
 * Standard typed application error for PublishIQ mobile.
 * Normalizes all HTTP errors, timeouts, and network failures.
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly details: Record<string, unknown>;

  constructor(message: string, code: string, status?: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  get isTimeout(): boolean {
    return this.code === 'TIMEOUT';
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }

  get isForbidden(): boolean {
    return this.status === 403 || this.code === 'FORBIDDEN';
  }

  get isRateLimited(): boolean {
    return this.status === 429 || this.code === 'TOO_MANY_REQUESTS';
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === 'NOT_FOUND';
  }

  get isConflict(): boolean {
    return this.status === 409 || this.code === 'CONFLICT';
  }

  get isValidationError(): boolean {
    return this.status === 400 || this.code === 'VALIDATION_ERROR';
  }
}
