import { RouteLocationRaw } from 'vue-router';

export type ParamSource = 'path' | 'query';

export type RouteParamMap = Record<string, Array<string>>;

export interface RouteParams {
  path: RouteParamMap;
  query: RouteParamMap;
}

/**
 * If a loader throws this, a redirect to the given location is performed.
 * @see RedirectLimitError
 */
export class RedirectError extends Error {
  constructor(public location: RouteLocationRaw) {
    super('redirect');
  }
}

/**
 * If the redirect limit is reached, no further redirects are attempted and this error is thrown instead.
 * @see RedirectError
 * @see Options#redirectLimit
 */
export class RedirectLimitError extends Error {
  constructor() {
    super('redirect limit reached');
  }
}

export interface Debug {
  (message: string): void;
}

export interface Options {
  /**
   * @see RedirectLimitError
   * Default: 25
   */
  redirectLimit?: number;

  /**
   * Enable debug logging by setting this to true or a custom log function.
   * Default: false
   */
  debug?: Debug | boolean;
}
