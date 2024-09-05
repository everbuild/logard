import { Debug, Options, RedirectError, RedirectLimitError, RouteAttributes, RouteParams } from './common';
import { Loader } from './Loader';
import TrackingScope from './TrackingScope';

export interface Uninstall {
  (): void;
}

export class Manager {
  private activeLoaders = new Set<Loader<any>>();
  private allLoaders = new Set<Loader<any>>();
  private redirectCount = 0;
  private readonly redirectLimit: number;
  private readonly debug: Debug;

  constructor(options?: Options) {
    this.redirectLimit = options?.redirectLimit ?? 25;
    this.debug = typeof options?.debug === 'function' ? options.debug : (options?.debug ? m => console.log(m) : () => {
    });
  }

  async startTransition(name: string, loaders: Array<Loader<any>>, params: RouteParams, attribs: RouteAttributes): Promise<Array<any>> {
    const usedLoaders = new Set<Loader<any>>();
    try {
      this.debug(`Transition to ${name}`);
      const scope = new TrackingScope(params, attribs);

      const results = await Promise.allSettled(loaders.map(async l => {
        const result = l.getResult(scope);
        l.collectUsedLoaders(usedLoaders);
        return result;
      }));

      this.handleErrors(results.filter(r => r.status === 'rejected').map(r => r.reason));

      this.redirectCount = 0;
      this.activeLoaders = usedLoaders;

      return results.filter(r => r.status === 'fulfilled').map(r => r.value);
    } finally {
      usedLoaders.forEach(l => this.allLoaders.add(l));
    }
  }

  private handleErrors(errors: Array<any>): void {
    const redirect = errors.find(e => e instanceof RedirectError);
    const handled = redirect || errors[0];
    errors.forEach(e => e === handled || console.error(e));
    if (redirect) {
      if (++this.redirectCount > this.redirectLimit) {
        this.redirectCount = 0;
        this.debug('Redirect limit reached');
        throw new RedirectLimitError();
      } else {
        this.debug('Redirecting');
        throw redirect;
      }
    } else if (handled) {
      throw handled;
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