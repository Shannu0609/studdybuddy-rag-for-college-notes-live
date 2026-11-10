import api from './api';

export const chatService = {
  async askQuestion({ question, conversationId = null, documentIds = [] }) {
    const { data } = await api.post('/chat/ask', {
      question,
      conversation_id: conversationId,
      document_ids: documentIds,
    });
    return data;
  },

  async getHistory(search = '') {
    const params = search.trim() ? { search: search.trim() } : {};
    const { data } = await api.get('/chat/history', { params });
    return data;
  },

  async getConversation(conversationId) {
    const { data } = await api.get(`/chat/${conversationId}`);
    return data;
  },

  async clearConversation(conversationId) {
    const { data } = await api.post(`/chat/${conversationId}/clear`);
    return data;
  },

  async deleteConversation(conversationId) {
    const { data } = await api.delete(`/chat/${conversationId}`);
    return data;
  },

  async clearAllHistory() {
    const { data } = await api.delete('/chat/history');
    return data;
  },
};

