import { useMemo, useState } from 'react';

type Room = {
  id: string;
  name: string;
  topic: string | null;
  updatedAt: string;
};

type Message = {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
};

type Member = {
  userId: string;
  invitedBy: string;
  role: string;
  joinedAt: string;
};

type ChatLayoutProps = {
  userId: string;
  mirrorsStarted: boolean;
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: (name: string, topic: string) => Promise<void>;
  messages: Message[];
  members: Member[];
  canSendToActiveRoom: boolean;
  onSendMessage: (roomId: string, text: string) => Promise<void>;
  onInviteUser: (roomId: string, targetUserId: string) => Promise<void>;
  onSignOut: () => void | Promise<void>;
};

export default function ChatLayout(props: ChatLayoutProps) {
  const {
    userId,
    mirrorsStarted,
    rooms,
    activeRoomId,
    onSelectRoom,
    onCreateRoom,
    messages,
    members,
    canSendToActiveRoom,
    onSendMessage,
    onInviteUser,
    onSignOut,
  } = props;

  const activeRoom = useMemo(() => rooms.find((room) => room.id === activeRoomId) ?? null, [rooms, activeRoomId]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="app-heading">
              PowerSync E2EE Chat
            </h1>
            <p className="text-sm text-slate-500">Vault unlocked • {mirrorsStarted ? 'Syncing data' : 'Starting sync…'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500" data-testid="user-id">
              {userId}
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onSignOut()}
              data-testid="chat-sign-out-button"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        <RoomsPanel
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={onSelectRoom}
          onCreateRoom={onCreateRoom}
        />
        <ChatPanel
          userId={userId}
          room={activeRoom}
          canSend={!!activeRoom && canSendToActiveRoom}
          messages={messages}
          members={members}
          onSendMessage={(text) => (activeRoom ? onSendMessage(activeRoom.id, text) : Promise.resolve())}
          onInviteUser={(targetUserId) => (activeRoom ? onInviteUser(activeRoom.id, targetUserId) : Promise.resolve())}
        />
      </main>
    </div>
  );
}

