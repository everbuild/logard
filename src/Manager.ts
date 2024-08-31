import { Debug, Options, RedirectError, RedirectLimitError, RouteAttributes, RouteParams } from './common';
import { Loader } from './Loader';
import TrackingScope from './TrackingScope';

export interface Uninstall {
  (): void;
}

export class Manager {
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

   async startTransition(name: string, loaders: Array<Loader<any>>, params: RouteParams, attribs: RouteAttributes): Promise<Array<any>> {
    try {
      this.debug(`Transition to ${name}`);
      const scope = new TrackingScope(params, attribs);
      const results = await Promise.all(loaders.map(l => l.getResult(scope)));
      this.redirectCount = 0;
      return results;
    } catch (error) {
      if (error instanceof RedirectError) {
        if (++this.redirectCount > this.redirectLimit) {
          this.redirectCount = 0;
          this.debug('Redirect limit reached');
          throw new RedirectLimitError();
        } else {
          this.debug('Redirecting');
          throw error;
        }
      } else {
        throw error;
      }
    } finally {
      this.activeLoaders.clear();
      loaders.forEach(l => l.collectAffectedLoaders(this.activeLoaders));
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
}