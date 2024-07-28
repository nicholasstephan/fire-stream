import assert from 'assert';
import sinon from 'sinon';
import { initializeApp, getApp } from "firebase/app";
import { getDatabase, ref, get, set, connectDatabaseEmulator } from "firebase/database";
import { getFirestore, connectFirestoreEmulator, initializeFirestore, doc, collection, query, setDoc, getDoc, getDocs, addDoc } from "firebase/firestore";
import { getStorage, connectStorageEmulator, uploadBytes, ref as storageRef, getDownloadURL } from "firebase/storage";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { JSDOM } from "jsdom";
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const { window } = new JSDOM('');
global.Blob = window.Blob;
global.File = window.File;
global.atob = window.atob;

import firestore from "./src/firestore/index.js";
import database from "./src/database/index.js";
import storage from "./src/storage/index.js";
import auth, { resetAuth } from "./src/auth/index.js";

initializeApp({
  apiKey: "AIzaSyBWUF4koDWXY5EZiPB7L-PrzCGtqm9ARCs",
  authDomain: "fire-stream-e747b.firebaseapp.com",
  databaseURL: "https://fire-stream-e747b-default-rtdb.firebaseio.com",
  projectId: "fire-stream-e747b",
  storageBucket: "fire-stream-e747b.appspot.com",
  messagingSenderId: "451639905339",
  appId: "1:451639905339:web:1ff409a4238b2e5de5201e"
});

initializeFirestore(getApp(), {
  ignoreUndefinedProperties: true,
});

await connectFirestoreEmulator(getFirestore(), '127.0.0.1', 8080);
await connectDatabaseEmulator(getDatabase(), "127.0.0.1", 9000);
await connectStorageEmulator(getStorage(), '127.0.0.1', 9199);
await connectAuthEmulator(getAuth(), `http://127.0.0.1:9099`);

async function wait(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}


describe('Sanity', function() {
  
  it('true == true', function() {
    assert.equal(true, true);
  });
  
  it('false != true', function() {
    assert.notEqual(true, false);
  });

  it('can read from and write to database', async function() {
    try {
      const testValue = "Come on, baby, light my fire";
      let loc = ref(getDatabase(), '/door');
      await set(loc, testValue);
      let snap = await get(loc);
      assert.equal(snap.val(), testValue);
    }
    catch(error) {
    }
  });

  it('can read and write from storage', async function() {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);
    const id = `file${Date.now()}`;
    const location = `uploads/${id}/test.txt`;

    await setDoc(doc(getFirestore(), "files", id), {
      name: "test.txt",
      location: location,
    });

    let snap = await uploadBytes(storageRef(getStorage(), location), data.buffer);
    assert.ok(snap);

    let url = await getDownloadURL(storageRef(getStorage(), location));
    assert.ok(url);
    
    let result = await fetch(url).then(res => res.text());
    
    assert.strictEqual(new TextDecoder().decode(data), result);
    
  });

});

