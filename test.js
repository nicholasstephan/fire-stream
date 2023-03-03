import assert from 'assert';
import sinon from 'sinon';
import { initializeApp, getApp } from "firebase/app";
import { getDatabase, ref, onValue, off, get, set, update, push, remove, connectDatabaseEmulator,  } from "firebase/database";
import { getFirestore, connectFirestoreEmulator, initializeFirestore, doc, collection, query, setDoc, getDoc, getDocs, addDoc } from "firebase/firestore";

import firestore from "./src/firestore/index.js";
import database from "./src/database/index.js";

const wait = async (timeout, ...result) => {
  return new Promise(resolve => {
    setTimeout(resolve, timeout, ...result);
  });
};

initializeApp({
  projectId: process.env.GCLOUD_PROJECT,
  databaseURL: process.env.FIREBASE_DATABASE_EMULATOR_HOST,
});

initializeFirestore(getApp(), {
  ignoreUndefinedProperties: true,
});

await connectFirestoreEmulator(getFirestore(), 'localhost', 8080);
await connectDatabaseEmulator(getDatabase(), "localhost", 9000);


describe('Sanity', function() {
  
  it('true == true', function() {
    assert.equal(true, true);
  });
  
  it('false != true', function() {
    assert.notEqual(true, false);
  });

  it('can read from and write to database', async function() {
    const testValue = "Come on, baby, light my fire";

    let loc = ref(getDatabase(), '/door');

    await set(loc, testValue);
    
    let snap = await get(loc);

    assert.equal(snap.val(), testValue);
  })

});

describe('Firestore Document Reads', function() {

  it('as a promise', async function() {

    const id = `doc${Date.now()}`;

    const testValue = {
      value: "Come on, baby, light my fire"
    };

    await setDoc(doc(getFirestore(), "test", id), testValue);

    let value = await firestore(`test/${id}`);

    assert.deepEqual(value, testValue);

  });

  it('as a subscription', async function() {

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

  it('in real time', async function() {
    
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

});

describe('Firestore Document Writes', function() {
  
  it('without overwriting existing data', async function() {

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
  
});

describe('Firestore Collection Reads', function() {

  it('as a promise', async function() {

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

  it('in real time', async function() {

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

  it('filtered', async function() {
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

});


describe('Firestore Collection Writes', function() {

  it('add a document', async function() {

    let line = "I'm a firestarter, twisted firestarter";
    await firestore("prodegy").add({line});

    let snap = await getDocs(query(collection(getFirestore(), "prodegy")));
    let data = snap.docs.map(d => d.data());

    assert.equal(data.length, 1);
    assert.equal(data[0].line, line);

  });

});

describe('Firebase Database', function() {

  it('can read a value', async function() {
    
    const value = "I'm a firestarter, twisted firestarter";

    await set(ref(getDatabase(), "prodegy"), value);

    let data = await database("prodegy");

    assert.equal(data, value);
  
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

  it('can write a value', async function() {

    const value = "Fight fire with fire";
    
    await database("metallica").update(value);  
    
    let snap = await get(ref(getDatabase(), "metallica"));
    
    assert.equal(snap.val(), value);

  });

});