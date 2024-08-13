import {
  getStorage,
  ref,
  deleteObject,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
  increment,
} from "firebase/firestore";


export default function (folder = "uploads") {
  return {
    upload: e => upload(folder, e),
    remove: id => remove(id),
    url: id => url(folder, id),
    use: id => use(id),
  };
};

export async function url(folder, id) {
  if(typeof folder === "object") {
    id = folder?.storageId || folder?.id;
    folder = folder?.folder;
  }
  try {
    let url = await getDownloadURL(ref(getStorage(), `${folder}/${id}`));
    return url;
  }
  catch(e) {
    return "";
  }
}

export async function upload(folder, files, callback) {
  if (!files) {
    console.warn("A file upload requires a file.");
    return;
  }
  if (!folder) {
    console.warn("A file upload requires a folder.");
    return;
  }
  if (files?.target?.files) files = files.target.files; // if files is an upload event
  if (files?.target?.result) files = [base64ToFile(files.target.result, files.name)]; // if files is a FileReader load event
  if (files?.buffer) files = files.buffer; // for Unit8Arrays
  if (!files?.length) files = [files]; // make sure it's a list

  let uploads = [];
  let res = [];

  let filesCol = collection(getFirestore(), `files`);

  for (let file of files) {

    let fileDoc = await addDoc(filesCol, {
      dateCreated: serverTimestamp(),
      folder: folder,
      name: file.name || null,
      type: file.type,
      size: file.size,
      uploadProgress: 0,
      useCount: 0,
    });

    let id = fileDoc.id;

    let location = `${folder}/${id}`
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

  Promise.all(uploads).then(() => callback?.(res));

  return res;
}

export async function use(id) {
  let fileRef = doc(getFirestore(), `files/${id}`);
  await updateDoc(fileRef, { useCount: increment(1) });
}

export async function remove(id) {
  let fileRef = doc(getFirestore(), `files/${id}`);
  let fileDoc = await getDoc(fileRef);
  if (!fileDoc.exists()) {
    return;
  }
  let file = fileDoc.data();

  if(file.useCount > 1) {
    await updateDoc(fileRef, { useCount: increment(-1) });
    return;
  }

  await deleteObject(ref(getStorage(), file.location));

  await updateDoc(fileRef, { dateRemoved: serverTimestamp(), useCount: 0 });
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
