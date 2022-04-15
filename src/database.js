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
  startWith: null, // an initial value
  debounce: 500, // debounce commits to server
};


export default function(url, options={}) {

  if(url.includes('undefined') || url.includes('null')) {
    return {subscribe:() => () => options.startWith};
  }

  options = {...defaultOptions, ...options};

  const database = getDatabase();
  const ref = databaseRef(database, url);

  let subscribers = [];
  let value = options.startWith;

  let emit = () => {
    subscribers.forEach(callback => callback(value));
  };

  let handler = snapshot => {
    value = snapshot.val();
    emit();
  };

  let subscribe = callback => {
    if(!subscribers.length) {
      onValue(ref, handler);
    }

    subscribers.push(callback);
    callback(value);

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

  let setTimer;
  let set = val => {
    value = val;
    emit();
    clearTimeout(setTimer);
    setTimer = setTimeout(() => setValue(ref, value), options.debounce);
  };

  let updateTimer;
  let update = val => {
    value = {...value, ...val};
    emit();
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => updateValue(ref, value), options.debounce);
  };

  let remove = () => {
    removeValue(ref);
    value = undefined;
    emit();
  };

  let push = val => {
    pushValue(ref, val);
  };

  let then = async callback => {
    if(value) {
      callback(value);
      return;
    }
    let snap = await getValue(ref);
    callback(snap.val() || options.startWith);
  };

  return {subscribe, set, update, remove, push, then};

}