function RoomsPanel({ rooms, activeRoomId, onSelectRoom, onCreateRoom }: {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: (name: string, topic: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Room name required.');
      return;
    }
    setCreating(true);
    try {
      await onCreateRoom(trimmed, topic.trim());
      setName('');
      setTopic('');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create room.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="col-span-12 md:col-span-4 lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold mb-2" data-testid="rooms-heading">
          Rooms
        </h2>
        <div className="flex flex-col gap-2">
          <input
            className="input-sm"
            placeholder="Room name"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            data-testid="room-name-input"
          />
          <input
            className="input-sm"
            placeholder="Topic (optional)"
            value={topic}
            onChange={(ev) => setTopic(ev.target.value)}
            data-testid="room-topic-input"
          />
          <button
            type="button"
            className="btn-primary"
            disabled={creating}
            onClick={handleCreate}
            data-testid="create-room-button"
          >
            {creating ? 'Creating…' : 'Create Room'}
          </button>
          {error ? <span className="text-xs text-red-600">{error}</span> : null}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rooms.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No rooms yet. Create one to get started.</p>
        ) : (
          <ul>
            {rooms.map((room) => (
              <li key={room.id}>
                <button
                  type="button"
                  className={`w-full text-left px-4 py-3 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    activeRoomId === room.id ? 'bg-slate-100 dark:bg-slate-800 font-medium' : ''
                  }`}
                  onClick={() => onSelectRoom(room.id)}
                  data-testid="room-list-item"
                  data-room-id={room.id}
                >
                  <div className="flex justify-between items-center">
                    <span>{room.name}</span>
                    <span className="text-xs text-slate-500">{formatTimestamp(room.updatedAt)}</span>
                  </div>
                  {room.topic ? <p className="text-xs text-slate-500 mt-1">{room.topic}</p> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ChatPanel({
  userId,
  room,
  canSend,
  messages,
  members,
  onSendMessage,
  onInviteUser,
}: {
  userId: string;
  room: Room | null;
  canSend: boolean;
  messages: Message[];
  members: Member[];
  onSendMessage: (text: string) => Promise<void>;
  onInviteUser: (targetUserId: string) => Promise<void>;
}) {
  const [messageDraft, setMessageDraft] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageSending, setMessageSending] = useState(false);
  const [inviteTarget, setInviteTarget] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const membersSorted = useMemo(
    () =>
      [...members].sort((a, b) => a.userId.localeCompare(b.userId)),
    [members],
  );

  async function handleSend() {
    if (!room) return;
    setMessageError(null);
    const trimmed = messageDraft.trim();
    if (!trimmed) return;
    if (!canSend) {
      setMessageError('Room key not available yet.');
      return;
    }
    setMessageSending(true);
    try {
      await onSendMessage(trimmed);
      setMessageDraft('');
    } catch (err: any) {
      setMessageError(err?.message ?? 'Could not send message.');
    } finally {
      setMessageSending(false);
    }
  }

  async function handleInvite() {
    if (!room) return;
    setInviteError(null);
    const target = inviteTarget.trim();
    if (!target) {
      setInviteError('Enter a user ID to invite.');
      return;
    }
    setInviting(true);
    try {
      await onInviteUser(target);
      setInviteTarget('');
    } catch (err: any) {
      setInviteError(err?.message ?? 'Failed to invite user.');
    } finally {
      setInviting(false);
    }
  }

  if (!room) {
    return (
      <section className="col-span-12 md:col-span-8 lg:col-span-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex items-center justify-center">
        <p className="text-sm text-slate-500">Create or select a room to start chatting.</p>
      </section>
    );
  }

  return (
    <section className="col-span-12 md:col-span-8 lg:col-span-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="active-room-heading">
            {room.name}
          </h2>
          <p className="text-xs text-slate-500">
            {members.length} member{members.length === 1 ? '' : 's'} • Last update {formatTimestamp(room.updatedAt)}
          </p>
          {room.topic ? <p className="text-xs text-slate-400 mt-1">{room.topic}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Room ID</p>
          <p className="text-xs font-mono text-slate-400">{room.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
        <div className="col-span-12 lg:col-span-9 flex flex-col border-r border-slate-200 dark:border-slate-800">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" data-testid="messages-container">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500">
                {canSend ? 'No messages yet. Say hello!' : 'Waiting for the room key before decrypting messages…'}
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3"
                  data-testid="chat-message"
                  data-message-id={msg.id}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span data-testid="message-sender">{msg.senderId === userId ? 'You' : msg.senderId}</span>
                    <span>{formatTimestamp(msg.sentAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" data-testid="message-text">
                    {msg.text}
                  </p>
                </div>
              ))
            )}
            {messageError ? <div className="text-xs text-red-600">{messageError}</div> : null}
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex gap-3">
              <textarea
                className="input flex-1"
                rows={2}
                placeholder={canSend ? 'Type a message' : 'Waiting for room key…'}
                value={messageDraft}
                onChange={(ev) => setMessageDraft(ev.target.value)}
                disabled={!canSend || messageSending}
                data-testid="message-input"
              />
              <button
                type="button"
                className="btn-primary self-end"
                onClick={handleSend}
                disabled={!canSend || messageSending}
                data-testid="send-message-button"
              >
                {messageSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-3 flex flex-col bg-slate-50/60 dark:bg-slate-900/60 border-l border-slate-200 dark:border-slate-800">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold mb-2">Invite member</h3>
            <div className="flex flex-col gap-2">
              <input
                className="input-sm"
                placeholder="Target user ID"
                value={inviteTarget}
                onChange={(ev) => setInviteTarget(ev.target.value)}
                data-testid="invite-user-input"
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={inviting}
                onClick={handleInvite}
                data-testid="invite-user-button"
              >
                {inviting ? 'Inviting…' : 'Invite'}
              </button>
              {inviteError ? <span className="text-xs text-red-600">{inviteError}</span> : null}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">Members</h3>
            {membersSorted.length === 0 ? (
              <p className="text-xs text-slate-500">No members synced yet.</p>
            ) : (
              membersSorted.map((member) => (
                <div key={member.userId} className="rounded border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs">
                  <div className="font-semibold">{member.userId === userId ? 'You' : member.userId}</div>
                  <div className="text-slate-500">Role: {member.role}</div>
                  <div className="text-slate-500">Invited by {member.invitedBy}</div>
                  <div className="text-slate-400">{formatTimestamp(member.joinedAt)}</div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function formatTimestamp(ts: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}
