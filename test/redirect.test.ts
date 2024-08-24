import { Manager } from '../src/Manager.js';
import { Loader } from '../src/Loader.js';

test('redirect', async () => {
  const mgr = new Manager({
    redirectLimit: 4,
    debug: true,
  });

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

  const router = {
    before: (to: any, from: any, next: (v: any) => void) => {},
    beforeEach(g: any) {
      this.before = g;
    },
    afterEach(h: any) {},
  };

  mgr.install(router as any);

  await transitionTo(route);

  function transitionTo(route: any): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      router.before(route, {}, v => {
        if (!v) resolve();
        else if (v instanceof Error) reject(v);
        else resolve(transitionTo({ ...route, ...v }));
      });
    });
  }
});