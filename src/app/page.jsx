'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('JavaScript');

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!username.trim()) return;

    // Navigate to chat room page with query params
    router.push(`/chat?username=${encodeURIComponent(username)}&room=${encodeURIComponent(room)}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold text-purple-600 flex items-center justify-center gap-2">
            <i className="fas fa-smile text-yellow-400" />
            ChatOnUs
          </h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              id="username"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
              placeholder="Enter username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="room" className="block text-sm font-medium text-gray-700">
              Room
            </label>
            <select
              id="room"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            >
              <option value="JavaScript">JavaScript</option>
              <option value="Python">Python</option>
              <option value="PHP">PHP</option>
              <option value="C#">C#</option>
              <option value="Ruby">Ruby</option>
              <option value="Java">Java</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 transition"
          >
            Join Chat
          </button>
        </form>
      </div>
    </div>
  );
}
