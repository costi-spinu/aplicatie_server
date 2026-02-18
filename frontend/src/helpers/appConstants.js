export const APP_NAME = 'Budget App';
// export const API_BASE_URL = 'http://127.0.0.1:8000/api/';


const apiOrigin = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api/`;
export const API_BASE_URL = apiOrigin.endsWith('/') ? apiOrigin : `${apiOrigin}/`;