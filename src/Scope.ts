import { ParamSource, RedirectError } from './common';
import { LocationQueryValue } from 'vue-router';
import { InvalidParam, ParamSanitizer, saneString } from './sanitizers';

export default abstract class Scope {
  /**
   * Get the string value of the single query parameter with the given name.
   * If multiple parameters are found with this name, a redirect is performed to strip the redundant ones.
   * If no (valid) parameter is found and a fallback value is provided, a redirect is performed to use that instead.
   * If no (valid) parameter is found and no fallback value is provided, `undefined` is returned.
   * @param name
   * @param fallback
   */
  getQueryParam(name: string, fallback?: string): string | undefined;

  /**
   * Get the sanitized value of the single query parameter with the given name.
   * If multiple parameters are found with this name, a redirect is performed to strip the redundant ones.
   * If no (valid) parameter is found and a fallback value is provided, a redirect is performed to use that instead.
   * If no (valid) parameter is found and no fallback value is provided, `undefined` is returned.
   * @param name
   * @param sanitizer
   * @param fallback
   */
  getQueryParam<T>(name: string, sanitizer: ParamSanitizer<T>, fallback?: string): T | undefined;

  getQueryParam(...args: Array<any>): any {
    return this.getParam('query', args, false)[0];
  }

  /**
   * Get an array of string values of all query parameters with the given name.
   * Note this is equivalent to using the {@Link saneString} sanitizer.
   * If no (valid) parameters are found and fallback values are provided, a redirect is performed to use those instead.
   * If no (valid) parameters are found and no fallback values are provided, an empty array is returned.
   * @param name
   * @param fallback
   */
  getQueryParams(name: string, fallback?: Array<string>): Array<string>;

  /**
   * Get an array of sanitized values of all query parameters with the given name.
   * If no (valid) parameters are found and fallback values are provided, a redirect is performed to use those instead.
   * If no (valid) parameters are found and no fallback values are provided, an empty array is returned.
   * @param name
   * @param sanitizer
   * @param fallback
   */
  getQueryParams<T>(name: string, sanitizer: ParamSanitizer<T>, fallback?: Array<string>): Array<T>;

  getQueryParams(...args: Array<any>): Array<any> {
    return this.getParam('query', args, true);
  }

  /**
   * Get the string value of the single path parameter with the given name.
   * If multiple parameters are found with this name, a redirect is performed to strip the redundant ones.
   * If no (valid) parameter is found and a fallback value is provided, a redirect is performed to use that instead.
   * If no (valid) parameter is found and no fallback value is provided, `undefined` is returned.
   * @param name
   * @param fallback
   */
  getPathParam(name: string, fallback?: string): string | undefined;

  /**
   * Get the sanitized value of the single path parameter with the given name.
   * If multiple parameters are found with this name, a redirect is performed to strip the redundant ones.
   * If no (valid) parameter is found and a fallback value is provided, a redirect is performed to use that instead.
   * If no (valid) parameter is found and no fallback value is provided, `undefined` is returned.
   * @param name
   * @param sanitizer
   * @param fallback
   */
  getPathParam<T>(name: string, sanitizer: ParamSanitizer<T>, fallback?: string): T | undefined;

  getPathParam(...args: Array<any>): any {
    return this.getParam('path', args, false)[0];
  }

  /**
   * Get an array of string values of all path parameters with the given name.
   * Note this is equivalent to using the {@Link saneString} sanitizer.
   * If no (valid) parameters are found and fallback values are provided, a redirect is performed to use those instead.
   * If no (valid) parameters are found and no fallback values are provided, an empty array is returned.
   * @param name
   * @param fallback
   */
  getPathParams(name: string, fallback?: Array<string>): Array<string>;

  /**
   * Get an array of sanitized values of all path parameters with the given name.
   * If no (valid) parameters are found and fallback values are provided, a redirect is performed to use those instead.
   * If no (valid) parameters are found and no fallback values are provided, an empty array is returned.
   * @param name
   * @param sanitizer
   * @param fallback
   */
  getPathParams<T>(name: string, sanitizer: ParamSanitizer<T>, fallback?: Array<string>): Array<T>;

  getPathParams(...args: Array<any>): Array<any> {
    return this.getParam('path', args, true);
  }

  protected abstract getParamValue(name: string, source: ParamSource): Array<string> | undefined;

  private getParam(source: ParamSource, args: Array<any>, multi: boolean): Array<any> {
    const name: string = args[0];
    const sanitizer: ParamSanitizer<any> = typeof args[1] === 'function' ? args[1] : saneString;
    const fallback: Array<string> = [typeof args[1] === 'function' ? args[2] : args[1]].flat().filter(v => v !== undefined);

    const rawValue = this.getParamValue(name, source);

    if (!rawValue || rawValue.length === 0) {
      if (fallback.length > 0) throw this.fixParam(name, source, fallback);
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
      if (remainingResults.length === 0 && fallback.length > 0) throw this.fixParam(name, source, fallback);
      const newValues = remainingResults.map(r => r.error ? r.error.newValue! : r.input);
      throw this.fixParam(name, source, multi ? newValues : newValues[0]);
    }

    if (!multi && results.length > 1) throw this.fixParam(name, source, results[0].input);

    return results.map(r => r.output!);
  }

  /**
   * Removes all query parameters with the given name by performing a redirect.
   * If no parameters are found this has no effect (other than dependency tracking).
   * @param name
   */
  removeQueryParams(name: string): void {
    const rawValue = this.getParamValue(name, 'query');
    if (rawValue && rawValue.length > 0) throw this.fixParam(name, 'query', undefined);
  }

  private fixParam(name: string, source: ParamSource, value: undefined | LocationQueryValue | LocationQueryValue[]) {
    return new RedirectError({ [source === 'path' ? 'params' : 'query']: { [name]: value } });
  }
}