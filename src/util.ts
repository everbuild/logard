import { LocationQuery, RouteLocationNormalized, RouteLocationRaw, RouteParamsGeneric } from 'vue-router';
import { RouteParamMap, RouteParams } from './common';

export function mergeLocation(target: RouteLocationRaw, base: RouteLocationNormalized): RouteLocationRaw {
  if (typeof target === 'string') {
    return target;
  } else if ('name' in target) {
    return {
      name: target.name ?? base.name,
      params: {
        ...base.params,
        ...target.params,
      },
      query: {
        ...base.query,
        ...target.query,
      },
      hash: target.hash ?? base.hash,
    };
  } else {
    return {
      path: target.path ?? base.path,
      query: {
        ...base.query,
        ...target.query,
      },
      hash: target.hash ?? base.hash,
    };
  }
}

export function extractRouteParams(route: RouteLocationNormalized): RouteParams {
  return {
    path: normalizeParams(route.params),
    query: normalizeParams(route.query),
  };
}

export function normalizeParams(input: RouteParamsGeneric | LocationQuery): RouteParamMap {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, normalizeParamValue(v)]));
}

export function normalizeParamValue(input: string | null | Array<string | null>): Array<string> {
  return [input].flat().filter(v => v !== null);
}

export function paramValuesAreSimilar(a: Array<string> | undefined, b: Array<string> | undefined): boolean {
  if (a === undefined) return b === undefined;
  if (b === undefined) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
