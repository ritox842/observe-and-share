Object.defineProperty(exports, "__esModule", { value: true });
var operators_1 = require("rxjs/operators");
var defer_1 = require("rxjs/internal/observable/defer");
var ngx_take_until_destroy_1 = require("ngx-take-until-destroy");
var shareResponseObserverMap = new Map();
var shareResponseSubscriberSet = new Set();
function shareResponse(paramKey) {
    return function (target, methodName, descriptor) {
        var originalFunction = target[methodName];
        if (typeof descriptor.value !== 'function') {
            console.warn("@shareResponse must be used by wrapping function");
            return descriptor;
        }
        descriptor.value = function () {
            var args = [];
            for (var i = 0; i < arguments.length; i++) {
                args[i] = arguments[i];
            }
            var mapKey = methodName + "_" + args; //Generate unique key.
            if (isExist(shareResponseObserverMap, mapKey)) {
                return shareResponseObserverMap.get(mapKey);
            }
            else {
                /**Call original function and store result.*/
                var originalFunctionResult = originalFunction.call(this, args);
                /**Check if function return an observable or some other type of response.*/
                var resultSubscriber$ = originalFunctionResult && originalFunctionResult._trySubscribe ?
                    originalFunctionResult._trySubscribe() :
                    null;
                /**
                 * For non subscribers response, Warn user and return the original
                 * function response.
                 */
                if (!resultSubscriber$) {
                    console.warn("Share response received a non observable result from " + methodName + " " + (args ? "supplied with '" + args + "'" : ""));
                    return originalFunctionResult;
                }
                /**Unsubscribe from temp subscription*/
                resultSubscriber$.unsubscribe();
                /**Create shared observable instance*/
                var resultObservable$ = originalFunctionResult
                    .pipe(operators_1.share());
                /**Get deferred observable from resultObservable$*/
                var deferResponse$ = getDeferredRepose(mapKey, resultObservable$, target);
                shareResponseObserverMap.set(mapKey, deferResponse$);
                return deferResponse$;
            }
        };
    };
}
exports.shareResponse = shareResponse;
/**
 *  Check to see if mapKey exist in shareResponseObserverMap.
 *  If not, return true for allowing new init.
 * @param cacheData
 * @param {string} mapKey
 * @returns {boolean}
 */
function isExist(cacheData, mapKey) {
    return cacheData.has(mapKey);
}
/**
 * Create a deferred observable instance witch upon subscription
 * returns the original observable and subscribe to it's response.
 * We use deferred observable to avoid subscribing to an observable
 * before the app does.
 * Keep track on subscribers with the shareResponseSubscriberSet and
 * keep only one subscriber per observable instance. On observable
 * complete, delete it from shareResponseSubscriberSet and
 * shareResponseObserverMap.
 * @param {string} mapKey
 * @param {Observable<any>} resultObservable$
 * @returns {Observable<any>}
 */
function getDeferredRepose(mapKey, resultObservable$, context) {
    return defer_1.defer(function () {
        debugger;
        if (!isExist(shareResponseSubscriberSet, mapKey)) {
            resultObservable$
                .pipe(ngx_take_until_destroy_1.untilDestroyed(context))
                .subscribe(function () { return null; }, function () { return null; }, function () { return clearShareReposeObserverCache(mapKey); });
            shareResponseSubscriberSet.add(mapKey);
        }
        return resultObservable$;
    });
}
/**
 * Remove mapKey from shareResponseSubscriberSet and
 * shareResponseObserverMap.
 * @param {string} mapKey
 */
function clearShareReposeObserverCache(mapKey) {
    shareResponseSubscriberSet.delete(mapKey);
    shareResponseObserverMap.delete(mapKey);
}
