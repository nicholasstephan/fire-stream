import {
  getFirestore,
  doc as docRef,
  setDoc,
  updateDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

export default function doc(options = {}) {

  let url = "";
  let ref = null
  let subscribers = [];
  let value = undefined;
  let isLoaded = false;
  let offSnapshot = null;
  let filter = options.filter || (v => v);

  function emit() {
    subscribers.forEach(callback => callback(filter(value)));
  }

  function query(q = {}) {
    return new Promise(resolve => {
      options = { ...options, ...q };
      url = options.url;
      if(!value && options.startWith) {
        value = options.startWith ? { ...options.startWith } : undefined;
      }
      ref = docRef(getFirestore(), url);

      if (subscribers.length) {
        offSnapshot();
        offSnapshot = onSnapshot(ref, snap => {
          if (snap?.exists()) {
            let base = options.startWith || {};
            value = { ...base, ...snap.data(), id: snap.id };
          }
          else {
            value = options.startWith ? { ...options.startWith, id: snap.id } : null;
          }

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

    let snap = await getDoc(ref);
    
    value = snap.data() || null;
    isLoaded = true;
    callback(value);
  }

  function subscribe(callback) {
    if (!subscribers.length) {
      offSnapshot = onSnapshot(ref, snap => {
        if (snap?.exists()) {
          let base = options.startWith || {};
          value = { ...base, ...snap.data(), id: snap.id };
        }
        else {
          value = options.startWith ? { ...options.startWith, id: snap.id } : null;
        }

        isLoaded = true;
        emit();
      });
    }

    subscribers.push(callback);
    if (value) callback(filter(value));

    return () => unsubscribe(callback);
  }

  function unsubscribe(callback) {
    subscribers = subscribers.filter(c => c !== callback);
    if (!subscribers.length) {
      offSnapshot();
    }
  }

  async function set(val) {
    if(!isLoaded) {
      let existingValue = await getDoc(ref);
      if(existingValue.exists) {
        console.warn(`You're trying to set a document (${url}) before it has been loaded.`);
        return;
      }
    }
    let {id, ...data} = val;
    return updateDoc(ref, data);
  }

  function update(val) {
    let {id, ...data} = val;
    return updateDoc(ref, data);
  }

  function overwrite(val) {
    let {id, ...data} = val;
    return setDoc(ref, data);
  }

  function remove() {
    return deleteDoc(ref);
  }

  query();

  return {
    then,
    subscribe,
    unsubscribe,
    set,
    update,
    overwrite,
    remove,
    query,
  };

}