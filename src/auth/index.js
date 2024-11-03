import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "firebase/auth";

import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";

let subscribers = [];
let resolvers = [];
let userId = undefined; // undefined until we know the user status
let user = undefined;   // either the user object or false if not logged in

function emit() {
  if (userId === undefined) return;
  while (resolvers.length) {
    resolvers.shift()?.(get());
  }
  for (let subscriber of subscribers) {
    subscriber?.(get());
  }
}

let init = () => {
  init = () => null;

  let offSnapshot;

  onAuthStateChanged(getAuth(), async data => {
    if (offSnapshot) {
      offSnapshot();
      offSnapshot = undefined;
    }

    // If the user is newly logged in, subscribe to their user document,
    // and emit the new user object to all subscribers.
    if (data?.uid && !userId) {
      userId = data.uid;
      offSnapshot = onSnapshot(doc(getFirestore(), `users/${userId}`), snap => {
        user = snap.data();
        emit();
      });
    }

    // If the user is newly logged out, 
    // emit a logged out state to all subscribers.
    if(userId !== false && !data?.uid) {
      userId = false;
      user = false;
      emit();
    }
  });
}

function subscribe(callback) {
  subscribers.push(callback);
  emit();
  init();
  return () => subscribers = subscribers.filter(cb => cb != callback);
}

function set(data) {
  if (!userId) return;
  let {id, ...update} = data;
  updateDoc(doc(getFirestore(), `users/${userId}`), update);
}

function get() {
  if(!userId) return false;
  return {id:userId, ...user};
}

export async function login(email, password) {
  let auth = await signInWithEmailAndPassword(getAuth(), email, password);
  userId = auth.user.uid;
  let user = {
    dateLastLogin: (new Date()).toISOString(),
  };
  await updateDoc(doc(getFirestore(), `users/${userId}`), user);
  init();
}

export async function logout() {
  return signOut(getAuth());
}

export async function register(email, password) {
  let auth = await createUserWithEmailAndPassword(getAuth(), email, password);
  userId = auth.user.uid;
  user = {
    email,
    dateCreated: (new Date()).toISOString(),
    dateLastLogin: (new Date()).toISOString(),
  };
  await setDoc(doc(getFirestore(), `users/${userId}`), user);
  return userId;
}

export async function resetPassword(email) {
  return sendPasswordResetEmail(getAuth(), email);
}

export function then(callback) {
  if(userId && user) {
    callback({id:userId, ...user});
    return;
  }
  resolvers.push(callback);
  init();
}

export default { subscribe, set, get, login, logout, register, resetPassword, then };