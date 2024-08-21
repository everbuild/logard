import { Manager } from '../src/Manager.js';
import { Loader } from '../src/Loader.js';

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

  const props1 = {
    result1: loader1,
  };

  const props2 = {
    result2: loader2,
  };

  const route1 = {
    fullPath: 'testPath',
    matched: [
      {
        props: {
          view: props1,
        },
      },
    ],
    params: {
      pathParam: 'hi',
    },
    query: {},
  } as any;

  const route2 = {
    fullPath: 'testPath',
    matched: [
      {
        props: {
          view: props2,
        },
      },
    ],
    params: {
      pathParam: 'hello',
    },
    query: {
      queryParam: 'world',
    },
  } as any;

  await mgr['startTransition'](route1);
  await mgr['endTransition']();

  expect(props1.result1).toBe('hi');

  await mgr['startTransition'](route2);
  await mgr['endTransition']();

  expect(props2.result2).toBe('hello world');

  await mgr['startTransition'](route1);
  await mgr['endTransition']();

  expect(props1.result1).toBe('bye');
});

export function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
