import { RouteLocationNormalized, Router, RouteRecordNormalized } from 'vue-router';
import { Loader } from './Loader';
import { Debug, Options, RedirectError, RedirectLimitError } from './common';
import { extractRouteParams, mergeLocation } from './util';
import TrackingScope from './TrackingScope';

export interface Uninstall {
  (): void;
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

  async load(scope: TrackingScope): Promise<void> {
    this.result = await this.loader.getResult(scope);
  }

  apply(): void {
    this.props[this.key] = this.result;
  }
}

export class Manager {
  propMap = new WeakMap<RouteRecordNormalized, Array<PropWrapper>>();
  activeLoaders = new Set<Loader<any>>();
  allLoaders = new Set<Loader<any>>();
  redirectCount = 0;
  redirectLimit: number;
  debug: Debug;

  constructor(options?: Options) {
    this.redirectLimit = options?.redirectLimit ?? 25;
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

  private async startTransition(route: RouteLocationNormalized): Promise<void> {
    this.debug(`Transition to ${route.fullPath}`);
    const props = route.matched.flatMap(record => this.getProps(record));
    const scope = new TrackingScope(extractRouteParams(route));
    try {
      await Promise.all(props.map(p => p.load(scope)));
      props.forEach(p => p.apply());
    } catch (error) {
      // avoids incorrect reporting of uncaught errors in Chrome
      throw error;
    } finally {
      this.activeLoaders.clear();
      props.forEach(p => p.loader.collectAffectedLoaders(this.activeLoaders));
      this.activeLoaders.forEach(l => this.allLoaders.add(l));
    }
  }

  private endTransition(): void {
    this.allLoaders.forEach(l => {
      if (this.activeLoaders.has(l)) {
        l.clean();
      } else {
        l.reset();
        this.allLoaders.delete(l);
      }
    });
  }

  private getProps(record: RouteRecordNormalized): Array<PropWrapper> {
    let props = this.propMap.get(record);
    if (!props) {
      props = this.resolveProps(record);
      this.propMap.set(record, props);
    }
    return props;
  }

  private resolveProps(record: RouteRecordNormalized): Array<PropWrapper> {
    return Object.values(record.props).flatMap(props => {
      if (typeof props !== 'object') return [];
      return Object.keys(props)
        .filter(key => props[key] instanceof Loader)
        .map(key => new PropWrapper(key, props));
    });
  }
}