describe('Firestore', function() {

  it('read document as a promise', async function() {

    const id = `doc${Date.now()}`;

    const testValue = {
      value: "Come on, baby, light my fire"
    };

    await setDoc(doc(getFirestore(), "test", id), testValue);

    let value = await firestore(`test/${id}`);

    assert.deepEqual(value, testValue);

  });

  it('read document as a subscription', async function() {

    const id = `doc${Date.now()}`;
      
    const testValue = {
      id: id,
      value: "Come on, baby, light my fire",
    };

    await setDoc(doc(getFirestore(), "test", id), testValue);

    let value = await new Promise(resolve => {
      let unsubscribe = firestore(`test/${id}`).subscribe(val => {
        resolve(val);
        unsubscribe();
      });
    });

    assert.deepEqual(value, testValue);

  });

  it('read document in real time', async function() {
    
    const id = `doc${Date.now()}`;
    const callback = sinon.spy();

    const testValue1 = {
      id: id,
      value: "Come on, baby, light my fire"
    };

    const testValue2 = {
      id: id,
      value: "Try to set the night on fire"
    };

    firestore(`test/${id}`).subscribe(callback);

    await setDoc(doc(getFirestore(), "test", id), testValue1);
    await setDoc(doc(getFirestore(), "test", id), testValue2);

    assert.equal(callback.callCount, 2);
    assert.deepEqual(callback.getCall(0).args[0], testValue1);
    assert.deepEqual(callback.getCall(1).args[0], testValue2);
  });
  
  it('write document without overwriting existing data', async function() {

    const id = `doc${Date.now()}`;

    const testValue1 = {
      value: "Come on, baby, light my fire"
    };

    const testValue2 = {
      value: "Try to set the night on fire"
    };

    await firestore(`test/${id}`).overwrite(testValue1);
    await firestore(`test/${id}`).set(testValue2);

    let snap = await getDoc(doc(getFirestore(), "test", id));

    assert.deepEqual(snap.data(), testValue1);

  });

  it('can set a document', async function() {

    const id = `doc${Date.now()}`;

    const testValue1 = {
      static: "If I was to say to you",
      updated: "Come on, baby, light my fire"
    };

    const testValue2 = {
      updated: "Try to set the night on fire"
    };

    await firestore(`test/${id}`).overwrite(testValue1);

    let testDoc = firestore(`test/${id}`);
    let was = await testDoc;
    testDoc.set(testValue2);

    let snap = await getDoc(doc(getFirestore(), "test", id));
    let snapData = snap.data();

    assert.equal(snapData.updated, testValue2.updated);
    assert.equal(snapData.static, testValue1.static);

  });

  it('can overwrite a document', async function() {

    const id = `doc${Date.now()}`;

    const testValue = {
      value: "Come on, baby, light my fire"
    };

    await firestore(`test/${id}`).overwrite(testValue);

    let snap = await getDoc(doc(getFirestore(), "test", id));

    assert.deepEqual(snap.data(), testValue);

  });

  it('can update a document', async function() {

    const id = `doc${Date.now()}`;

    const testValue1 = {
      value: "Come on, baby, light my fire"
    };

    const testValue2 = {
      value: "Try to set the night on fire"
    };

    await firestore(`test/${id}`).overwrite(testValue1);

    let snap = await getDoc(doc(getFirestore(), "test", id));

    assert.deepEqual(snap.data(), testValue1);

    await firestore(`test/${id}`).update(testValue2);

    snap = await getDoc(doc(getFirestore(), "test", id));

    assert.deepEqual(snap.data(), testValue2);

  });

  it('can remove a document', async function() {

    const id = `doc${Date.now()}`;

    const testValue = {
      value: "Come on, baby, light my fire"
    };

    await firestore(`test/${id}`).overwrite(testValue);

    let snap = await getDoc(doc(getFirestore(), "test", id));

    assert.deepEqual(snap.data(), testValue);

    await firestore(`test/${id}`).remove();

    snap = await getDoc(doc(getFirestore(), "test", id));

    assert.equal(snap.exists(), false);
    assert.equal(snap.data(), undefined);

  });

  it('read collection as a promise', async function() {

    let data = [
      {line: "You know that it would be untrue"},
      {line: "You know that I would be a liar"},
      {line: "If I was to say to you"},
      {line: "Girl, we couldn't get much higher"},
    ];

    await addDoc(collection(getFirestore(), "doors"), data[0]);
    await addDoc(collection(getFirestore(), "doors"), data[1]);
    await addDoc(collection(getFirestore(), "doors"), data[2]);
    await addDoc(collection(getFirestore(), "doors"), data[3]);

    let lines = await firestore("doors");

    assert.equal(lines.length, 4);

    assert.ok(lines.find(l => l.line == data[0].line), "Line 1 not found.");
    assert.ok(lines.find(l => l.line == data[1].line), "Line 2 not found.");
    assert.ok(lines.find(l => l.line == data[2].line), "Line 3 not found.");
    assert.ok(lines.find(l => l.line == data[3].line), "Line 4 not found.");

  });

  it('read collection in real time', async function() {

    const line1 = {line:"Smoke on the water"};
    const line2 = {line:"Fire in the sky"};
    const callback = sinon.spy();

    firestore("acdc").subscribe(callback);

    await addDoc(collection(getFirestore(), "acdc"), line1);
    await addDoc(collection(getFirestore(), "acdc"), line2);

    assert.equal(callback.callCount, 2);
    assert.equal(callback.getCall(0).args[0].length, 1);
    assert.equal(callback.getCall(1).args[0].length, 2);

  });

  it('filtered collection', async function() {
    const line1 = {
      number: 1,
      line:"You shake my nerves and you rattle my brain"
    };
    const line2 = {
      number: 2,
      line:"Too much love drives a man insane"
    };
    const line3 = {
      number: 3,
      line:"You broke my will, but what a thrill"
    };
    const line4 = {
      number: 4,
      line:"Goodness gracious, great balls of fire"
    };

    await addDoc(collection(getFirestore(), "lewis"), line1);
    await addDoc(collection(getFirestore(), "lewis"), line2);
    await addDoc(collection(getFirestore(), "lewis"), line3);
    await addDoc(collection(getFirestore(), "lewis"), line4);

    let lines = await firestore({
      url: "lewis",
      where: [
        ['number', '==', 4]
      ]
    });

    assert.equal(lines.length, 1);
    assert.equal(lines[0].line, line4.line);
  });

  it('order and limits and direction', async function() {

    const line1 = {
      number: 1,
      line: "Love is a burning thing"
    };

    const line2 = {
      number: 2,
      line: "And it makes a fiery ring"
    };

    const line3 = {
      number: 3,
      line: "Bound by wild desire"
    };

    const line4 = {
      number: 4,
      line: "I fell into a ring of fire"
    };

    await addDoc(collection(getFirestore(), "cash"), line1);
    await addDoc(collection(getFirestore(), "cash"), line2);
    await addDoc(collection(getFirestore(), "cash"), line3);
    await addDoc(collection(getFirestore(), "cash"), line4);

    let first = await firestore({
      url: "cash",
      orderBy: "line",
      limit: 1
    });

    assert.equal(first.length, 1);
    assert.equal(first[0].line, line2.line);

    let last = await firestore({
      url: "cash",
      orderBy: "line",
      limit: 1,
      direction: "desc"
    });

    assert.equal(last.length, 1);
    assert.equal(last[0].line, line1.line);
    
  });

  it('with updated query', function(done) {

    const line1 = {
      number: 1,
      line: "She's just a girl and she's on fire"
    };

    const line2 = {
      number: 2,
      line: "Hotter than a fantasy, lonely like a highway"
    };

    const line3 = {
      number: 3,
      line: "She's living in a world and it's on fire"
    };

    const line4 = {
      number: 4,
      line: "Filled with catastrophe, but she knows she can fly away"
    };

    Promise.all([
      addDoc(collection(getFirestore(), "keys"), line1),
      addDoc(collection(getFirestore(), "keys"), line2),
      addDoc(collection(getFirestore(), "keys"), line3),
      addDoc(collection(getFirestore(), "keys"), line4)
    ]).then(() => {
    
      let ref = firestore({
        url: "keys",
        orderBy: "number",
        limit: 1
      });
      
      let calls = 0;

      ref.subscribe(res => {
        calls += 1;

        if(calls == 1) {
          assert.equal(res.length, 1);
          ref.query({limit:2}).then(value => {
            assert.equal(value.length, 2);
          });
        }

        if(calls == 2) {
          assert.equal(res.length, 2);
          done();
        }
      });

    });
    
  });

  it('add a document', async function() {

    let line = "I'm a firestarter, twisted firestarter";
    await firestore("prodegy").add({line});

    let snap = await getDocs(query(collection(getFirestore(), "prodegy")));
    let data = snap.docs.map(d => d.data());

    assert.equal(data.length, 1);
    assert.equal(data[0].line, line);

  });

});

