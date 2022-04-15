
import { 
  getFirestore, 
  doc as docRef, 
  collection as colRef,
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc,
  addDoc,
  deleteDoc,
  query, 
  where, 
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion, 
  arrayRemove,
  Timestamp,
} from "firebase/firestore";


let defaultOptions = {
  startWith: null, // an initial value
  debounce: 500, // debounce commits to server
  limit: null, // limit collection response lengths
  orderBy: null, // order collection responses by field
  direction: 'asc', // if `orderBy` is given, order in this direction.
  where: [], // An array of filter tuples; [['name', '==', 'Tyler Durden']]
};


export function doc(url, options={}) {
  
  options = {...defaultOptions, ...options};

  if(url.includes('undefined') || url.includes('null')) {
    return {subscribe:() => () => options.startWith};
  }

  const firestore = getFirestore();
  const ref = docRef(firestore, url);
  
  let subscribers = [];
  let value = options.startWith;
  let unsubscribe;
  
  let emit = () => {
    subscribers.forEach(callback => callback(value));
  };

  let subscribe = callback => {
    if(!subscribers.length) {
      unsubscribe = onSnapshot(ref, doc => {
        if(doc.exists()) {
          value = doc.data();
          emit();
        }
      });
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
      if(!subscribers.length) unsubscribe()
    }, 5000);
  };

  let setTimer;
  let set = val => {
    value = val;
    emit();
    clearTimeout(setTimer);
    setTimer = setTimeout(() => setDoc(ref, value), options.debounce);
  };

  let updateTimer;
  let update = val => {
    value = {...value, ...val};
    emit();
    clearTimout(updateTimer);
    updateTimer = setTimeout(() => updateDoc(ref, value), options.debounce);
  };

  let remove = () => {
    deleteDoc(ref);
    value = undefined;
    emit();
  };

  let then = async callback => {
    if(value) {
      callback(value);
      return;
    }
    let snap = await getDoc(ref);
    callback(snap.data() || null);
  };

  return {subscribe, set, update, remove, then};
}


export function collection(url, options={}) {
  
  options = {...defaultOptions, ...options};

  if(url.includes('undefined') || url.includes('null')) {
    return {subscribe:() => () => options.startWith};
  }

  const firestore = getFirestore();

  let col = colRef(firestore, url);
  let args = [col];
  for(let filter of options.where) {
    if(filter.includes(undefined)) {
      continue;
    }
    args.push(
      where(...filter)
    );
  }
  if(options.orderBy) {
    args.push(
      orderBy(options.orderBy, options.direction)
    )
  }
  let ref = query(...args);

  let subscribers = [];
  let value = options.startWith;
  let unsubscribe;

  let emit = () => {
    subscribers.forEach(callback => callback(value));
  };

  let subscribe = callback => {
    if(!subscribers.length) {
      unsubscribe = onSnapshot(ref, snap => {
        let res = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        value = res;
        emit();
      });
    }

    subscribers.push(callback);
    callback(value);

    // Wrap the unsubscribe check is a 1 second timeout 
    // in case the next page loaded subscribes to the same
    // information. This will prevent a flash as cached data
    // is removed then reloaded. 
    return () => setTimeout(() => {
      subscribers = subscribers.filter(cb => cb != callback);
      if(!subscribers.length) unsubscribe();
    }, 5000);
  };
  
  let add = value => addDoc(col, value || {});

  let then = async callback => {
    if(value) {
      callback(value);
      return;
    }
    let snap = await getDocs(ref);
    let res = [];
    snap.forEach(doc => res.push(doc.data()));
    callback(res);
  };

  return { subscribe, add, then };

}

export default function(url, options) {
  // If the URL has an odd number of parts, it's a colletion,
  // otherwise it's a document.
  if(url.split('/').filter(p => !!p).length % 2) {
    return collection(url, options);
  }
  return doc(url, options);
}

export function timestamp(value) {
  if(!value) {
    return serverTimestamp()
  }
  return Timestamp.fromDate(value);
}

export function remove(value) {
  return arrayRemove(value);
}

export function union(value) {
  return arrayUnion(value);
}