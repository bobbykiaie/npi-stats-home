import React, { useState, useRef, useEffect } from 'react';
import { FiMessageSquare, FiSend, FiX, FiCpu } from 'react-icons/fi';
import axios from 'axios';
import API_BASE_URL from './api';
import ReactMarkdown from 'react-markdown';

export default function AIChatBot() {
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState([]);   // for UI
  const [history, setHistory]     = useState([]);   // raw LLM history
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef            = useRef(null);

  // auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    // 1) Add user to UI & history
    setMessages(m => [...m, { sender: 'user', text }]);
    const newHistory = [...history, { role: 'user', content: text }];
    setHistory(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      // 2) Send both history + new message
      const { data } = await axios.post(
        `${API_BASE_URL}/ai/chat`,
        { message: text, history: newHistory },
        { withCredentials: true }
      );

      // 3) Add assistant reply to UI & history
      setMessages(m => [...m, { sender: 'ai', text: data.reply }]);
      setHistory(h => [...h, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages(m => [
        ...m,
        { sender: 'ai', text: "Sorry, I couldn't get a response. Please try again." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-8 w-96 h-[32rem] bg-white rounded-xl shadow-2xl flex flex-col z-50">
          <header className="flex items-center justify-between p-4 bg-slate-100 rounded-t-xl border-b">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FiCpu /> NPI Stats AI Assistant
            </h3>
            <button onClick={() => setIsOpen(false)} className="p-1 text-slate-500 hover:text-slate-800">
              <FiX />
            </button>
          </header>

          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-2xl ${
                      msg.sender === 'user'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    <ReactMarkdown
                      children={msg.text}
                      containerProps={{ className: 'prose prose-sm' }}
                    />
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-xs px-4 py-2 rounded-2xl bg-slate-200 text-slate-800">
                    <span className="animate-pulse">...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <footer className="p-4 border-t">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && !isLoading && handleSend()}
                placeholder="Ask about your data..."
                className="w-full p-2 border border-slate-300 rounded-lg"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                <FiSend />
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-transform hover:scale-110"
      >
        {isOpen ? <FiX size={24} /> : <FiMessageSquare size={24} />}
      </button>
    </>
  );
}