describe('Database', function() {

  it('can write a value', async function() {

    const value = "Fight fire with fire";
    
    await database("metallica").update(value);  
    
    let snap = await get(ref(getDatabase(), "metallica"));
    
    assert.equal(snap.val(), value);

  });
  
  it('returns startWith value on undefined', async function() {

    let data = await database("undefined", {
      startWith: "Come on baby light my fire"
    });

    assert.equal(data, "Come on baby light my fire");

  });

  it('can read a value', async function() {
    
    const value = "I'm a firestarter, twisted firestarter";

    await set(ref(getDatabase(), "prodegy"), value);

    let data = await database("prodegy");

    assert.equal(data, value);
  
  });

  it('can read a value as an array', async function() {
    
    const value1 = "I'm a firestarter, twisted firestarter";
    const value2 = "Come on baby light my fire";

    await set(ref(getDatabase(), "array/0"), value1);
    await set(ref(getDatabase(), "array/1"), value2);

    let data = await database("array", {array:true});
    
    assert.equal(data.length, 2);
    assert.equal(data[0], value1);
    assert.equal(data[1], value2);
  
  });

  it('uses startWith option', async function() { 
    const value = {
      line1: "You know that it would be untrue", 
      line2: "You know that I would be a liar"
    };

    const startWith = {
      artist: "The Doors"
    };

    const callback = sinon.spy();

    await set(ref(getDatabase(), "doors2"), value);

    await new Promise(resolve => {
      let count = 0;
      database({url:"doors2", startWith}).subscribe((res) => {
        callback(res);
        if(++count == 2) {
          resolve();
        }
      });
    });

    assert.deepStrictEqual(callback.getCall(0).args[0], startWith);
    assert.deepStrictEqual(callback.getCall(1).args[0], {...startWith, ...value});

  });

  it('can read value in a stream', async function() {
        
    const value1 = "Goodness Gracious";
    const value2 = "Great Balls of Fire!";

    const callback = sinon.spy();

    database("lewis").subscribe(callback);

    await set(ref(getDatabase(), "lewis"), value1);
    await set(ref(getDatabase(), "lewis"), value2);

    assert.equal(callback.callCount, 2);
    assert.equal(callback.getCall(0).args[0], value1);
    assert.equal(callback.getCall(1).args[0], value2);
  
  });

});

