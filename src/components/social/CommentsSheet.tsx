import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { useSocialStore } from '../../store/useSocialStore';

interface CommentsSheetProps {
  feedItemId: string;
  open: boolean;
  onClose: () => void;
}

export function CommentsSheet({ feedItemId, open, onClose }: CommentsSheetProps) {
  const { user } = useAuth();
  const { comments, loadComments, addComment, deleteComment } = useSocialStore();
  const [text, setText] = useState('');
  const itemComments = comments[feedItemId] ?? [];

  useEffect(() => {
    if (open) loadComments(feedItemId);
  }, [open, feedItemId]);

  const handleSubmit = async () => {
    if (!text.trim() || !user) return;
    await addComment(feedItemId, user.id, text.trim());
    setText('');
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Comments">
      <div className="px-4 py-2 space-y-3" style={{ minHeight: 120 }}>
        {itemComments.map(c => {
          const initials = (c.author?.fullName ?? '?')
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div key={c.id} className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-[10px] font-black text-white shrink-0 overflow-hidden">
                {c.author?.avatarUrl ? (
                  <img src={c.author.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-bold text-white">
                    {c.author?.fullName?.split(' ')[0] ?? 'Someone'}
                  </span>
                  <span className="text-[10px] text-secondaryText/60">
                    <TimeAgo ts={c.createdAt} />
                  </span>
                </div>
                <p className="text-xs text-white/80 mt-0.5 break-words">{c.body}</p>
              </div>
              {user?.id === c.userId && (
                <button
                  onClick={() => deleteComment(c.id, feedItemId)}
                  className="text-secondaryText/40 hover:text-bloodRed shrink-0 p-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        {itemComments.length === 0 && (
          <p className="text-center text-secondaryText/60 text-xs py-6">No comments yet</p>
        )}
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-white/10 flex gap-2" style={{ backgroundColor: '#2C2C2E' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Add a comment..."
          maxLength={500}
          className="flex-1 bg-surfaceHover rounded-full px-4 py-2 text-xs text-white placeholder:text-secondaryText/40 border border-white/5 outline-none focus:border-bloodRed/30"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="px-3 py-2 text-bloodRed font-bold text-xs disabled:opacity-30"
        >
          Post
        </button>
      </div>
    </BottomSheet>
  );
}

function TimeAgo({ ts }: { ts: string }) {
  const diffMs = Date.now() - new Date(ts).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return <span>Just now</span>;
  if (diffMin < 60) return <span>{diffMin}m</span>;
  if (diffHr < 24) return <span>{diffHr}h</span>;
  if (diffDays === 1) return <span>1d</span>;
  return <span>{diffDays}d</span>;
}
