'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';

let socket;

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const username = searchParams.get('username');
  const room = searchParams.get('room');

  // Sidebar users
  const [users, setUsers] = useState([]);
  // Messages: [{ username, text, createdAt? }]
  const [messages, setMessages] = useState([]);
  // Composer value
  const [msg, setMsg] = useState('');
  // Typing indicator: a Set of usernames currently typing (excluding me)
  const [typingUsers, setTypingUsers] = useState(new Set());

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);   // debounce timer for my typing
  const hasToldServerTypingRef = useRef(false); // track if we’ve emitted "typing"

  // -------------------------------------------------------
  // Establish socket connection, join room, attach listeners
  // -------------------------------------------------------
  useEffect(() => {
    if (!username || !room) {
      router.push('/');
      return;
    }

    socket = io('http://localhost:3001');
    socket.emit('joinRoom', { username, room });

    // History on join (array oldest->newest)
    socket.on('messageHistory', (history) => {
      setMessages(history);
    });

    // Live messages
    socket.on('message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Users in room
    socket.on('roomUsers', ({ users }) => setUsers(users));

    // Someone else started typing
    socket.on('typing', ({ username: who }) => {
      if (!who || who === username) return;
      setTypingUsers((prev) => new Set(prev).add(who));
    });

    // Someone else stopped typing
    socket.on('stopTyping', ({ username: who }) => {
      if (!who) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(who);
        return next;
      });
    });

    // Cleanup listeners + disconnect
    return () => {
      socket.off('messageHistory');
      socket.off('message');
      socket.off('roomUsers');
      socket.off('typing');
      socket.off('stopTyping');
      socket.disconnect();
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // -----------------------------------------
  // Typing handlers (client-side debounce)
  // -----------------------------------------
  const startTyping = () => {
    // First keypress after idle: tell server "typing"
    if (!hasToldServerTypingRef.current) {
      socket.emit('typing'); // backend broadcasts to others in room
      hasToldServerTypingRef.current = true;
    }
    // Reset the inactivity timer; when it fires we emit stopTyping
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1200); // idle threshold (ms)
  };

  const stopTyping = () => {
    if (hasToldServerTypingRef.current) {
      socket.emit('stopTyping');
      hasToldServerTypingRef.current = false;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  // When input changes, update msg and manage typing state
  const onChangeMsg = (e) => {
    const val = e.target.value;
    setMsg(val);
    if (val.trim().length > 0) {
      startTyping();
    } else {
      // empty string -> not typing
      stopTyping();
    }
  };

  // Submit message
  const sendMessage = (e) => {
    e.preventDefault();
    const text = msg.trim();
    if (!text) return;

    // Stop typing immediately (we just sent)
    stopTyping();

    // Server will persist + broadcast
    socket.emit('chat-message', text);
    setMsg('');
  };

  // Render a human-friendly typing string
  const typingText = (() => {
    const arr = Array.from(typingUsers);
    if (arr.length === 0) return '';
    if (arr.length === 1) return `${arr[0]} is typing…`;
    if (arr.length === 2) return `${arr[0]} and ${arr[1]} are typing…`;
    return `${arr[0]}, ${arr[1]} and ${arr.length - 2} others are typing…`;
  })();

  // Message bubble component with alignment + colors
  const MessageBubble = ({ m }) => {
    const isServer = m.username === 'Server';
    const isMe = m.username === username;

    // Base styles
    let container = 'flex';
    let bubble =
      'max-w-[75%] rounded-lg px-3 py-2 shadow text-sm leading-snug';
    let nameClass = 'text-xs font-semibold mb-0.5';

    if (isServer) {
      // Centered, subtle system messages
      container += ' justify-center';
      bubble += ' bg-gray-200 text-gray-800';
      nameClass += ' text-gray-600 text-center';
    } else if (isMe) {
      // My messages: right-aligned, purple background, white text
      container += ' justify-end';
      bubble += ' bg-purple-600 text-white';
      nameClass += ' text-purple-100 text-right';
    } else {
      // Others: left-aligned, white bubble, dark text
      container += ' justify-start';
      bubble += ' bg-white text-black';
      nameClass += ' text-purple-700';
    }

    return (
      <div className={container}>
        <div className={bubble}>
          <div className={nameClass}>
            {m.username || 'Server'}{' '}
            {m.createdAt && (
              <span className="ml-2 text-[10px] text-gray-400 align-middle">
                {new Date(m.createdAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div>{m.text}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-purple-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <i className="fas fa-smile text-yellow-300" />
          ChatOnUs
        </h1>
        <button
          onClick={() => {
            stopTyping();
            router.push('/');
          }}
          className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-md"
        >
          Leave Room
        </button>
      </header>

      <main className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-300 p-4 hidden sm:block">
          <h3 className="font-semibold mb-1">
            <i className="fas fa-comments text-purple-500 mr-2" />
            Room Name:
          </h3>
          <h2 className="text-lg font-bold text-purple-600 mb-4">{room}</h2>

          <h3 className="font-semibold mb-2">
            <i className="fas fa-users text-purple-500 mr-2" />
            Users
          </h3>
          <ul className="space-y-1">
            {users.map((user, idx) => (
              <li key={idx} className="text-gray-700">
                {user.username}
              </li>
            ))}
          </ul>
        </aside>

        {/* Chat Area */}
        <section className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((m, i) => (
              <MessageBubble key={i} m={m} />
            ))}
            {/* Typing indicator row (if any) */}
            {typingText && (
              <div className="flex justify-start pl-4 pb-2">
                <div className="text-xs text-gray-500 italic">{typingText}</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={sendMessage}
            className="bg-white border-t border-gray-300 flex items-center p-4 gap-2"
          >
            <input
              type="text"
              className="flex-1 border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter message..."
              value={msg}
              onChange={onChangeMsg}
              onBlur={stopTyping}
              required
            />
            <button
              type="submit"
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
            >
              <i className="fas fa-paper-plane" /> Send
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}