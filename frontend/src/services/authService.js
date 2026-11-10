import api, { TOKEN_STORAGE_KEY } from './api';

export const authService = {
  async register(payload) {
    const { data } = await api.post('/auth/register', payload);
    if (data?.access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
    }
    return data;
  },

  async login(payload) {
    const { data } = await api.post('/auth/login', payload);
    if (data?.access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
    }
    return data;
  },

  async getMe() {
    const { data } = await api.get('/auth/me');
    return data;
  },

  async forgotPassword(email) {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  async resetPassword(payload) {
    const { data } = await api.post('/auth/reset-password', payload);
    return data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on stateless JWT logout
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  },

  async updateProfile(payload) {
    const { data } = await api.patch('/auth/profile', payload);
    return data;
  },

  async changePassword(payload) {
    const { data } = await api.post('/auth/change-password', payload);
    return data;
  },

  async deleteAccount(password) {
    const { data } = await api.delete('/auth/account', { data: { password } });
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return data;
  },
};

