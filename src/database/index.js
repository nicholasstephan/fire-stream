import { 
  getDatabase, 
  ref as databaseRef, 
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


export default function(url, options = {}) {

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
  const ref = databaseRef(database, options.url);


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

    // Delaying the unsubscribe here so that 
    // if the next loaded page uses the same data
    // firebase hasn't already dumpted the memory.
    // Prevents flashing as the data is re-loaded
    // from the database.
    return () => setTimeout(() => {
      subscribers = subscribers.filter(cb => cb != callback);
      if(!subscribers.length) offValue(ref, 'value', handler)
    }, 5000);
  };

  let set = async val => {
    if(!isLoaded) {
      let existingValue = await getValue(ref);
      if(existingValue.exists()) {
        console.warn(`WARNING: You're trying to set a value (${options.url}) before it has been loaded.`);
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