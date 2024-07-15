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
  if (user === undefined) return;
  let data = {id:userId, ...user};
  while (resolvers.length) {
    resolvers.shift()?.(data);
  }
  for (let subscriber of subscribers) {
    subscriber?.(data);
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

    if (data?.uid) {
      userId = data.uid;
      offSnapshot = onSnapshot(doc(getFirestore(), `users/${userId}`), snap => {
        user = snap.data();
        emit();
      });
    }
    else if(user !== undefined) {
      userId = false;
      user = false;
      emit();
    }

  });
}

function subscribe(callback) {
  init();
  subscribers.push(callback);
  if (user !== undefined) {
    callback(user);
  }
  return () => subscribers = subscribers.filter(cb => cb != callback);
}

function set(data) {
  if (!userId) return;
  let {id, ...update} = data;
  updateDoc(doc(getFirestore(), `users/${userId}`), update);
}

function get() {
  return user;
}

export function resetAuth() {
  userId = undefined;
  user = undefined;
}

export async function login(email, password) {
  let auth = await signInWithEmailAndPassword(getAuth(), email, password);
  userId = auth.user.uid;
  let user = {
    dateLastLogin: (new Date()).toISOString(),
  };
  await updateDoc(doc(getFirestore(), `users/${userId}`), user);
}

export async function logout() {
  userId = false;
  user = false;
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

export default { subscribe, set, get, login, logout, register, resetPassword };