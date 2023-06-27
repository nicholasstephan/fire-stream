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


const defaultOptions = {
  // An initial value to return before the data is loaded, 
  // or if the data is null. 
  // If both the data and startWith are objects, the data 
  // will be merged with startWith to continue supplying
  // default values. 
  startWith: null, 
};

export const noop = {
  subscribe: callback => {
    callback(options.startWith);
    return () => null;
  },
  unsubscribe: () => null,
  then: callback => callback(options.startWith),
  get: () => null,
  set: () => null,
  update: () => null,
  remove: () => null,
  push: () => null,
  add: () => null,
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
    return noop;
  }

  const database = getDatabase();
  let ref = databaseRef(database, options.url);

  let constraints = [];
  if(options.where) {
    let [field, operator, value] = options.where;
    constraints.push( orderByChild(field) );
    if(operator == "==") {  
      constraints.push( equalTo(value) );
    }
    if(operator == "<") {
      constraints.push( startAt(value) );
    }
    if(operator == ">") {
      constraints.push( endAt(value) );
    }
  }
  else if(options.orderBy) {
    constraints.push( orderByChild(options.orderBy) );
  }
  if(options.limit) {
    constraints.push( limitToLast(options.limit) );
  }
  if(options.limitToFirst) {
    constraints.push( limitToFirst(options.limitToFirst) );
  }
  if(constraints.length) {
    ref = query(ref, ...constraints);
  }

  // Manage subscriptions.

  let subscribers = [];
  let value = options.startWith;
  let isLoaded = false;
  
  let subscribe = callback => {
    let handler = snapshot => {
      value = snapshot.val();
      if(value == null && options.startWith != null) {
        value = options.startWith;
      }
      if(typeof value == 'object' && typeof options.startWith == 'object') {
        value = {...options.startWith, ...value};
      }
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
    return () => unsubscribe(callback);
  };

  let unsubscribe = callback => {
    if(callback){
      subscribers = subscribers.filter(cb => cb != callback);
    }
    else {
      subscribers = [];
    }
    if(!subscribers.length) {
      offValue(ref, 'value', handler);
    }
  };

  let get = () => {
    return value;
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

export default res;