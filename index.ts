import { Router } from 'vue-router';
import { Manager, Uninstall } from './src/Manager';
import { Options } from './src/common';

export { Options, Debug, RedirectError, RedirectLimitError } from './src/common';
export { OnLoad, OnFree, Loader } from './src/Loader';
export { Uninstall } from './src/Manager';
export * from './src/sanitizers';
export { default as Scope } from './src/Scope';

export function installRouteLoader(router: Router, options?: Options): Uninstall {
  const mgr = new Manager(options);
  return mgr.install(router);
}
