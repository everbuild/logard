# Logard

> Vue Router data loading made easy.

⚠️ [v1.0 introduced a few small breaking changes](CHANGES.md#v10)

Logard helps streamline the process of data loading for single page web applications that choose to so before navigation.
This means all required data is loaded before the navigation is performed and can be used immediately by the destination view.

It was initially conceived with [Vue Router](https://router.vuejs.org/) in mind, but only little code turned out to be specific to that.
It was since adapted to make it more broadly usable but no support for other routers has been added yet.
PR's welcome 😀.
This documentation just assumes usage of Vue Router for now.

Logard introduces the concept of Loaders that load data based on route information such as query and path parameters.
It tracks what information is actually used so that it knows when to refresh a loader.
Loaders are associated with routes and the results are passed to the props of the view component.

This way, Logard helps avoid global state and its associated hazards by providing a familiar way of passing data to components.
It also really shines when nested routes share (parts of) the same data, by automating the logic that decides when to load what.

It is not really a caching solution.
It does avoid some needless data loading but discards results as soon as they're no longer needed. 
That being said, caching can be added by the user if needed.

## Contents

1. [Install](#install)
1. [Usage](#usage)
1. [Demo](#demo)
1. [Guide](#guide)
   1. [Loader](#loader)
   1. [Scope](#scope)
   1. [Sanitizers](#sanitizers)
   1. [Dependency tracking](#dependency-tracking)
   1. [Flow](#flow)
1. [Changelog](#changelog)

## Install

```
$ npm install --saveDev logard
```

## Usage

Consider this basic usage example:

```javascript
import { Loader } from 'logard';
import { installRouteLoader, VueRouterRedirectError } from 'logard/dist/vue-router';
import { createRouter } from 'vue-router';

const userLoader = new Loader(async scope => {        // Create an instance of the Loader class, passing it a function that performs the actual loading
  const userId = scope.getPathParam('userId');        // Scopes expose an API for retrieving route information and simultaniously tracking dependencies
  const user = await loadUser(userId);                // hypothetical function to load some data
  if (!user) throw new VueRouterRedirectError('/');   // Logard will catch this exception and instruct Vue Router to perform a redirect to the given location 
  return user;
});

const router = createRouter({
  routes: [
    {
      path: '/user/:userId',  // thanks to it's dependency tracking, Logard knows the userLoader needs to be refreshed whenever `userId` changes.
      component: UserDetailsPage,
      props: {
        user: userLoader,     // the result of the userLoader will be passed to the `user` prop of the UserDetailsPage component.
      },
      // ...
    },
  ],
});

installRouteLoader(router);   // register the necessary guards and hooks to make Logard work
```

As you can see, loaders are linked to route props that are defined using ["object mode"](https://router.vuejs.org/guide/essentials/passing-props.html#Object-mode).
Logard scans your route config for instances of the Loader class and replaces these on the fly with the results of their execution.
Multiple routes are allowed to use the same loader, which is typically done with nested routes.
You can also combine "normal" props with loader props, as long as you stick with object mode.

Real-world applications will typically have many more routes and will often move routes and even loaders into separate files to keep things organised.

## Demo

A basic demo application [can be found here](https://github.com/everbuild/logard-demo).

[It can be seen in action here](https://everbuild.github.io/logard-demo).

## Guide

### Loader

```typescript
class Loader<Result> {
  constructor(
    onLoad: (scope: Scope, previousResult: Result | undefined) => Result | Promise<Result>,
    onFree?: (result: Result) => void,
  )

  getResult(scope: Scope): Promise<Result>;
}
```

The `onLoad` function accepts a scope and it's previous result (if invoked subsequently) and produces a new result.
It can do so synchronously or - more usually - asynchronously by returning a Promise.
The [scope](#scope) should be used to retrieve route parameters and attributes.

If provided, the `onFree` function will be called _after_ navigation whenever a result is no longer used.
It can be used to release any resources associated with a specific result.

With `getResult` a loader can use the result of another loader.
The other loader doesn't even need to be linked to an active route, so this can be used purely to structure your code.
`getResult` is meant to be called from within an `onLoad` function, with the scope that was passed to it.
Don't use this in any other way.

### Scope

```typescript
class Scope {
  getQueryParam(name: string, fallback?: string): string | undefined;

  getQueryParam<T>(name: string, sanitizer: ParamSanitizer<T>, fallback?: string | T): T | undefined;

  getQueryParams(name: string, fallback?: Array<string>): Array<string>;

  getQueryParams<T>(name: string, sanitizer: ParamSanitizer<T>, fallback?: Array<string | T>): Array<T>;

  getPathParam(name: string): string | undefined;

  getPathParam<T>(name: string, sanitizer: ParamSanitizer<T>, fallback?: string | T): T | undefined;

  removeQueryParams(name: string): void;

  getAttribute<T>(name: string): T | undefined;
}
```

#### Parameter retrieval

As you saw above, `Scope` provides several useful functions to retrieve query and path parameters.
Generally, they all work the same.

Since there can be **multiple** query parameters with the same name, use `getQueryParam` if you expect only one or `getQueryParams` if multiple are allowed.
The latter returns an array. The former returns a single value, or `undefined` if no such parameter is found at all.

You can optionally provide a **sanitizer**.
This is a simple function that checks that a value is valid and if needed transforms it into an internal format (e.g. parse a string into a number).
In some cases, invalid values can be corrected ("sanitized") automatically.
Otherwise, they're generally discarded, except for path parameters (they can't be removed).
[Sanitizers are discussed in more detail in the next section](#sanitizers).

With most functions, you can also optionally provide a **fallback** value (or array of values in case of multiple query parameters).
Be aware that it is simply coerced to string.
If specific formatting is needed, perform your own string conversion in advance.
Fallback values are used when no valid parameter is found with the given name, but there are a few notable exceptions:

* Missing path parameters can't be added on the fly so this always results in `undefined` being returned.
  The fallback is only used when the parameter is invalid or empty (`""`).
* In case of a query parameter where the first value is an empty string and no other valid values are found, `undefined` is returned as well.
  This is done to allow for a distinction between "no parameter" and "empty value".

If for any reason (sanitizer, fallback, redundant query parameters,...) the return value of any retrieval function would no longer correspond to the original
value from the route, a **redirect** is performed to correct this.
This is done by throwing a `RedirectError`, which means any further code in your loader is skipped.
Do not worry though, as the process is just restarted with the corrected parameter.
Therefore, this is mostly transparent to your code but it should be obvious that costly operations are best deferred
until after all needed parameters are retrieved.
This only applies within each loader, as loaders that have already been executed successfully will not be executed again.

#### Removing query parameters

As the name suggests `removeQueryParams` removes all query parameters with the given name.
As with parameter retrieval, it does so by throwing a `RedirectError`.
It also tracks the dependency so you should always call it to clean up parameters that are only used in some conditions.

#### Attributes (a.k.a. meta fields)

`getAttribute` can be used to obtain the value of a ["meta field"](https://router.vuejs.org/guide/advanced/meta.html) with the given name.

### Sanitizers

```typescript
type ParamSanitizer<Output> = (input: string) => Output;
```

A function that sanitizes a value.

* **If the input is valid** it should be returned as is or transformed ("parsed") into an internal representation (e.g. convert a string to a number).
* **If the input is invalid** it should throw an InvalidParam error with a new "corrected" value or `undefined` (default) to indicate that the value should be discarded.
  Note that it should never return a corrected value but rather throw InvalidParam.
  This will trigger a redirect to a location with the corrected value so that this always reflects the application state.

Some basic sanitizers are included in [sanitizers.ts](src/sanitizers.ts), but you'll likely need to add your own.

Consider this arbitrary example to make it more clear:

```typescript
function sanitizer(input: string): number {
  if (input === 'nothing') return 0;                      // valid: return
  if (input === 'all') return Number.POSITIVE_INFINITY;   // valid: return
  if (input === '') throw new InvalidParam('nothing');    // invalid but can be corrected: throw with argument
  throw new InvalidParam();                               // invalid but correction impossible: throw without argument
}
```

### Dependency tracking

Logard keeps track of loader dependencies via the scope that is passed to `OnLoad` functions.
This is the case for all `Scope` functions as well as `Loader.getResult`.
This way it can determine what loaders need to be refreshed during subsequent navigations.

It should be obvious that the result of a loader should therefore only depend on values that are obtained this way.
**Avoid** using any other means like global variables, `LocalStorage`, `location.search`, etc...

### Flow

Below is a fairly detailed description of the steps performed before each navigation:

1. Collect all loaders defined for the target route.
2. For each of them, call onLoad if any dependencies have changed from the last invocation, or if this is the first invocation.
3. Pass the results to the respective component props.
4. If a RedirectError is thrown by any of the above steps, instruct the router to transition to the new route,
   which essentially restarts this flow from step 1.
   If the `redirectLimit` is reached however, the navigation is cancelled with a permanent error.

And after each navigation:

1. Call onFree for all results that are no longer used by the current route.
2. Reset the state of all loaders of the previous route that are no longer used by the current route.
   Note that this includes loaders of any intermediary routes visited due to redirects.
   Resetting the state essentially means that if they're ever invoked again, they will behave as if it's the first time.

## Changelog

[See CHANGES.md](CHANGES.md)