# v1.0

* isolated Vue Router code
  * `installRouteLoader` now needs to be imported from `logard/dist/vue-router`
  * `RedirectError` is now defined in a router agnostic way. An equivalent `VueRouterRedirectError` is also provided by `logard/dist/vue-router`.
* fixed a bug that could result in not all results getting properly freed after errors (including redirect).
* added documentation