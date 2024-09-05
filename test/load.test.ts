import { Loader } from '../src/Loader.js';
import { Manager } from '../src/Manager.js';

test('load', async () => {
  const mgr = new Manager();

  const userLoader = new Loader(async s => {
    await tick();
    return s.getPathParam('name') ?? 'missing pathParam';
  });

  const messageLoader = new Loader<string>(async (s, p) => {
    const user = await userLoader.getResult(s);
    const verb = s.getAttribute<string>('verb') ?? '?';
    const message = s.getQueryParam('message') ?? '?';
    await tick();
    return [user, verb, message, p?.includes(user) && p?.includes(message) && 'again'].filter(Boolean).join(' ');
  });

  let results = await mgr.startTransition('', [userLoader], { path: { name: ['Eve'] }, query: {} }, {});
  mgr.endTransition();
  expect(results).toEqual(['Eve']);

  results = await mgr.startTransition('', [messageLoader], { path: { name: ['Eve'] }, query: { message: ['hi'] } }, { verb: 'says' });
  mgr.endTransition();
  expect(results).toEqual(['Eve says hi']);

  results = await mgr.startTransition('', [messageLoader], { path: { name: ['Adam'] }, query: { message: ['hi'] } }, { verb: 'says' });
  mgr.endTransition();
  expect(results).toEqual(['Adam says hi']);

  results = await mgr.startTransition('', [messageLoader], { path: { name: ['Adam'] }, query: { message: ['what are you hiding'] } }, { verb: 'asks' });
  mgr.endTransition();
  expect(results).toEqual(['Adam asks what are you hiding']);

  results = await mgr.startTransition('', [messageLoader], { path: { name: ['Adam'] }, query: { message: ['what are you hiding'] } }, { verb: 'whispers' });
  mgr.endTransition();
  expect(results).toEqual(['Adam whispers what are you hiding again']);

  results = await mgr.startTransition('', [userLoader], { path: { name: ['Adam'] }, query: {} }, {});
  mgr.endTransition();
  expect(results).toEqual(['Adam']);
});

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
