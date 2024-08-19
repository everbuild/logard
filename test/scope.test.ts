import TrackingScope from '../src/TrackingScope';
import { RedirectError } from '../src/common';
import { RouteLocationRaw } from 'vue-router';
import { saneBoolean, saneNumber, saneOption } from '../src/sanitizers.js';

test('scope', () => {
  const scope = new TrackingScope({
    query: {
      queryEmpty: [],
      querySingle: ['string'],
      queryMulti: ['string1', 'string2'],
      queryTrue: ['y'],
      queryFalse: ['n'],
      queryTruthy: ['1'],
      queryFalsy: ['0'],
      queryNumber: ['1337'],
      queryMixed: ['IM', '1337'],
    },
    path: {
      pathOption: ['1'],
      pathEmpty: [''],
    },
  });

  expect(scope.getQueryParam('queryNotFound')).toBe(undefined);
  expect(captureRedirectLocation(() => scope.getQueryParam('queryNotFound', 'fallback'))).toEqual({ query: { queryNotFound: 'fallback' } });
  expect(scope.getQueryParam('queryEmpty')).toBe(undefined);
  expect(scope.getQueryParam('querySingle')).toBe('string');
  expect(scope.getQueryParams('querySingle')).toEqual(['string']);
  expect(captureRedirectLocation(() => scope.getQueryParam('querySingle', saneNumber))).toEqual({ query: {} });
  expect(captureRedirectLocation(() => scope.getQueryParam('querySingle', saneNumber, 0))).toEqual({ query: { querySingle: '0' } });
  expect(captureRedirectLocation(() => scope.getQueryParam('queryNotFound', saneNumber, 0))).toEqual({ query: { queryNotFound: '0' } });
  expect(captureRedirectLocation(() => scope.getQueryParam('queryMulti'))).toEqual({ query: { queryMulti: 'string1' } });
  expect(scope.getQueryParams('queryMulti')).toEqual(['string1', 'string2']);
  expect(captureRedirectLocation(() => scope.getQueryParams('queryNotFound', ['1', '2']))).toEqual({ query: { queryNotFound: ['1', '2'] } });
  expect(scope.getQueryParam('queryTrue', saneBoolean)).toBe(true);
  expect(scope.getQueryParam('queryFalse', saneBoolean)).toBe(false);
  expect(captureRedirectLocation(() => scope.getQueryParam('queryTruthy', saneBoolean))).toEqual({ query: { queryTruthy: 'y' } });
  expect(captureRedirectLocation(() => scope.getQueryParam('queryFalsy', saneBoolean))).toEqual({ query: { queryFalsy: 'n' } });
  expect(scope.getQueryParam('queryNumber', saneNumber)).toBe(1337);
  expect(captureRedirectLocation(() => scope.getQueryParam('queryMixed', saneNumber))).toEqual({ query: { queryMixed: '1337' } });

  expect(scope.getPathParam('pathOption', saneOption(['1', '2', '3']))).toBe('1');
  expect(captureRedirectLocation(() => scope.getPathParam('pathOption', saneOption(['2', '3']), '2'))).toEqual({ params: { pathOption: '2' } });
  expect(scope.getPathParam('pathEmpty')).toBe('');
  expect(scope.getPathParam('pathEmpty', saneNumber)).toBe(undefined);
  expect(captureRedirectLocation(() => scope.getPathParam('pathEmpty', saneNumber, '0'))).toEqual({ params: { pathEmpty: '0' } });
  expect(scope.getPathParam('pathNotFound')).toBe(undefined);
  expect(scope.getPathParam('pathNotFound', saneNumber)).toBe(undefined);
  expect(scope.getPathParam('pathNotFound', saneNumber, '0')).toBe(undefined);
});

function captureRedirectLocation(fn: () => any): RouteLocationRaw | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof RedirectError) return e.location;
  }
}