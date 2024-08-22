import { ParamSource, RouteParams } from './common';
import { Loader } from './Loader';
import Scope from './Scope';

export default class TrackingScope extends Scope {
  usedPathParams = new Set<string>();
  usedQueryParams = new Set<string>();
  usedLoaders = new Map<Loader<any>, Promise<any>>();

  constructor(
    public params: RouteParams,
  ) {
    super();
  }

  protected getParamValue(name: string, source: ParamSource): Array<string> | undefined {
    this[source === 'path' ? 'usedPathParams' : 'usedQueryParams'].add(name);
    return this.params[source][name];
  }

  addLoader(loader: Loader<any>, result: Promise<any>): void {
    this.usedLoaders.set(loader, result);
  }
}
