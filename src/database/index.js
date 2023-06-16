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
  startWith: null, // an initial value to start with
};

export const noop = {
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

export default res;