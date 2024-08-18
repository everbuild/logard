import { Router } from 'vue-router';
import { Manager, Uninstall } from './src/Manager';
import { Options } from './src/common';

export function installRouteLoader(router: Router, options?: Options): Uninstall {
  const mgr = new Manager(options);
  return mgr.install(router);
}
