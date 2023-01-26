/**
 * Connect to a firestore document or collection.
 * @param {string} url - the url of the document or collection
 * @param {object} options - options for the document or collection
 * @param {any} options.startWith - an initial value
 * @param {number} options.debounce - debounce commits to server
 * @param {number} options.limit - limit collection response lengths
 * @param {string} options.orderBy - order collection responses by field
 * @param {string} options.direction - if `orderBy` is given, order in this 
 *                                     direction. Either "asc" or "desc".
 * @param {array} options.where - an array of filter tuples; 
 *                                [['name', '==', 'Tyler Durden']]
 * @returns {object} - a thenable store that can be subscribed to and updated
 */

import doc from './doc.js';
import collection from './collection.js';
import { serverTimestamp, arrayUnion, arrayRemove, Timestamp } from "firebase/firestore";

let defaultOptions = {
  startWith: undefined,
  debounce: 500,
  limit: null,
  orderBy: null,
  direction: 'asc',
  where: [],
};

export default function firestore(url, options = {}) {
  
  if(typeof url == 'string') {
    options.url = url;
  }
  else {
    options = url;
  }

  if (options.url.includes('undefined') || options.url.includes('null')) {
    return {
      then: callback => callback(options.startWith || null),
      subscribe: callback => {
        callback(options.startWith || null);
        return () => null;
      },
      unsubscribe: () => null,
      set: () => null,
      add: () => null,
      update: () => null,
      overwrite: () => null,
      remove: () => null,
    }
  }

  options = { ...defaultOptions, ...options };
  let isCollection = options.url.split('/').filter(p => !!p).length % 2;

  if (isCollection) {
    return collection(options);
  }
  else {
    return doc(options);
  }

}


/**
 * Utility to union a new value with a array field.
 * @param {any} value - the value to union
 */
export function union(value) {
  return arrayUnion(value);
}
firestore.union = union;


/**
 * Utility to remove a value from a array field.
 * @param {any} value - the value to remove
 */
export function remove(value) {
  return arrayRemove(value);
}
firestore.remove = remove;


/**
 * Utility to create a timestamp.
 * @param {Date} value - (optional) the date to create a 
 *                       timestamp from. If not given, the 
 *                       server timestamp is used.
 */
export function timestamp(value) {
  if (!value) {
    return serverTimestamp()
  }
  return Timestamp.fromDate(value);
}
firestore.timestamp = timestamp;




