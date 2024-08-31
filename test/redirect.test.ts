import { Loader } from '../src/Loader.js';
import { installRouteLoader } from '../src/vueRouter';

test('redirect', async () => {
  const loader1 = new Loader((s) => {
    return s.getQueryParam('queryParam', 'defaultQueryValue') ?? '?';
  });

  const loader2 = new Loader(s => {
    return loader1.getResult(s);
  });

  const route = {
    fullPath: 'testPath',
    matched: [
      {
        props: {
          view: { loader1, loader2 },
        },
      },
    ],
    params: {},
    query: {},
  };

  let onBefore: (route: any) => Promise<any>;

  const router = {
    beforeEach: (g: any) => onBefore = g,
    afterEach: (h: any) => {},
  };

  installRouteLoader(router as any, {
    redirectLimit: 4,
    debug: true,
  });

  await transitionTo(route);

  async function transitionTo(route: any): Promise<void> {
    const newRoute = await onBefore(route);
    if (newRoute) return transitionTo({ ...route, ...newRoute });
  }
});