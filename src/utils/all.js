/* 
Map one subscription to another. 
*/

export default function all(stores) {
  return {
    subscribe(callback) {
      let values = stores.map(() => undefined);

      let subscriptions = stores.map((store, i) => {
        return store.subscribe(value => {
          values[i] = value;
          if(values.every(value => value !== undefined)) {
            callback(values);
          }
        });
      });

      return function unsubscribeAll() {
        subscriptions.forEach(unsubscribe => unsubscribe());
      }
    }
  }
}