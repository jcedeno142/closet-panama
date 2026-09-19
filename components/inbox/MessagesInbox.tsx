"use client";

import Link from "next/link";
import { MessageCircle, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  user_one_id: string;
  user_two_id: string;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type ConversationCard = {
  conversation: Conversation;
  otherUser: Profile | null;
  lastMessage: Message | null;
  unreadCount: number;
};

export default function MessagesInbox() {
  const supabase = useMemo(() => createClient(), []);

  const [currentUserId, setCurrentUserId] = useState("");

  const [conversations, setConversations] = useState<ConversationCard[]>([]);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/auth";
      return;
    }

    setCurrentUserId(user.id);

    /*
     * LOAD ALL CONVERSATIONS
     * WHERE CURRENT USER IS A PARTICIPANT
     */
    const { data: conversationData, error: conversationError } = await supabase
      .from("conversations")
      .select(
        `
          id,
          user_one_id,
          user_two_id,
          created_at,
          updated_at
        `,
      )
      .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
      .order("updated_at", {
        ascending: false,
      });

    if (conversationError) {
      console.error("Conversation list error:", conversationError);

      setErrorMessage("No pudimos cargar tus conversaciones.");

      setLoading(false);
      return;
    }

    const conversationList = (conversationData || []) as Conversation[];

    if (conversationList.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    /*
     * GET OTHER USER IDS
     */
    const otherUserIds = [
      ...new Set(
        conversationList.map((conversation) =>
          conversation.user_one_id === user.id
            ? conversation.user_two_id
            : conversation.user_one_id,
        ),
      ),
    ];

    /*
     * LOAD OTHER USER PROFILES
     */
    let profileMap: Record<string, Profile> = {};

    if (otherUserIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(
          `
            id,
            username,
            display_name,
            avatar_url
          `,
        )
        .in("id", otherUserIds);

      if (profileError) {
        console.error("Conversation profiles error:", profileError);
      } else {
        profileMap = Object.fromEntries(
          (profileData || []).map((profile) => [profile.id, profile]),
        );
      }
    }

    /*
     * LOAD MESSAGES FOR THESE
     * CONVERSATIONS
     */
    const conversationIds = conversationList.map(
      (conversation) => conversation.id,
    );

    let lastMessageMap: Record<string, Message> = {};

    let unreadCountMap: Record<string, number> = {};

    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .select(
        `
          id,
          conversation_id,
          sender_id,
          body,
          read_at,
          created_at
        `,
      )
      .in("conversation_id", conversationIds)
      .order("created_at", {
        ascending: false,
      });

    if (messageError) {
      console.error("Conversation messages error:", messageError);
    } else {
      /*
       * Messages are newest first.
       * Keep only the newest one for
       * each conversation.
       */
      for (const message of messageData || []) {
        if (!lastMessageMap[message.conversation_id]) {
          lastMessageMap[message.conversation_id] = message as Message;
        }

        if (message.sender_id !== user.id && message.read_at === null) {
          unreadCountMap[message.conversation_id] =
            (unreadCountMap[message.conversation_id] || 0) + 1;
        }
      }
    }
    /*
     * BUILD UI CARDS
     */
    const cards: ConversationCard[] = conversationList.map((conversation) => {
      const otherUserId =
        conversation.user_one_id === user.id
          ? conversation.user_two_id
          : conversation.user_one_id;

      return {
        conversation,

        otherUser: profileMap[otherUserId] || null,

        lastMessage: lastMessageMap[conversation.id] || null,

        unreadCount: unreadCountMap[conversation.id] || 0,
      };
    });

    /*
     * SORT BY MOST RECENT MESSAGE.
     * Conversations without messages
     * use their creation date.
     */
    cards.sort((a, b) => {
      const aDate =
        a.lastMessage?.created_at ||
        a.conversation.updated_at ||
        a.conversation.created_at;

      const bDate =
        b.lastMessage?.created_at ||
        b.conversation.updated_at ||
        b.conversation.created_at;

      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    setConversations(cards);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /*
   * REALTIME
   *
   * Refresh the conversation list when
   * any new message visible to this user
   * is inserted.
   */
  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const channel = supabase
      .channel(`inbox-messages-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          loadConversations();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadConversations, supabase]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        Cargando mensajes...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="mx-4 mt-4 rounded-xl bg-zinc-100 p-4 text-sm">
        {errorMessage}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="px-5 py-20 text-center">
        <MessageCircle size={34} className="mx-auto text-zinc-300" />

        <h2 className="mt-4 font-bold">No tienes mensajes</h2>

        <p className="mx-auto mt-2 max-w-[260px] text-sm leading-5 text-zinc-400">
          Cuando hables con un comprador o vendedor, la conversación aparecerá
          aquí.
        </p>
      </div>
    );
  }

  return (
    <section className="divide-y divide-zinc-100">
      {conversations.map(
        ({ conversation, otherUser, lastMessage, unreadCount }) => {
          const username = otherUser?.username?.replace(/^@/, "") || "usuario";

          const displayName = otherUser?.display_name || username;

          const initial = displayName.charAt(0).toUpperCase() || "?";

          const isMyLastMessage = lastMessage?.sender_id === currentUserId;

          return (
            <Link
              key={conversation.id}
              href={`/inbox/${conversation.id}`}
              className="flex items-center gap-3 px-4 py-4 transition hover:bg-zinc-50"
            >
              {/* AVATAR */}

              {otherUser?.avatar_url ? (
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                  <img
                    src={otherUser.avatar_url}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-lg font-bold text-white">
                  {otherUser ? initial : <UserRound size={20} />}
                </div>
              )}

              {/* CONTENT */}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p
                    className={`truncate text-sm ${
                      unreadCount > 0
                        ? "font-black text-black"
                        : "font-bold text-zinc-700"
                    }`}
                  >
                    {displayName}
                  </p>

                  {lastMessage && (
                    <p className="shrink-0 text-[10px] text-zinc-400">
                      {formatInboxTime(lastMessage.created_at)}
                    </p>
                  )}
                </div>

                <p className="mt-0.5 truncate text-xs text-zinc-400">
                  @{username}
                </p>

                <p
                  className={`mt-1 truncate text-sm ${
                    unreadCount > 0
                      ? "font-semibold text-black"
                      : "text-zinc-500"
                  }`}
                >
                  {lastMessage ? (
                    <>
                      {isMyLastMessage ? "Tú: " : ""}
                      {lastMessage.body}
                    </>
                  ) : (
                    "Nueva conversación"
                  )}
                </p>
              </div>
              {unreadCount > 0 && (
                <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-black px-2 text-[11px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        },
      )}
    </section>
  );
}

function formatInboxTime(value: string) {
  const date = new Date(value);
  const now = new Date();

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat("es-PA", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "short",
  }).format(date);
}
