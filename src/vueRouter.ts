import { LocationQuery, RouteLocationNormalized, RouteLocationRaw, RouteParamsGeneric, Router, RouteRecordNormalized } from 'vue-router';
import { Options, RedirectError, RouteParamMap, RouteParams } from './common';
import { Loader } from './Loader';
import { Manager } from './Manager';

export type VueRouterRedirectError = RedirectError<RouteLocationRaw>

export interface Uninstall {
  (): void;
}

class PropWrapper {
  loader: Loader<any>;

  constructor(
    readonly key: string,
    readonly props: Record<string, any>,
  ) {
    this.loader = props[key];
  }

  apply(result: any): void {
    this.props[this.key] = result;
  }
}

class VueRouterManager extends Manager {
  propMap = new WeakMap<RouteRecordNormalized, Array<PropWrapper>>();
  uninstall: Uninstall;

  constructor(router: Router, options?: Options) {
    super(options);

    const removeBefore = router.beforeEach(async route => {
      try {
        const props = route.matched.flatMap(record => this.getProps(record));
        const loaders = props.map(p => p.loader);
        const params = this.extractParams(route);
        const results = await this.startTransition(route.fullPath, loaders, params, route.meta);
        props.forEach((p, i) => p.apply(results[i]));
      } catch (error) {
        if (error instanceof RedirectError) {
          return this.getRedirectLocation(error.target, route);
        } else {
          throw error;
        }
      }
    });

    const removeAfter = router.afterEach(() => this.endTransition());

    this.uninstall = () => {
      removeBefore();
      removeAfter();
    };
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

  extractParams(route: RouteLocationNormalized): RouteParams {
    return {
      path: this.normalizeParams(route.params),
      query: this.normalizeParams(route.query),
    };
  }

  normalizeParams(input: RouteParamsGeneric | LocationQuery): RouteParamMap {
    return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, this.normalizeParamValue(v)]));
  }

  normalizeParamValue(input: string | null | Array<string | null>): Array<string> {
    return [input].flat().filter(v => v !== null);
  }

  getRedirectLocation(target: VueRouterRedirectError['target'], base: RouteLocationNormalized): RouteLocationRaw {
    if (typeof target === 'string') {
      // RouteLocationAsString
      return target;
    } else if ('name' in target) {
      // RouteLocationAsRelativeGeneric
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
    } else if (typeof target.path === 'string') {
      // RouteLocationAsPathGeneric
      return {
        path: base.path,
        query: {
          ...base.query,
          ...target.query,
        },
        hash: target.hash ?? base.hash,
      };
    } else {
      // internal RouteParams
      return {
        name: base.name,
        params: {
          ...base.params,
          ...target.path,
        },
        query: {
          ...base.query,
          ...target.query,
        },
        hash: base.hash,
      };
    }
  }
}

export function installRouteLoader(router: Router, options?: Options): Uninstall {
  return new VueRouterManager(router, options).uninstall;
}
