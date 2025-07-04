import React, { useState } from 'react';
import { useSelector } from 'react-redux';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ReplyForm({ reviewId, onReplyAdded }) {
  const { currentUser } = useSelector((state) => state.user);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError('Reply cannot be empty');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/reply/${reviewId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comment }),
      });
      const data = await res.json();
      if (res.ok) {
        setComment('');
        if (onReplyAdded) onReplyAdded();
      } else {
        setError(data.message || 'Failed to add reply');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2">
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={2}
        className="w-full border border-gray-300 rounded p-2 text-sm"
        placeholder="Write a reply..."
        disabled={loading}
      />
      {error && <div className="text-red-600 text-xs">{error}</div>}
      <button
        type="submit"
        className="self-end bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
        disabled={loading || !comment.trim()}
      >
        {loading ? 'Replying...' : 'Reply'}
      </button>
    </form>
  );
} 