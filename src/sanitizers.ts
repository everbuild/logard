/**
 * A function that sanitizes a query or path parameter value.
 * If the input is valid it should be returned as is or transformed ("parsed") into an internal representation.
 * If the input is invalid it should throw {@link InvalidParam} with a new "corrected" value or `undefined` to indicate that the value should be discarded.
 * Note that it should never return a corrected value but rather throw InvalidParam.
 * This error will trigger a redirect to a path with the corrected value so that this always reflects the application state.
 */
export interface ParamSanitizer<Output> {
  (input: string): Output;
}

export class InvalidParam extends Error {
  /**
   * @param newValue if provided, the parameter value in question will be updated, otherwise it will be discarded.
   */
  constructor(
    public newValue?: string,
  ) {
    super();
  }
}

export function saneString(input: string): string {
  return input;
}

export function saneNumber(input: string): number {
  if (input === '') throw new InvalidParam();
  const output = parseInt(input, 10);
  if (Number.isNaN(output)) throw new InvalidParam();
  const outputString = `${output}`;
  if (outputString !== input) throw new InvalidParam(outputString);
  return output;
}

export function saneBoolean(input: string): boolean {
  if (input === 'y') return true;
  if (input === 'n') return false;
  const falsy = ['', '0', 'false', 'no'].includes(input.trim().toLowerCase());
  throw new InvalidParam(falsy ? 'n' : 'y');
}

/**
 * Produces a {@link ParamSanitizer} that ensures the input value equals one of the given options.
 *
 * Can be used if the options are strings.
 * @param options
 */
export function saneOption<T extends string>(options: Array<T>): ParamSanitizer<T>;

/**
 * Produces a {@link ParamSanitizer} that ensures the input value equals one of the given options.
 * Can be used if the options are of any type.
 * A separate "base" {@link ParamSanitizer} is used to transform the input value to the option (= output) type.
 * @param options
 * @param base
 */
export function saneOption<T>(options: Array<T>, base: ParamSanitizer<T>): ParamSanitizer<T>;

export function saneOption(options: Array<any>, base = saneString): ParamSanitizer<any> {
  return input => {
    const option = base(input);
    if (options.includes(option)) return option;
    throw new InvalidParam();
  };
}