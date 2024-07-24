import { LocationQuery, RouteLocationNormalized, RouteLocationRaw, RouteParamsGeneric, Router, RouteRecordNormalized } from 'vue-router';

type RouteParamMap = Record<string, Array<string>>;

interface RouteParams {
  path: RouteParamMap;
  query: RouteParamMap;
}

export interface Uninstall {
  (): void;
}

export interface OnLoad<Result> {
  (scope: Scope): Result | Promise<Result>;
}

export interface OnFree<Result> {
  (result: Result): void;
}

export interface Debug {
  (message: string): void;
}

export interface Options {
  redirectLimit?: number;
  debug?: boolean | Debug;
}

export class RedirectError extends Error {
  constructor(public location: RouteLocationRaw) {
    super('redirect');
  }
}

export class RedirectLimitError extends Error {
  constructor() {
    super('redirect limit reached');
  }
}

export class Scope {
  usedPathParams = new Set<string>();
  usedQueryParams = new Set<string>();
  usedLoaders = new Set<Loader<any>>();

  constructor(
    public params: RouteParams,
  ) {
  }

  getPathParam(name: string): Array<string> | undefined {
    this.usedPathParams.add(name);
    return this.params.path[name];
  }

  getSinglePathParam(name: string): string | undefined {
    const v = this.getPathParam(name);
    if (!v) return;
    if (v.length > 1) throw new RedirectError({ params: { [name]: v[0] } });
    return v[0];
  }

  getQueryParam(name: string): Array<string> | undefined {
    this.usedQueryParams.add(name);
    return this.params.query[name];
  }

  getSingleQueryParam(name: string): string | undefined {
    const v = this.getQueryParam(name);
    if (!v) return;
    if (v.length > 1) throw new RedirectError({ query: { [name]: v[0] } });
    return v[0];
  }

  addLoader(loader: Loader<any>): void {
    this.usedLoaders.add(loader);
  }
}

export class Loader<Result> {
  private results: Array<Result> = [];
  private promise?: Promise<Result>;
  private scope?: Scope;

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
    scope.addLoader(this);
    if (this.needsLoad(scope.params)) {
      try {
        const localScope = new Scope(scope.params);
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

class PropWrapper {
  loader: Loader<any>;
  result: any;

  constructor(
    readonly key: string,
    readonly props: Record<string, any>,
  ) {
    this.loader = props[key];
  }

  async load(scope: Scope): Promise<void> {
    this.result = await this.loader.getResult(scope);
  }

  apply(): void {
    this.props[this.key] = this.result;
  }
}

class Manager {
  propMap = new WeakMap<RouteRecordNormalized, Array<PropWrapper>>();
  activeLoaders = new Set<Loader<any>>();
  allLoaders = new Set<Loader<any>>();
  redirectCount = 0;
  redirectLimit = 25;
  debug: Debug;

  constructor(options?: Options) {
    this.redirectLimit = options?.redirectLimit ?? this.redirectLimit;
    this.debug = typeof options?.debug === 'function' ? options.debug : (options?.debug ? m => console.log(m) : () => {
    });
  }

  install(router: Router): Uninstall {
    const removeBefore = router.beforeEach((to, from, next) => this.startTransition(to).then(() => {
      this.redirectCount = 0;
      next();
    }, error => {
      if (error instanceof RedirectError) {
        if (++this.redirectCount > this.redirectLimit) {
          this.redirectCount = 0;
          this.debug('Redirect limit reached');
          next(new RedirectLimitError());
        } else {
          this.debug('Redirecting');
          next(mergeLocation(error.location, to));
        }
      } else {
        next(error);
      }
    }));

    const removeAfter = router.afterEach(() => this.endTransition());
    return () => {
      removeBefore();
      removeAfter();
    };
  }

  async startTransition(route: RouteLocationNormalized): Promise<void> {
    this.debug(`Transition to ${route.fullPath}`);
    const props = route.matched.flatMap(record => this.getProps(record));
    const scope = new Scope(extractRouteParams(route));
    try {
      await Promise.all(props.map(p => p.load(scope)));
      props.forEach(p => p.apply());
    } finally {
      this.activeLoaders.clear();
      props.forEach(p => p.loader.collectAffectedLoaders(this.activeLoaders));
      this.activeLoaders.forEach(l => this.allLoaders.add(l));
    }
  }

  endTransition(): void {
    this.allLoaders.forEach(l => {
      if (this.activeLoaders.has(l)) {
        l.clean();
      } else {
        l.reset();
        this.allLoaders.delete(l);
      }
    });
  }

  getProps(record: RouteRecordNormalized): Array<PropWrapper> {
    let props = this.propMap.get(record);
    if (!props) {
      props = this.resolveProps(record);
      this.propMap.set(record, props);
    }
    return props;
  }

  resolveProps(record: RouteRecordNormalized): Array<PropWrapper> {
    return Object.values(record.props).flatMap(props => {
      if (typeof props !== 'object') return [];
      return Object.keys(props)
        .filter(key => props[key] instanceof Loader)
        .map(key => new PropWrapper(key, props));
    });
  }
}

export function installRouteLoader(router: Router, options?: Options): Uninstall {
  const mgr = new Manager(options);
  return mgr.install(router);
}

function mergeLocation(target: RouteLocationRaw, base: RouteLocationNormalized): RouteLocationRaw {
  if (typeof target === 'string') {
    return target;
  } else if ('name' in target) {
    return {
      name: target.name ?? base.name,
      params: {
        ...base.params,
        ...target.params,
      },
      query: {
        ...base.query,
        ...target.query,
      },
      hash: target.hash ?? base.hash,
    };
  } else {
    return {
      path: target.path ?? base.path,
      query: {
        ...base.query,
        ...target.query,
      },
      hash: target.hash ?? base.hash,
    };
  }
}

function extractRouteParams(route: RouteLocationNormalized): RouteParams {
  return {
    path: normalizeParams(route.params),
    query: normalizeParams(route.query),
  };
}

function normalizeParams(input: RouteParamsGeneric | LocationQuery): RouteParamMap {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, normalizeParamValue(v)]));
}

function normalizeParamValue(input: string | null | Array<string | null>): Array<string> {
  return [input].flat().filter(v => v !== null);
}

function paramValuesAreSimilar(a: Array<string> | undefined, b: Array<string> | undefined): boolean {
  if (a === undefined) return b === undefined;
  if (b === undefined) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}