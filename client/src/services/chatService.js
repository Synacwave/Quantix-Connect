import API from "./api";

export const getUserChats = async () => {
  const { data } = await API.get("/chats");
  return data;
};

export const getSingleChat = async (chatId) => {
  const { data } = await API.get(`/chats/${chatId}`);
  return data;
};

export const searchUsers = async (query) => {
  const { data } = await API.get(`/chats/users/search?q=${encodeURIComponent(query)}`);
  return data;
};

export const createDMChat = async (userId) => {
  const { data } = await API.post("/chats/dm", { userId });
  return data;
};

export const createGroupChat = async ({ name, description, participantIds }) => {
  const { data } = await API.post("/chats/group", {
    name,
    description,
    participantIds,
  });
  return data;
};