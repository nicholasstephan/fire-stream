import {
  getDatabase,
  ref as databaseRef,
  query,
  orderByChild,
  equalTo,
  limitToLast,
  limitToFirst,
  onValue,
  off as offValue,
  get as getValue,
  set as setValue,
  update as updateValue,
  push as pushValue,
  remove as removeValue,
} from "firebase/database";

import { upload, remove, use, url as getStorageUrl } from '../storage/index.js';

const isObject = v => v instanceof Object;
const isFile = v => v?.file instanceof Uint8Array || v?.file instanceof Blob || v?.file instanceof File;




const defaultOptions = {
  // An initial value to return before the data is loaded, 
  // or if the data is null. 
  // If both the data and startWith are objects, the data 
  // will be merged with startWith to continue supplying
  // default values. 
  startWith: null,
};

const noop = (startWith = null) => ({
  subscribe: callback => {
    callback(startWith);
    return () => null;
  },
  unsubscribe: () => null,
  then: callback => {
    callback(startWith)
  },
  get: () => null,
  set: () => null,
  update: () => null,
  remove: () => null,
  push: () => null,
  add: () => null,
});

export default function (url, options = {}) {

  if (typeof url == 'string') {
    options.url = url;
  }
  else {
    options = url;
  }
  options = { ...defaultOptions, ...options };

  if (
    options.url.includes('undefined') ||
    options.url.includes('null') ||
    options.url.includes('//')
  ) {
    return noop(options.startWith);
  }

  const database = getDatabase();
  let ref = databaseRef(database, options.url);

  let constraints = [];
  if (options.where) {
    let [field, operator, value] = options.where;
    constraints.push(orderByChild(field));
    if (operator == "==") {
      constraints.push(equalTo(value));
    }
    if (operator == "<") {
      constraints.push(startAt(value));
    }
    if (operator == ">") {
      constraints.push(endAt(value));
    }
  }
  else if (options.orderBy) {
    constraints.push(orderByChild(options.orderBy));
  }
  if (options.limit) {
    constraints.push(limitToLast(options.limit));
  }
  if (options.limitToFirst) {
    constraints.push(limitToFirst(options.limitToFirst));
  }
  if (constraints.length) {
    ref = query(ref, ...constraints);
  }

  // Manage subscriptions.

  let subscribers = [];
  let value = options.startWith;
  let isLoaded = false;

  let subscribe = callback => {
    let handler = snapshot => {
      value = snapshot.val();
      if (value == null && options.startWith != null) {
        value = options.startWith;
      }
      if (typeof value == 'object' && typeof options.startWith == 'object') {
        value = { ...options.startWith, ...value };
      }
      if (options.array) {
        value = Object.entries(value).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([key, val]) => val);
      }
      isLoaded = true;
      subscribers.forEach(callback => callback(value));
    };

    if (!subscribers.length) {
      onValue(ref, handler);
    }

    subscribers.push(callback);
    if (value) {
      callback(value);
    }

    // TODO: This causes issues with svelte. 
    // replace with internal cache. 
    return () => unsubscribe(callback);
  };

  let unsubscribe = callback => {
    if (callback) {
      subscribers = subscribers.filter(cb => cb != callback);
    }
    else {
      subscribers = [];
    }
    if (!subscribers.length) {
      offValue(ref, 'value');
    }
  };

  let get = () => {
    return value;
  };

  let set = async newValue => {
    if (!isLoaded) {
      let existingValue = await getValue(ref);
      if (existingValue.exists()) {
        console.warn(`WARNING: You're trying to set a value (${options.url}) before it has been loaded. If you're intentially doing this, use 'overwrite' instead.`);
        return;
      }
    }
    newValue = await addFiles(options.url, newValue);
    await removeFiles(value, newValue);
    return setValue(ref, newValue);
  };

  let update = async newValue => {
    if (typeof newValue == 'string') {
      return set(newValue);
    }
    else {
      if(!value) {
        let snap = await getValue(ref);
        value = snap.val();
      }
      newValue = await addFiles(options.url, newValue);
      await removeFiles(value, newValue);
      return updateValue(ref, newValue);
    }
  };

  let overwrite = async newValue => {
    let snap = await getValue(ref);
    value = snap.val();
    isLoaded = true;
    return set(newValue);
  };

  let remove = async () => {
    if (!isLoaded) {
      let snap = await getValue(ref);
      value = snap.val();
    }
    removeFiles(value);
    value = null;
    removeValue(ref);
  };

  let push = val => {
    let res = pushValue(ref, val);
    return res.key;
  };

  let then = async callback => {
    if (value) {
      callback(value);
      return;
    }

    let snap = await getValue(ref);
    value = snap.val();

    isLoaded = true;
    callback(value);
  };

  return {
    subscribe,
    get,
    set,
    update,
    overwrite,
    remove,
    push,
    add: push,
    then
  };

}

async function addFiles(path, value) {
  if(isFile(value)) {
    let storageId = await upload('uploads', value.file);
    console.log('added file', storageId);
    let url = await getStorageUrl('uploads', storageId);
    console.log('got url', url);
    await use(storageId);
    return {
      storageId: storageId,
      folder: 'uploads',
      url: url,
      file: null,
    };
  }
  if(value?.storageId) {
    use(value.storageId);
    return value;
  }
  if(isObject(value)) {
    for(let key in value) {
      value[key] = await addFiles(`${path}/${key}`, value[key]);
    }
    return value;
  }
  return value;
}

async function removeFiles(oldValue, newValue) {
  if(oldValue?.storageId) {
    if(newValue?.storageId != oldValue.storageId) {
      await remove(oldValue.storageId);
    }
    return;
  }
  if(isObject(oldValue)) {
    for(let key in oldValue) {
      await removeFiles(oldValue[key], newValue?.[key]);
    }
  }
}