describe('Storage', function() {

  it('can read from storage', async function() {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);

    const id = `file${Date.now()}`;
    const location = `uploads/${id}`;

    await setDoc(doc(getFirestore(), "files", id), {
      name: "test.txt",
      location: location,
    });

    let snap = await uploadBytes(storageRef(getStorage(), location), data.buffer);
    assert.ok(snap);

    let url = await storage().url(id);
    
    assert.ok(url);
    
    let result = await fetch(url).then(res => res.text());
    
    assert.strictEqual(new TextDecoder().decode(data), result);
    
  });

  it('can write to storage', async function() {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);

    let id = await storage().upload(data, async () => {

      let url = await getDownloadURL(storageRef(getStorage(), `/uploads/${id}`));
      assert.ok(url);
      
      let result = await fetch(url).then(res => res.text());
      
      assert.strictEqual(new TextDecoder().decode(data), result);

    });

    assert.ok(id);
  });

  it('can creates associated file in firestore', async function() {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);

    let id = storage().upload(data, async () => {
      let snap = await getDoc(doc(getFirestore(), "files", id));
      let snapData = snap.data();

      assert.equal(snapData.location, `uploads/${id}`);
      assert.equal(snapData.folder, 'uploads');
      assert.equal(snapData.useCount, 0);
    });

    assert.ok(id);
  });

  it('can remove from storage', async function() {

    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);

    const id = `file${Date.now()}`;
    const location = `uploads/${id}`;

    await setDoc(doc(getFirestore(), "files", id), {
      name: "test.txt",
      location: location,
      useCount: 1,
    });

    let uploadSnap = await uploadBytes(storageRef(getStorage(), location), data.buffer);
    assert.ok(uploadSnap);

    await storage().remove(id);
    
    let docSnap = await getDoc(doc(getFirestore(), "files", id));
    let docData = docSnap.data();
    assert.ok(docData.dateRemoved);

    try {
      let url = await getDownloadURL(storageRef(getStorage(), location));
    }
    catch(error) {
      assert.equal(error.code, 'storage/object-not-found');
    }
    
  });

  it('will decrement use count', async function() {

    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);

    const id = `file${Date.now()}`;
    const location = `uploads/${id}`;

    await setDoc(doc(getFirestore(), "files", id), {
      name: "test.txt",
      location: location,
      useCount: 3,
    });

    let uploadSnap = await uploadBytes(storageRef(getStorage(), location), data.buffer);
    assert.ok(uploadSnap);

    await storage().remove(id);
    
    let docSnap = await getDoc(doc(getFirestore(), "files", id));
    let docData = docSnap.data();
    assert.equal(docData.dateRemoved, undefined);
    assert.equal(docData.useCount, 2);

    let url = await getDownloadURL(storageRef(getStorage(), location));
    assert.ok(url);
    
  });

  it('will store file added to database', async function() {

    this.timeout(10000); // sets timeout to 10 seconds
    
    let file = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);

    let data = {
      name: "Doors",
      file: {
        file: file,
      }
    };

    await database("file").set(data);

    await wait(1000);

    let snap = await get(ref(getDatabase(), "file"));
    let snapData = snap.val();

    assert.equal(snapData.name, data.name);
    assert.ok(snapData.file.folder);
    assert.ok(snapData.file.storageId);

    let value = await firestore(`files/${snapData.file.storageId}`);

    assert.ok(value);

  });

  it('will remove stored file on database change', async function() {

    // add a file and associated firestore entry
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);

    const id = `file${Date.now()}`;
    const location = `uploads/${id}`;

    await setDoc(doc(getFirestore(), "files", id), {
      name: "test.txt",
      location: location,
      useCount: 1,
    });

    let uploadSnap = await uploadBytes(storageRef(getStorage(), location), data.buffer);
    assert.ok(uploadSnap);

    const value = {
      name: "Fire Starter",
      file: {
        folder: 'uploads',
        storageId: id,
      }
    };

    await set(ref(getDatabase(), "prodegy"), value);

    await database("prodegy").overwrite({
      name: "Fire Starter"
      // note that the file property is missing
    });

    await wait(1000);

    // check the file is removed from storage
    let docSnap = await getDoc(doc(getFirestore(), "files", id));
    let docData = docSnap.data();

    assert.ok(docData.dateRemoved);

    try {
      await getDownloadURL(storageRef(getStorage(), location));
    }
    catch(error) {
      assert.equal(error.code, 'storage/object-not-found');
    }

  });

  it('will remove stored file on database remove', async function() {

    this.timeout(10000); // sets timeout to 10 seconds

    // add a file and associated firestore entry
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);

    const id = `file${Date.now()}`;
    const location = `uploads/${id}`;

    await setDoc(doc(getFirestore(), "files", id), {
      name: "test.txt",
      location: location,
      useCount: 1,
    });

    let uploadSnap = await uploadBytes(storageRef(getStorage(), location), data.buffer);
    assert.ok(uploadSnap);

    const value = {
      name: "Fire Starter",
      file: {
        folder: 'uploads',
        storageId: id,
      }
    };

    await set(ref(getDatabase(), "prodegy"), value);

    await database("prodegy").remove();

    await wait(1000);

    // check the file is removed from storage
    let docSnap = await getDoc(doc(getFirestore(), "files", id));
    let docData = docSnap.data();

    assert.ok(docData.dateRemoved);

    try {
      await getDownloadURL(storageRef(getStorage(), location));
    }
    catch(error) {
      assert.equal(error.code, 'storage/object-not-found');
    }

  });

  it('will remove stored file on database file replaced', async function() {

    // add a file and associated firestore entry
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);

    const id = `file${Date.now()}`;
    const location = `uploads/${id}`;

    await setDoc(doc(getFirestore(), "files", id), {
      name: "test.txt",
      location: location,
      useCount: 1,
    });

    let uploadSnap = await uploadBytes(storageRef(getStorage(), location), data.buffer);
    assert.ok(uploadSnap);

    const value = {
      name: "Fire Starter",
      file: {
        folder: 'uploads',
        storageId: id,
      }
    };

    await set(ref(getDatabase(), "prodegy"), value);

    await database("prodegy").overwrite({
      name: "Fire Starter",
      file: {
        file: data
      }
    });

    await wait(1000);

    // check the file is removed from storage
    let docSnap = await getDoc(doc(getFirestore(), "files", id));
    let docData = docSnap.data();

    assert.ok(docData.dateRemoved);

    try {
      await getDownloadURL(storageRef(getStorage(), location));
    }
    catch(error) {
      assert.equal(error.code, 'storage/object-not-found');
    }

    let newData = await database("prodegy");

    assert.notEqual(newData.file.storageId, id);

  });

  it('will increment use count when used in database', async function() {
    this.timeout(10000); // sets timeout to 10 seconds

    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);
    
    await database("metallica2").overwrite({
      name: "Metallica",
      file: {
        file: data,
      }
    });

    await wait(1000);

    let metallica = await database("metallica2");
    let storageId = metallica.file.storageId;
    let file = metallica.file;

    let docSnap = await getDoc(doc(getFirestore(), "files", storageId));
    let docData = docSnap.data();

    wait(100);

    assert.ok(storageId);
    assert.equal(docData.useCount, 1);

    await database("doors2").overwrite({
      name: "Doors",
      file: file,
    });

    wait(100);

    docSnap = await getDoc(doc(getFirestore(), "files", storageId));
    docData = docSnap.data();

    assert.equal(docData.useCount, 2);

  });

  it('will add file on database update', async function() {

    let db = database("file");

    await db.overwrite({
      name: "Doors",
    });

    await db.update({
      file: {
        file: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]),
      }
    });

    await wait(1000);

    let snap = await get(ref(getDatabase(), "file"));
    let snapData = snap.val();

    assert.equal(snapData.name, "Doors");
    assert.ok(snapData.file.folder);
    assert.ok(snapData.file.storageId);

    let value = await firestore(`files/${snapData.file.storageId}`);

    assert.ok(value);
  });

  it('will remove file on database update', async function() {

    this.timeout(10000); // sets timeout to 10 seconds

    // add a file and associated firestore entry
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21]);

    const id = `file${Date.now()}`;
    const location = `uploads/${id}`;

    await setDoc(doc(getFirestore(), "files", id), {
      name: "test.txt",
      location: location,
      useCount: 1,
    });

    let uploadSnap = await uploadBytes(storageRef(getStorage(), location), data.buffer);
    assert.ok(uploadSnap);

    const value = {
      name: "Fire Starter",
      file: {
        folder: 'uploads',
        storageId: id,
      }
    };

    await set(ref(getDatabase(), "prodegy"), value);


    await database("prodegy").update({
      file: null,
    });

    await wait(1000);

    // check the file is removed from storage
    let docSnap = await getDoc(doc(getFirestore(), "files", id));
    let docData = docSnap.data();

    assert.ok(docData.dateRemoved);

    try {
      await getDownloadURL(storageRef(getStorage(), location));
    }
    catch(error) {
      assert.equal(error.code, 'storage/object-not-found');
    }


  });

});

