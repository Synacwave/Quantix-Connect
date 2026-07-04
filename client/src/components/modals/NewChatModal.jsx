import React, { useEffect, useState } from "react";
import {
  createDMChat,
  createGroupChat,
  searchUsers,
} from "../../services/chatService";

const NewChatModal = ({ open, onClose, onChatCreated }) => {
  const [mode, setMode] = useState("dm");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;

    const runSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      try {
        setSearching(true);
        const data = await searchUsers(query.trim());
        setResults(data.users || []);
      } catch (error) {
        console.error("User search error:", error);
      } finally {
        setSearching(false);
      }
    };

    const timer = setTimeout(runSearch, 350);
    return () => clearTimeout(timer);
  }, [query, open]);

  const resetModal = () => {
    setMode("dm");
    setQuery("");
    setResults([]);
    setSelectedUsers([]);
    setGroupName("");
    setGroupDescription("");
    setLoading(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const toggleUser = (user) => {
    const exists = selectedUsers.some((u) => u._id === user._id);

    if (exists) {
      setSelectedUsers((prev) => prev.filter((u) => u._id !== user._id));
      return;
    }

    setSelectedUsers((prev) => [...prev, user]);
  };

  const handleCreateDM = async (userId) => {
    try {
      setLoading(true);
      const data = await createDMChat(userId);
      onChatCreated(data.chat);
      handleClose();
    } catch (error) {
      console.error("Create DM error:", error);
      alert(error?.response?.data?.message || "Failed to create DM");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      return alert("Enter a group name");
    }

    if (selectedUsers.length < 1) {
      return alert("Select at least one user");
    }

    try {
      setLoading(true);
      const data = await createGroupChat({
        name: groupName.trim(),
        description: groupDescription.trim(),
        participantIds: selectedUsers.map((u) => u._id),
      });

      onChatCreated(data.chat);
      handleClose();
    } catch (error) {
      console.error("Create group error:", error);
      alert(error?.response?.data?.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="qx-modal-backdrop" onClick={handleClose}>
      <div className="qx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qx-modal-head">
          <div>
            <h3>Start Something</h3>
            <p>Create a DM or spin up a group.</p>
          </div>
          <button className="qx-modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="qx-modal-switch">
          <button
            className={mode === "dm" ? "active" : ""}
            onClick={() => setMode("dm")}
          >
            Direct Message
          </button>
          <button
            className={mode === "group" ? "active" : ""}
            onClick={() => setMode("group")}
          >
            Group Chat
          </button>
        </div>

        {mode === "group" ? (
          <div className="qx-group-fields">
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Group description (optional)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
            />
          </div>
        ) : null}

        <div className="qx-modal-search">
          <input
            type="text"
            placeholder={mode === "dm" ? "Search users to message..." : "Search users to add..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {mode === "group" && selectedUsers.length > 0 ? (
          <div className="qx-selected-users">
            {selectedUsers.map((user) => (
              <button
                key={user._id}
                className="qx-selected-chip"
                onClick={() => toggleUser(user)}
              >
                {user.fullName || user.username} ✕
              </button>
            ))}
          </div>
        ) : null}

        <div className="qx-modal-results">
          {searching ? (
            <div className="qx-modal-empty">Searching...</div>
          ) : results.length === 0 ? (
            <div className="qx-modal-empty">No users found yet.</div>
          ) : (
            results.map((user) => {
              const selected = selectedUsers.some((u) => u._id === user._id);

              return (
                <div key={user._id} className="qx-user-result">
                  <div className="qx-user-result-left">
                    <div className="qx-user-result-avatar">
                      {(user.fullName?.[0] || user.username?.[0] || "Q").toUpperCase()}
                    </div>
                    <div>
                      <strong>{user.fullName || user.username}</strong>
                      <span>@{user.username}</span>
                    </div>
                  </div>

                  {mode === "dm" ? (
                    <button
                      className="qx-user-result-btn"
                      onClick={() => handleCreateDM(user._id)}
                      disabled={loading}
                    >
                      Message
                    </button>
                  ) : (
                    <button
                      className={`qx-user-result-btn ${selected ? "selected" : ""}`}
                      onClick={() => toggleUser(user)}
                      disabled={loading}
                    >
                      {selected ? "Added" : "Add"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {mode === "group" ? (
          <div className="qx-modal-actions">
            <button className="qx-modal-ghost" onClick={handleClose}>
              Cancel
            </button>
            <button className="qx-modal-primary" onClick={handleCreateGroup} disabled={loading}>
              {loading ? "Creating..." : "Create Group"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default NewChatModal;