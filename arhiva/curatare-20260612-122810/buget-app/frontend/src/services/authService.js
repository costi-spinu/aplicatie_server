import api from './apiConfig';

export const getCurrentUser = () => api.get('me/');
