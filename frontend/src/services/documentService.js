import api from './api';

export const documentService = {
  async uploadDocument(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (!onProgress || !progressEvent.total) return;
        const pct = Math.min(100, Math.round((progressEvent.loaded * 100) / progressEvent.total));
        onProgress(pct);
      },
    });
    return data;
  },

  async getDocuments(params = {}) {
    const { data } = await api.get('/documents', { params });
    return data;
  },

  async getDocument(documentId) {
    const { data } = await api.get(`/documents/${documentId}`);
    return data;
  },

  async deleteDocument(documentId) {
    const { data } = await api.delete(`/documents/${documentId}`);
    return data;
  },
};

