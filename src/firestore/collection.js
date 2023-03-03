import {
  getFirestore,
  collection as colRef,
  getDocs,
  addDoc,
  query,
  where,
  limit,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

export default function collection(options={}) {

  let url = options.url;
  let col = colRef(getFirestore(), url);
  let args = [col];
  for (let filter of options.where) {
    if (filter.includes(undefined)) {
      continue;
    }
    args.push(
      where(...filter)
    );
  }
  if (options.orderBy) {
    args.push(
      orderBy(options.orderBy, options.direction)
    )
  }
  if (options.limit) {
    args.push(
      limit(options.limit)
    );
  }
  let ref = query(...args);

  let subscribers = [];
  let value = options.startWith ? [...options.startWith] : undefined;
  let isLoaded = false;
  let offSnapshot = null;

  function emit() {
    subscribers.forEach(callback => callback(value));
  }

  async function then(callback) {
    if (value) {
      callback(value);
      return;
    }

    let snap = await getDocs(ref);
    value = snap.docs?.map(doc => ({ ...doc.data(), id: doc.id })) || [];

    isLoaded = true;
    callback(value);
  }

  function subscribe(callback) {
    if (!subscribers.length) {
      offSnapshot = onSnapshot(ref, snap => {
        value = snap.docs?.map(doc => ({ ...doc.data(), id: doc.id })) || [];
        isLoaded = true;
        emit();
      });
    }

    subscribers.push(callback);
    if (value) callback(value);

    return () => unsubscribe(callback);
  }

  function unsubscribe(callback) {
    // Delaying the unsubscribe here so that if the next loaded page 
    // uses the same data firebase hasn't already dumpted the memory. 
    // Prevents flashing as the data is re-loaded from the database.
    setTimeout(() => {
      subscribers = subscribers.filter(c => c !== callback);
      if (!subscribers.length) {
        offSnapshot();
      }
    }, 500);
  }

  function add(data={}) {
    return addDoc(col, data);
  }

  return { 
    then, 
    subscribe, 
    unsubscribe, 
    add, 
  };

}