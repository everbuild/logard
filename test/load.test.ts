import { RouteParams } from '../src/common';
import { Loader } from '../src/Loader.js';
import { Manager } from '../src/Manager.js';

test('load', async () => {
  const mgr = new Manager();

  const loader1 = new Loader(async (s, pr) => {
    await tick();
    if (pr === 'hello') return 'bye';
    return s.getPathParam('pathParam') ?? 'missing pathParam';
  });

  const loader2 = new Loader(async s => {
    const a = await loader1.getResult(s);
    const b = s.getQueryParam('queryParam') ?? 'missing queryParam';
    await tick();
    return `${a} ${b}`;
  });

  const params1: RouteParams = {
    path: {
      pathParam: ['hi'],
    },
    query: {},
  };

  const params2: RouteParams = {
    path: {
      pathParam: ['hello'],
    },
    query: {
      queryParam: ['world'],
    },
  };

  const results1 = await mgr.startTransition('1', [loader1], params1, {});
  mgr.endTransition();

  expect(results1).toEqual(['hi']);

  const results2 = await mgr.startTransition('2', [loader2], params2, {});
  mgr.endTransition();

  expect(results2).toEqual(['hello world']);

  const results3 = await mgr.startTransition('3', [loader1], params1, {});
  mgr.endTransition();

  expect(results3).toEqual(['bye']);
});

export function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
