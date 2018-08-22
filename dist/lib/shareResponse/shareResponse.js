Object.defineProperty(exports, "__esModule", { value: true });
var operators_1 = require("rxjs/operators");
var defer_1 = require("rxjs/internal/observable/defer");
var shareResponseObserverMap = new Map();
var shareResponseSubscriberSet = new Set();
function shareResponse() {
    return function (target, methodName, descriptor) {
        var originalFunction = target[methodName];
        if (typeof descriptor.value !== 'function') {
            console.warn("@shareResponse must be used by wrapping function");
            return descriptor;
        }
        descriptor.value = function () {
            var args = getArgumentsAsArray(arguments);
            var mapKey = methodName + "_" + args.toString(); //Generate unique key.
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
                var deferResponse$ = getDeferredRepose(mapKey, resultObservable$);
                shareResponseObserverMap.set(mapKey, deferResponse$);
                console.log("Observables amount in map (in) - " + shareResponseObserverMap.size);
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
function getDeferredRepose(mapKey, resultObservable$) {
    return defer_1.defer(function () {
        if (!isExist(shareResponseSubscriberSet, mapKey)) {
            resultObservable$
                .subscribe(function () { return null; }, function () { return null; }, function () {
                clearShareReposeObserverCache(mapKey);
                console.log("Observables amount in map (out)- " + shareResponseObserverMap.size);
            });
            shareResponseSubscriberSet.add(mapKey);
        }
        return resultObservable$;
    });
}
/**
 * Loop through original method argument list
 * and create an array of them.
 * @param funcArguments
 */
function getArgumentsAsArray(funcArguments) {
    var args = [];
    for (var i = 0; i < funcArguments.length; i++) {
        args[i] = funcArguments[i];
    }
    return args;
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
