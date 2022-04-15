import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

export function connectFirestore(hostname="localhost", port=8080) {
  connectFirestoreEmulator(getFirestore(), hostname, port);
}

export function connectDatabase(hostname="localhost", port=9000) {
  connectDatabaseEmulator(getDatabase(), hostname, port);
}