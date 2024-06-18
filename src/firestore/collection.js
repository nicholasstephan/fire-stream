import {
  getFirestore,
  collection as colRef,
  getDocs,
  addDoc,
  query as queryRef,
  where,
  limit,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

export default function collection(options = {}) {

  let url = options.url;
  let col = colRef(getFirestore(), url);
  let ref = null;
  let subscribers = [];
  let value = undefined;
  let isLoaded = false;
  let offSnapshot = null;

  function emit() {
    subscribers.forEach(callback => callback(value));
  }

  function query(q) {
    return new Promise(resolve => {
      options = {...options, ...q};

      url = options.url;

      if(!value && options.startWith) {
        value = options.startWith ? [...options.startWith] : undefined;
      }

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

      ref = queryRef(...args);

      if (subscribers.length) {
        offSnapshot();
        offSnapshot = onSnapshot(ref, snap => {
          value = snap.docs?.map(doc => ({ ...doc.data(), id: doc.id })) || [];
          isLoaded = true;
          resolve(value);
          emit();
        });
      }
    });
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
    if(callback) {
      subscribers = subscribers.filter(c => c !== callback);
    }
    else {
      subscribers = [];
    }
    if (!subscribers.length) {
      offSnapshot();
    }
  }

  function add(data = {}) {
    return addDoc(col, data);
  }

  // Kick of the query.
  query(options);

  // Return API
  return {
    then,
    subscribe,
    unsubscribe,
    add,
    push: add,
    query,
  };

}