describe('Auth', function() {

  it('shows as logged out', async function() {
    this.timeout(10000); // sets timeout to 10 seconds
    resetAuth();

    const callback = sinon.spy();
    auth.subscribe(callback);

    await wait(1000);

    assert.equal(callback.callCount, 1);
    // assert.equal(callback.getCall(0).args[0], undefined);
    // assert.equal(callback.getCall(1).args[0], false);
    assert.equal(callback.getCall(0).args[0], false);
  });

  it('can register', async function() {
    this.timeout(10000); // sets timeout to 10 seconds
    resetAuth();

    await auth.register('alberto.rvx@gmail.com', 'testing');
    let user = auth.get();
    assert.ok(user);
    assert.ok(user.dateCreated);
    assert.ok(user.dateLastLogin);
    assert.equal(user.email, 'alberto.rvx@gmail.com');
  });

  it('can log out and back in', async function() {
    this.timeout(10000); // sets timeout to 10 seconds
    resetAuth();
    
    let email = 'alberto.rvx+2@gmail.com'

    await auth.register(email, 'testing');
    let user = auth.get();
    assert.ok(user);
    assert.ok(user.dateCreated);
    assert.ok(user.dateLastLogin);
    assert.ok(user.id);
    assert.equal(user.email, email);

    await auth.logout();

    await wait(100);

    user = auth.get();
    assert.equal(user, false);
  });

  it('can subscribe to user status', async function() {
    this.timeout(10000); // sets timeout to 10 seconds
    resetAuth();

    const callback = sinon.spy();
    const email = 'alberto.rvx+3@gmail.com';

    auth.subscribe(callback);
    
    await auth.register(email, 'testing');
    await wait(100);
    assert.equal(callback.callCount, 1);
    assert.equal(callback.getCall(0).args[0].email, email);
    
    await auth.logout();
    await wait(100);
    assert.equal(callback.callCount, 2);
    assert.equal(callback.getCall(1).args[0], false);
    
    await auth.login(email, 'testing');
    await wait(100);
    assert.equal(callback.callCount, 3);
    assert.equal(callback.getCall(2).args[0].email, email);
  });

  it('can subscribe to user info', async function() {
    this.timeout(10000); // sets timeout to 10 seconds
    resetAuth();

    const callback = sinon.spy();
    const email = 'alberto.rvx+4@gmail.com';

    auth.subscribe(callback);
    
    await auth.register(email, 'testing');
    await wait(100);
    assert.equal(callback.callCount, 1);
    assert.equal(callback.getCall(0).args[0].email, email);
    
    auth.set({name: 'Alberto'});
    await wait(100);
    assert.equal(callback.callCount, 2);
    assert.equal(callback.getCall(1).args[0].name, "Alberto");
  });

});