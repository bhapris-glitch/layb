'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../lib/api';
import { MessageSquare, Send, User } from 'lucide-react';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Load conversations on mount
  useEffect(() => {
    async function loadConversations() {
      try {
        const data = await fetchApi('/conversations');
        setConversations(data.data || []);
        if (data.data?.length > 0) setActiveChat(data.data[0]);
      } catch (err) {
        console.error('Failed to load conversations', err);
      } finally {
        setLoading(false);
      }
    }
    loadConversations();
  }, []);

  // Fetch messages when selected chat changes
  useEffect(() => {
    if (!activeChat) return;
    async function loadMessages() {
      try {
        const data = await fetchApi(`/messages/${activeChat._id || activeChat.id}`);
        setMessages(data.data || []);
      } catch (err) {
        console.error('Failed to load messages', err);
      }
    }
    loadMessages();
  }, [activeChat]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChat) return;

    const newMessage = { sender: 'merchant', content: inputMessage, timestamp: new Date() };
    setMessages((prev) => [...prev, newMessage]);
    const messageText = inputMessage;
    setInputMessage('');

    try {
      await fetchApi(`/messages/${activeChat._id || activeChat.id}`, {
        method: 'POST',
        body: JSON.stringify({ content: messageText, sender: 'merchant' }),
      });
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  if (loading) return <div className="text-dark-muted">Loading live conversations...</div>;

  return (
    <div className="h-[calc(100vh-140px)] border border-dark-border rounded-2xl bg-dark-surface flex overflow-hidden">
      {/* Chat List */}
      <div className="w-1/3 border-r border-dark-border flex flex-col">
        <div className="p-4 border-b border-dark-border">
          <h2 className="font-semibold text-dark-text">Conversations</h2>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 p-2">
          {conversations.length === 0 ? (
            <div className="p-4 text-xs text-dark-muted">No active conversations found.</div>
          ) : (
            conversations.map((chat) => (
              <button
                key={chat._id || chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full text-left p-3 rounded-xl transition-colors flex items-center gap-3 ${
                  activeChat?._id === chat._id
                    ? 'bg-dark-border text-dark-text'
                    : 'hover:bg-dark-bg/50 text-dark-muted'
                }`}
              >
                <div className="p-2 rounded-full bg-dark-bg text-brand-PRIMARY">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 truncate">
                  <p className="text-sm font-medium text-dark-text truncate">
                    {chat.customerName || `Customer #${chat._id?.slice(-4)}`}
                  </p>
                  <p className="text-xs text-dark-muted truncate">{chat.lastMessage || 'Active session'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Active Conversation Thread */}
      <div className="flex-1 flex flex-col bg-dark-bg/30">
        {activeChat ? (
          <>
            <div className="p-4 border-b border-dark-border bg-dark-surface flex justify-between items-center">
              <span className="font-semibold text-sm">
                Chatting with {activeChat.customerName || `Customer #${activeChat._id?.slice(-4)}`}
              </span>
              <span className="text-xs text-emerald-400 font-medium">● AI Assistant Active</span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((msg, idx) => {
                const isMerchant = msg.sender === 'merchant' || msg.sender === 'user';
                return (
                  <div key={idx} className={`flex ${isMerchant ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs md:max-w-md p-3 rounded-2xl text-sm ${
                        isMerchant
                          ? 'bg-brand-PRIMARY text-white rounded-br-none'
                          : 'bg-dark-surface border border-dark-border text-dark-text rounded-bl-none'
                      }`}
                    >
                      {msg.content || msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-dark-border bg-dark-surface flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-sm text-dark-text focus:outline-none focus:border-brand-PRIMARY"
              />
              <button type="submit" className="p-2 bg-brand-PRIMARY hover:bg-brand-hover text-white rounded-xl transition-colors">
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-dark-muted text-sm">
            Select a conversation to view thread.
          </div>
        )}
      </div>
    </div>
  );
}
