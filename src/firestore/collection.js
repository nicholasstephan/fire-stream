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
  let value = options.startWith ? [...options.startWith] : undefined;
  let isLoaded = false;
  let offSnapshot = null;

  function query(q) {

    q = {...options, ...q};

    let args = [col];
    for (let filter of q.where) {
      if (filter.includes(undefined)) {
        continue;
      }
      args.push(
        where(...filter)
      );
    }
    if (q.orderBy) {
      args.push(
        orderBy(q.orderBy, q.direction)
      )
    }
    if (q.limit) {
      args.push(
        limit(q.limit)
      );
    }

    ref = queryRef(...args);

    if (subscribers.length) {
      offSnapshot();
      offSnapshot = onSnapshot(ref, snap => {
        value = snap.docs?.map(doc => ({ ...doc.data(), id: doc.id })) || [];
        isLoaded = true;
        emit();
      });
    }
  }

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
    subscribers = subscribers.filter(c => c !== callback);
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