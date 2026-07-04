import API from "./api";

export const getChatMessages = async (chatId) => {
  const { data } = await API.get(`/messages/${chatId}`);
  return data;
};

export const sendChatMessage = async (chatId, payload) => {
  const { data } = await API.post(`/messages/${chatId}`, payload);
  return data;
};