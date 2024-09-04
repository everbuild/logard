import { Router } from 'vue-router';
import { Options } from './common';
import { Manager, Uninstall } from './Manager';

export type { Options, Debug } from './common';
export { RedirectError, RedirectLimitError } from './common';
export type { OnLoad, OnFree } from './Loader';
export { Loader } from './Loader';
export type { Uninstall } from './Manager';
export * from './sanitizers';
export { default as Scope } from './Scope';

export function installRouteLoader(router: Router, options?: Options): Uninstall {
  const mgr = new Manager(options);
  return mgr.install(router);
}
