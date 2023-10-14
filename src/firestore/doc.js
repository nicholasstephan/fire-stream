import {
  getFirestore,
  doc as docRef,
  setDoc,
  updateDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

export default function doc(options) {

  const url = options.url;
  const ref = docRef(getFirestore(), url);

  let subscribers = [];
  let value = options.startWith ? { ...options.startWith } : undefined;
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
    if (value) callback(value);

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
        console.warn(`WARNING: You're trying to set a document (${url}) before it has been loaded.`);
        return;
      }
    }
    let {id, ...data} = val;
    if(window?.firestreamLog) {
      console.log("UPDATE", url, val);
    }
    return updateDoc(ref, data);
  }

  function update(val) {
    let {id, ...data} = val;
    if(window?.firestreamLog) {
      console.log("UPDATE", url, val);
    }
    return updateDoc(ref, data);
  }

  function overwrite(val) {
    let {id, ...data} = val;
    if(window?.firestreamLog) {
      console.log("SET", url, val);
    }
    return setDoc(ref, data);
  }

  function remove() {
    if(window?.firestreamLog) {
      console.log("REMOVE", url, val);
    }
    return deleteDoc(ref);
  }

  return {
    then,
    subscribe,
    unsubscribe,
    set,
    update,
    overwrite,
    remove,
  };

}