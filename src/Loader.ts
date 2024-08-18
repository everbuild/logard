import { RouteParams } from './common';
import { paramValuesAreSimilar } from './util';
import Scope from './Scope';
import TrackingScope from './TrackingScope';

export interface OnLoad<Result> {
  (scope: Scope): Result | Promise<Result>;
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

  needsLoad(params: RouteParams): boolean {
    if (!this.scope) return true;
    if ([...this.scope.usedPathParams].some(p => !paramValuesAreSimilar(this.scope!.params.path[p], params.path[p]))) return true;
    if ([...this.scope.usedQueryParams].some(p => !paramValuesAreSimilar(this.scope!.params.query[p], params.query[p]))) return true;
    if ([...this.scope.usedLoaders].some(l => l.needsLoad(params))) return true;
    return false;
  }

  getResult(scope: Scope): Promise<Result> {
    if (!(scope instanceof TrackingScope)) throw new Error('invalid scope');
    scope.addLoader(this);
    if (this.needsLoad(scope.params)) {
      try {
        const localScope = new TrackingScope(scope.params);
        this.promise = Promise.resolve(this.onLoad(localScope));
        this.scope = localScope;
        this.promise.then(r => this.results.push(r));
      } catch (error) {
        this.promise = Promise.reject(error);
      }
    }
    return this.promise!;
  }

  collectAffectedLoaders(set: Set<Loader<any>>): void {
    set.add(this);
    this.scope?.usedLoaders.forEach(l => l.collectAffectedLoaders(set));
  }

  clean(): void {
    this.freeResults(this.results.length - 1);
  }

  reset(): void {
    this.freeResults(this.results.length);
    this.promise = undefined;
    this.scope = undefined;
  }

  private freeResults(count: number): void {
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        this.onFree?.(this.results[i]);
      }
      this.results.splice(0, count);
    }
  }
}