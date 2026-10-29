import { useEffect, useState } from 'react';
import { readStored, writeStored } from '../src/local-store.js';

/** useState that starts from the saved JSON value under `key` and saves each change. */
export default function useStoredState(key, fallback, normalize) {
  const [value, setValue] = useState(() => readStored(key, fallback, normalize));
  useEffect(() => { writeStored(key, value); }, [key, value]);
  return [value, setValue];
}
