import {
  getDatabase,
  ref as databaseRef,
  query,
  orderByChild,
  equalTo,
  startAt,
  endAt,
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

import { upload, remove, use } from '../storage/index.js';

const isObject = v => v instanceof Object;
const isFile = v => !v?.storageId && (v?.file instanceof Uint8Array || v?.file instanceof Blob || v?.file instanceof File);




const defaultOptions = {
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

function addFiles(path, oldValue, newValue) {
  if(isFile(newValue)) {
    let storageId = upload('uploads', newValue.file, (storageId) => use(storageId));
    return {
      storageId: storageId,
      folder: 'uploads',
      file: null,
    };
  }
  if(newValue?.storageId && newValue.storageId != oldValue?.storageId) {
    use(newValue.storageId);
    return newValue;
  }
  if(isObject(newValue)) {
    for(let key in newValue) {
      newValue[key] = addFiles(`${path}/${key}`, oldValue?.[key], newValue[key]);
    }
    return newValue;
  }
  return newValue;
}

async function removeFiles(oldValue, newValue) {
  if(oldValue?.storageId) {
    if(newValue?.storageId != oldValue.storageId) {
      try {
        await remove(oldValue.storageId);
      }
      catch(e) {
        console.warn('Could not remove file:', oldValue.storageId, e);
      }
    }
    return;
  }
  if(isObject(oldValue)) {
    for(let key in oldValue) {
      removeFiles(oldValue[key], newValue?.[key]);
    }
  }
}

function clone(value) {
  if (value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(clone);
  }
  if (typeof value == 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, clone(val)]));
  }
  return value;
}

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

  let subscribers = [];
  let value = options.startWith;
  let isLoaded = false;

  let subscribe = callback => {
    let handler = snapshot => {
      value = snapshot.val();
      if (value == null && options.startWith != null) {
        value = options.startWith;
      }
      if (value && options.startWith && typeof value == 'object' && typeof options.startWith == 'object') {
        value = { ...options.startWith, ...value };
      }
      if (options.array) {
        value = Object.entries(value).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([key, val]) => val);
      }
      isLoaded = true;
      let cloneValue = clone(value);
      subscribers.forEach(callback => {
        callback(cloneValue);
      });
    };

    if (!subscribers.length) {
      onValue(ref, handler);
    }

    subscribers.push(callback);
    if (value) {
      let cloneValue = clone(value);
      callback(cloneValue);
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

  let set = newValue => {
    if (!isLoaded) {
      console.error(`You're trying to set a value (${options.url}) before it has been loaded. If you're intentially doing this, use 'overwrite' instead.`);
      return;
    }
    newValue = addFiles(options.url, value, newValue);
    removeFiles(value, newValue);
    let res = setValue(ref, newValue);
    return res;
  };

  let update = async newValue => {
    if (typeof newValue == 'string') {
      return set(newValue);
    }
    else {
      if (!isLoaded) {
        let snap = await getValue(ref);
        value = snap.val();
      }
      
      let oldValue = value;
      newValue = addFiles(options.url, oldValue, newValue);
      await updateValue(ref, newValue);

      let snap = await getValue(ref);
      let updatedValue = snap.val();
      removeFiles(oldValue, updatedValue);
    }
  };

  let overwrite = async newValue => {
    let snap = await getValue(ref);
    value = snap.val();
    isLoaded = true;
    await set(newValue);
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
    // todo: parse for files.
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

