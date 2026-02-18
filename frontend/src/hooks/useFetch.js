import { useEffect, useState } from 'react';
import api from '../services/api';

export default function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    api
      .get(url)
      .then((response) => mounted && setData(response.data))
      .catch((err) => mounted && setError(err))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [url]);

  return { data, loading, error };
}
