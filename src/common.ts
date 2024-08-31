export type ParamSource = 'path' | 'query';

export type RouteParamValues = Array<string>;

export type RouteParamMap = Record<string, RouteParamValues>;

export interface RouteParams {
  path: RouteParamMap;
  query: RouteParamMap;
}

export type RouteAttributes = Record<string, any>;

/**
 * If a loader throws this, a redirect to the given location is performed.
 * @see RedirectLimitError
 */
export class RedirectError<CustomTarget = {}> extends Error {
  constructor(public target: Partial<RouteParams> | CustomTarget) {
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
