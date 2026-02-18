import { useState } from 'react';

export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  });

  const setStoredValue = (next) => {
    setValue(next);
    localStorage.setItem(key, JSON.stringify(next));
  };

  return [value, setStoredValue];
}
