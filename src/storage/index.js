import {
  getStorage,
  ref,
  deleteObject,
  uploadBytesResumable,
} from "firebase/storage";

import {
  getFirestore,
  collection,
  doc,
  deleteDoc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";


export default function (folder) {
  return {
    upload: (e, callback) => upload(folder, e, callback),
    remove: id => remove(id),
  };
};

export async function upload(folder, files, callback) {
  if (!files) return;
  if (files?.target?.files) files = files.target.files; // if files is an upload event
  if (files?.target?.result) files = [base64ToFile(files.target.result, files.name)]; // if files is a FileReader load event
  if (!files?.length) files = [files]; // make sure it's a list

  if (!folder) {
    folder = "uploads";
  }

  let uploads = [];
  let res = [];

  let filesCol = collection(getFirestore(), `files`);

  let userId = getAuth().currentUser?.uid || null;

  for (let file of files) {

    let fileDoc = await addDoc(filesCol, {
      dateCreated: serverTimestamp(),
      folder: folder,
      name: file.name || "Untitled",
      type: file.type,
      size: file.size,
      uploadProgress: 0,
      createdByUserId: userId,
    });

    let id = fileDoc.id;

    let location = `${folder}/${id}/${file.name}`
    let storageRef = ref(getStorage(), location);

    uploads.push(new Promise((resolve, reject) => {
      uploadBytesResumable(storageRef, file)
        .on('state_changed',
          (snapshot) => {
            updateDoc(fileDoc, { uploadProgress: snapshot.bytesTransferred / snapshot.totalBytes });
          },
          (uploadError) => {
            updateDoc(fileDoc, { uploadError: uploadError.toString() });
            reject(uploadError);
          },
          async () => {
            await updateDoc(fileDoc, {
              location: location,
              uploadProgress: deleteField(),
              uploadError: deleteField(),
            });
            resolve();
          }
        );

      res.push(id);
    }));
  }

  if (res.length == 1) {
    res = res[0];
  }

  Promise.all(uploads).then(() => callback && callback(res));

  return res;
}

export async function remove(id) {
  let fileRef = doc(getFirestore(), `files/${id}`);
  let fileDoc = await getDoc(fileRef);
  if (!fileDoc.exists()) {
    return;
  }
  let file = fileDoc.data();

  // remove original.
  let storageRef = ref(getStorage(), file.location);
  await deleteObject(storageRef);

  // remove each derrived
  for (let derivedId in file.derived || {}) {
    let location = file.derived[derivedId].location;
    if (!location) {
      continue;
    }
    let storageRef = ref(getStorage(), location);
    await deleteObject(storageRef);
  }

  await deleteDoc(fileRef);
}

export function base64ToFile(str, filename = "Untitled") {
  let res = str.split(',');
  let mime = res[0].match(/:(.*?);/)[1];
  let bstr = atob(res[1]);
  let n = bstr.length;
  let u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}
