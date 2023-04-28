import { 
  getDatabase, 
  ref as databaseRef, 
  query, 
  orderByChild,
  orderByKey,
  orderByValue,
  equalsTo,
  limitToFirst,
  limitToLast,
  onValue, 
  off as offValue,
  get as getValue,
  set as setValue,
  update as updateValue,
  push as pushValue,
  remove as removeValue,
} from "firebase/database";


const defaultOptions = {
  startWith: null, // an initial value to start with
};


let res = function(url, options = {}) {

  if(typeof url == 'string') {
    options.url = url;
  }
  else {
    options = url;
  }
  options = {...defaultOptions, ...options};

  if(options.url.includes('undefined') || options.url.includes('null')) {
    return {
      subscribe: callback => {
        callback(options.startWith);
        return () => null;
      },
      then: callback => callback(options.startWith),
      set: () => null,
      update: () => null,
      remove: () => null,
      push: () => null,
    };
  }

  const database = getDatabase();
  let filters = [databaseRef(database, options.url)];
  if(options.orderByChild) {
    filters.push(orderByChild(options.orderByChild));
  }
  else if(options.orderByKey) {
    filters.push(orderByKey());
  }
  else if(options.orderByValue) {
    filters.push(orderByValue());
  }

  if(options.equalTo) {
    filters.push(equalsTo(options.equalTo));
  }
  
  if(options.limitToFirst) {
    filters.push(limitToFirst(options.limitToFirst));
  }
  else if(options.limitToLast) {
    filters.push(limitToLast(options.limitToLast));
  }

  const ref = query(...filters)
  let subscribers = [];
  let value = options.startWith;
  let isLoaded = false;

  
  let subscribe = callback => {
    let handler = snapshot => {
      value = snapshot.val();
      isLoaded = true;
      subscribers.forEach(callback => callback(value));
    };

    if(!subscribers.length) {
      onValue(ref, handler);
    }

    subscribers.push(callback);
    if(value) {
      callback(value);
    }

    // TODO: This causes issues with svelte. 
    // replace with internal cache. 
    return () => {
      subscribers = subscribers.filter(cb => cb != callback);
      if(!subscribers.length) offValue(ref, 'value', handler)
    };
  };

  let set = async val => {
    if(!isLoaded) {
      let existingValue = await getValue(ref);
      if(existingValue.exists()) {
        console.warn(`WARNING: You're trying to set a value (${options.url}) before it has been loaded. If you're intentially doing this, use 'overwrite' instead.`);
        return;
      }
    }
    return setValue(ref, val);
  };

  let update = val => {
    if(typeof val == 'string') {
      return set(val);
    }
    else {
      updateValue(ref, val);
    }
  };

  let overwrite = val => {
    value = val;
    return setValue(ref, value);
  };

  let remove = () => {
    removeValue(ref);
  };

  let push = val => {
    let res = pushValue(ref, val);
    return res.key;
  };

  let then = async callback => {
    if(value) {
      callback(value);
      return;
    }

    let snap = await getValue(ref);
    value = snap.val();

    isLoaded = true;
    callback(value);
  };

  return {subscribe, set, update, overwrite, remove, push, then};

}

res.createId = () => databaseRef(getDatabase()).push().key;

export default res;