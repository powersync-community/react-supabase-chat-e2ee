import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bars3Icon,
  PaperAirplaneIcon,
  PlusIcon,
  UserGroupIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { Avatar } from "./Avatar";

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
  onCreateRoom: (name: string, topic: string) => Promise<string>;
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

  const [showRoomsDrawer, setShowRoomsDrawer] = useState(false);
  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [showUserMenu, setShowUserMenu] = useState(false);
  const copyResetTimer = useRef<number | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (userMenuRef.current.contains(event.target as Node)) return;
      setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showUserMenu]);

  async function handleCopyUserId() {
    if (!userId) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(userId);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopyStatus("copied");
    } catch (err) {
      console.warn("Failed to copy user ID", err);
      setCopyStatus("error");
    } finally {
      if (copyResetTimer.current) {
        window.clearTimeout(copyResetTimer.current);
      }
      copyResetTimer.current = window.setTimeout(
        () => setCopyStatus("idle"),
        2000,
      );
    }
  }

  return (
    <div className="h-screen min-h-screen min-h-[100dvh] h-[100dvh] flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-50">
      <header className="border-b border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-950/70 backdrop-blur sticky top-0 z-20 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className={`btn-secondary-sm h-10 w-10 rounded-full lg:hidden!`}
              onClick={() => setShowRoomsDrawer(true)}
              data-testid="rooms-drawer-button"
              aria-label="Open rooms"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1
                className="text-xl sm:text-2xl font-semibold truncate"
                data-testid="app-heading"
              >
                PowerSync E2EE Chat
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                Vault unlocked ·{" "}
                {mirrorsStarted
                  ? "Syncing securely"
                  : "Starting encrypted sync…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 w-auto">
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-3 py-2 shadow-sm"
                onClick={() => setShowUserMenu((prev) => !prev)}
                data-testid="user-menu-button"
                aria-haspopup="dialog"
                aria-expanded={showUserMenu}
              >
                <Avatar userId={userId} size={38} />
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">
                    You
                  </span>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    {truncateUserId(userId)}
                  </span>
                </div>
              </button>
              {showUserMenu ? (
                <div
                  ref={userMenuRef}
                  className="absolute right-0 mt-3 w-72 max-w-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-300/30 dark:shadow-black/40 p-5 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar userId={userId} size={48} />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Signed in
                      </span>
                      <span
                        className="font-mono text-xs text-slate-500 dark:text-slate-400"
                        data-testid="user-id"
                      >
                        {userId}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      onClick={handleCopyUserId}
                      data-testid="copy-user-id-button"
                    >
                      {copyStatus === "copied"
                        ? "Copied!"
                        : copyStatus === "error"
                          ? "Copy failed"
                          : "Copy ID"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Close
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn w-full"
                    onClick={() => onSignOut()}
                    data-testid="chat-sign-out-button"
                  >
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full overflow-hidden py-6">
        <div className="h-full min-h-0 max-w-6xl mx-auto px-4 sm:px-6 grid auto-rows-[minmax(0,1fr)] gap-6 lg:gap-8 lg:grid-cols-12 overflow-hidden">
          <div className="hidden lg:flex lg:flex-col lg:col-span-4 xl:col-span-3 min-h-0 overflow-hidden">
            <RoomsPanel
              rooms={rooms}
              activeRoomId={activeRoomId}
              onSelectRoom={onSelectRoom}
              onCreateRoom={onCreateRoom}
            />
          </div>
          <div className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 overflow-hidden">
            <ChatPanel
              userId={userId}
              room={activeRoom}
              canSend={!!activeRoom && canSendToActiveRoom}
              messages={messages}
              members={members}
              onSendMessage={(text) =>
                activeRoom
                  ? onSendMessage(activeRoom.id, text)
                  : Promise.resolve()
              }
              onInviteUser={(targetUserId) =>
                activeRoom
                  ? onInviteUser(activeRoom.id, targetUserId)
                  : Promise.resolve()
              }
            />
          </div>
        </div>
      </main>
      {showRoomsDrawer ? (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-[85%] max-w-sm bg-white dark:bg-slate-900 p-4 shadow-2xl border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <RoomsPanel
              rooms={rooms}
              activeRoomId={activeRoomId}
              onSelectRoom={onSelectRoom}
              onCreateRoom={onCreateRoom}
              variant="drawer"
              onClose={() => setShowRoomsDrawer(false)}
            />
          </div>
          <button
            type="button"
            className="flex-1 bg-slate-950/40"
            onClick={() => setShowRoomsDrawer(false)}
            aria-label="Close rooms drawer"
          />
        </div>
      ) : null}
    </div>
  );
}

function RoomsPanel({
  rooms,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  variant = "sidebar",
  onClose,
}: {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: (name: string, topic: string) => Promise<string>;
  variant?: "sidebar" | "drawer";
  onClose?: () => void;
}) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreator, setShowCreator] = useState(() => rooms.length === 0);
  const initialRoomsRef = useRef(rooms.length);
  const formRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const isDrawer = variant === "drawer";

  useEffect(() => {
    if (!showCreator) return;
    if (isDrawer) return;
    const handler = (event: MouseEvent) => {
      if (!formRef.current) return;
      if (!formRef.current.contains(event.target as Node)) {
        setShowCreator(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCreator, isDrawer]);

  useEffect(() => {
    if (showCreator) {
      nameInputRef.current?.focus({ preventScroll: true });
    }
  }, [showCreator]);

  useEffect(() => {
    if (initialRoomsRef.current === 0 && rooms.length > 0) {
      initialRoomsRef.current = rooms.length;
      setShowCreator(false);
    }
  }, [rooms.length]);

  async function handleCreate() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Room name required.");
      return;
    }
    setCreating(true);
    try {
      const newRoomId = await onCreateRoom(trimmed, topic.trim());
      setName("");
      setTopic("");
      setShowCreator(false);
      onSelectRoom(newRoomId);
      if (isDrawer && onClose) onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create room.");
    } finally {
      setCreating(false);
    }
  }

  const creatorForm = (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void handleCreate();
      }}
    >
      <input
        ref={nameInputRef}
        className="input-sm"
        placeholder="Room name"
        value={name}
        onChange={(ev) => setName(ev.target.value)}
        data-testid="room-name-input"
        autoComplete="off"
      />
      <input
        className="input-sm"
        placeholder="Topic (optional)"
        value={topic}
        onChange={(ev) => setTopic(ev.target.value)}
        data-testid="room-topic-input"
        autoComplete="off"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn flex-1"
          disabled={creating}
          data-testid="create-room-button"
        >
          {creating ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => setShowCreator(false)}
        >
          Cancel
        </button>
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </form>
  );

  return (
    <section className={`relative flex flex-col ${isDrawer ? "h-full" : ""}`}>
      <div className="card flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold" data-testid="rooms-heading">
              Rooms ({rooms.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary-sm h-9 rounded-full px-3 inline-flex items-center gap-2"
              onClick={() => setShowCreator((prev) => !prev)}
              aria-haspopup="dialog"
              aria-expanded={showCreator}
              data-testid="rooms-create-button"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </button>
            {isDrawer && onClose ? (
              <button
                type="button"
                className="btn-secondary-sm h-9 w-9 rounded-full"
                onClick={onClose}
                title="Close rooms"
                aria-label="Close rooms"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {showCreator ? (
          <div
            ref={formRef}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 shadow-sm p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              New room
            </h3>
            {creatorForm}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto -mx-3 px-3">
          {rooms.length === 0 ? (
            <p
              className="text-sm text-slate-500 dark:text-slate-400"
              data-testid="room-empty-state"
            >
              No rooms yet. Create one above to start a secure conversation.
            </p>
          ) : (
            <ul className="space-y-2">
              {rooms.map((room) => {
                const isActive = activeRoomId === room.id;
                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      className={`w-full text-left rounded-lg border transition px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                        isActive
                          ? "border-blue-500 bg-blue-50/80 text-blue-900 dark:text-blue-100 dark:bg-blue-900/30"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-blue-300 dark:hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-900/30"
                      }`}
                      onClick={() => {
                        onSelectRoom(room.id);
                        if (isDrawer && onClose) onClose();
                      }}
                      data-testid="room-list-item"
                      data-room-id={room.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Avatar
                            userId={room.id}
                            size={34}
                            className="shrink-0"
                          />
                          <div>
                            <p className="font-medium leading-tight line-clamp-2">
                              {room.name}
                            </p>
                            {room.topic ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                                {room.topic}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {formatTimestamp(room.updatedAt)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
  const [messageDraft, setMessageDraft] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageSending, setMessageSending] = useState(false);
  const [inviteTarget, setInviteTarget] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [showMemberPopover, setShowMemberPopover] = useState(false);

  const inviteInputRef = useRef<HTMLInputElement | null>(null);
  const memberPopoverRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const membersSorted = useMemo(
    () => [...members].sort((a, b) => a.userId.localeCompare(b.userId)),
    [members],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, room?.id]);

  useEffect(() => {
    if (canSend) {
      messageInputRef.current?.focus({ preventScroll: true });
    }
  }, [canSend, room?.id]);

  useEffect(() => {
    if (showInvite) {
      inviteInputRef.current?.focus({ preventScroll: true });
    }
  }, [showInvite]);

  useEffect(() => {
    if (!showMemberPopover) return;
    const handler = (event: MouseEvent) => {
      const popover = memberPopoverRef.current;
      if (!popover) return;
      const target = event.target as Element | null;
      if (!target) return;
      if (popover.contains(target)) return;
      if (target.closest('[data-popover-toggle="members"]')) return;
      setShowMemberPopover(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMemberPopover]);

  async function handleSend() {
    if (!room) return;
    setMessageError(null);
    const trimmed = messageDraft.trim();
    if (!trimmed) return;
    if (!canSend) {
      setMessageError("Room key not available yet.");
      return;
    }
    setMessageSending(true);
    try {
      await onSendMessage(trimmed);
      setMessageDraft("");
    } catch (err: any) {
      setMessageError(err?.message ?? "Could not send message.");
    } finally {
      setMessageSending(false);
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          messageInputRef.current?.focus({ preventScroll: true });
        });
      } else {
        messageInputRef.current?.focus({ preventScroll: true });
      }
    }
  }

  async function handleInvite() {
    if (!room) return;
    setInviteError(null);
    const target = inviteTarget.trim();
    if (!target) {
      setInviteError("Enter a user ID to invite.");
      return;
    }
    setInviting(true);
    try {
      await onInviteUser(target);
      setInviteTarget("");
    } catch (err: any) {
      setInviteError(err?.message ?? "Failed to invite user.");
    } finally {
      setInviting(false);
    }
  }

  const sendDisabled = !canSend || messageSending || !messageDraft.trim();

  if (!room) {
    return (
      <section className="col-span-12 lg:col-span-8 xl:col-span-9 flex min-h-0">
        <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white/80 dark:bg-slate-900/80 shadow-sm flex items-center justify-center min-h-[18rem]">
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center px-4">
            Create or select a room to start chatting.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="h-full col-span-12 lg:col-span-8 xl:col-span-9 flex min-h-0">
      <div className="relative flex flex-col flex-1 h-full min-h-0 sm:min-h-[28rem] border border-slate-200 dark:border-slate-800/70 rounded-2xl bg-white/90 dark:bg-slate-900/80">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h2
              className="text-xl font-semibold truncate"
              data-testid="active-room-heading"
            >
              {room.name}
            </h2>
            {room.topic ? (
              <span className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[16rem]">
                {room.topic}
              </span>
            ) : null}
            <span className="text-xs text-slate-500 whitespace-nowrap">
              Last update {formatTimestamp(room.updatedAt)}
            </span>
            <div className="relative ml-auto">
              <button
                type="button"
                className="btn-secondary-sm h-10 rounded-full px-4 inline-flex items-center gap-2"
                onClick={() => setShowMemberPopover((prev) => !prev)}
                data-testid="members-popover-button"
                data-popover-toggle="members"
                aria-haspopup="dialog"
                aria-expanded={showMemberPopover}
              >
                <UserGroupIcon className="h-4 w-4" />
                <span>{members.length}</span>
              </button>
              {showMemberPopover ? (
                <div
                  ref={memberPopoverRef}
                  className="absolute right-0 top-12 z-30 w-72 max-w-xs rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/20 p-4 space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                        Invite member
                      </h3>
                      <button
                        type="button"
                        className="btn-secondary-sm h-8 w-8 rounded-full"
                        onClick={() => setShowInvite(true)}
                        title="Invite member"
                      >
                        <UserPlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {showInvite ? (
                      <form
                        className="flex flex-col gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleInvite();
                        }}
                      >
                        <input
                          ref={inviteInputRef}
                          className="input-sm h-11"
                          placeholder="Target user ID"
                          value={inviteTarget}
                          onChange={(ev) => setInviteTarget(ev.target.value)}
                          data-testid="invite-user-input"
                          autoComplete="off"
                        />
                        <button
                          type="submit"
                          className="btn h-11"
                          disabled={inviting}
                          data-testid="invite-user-button"
                        >
                          {inviting ? "Inviting…" : "Invite"}
                        </button>
                      </form>
                    ) : null}
                    {inviteError ? (
                      <span className="text-xs text-red-600">
                        {inviteError}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-3 text-sm">
                    <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                      Members
                    </h3>
                    {membersSorted.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No members synced yet.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {membersSorted.map((member) => {
                          const isSelected = selectedMember === member.userId;
                          return (
                            <li
                              key={member.userId}
                              className={`rounded-xl border transition px-4 py-3 cursor-pointer ${
                                isSelected
                                  ? "border-indigo-400 bg-indigo-50/70 text-indigo-900"
                                  : "border-slate-200 bg-white"
                              }`}
                              onClick={() =>
                                setSelectedMember((prev) =>
                                  prev === member.userId ? null : member.userId,
                                )
                              }
                            >
                              <div className="flex items-center gap-3">
                                <Avatar userId={member.userId} size={32} />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="font-semibold">
                                      {member.userId === userId
                                        ? "You"
                                        : member.userId}
                                    </span>
                                    <span className="badge">{member.role}</span>
                                  </div>
                                  {isSelected ? (
                                    <div className="space-y-1 text-[11px] text-slate-500">
                                      <div>Invited by {member.invitedBy}</div>
                                      <div className="text-slate-400">
                                        {formatTimestamp(member.joinedAt)}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6 space-y-3"
          data-testid="messages-container"
        >
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">
              {canSend
                ? "No messages yet. Say hello!"
                : "Waiting for the room key before decrypting messages…"}
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.senderId === userId;
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-3 ${isOwn ? "justify-end" : "justify-start"}`}
                  data-testid="chat-message"
                  data-message-id={msg.id}
                >
                  {!isOwn ? <Avatar userId={msg.senderId} size={32} /> : null}
                  <div
                    className={`max-w-full sm:max-w-[80%] rounded-2xl border px-4 py-3 shadow-sm transition ${
                      isOwn
                        ? "border-blue-500/60 bg-gradient-to-br from-blue-600 to-indigo-500 text-white"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[11px] mb-1 opacity-80">
                      <span data-testid="message-sender">
                        {isOwn ? "You" : msg.senderId}
                      </span>
                      <span>{formatTimestamp(msg.sentAt)}</span>
                    </div>
                    <p
                      className="text-sm whitespace-pre-wrap leading-relaxed"
                      data-testid="message-text"
                    >
                      {msg.text}
                    </p>
                  </div>
                  {isOwn ? <Avatar userId={msg.senderId} size={32} /> : null}
                </div>
              );
            })
          )}
          {messageError ? (
            <div className="text-xs text-red-600 bg-red-50/80 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {messageError}
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800/70 bg-white/90 dark:bg-slate-950/50 px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/70 px-3 py-2 shadow-sm">
              <textarea
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none resize-none"
                rows={1}
                placeholder={
                  canSend ? "Type a message" : "Waiting for room key…"
                }
                value={messageDraft}
                onChange={(ev) => setMessageDraft(ev.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                disabled={!canSend}
                data-testid="message-input"
                ref={messageInputRef}
              />
              <button
                type="button"
                className="btn h-11 w-11 rounded-full flex items-center justify-center shadow"
                onClick={handleSend}
                disabled={sendDisabled}
                data-testid="send-message-button"
                aria-label="Send message"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
            {messageError ? (
              <span className="text-xs text-red-600">{messageError}</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatTimestamp(ts: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

function truncateUserId(id: string, prefix = 6, suffix = 4): string {
  if (!id) return "";
  if (id.length <= prefix + suffix + 3) return id;
  return `${id.slice(0, prefix)}…${id.slice(-suffix)}`;
}
