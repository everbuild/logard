import { RouteAttributes, RouteParams, RouteParamValues } from './common';
import Scope from './Scope';
import TrackingScope from './TrackingScope';

export interface OnLoad<Result> {
  (scope: Scope, previousResult: Result | undefined): Result | Promise<Result>;
}

export interface OnFree<Result> {
  (result: Result): void;
}

export class Loader<Result> {
  private results: Array<Result> = [];
  private promise?: Promise<Result>;
  private scope?: TrackingScope;

  constructor(
    private onLoad: OnLoad<Result>,
    private onFree?: OnFree<Result>,
  ) {
  }

  getResult(scope: Scope): Promise<Result> {
    if (!(scope instanceof TrackingScope)) throw new Error('invalid scope');
    if (this.needsLoad(scope.params, scope.attribs)) {
      this.promise = this.doLoad(scope);
      this.promise.catch(() => {
        // avoids incorrect reporting of uncaught errors in Chrome
      });
    }
    scope.addLoader(this, this.promise!);
    return this.promise!;
  }

  private needsLoad(params: RouteParams, attribs: RouteAttributes): boolean {
    if (!this.scope) return true;
    if ([...this.scope.usedPathParams].some(p => !this.paramValuesAreSimilar(this.scope!.params.path[p], params.path[p]))) return true;
    if ([...this.scope.usedQueryParams].some(p => !this.paramValuesAreSimilar(this.scope!.params.query[p], params.query[p]))) return true;
    if ([...this.scope.usedAttribs].some(a => this.scope!.attribs[a] !== attribs[a])) return true;
    if ([...this.scope.usedLoaders.entries()].some(([l, r]) => l.needsLoad(params, attribs) || l.promise !== r)) return true;
    return false;
  }

  private paramValuesAreSimilar(a: RouteParamValues | undefined, b: RouteParamValues | undefined): boolean {
    if (a === undefined) return b === undefined;
    if (b === undefined) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private async doLoad(scope: TrackingScope): Promise<Result> {
    this.scope = new TrackingScope(scope.params, scope.attribs);
    const result = await this.onLoad(this.scope, this.results[0]);
    this.results.unshift(result);
    return result;
  }

  collectAffectedLoaders(set: Set<Loader<any>>): void {
    set.add(this);
    this.scope?.usedLoaders.forEach((p, l) => l.collectAffectedLoaders(set));
  }

  clean(): void {
    this.freeResults(1);
  }

  reset(): void {
    this.freeResults(0);
    this.promise = undefined;
    this.scope = undefined;
  }

  private freeResults(offset = 0): void {
    for (let i = offset; i < this.results.length; i++) {
      this.onFree?.(this.results[i]);
    }
    this.results.splice(offset);
  }
}