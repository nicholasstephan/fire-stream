import assert from 'assert';
import { getDatabase, ref, onValue, off, get, set, update, push, remove } from "firebase/database";

import { connectDatabase, connectFirestore } from './src/emulators.js';
import { initializeApp } from './index.js';
import database from './src/database.js';


console.log('env', JSON.stringify(process.env, null, 2));

initializeApp({
  projectId: process.env.GCLOUD_PROJECT,
  databaseURL: process.env.FIREBASE_DATABASE_EMULATOR_HOST,
});

connectDatabase();
connectFirestore();

describe('Sanity', function() {
  
  it('true == true', function() {
    assert.equal(true, true);
  });
  
  it('false != true', function() {
    assert.notEqual(true, false);
  });

  it('can read from and write to database', async function(done) {
    let loc = ref(getDatabase(), 'door');
    await set(loc, "Come on, baby, light my fire");
    console.log('done setting');
    let snap = await get(loc);
    console.log('done');
    console.log('val', snap.val());
    done();
  })

});


describe('Realtime Database', function() {

  xit('can read async', async function() {
    await set(ref(getDatabase(), 'door'), "Come on, baby, light my fire");
    let val = await database("door");
    console.log('val', val);
    assert.equal(val, "Come on, baby, light my fire");
  });

});