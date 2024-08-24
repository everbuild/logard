import { ParamSource, RedirectError, RouteParamValues } from './common';
import { InvalidParam, ParamSanitizer, saneString } from './sanitizers';

export default abstract class Scope {
  /**
   * Get the string value of the single query parameter with the given name.
   * @see https://github.com/everbuild/logard#scope
   */
  getQueryParam(name: string, fallback?: string): string | undefined;

  /**
   * Get the sanitized value of the single query parameter with the given name.
   * @see https://github.com/everbuild/logard#scope
   */
  getQueryParam<T>(name: string, sanitizer: ParamSanitizer<T>, fallback?: string | T): T | undefined;

  getQueryParam(...args: Array<any>): any {
    return this.getParam('query', args, false)[0];
  }

  /**
   * Get an array of string values of all query parameters with the given name.
   * @see https://github.com/everbuild/logard#scope
   */
  getQueryParams(name: string, fallback?: Array<string>): Array<string>;

  /**
   * Get an array of sanitized values of all query parameters with the given name.
   * @see https://github.com/everbuild/logard#scope
   */
  getQueryParams<T>(name: string, sanitizer: ParamSanitizer<T>, fallback?: Array<string | T>): Array<T>;

  getQueryParams(...args: Array<any>): Array<any> {
    return this.getParam('query', args, true);
  }

  /**
   * Get the string value of the path parameter with the given name (there can only be one).
   * @see https://github.com/everbuild/logard#scope
   */
  getPathParam(name: string): string | undefined;

  /**
   * Get the sanitized value of the path parameter with the given name (there can only be one).
   * @see https://github.com/everbuild/logard#scope
   */
  getPathParam<T>(name: string, sanitizer: ParamSanitizer<T>, fallback?: string | T): T | undefined;

  getPathParam(...args: Array<any>): any {
    return this.getParam('path', args, false)[0];
  }

  /**
   * @internal
   */
  private getParam(source: ParamSource, args: Array<any>, multi: boolean): Array<any> {
    const name: string = args[0];
    const sanitizer: ParamSanitizer<any> = typeof args[1] === 'function' ? args[1] : saneString;
    const fallback: Array<string> = [typeof args[1] === 'function' ? args[2] : args[1]].flat().filter(v => v !== undefined).map(v => `${v}`);

    const rawValue = this.getParamValue(name, source);

    if (!rawValue || rawValue.length === 0) {
      if (source === 'query' && fallback.length > 0) throw this.fixParam(name, source, fallback);
      else return [];
    }

    const results = rawValue.map(input => {
      try {
        return { input, output: sanitizer(input) };
      } catch (error) {
        if (error instanceof InvalidParam) return { error };
        else throw error;
      }
    });

    if (results.some(r => r.error)) {
      const remainingResults = results.filter(r => !r.error || r.error.newValue !== undefined);
      if (remainingResults.length === 0) {
        // special treatment of empty values - crucial for paths but also for query parameters that require a distinction between "not present" and "empty"
        if (rawValue[0] === '') return [];
        if (fallback.length > 0) throw this.fixParam(name, source, fallback);
      }
      const newValues = remainingResults.map(r => r.error ? r.error.newValue! : r.input);
      throw this.fixParam(name, source, multi ? newValues : newValues.slice(0, 1));
    }

    if (!multi && results.length > 1) throw this.fixParam(name, source, [results[0].input!]);

    return results.map(r => r.output!);
  }

  /**
   * @internal
   */
  protected abstract getParamValue(name: string, source: ParamSource): Array<string> | undefined;

  /**
   * Removes all query parameters with the given name by performing a redirect.
   * If no parameters are found this has no effect (other than dependency tracking).
   */
  removeQueryParams(name: string): void {
    const rawValue = this.getParamValue(name, 'query');
    if (rawValue && rawValue.length > 0) throw this.fixParam(name, 'query', []);
  }

  /**
   * @internal
   */
  private fixParam(name: string, source: ParamSource, value: RouteParamValues) {
    const key = source === 'path' ? 'path' : 'query';
    return new RedirectError({ [key]: { [name]: value } });
  }

  abstract getAttribute<T>(name: string): T | undefined;
}