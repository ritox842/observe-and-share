import {Observable} from 'rxjs';
import {share} from 'rxjs/operators';
import {defer} from 'rxjs/internal/observable/defer';

const shareResponseObserverMap = new Map<string, Observable<any>>();
const shareResponseSubscriberSet = new Set<string>();

export function shareResponse() {
    return (target: any, methodName: any, descriptor: any) => {
        const originalFunction = target[methodName];

        if (typeof descriptor.value !== 'function') {
            console.warn(`@shareResponse must be used by wrapping function`);
            return descriptor;
        }

        descriptor.value = function () {
            const args = getArgumentsAsArray(arguments);
            const mapKey = `${methodName}_${args.toString()}`; //Generate unique key.

            if (isExist(shareResponseObserverMap, mapKey)) {
                return shareResponseObserverMap.get(mapKey);
            } else {
                /**Call original function and store result.*/
                const originalFunctionResult = originalFunction.call(this, args);

                /**Check if function return an observable or some other type of response.*/
                const resultSubscriber$ = originalFunctionResult && originalFunctionResult._trySubscribe ?
                    originalFunctionResult._trySubscribe() :
                    null;

                /**
                 * For non subscribers response, Warn user and return the original
                 * function response.
                 */
                if (!resultSubscriber$) {
                    console.warn(`Share response received a non observable result from ${methodName} ${args ? `supplied with '${args}'` : ``}`);

                    return originalFunctionResult;
                }

                /**Unsubscribe from temp subscription*/
                resultSubscriber$.unsubscribe();

                /**Create shared observable instance*/
                const resultObservable$ = originalFunctionResult
                    .pipe(share());

                /**Get deferred observable from resultObservable$*/
                const deferResponse$ = getDeferredRepose(mapKey, resultObservable$);

                shareResponseObserverMap.set(mapKey, deferResponse$);

                return deferResponse$;
            }
        };
    };
}

/**
 *  Check to see if mapKey exist in shareResponseObserverMap.
 *  If not, return true for allowing new init.
 * @param cacheData
 * @param {string} mapKey
 * @returns {boolean}
 */
function isExist(cacheData: Map<string, Observable<any>> | Set<string>, mapKey: string): boolean {
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
function getDeferredRepose(mapKey: string, resultObservable$: Observable<any>) {
    return defer(() => {
        if (!isExist(shareResponseSubscriberSet, mapKey)) {
            resultObservable$
                .subscribe(
                    () => null,
                    () => null,
                    () => clearShareReposeObserverCache(mapKey));
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
function getArgumentsAsArray(funcArguments): any[] {
    const args = [];
    for (let i = 0; i < funcArguments.length; i++) {
        args[i] = funcArguments[i];
    }
    return args;
}

/**
 * Remove mapKey from shareResponseSubscriberSet and
 * shareResponseObserverMap.
 * @param {string} mapKey
 */
function clearShareReposeObserverCache(mapKey: string): void {
    shareResponseSubscriberSet.delete(mapKey);
    shareResponseObserverMap.delete(mapKey);
}