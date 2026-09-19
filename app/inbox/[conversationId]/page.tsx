"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Send, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export default function ConversationPage() {
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);

  const conversationId = String(params.conversationId || "");

  const [currentUserId, setCurrentUserId] = useState("");

  const [conversation, setConversation] = useState<Conversation | null>(null);

  const [otherUser, setOtherUser] = useState<Profile | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  const [newMessage, setNewMessage] = useState("");

  const [loading, setLoading] = useState(true);

  const [sending, setSending] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  /*
   * Scroll to newest message.
   */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({
        behavior,
      });
    }, 50);
  }, []);

  /*
   * Load conversation + other user's profile.
   */
  const loadConversation = useCallback(async () => {
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
      .eq("id", conversationId)
      .maybeSingle();

    if (conversationError) {
      console.error("Conversation error:", conversationError);

      setErrorMessage("No pudimos cargar esta conversación.");

      setLoading(false);
      return;
    }

    if (!conversationData) {
      setErrorMessage("Esta conversación no existe o no tienes acceso.");

      setLoading(false);
      return;
    }

    setConversation(conversationData as Conversation);

    const otherUserId =
      conversationData.user_one_id === user.id
        ? conversationData.user_two_id
        : conversationData.user_one_id;

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
      .eq("id", otherUserId)
      .maybeSingle();

    if (profileError) {
      console.error("Profile error:", profileError);
    }

    if (profileData) {
      setOtherUser(profileData);
    }

    /*
     * Load existing messages.
     */
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
      .eq("conversation_id", conversationId)
      .order("created_at", {
        ascending: true,
      });

    if (messageError) {
      console.error("Messages error:", messageError);

      setErrorMessage("No pudimos cargar los mensajes.");

      setLoading(false);
      return;
    }

    /*
     * Mark messages received from the other user as read.
     */
    const { error: readError } = await supabase
      .from("messages")
      .update({
        read_at: new Date().toISOString(),
      })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .is("read_at", null);

    if (readError) {
      console.error("Mark messages read error:", readError);
    }

    setMessages((messageData || []) as Message[]);

    setLoading(false);

    scrollToBottom("auto");
  }, [conversationId, scrollToBottom, supabase]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  /*
   * Realtime messages.
   *
   * When either participant inserts a new message
   * into this conversation, Supabase sends it to
   * the open chat.
   */
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;

          setMessages((current) => {
            const alreadyExists = current.some(
              (message) => message.id === incoming.id,
            );

            if (alreadyExists) {
              return current;
            }

            return [...current, incoming];
          });

          scrollToBottom();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, scrollToBottom, supabase]);

  /*
   * Send message.
   */
  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();

    const body = newMessage.trim();

    if (!body || !currentUserId || !conversation) {
      return;
    }

    if (body.length > 2000) {
      setErrorMessage("El mensaje no puede tener más de 2000 caracteres.");

      return;
    }

    setSending(true);
    setErrorMessage("");

    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,

        sender_id: currentUserId,

        body,
      })
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
      .single();

    if (insertError) {
      console.error("Send message error:", insertError);

      setErrorMessage("No pudimos enviar el mensaje.");

      setSending(false);
      return;
    }

    /*
     * Add it immediately.
     *
     * Realtime may also return the same message,
     * so both paths check the message ID.
     */
    if (insertedMessage) {
      setMessages((current) => {
        const exists = current.some(
          (message) => message.id === insertedMessage.id,
        );

        if (exists) {
          return current;
        }

        return [...current, insertedMessage as Message];
      });
    }

    setNewMessage("");
    setSending(false);

    scrollToBottom();
  }

  const otherUsername = otherUser?.username?.replace(/^@/, "") || "usuario";

  const otherDisplayName = otherUser?.display_name || otherUsername;

  const avatarInitial = otherDisplayName.charAt(0).toUpperCase() || "?";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm text-zinc-400">Cargando conversación...</p>
      </main>
    );
  }

  if (!conversation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-black">
        <div className="text-center">
          <h1 className="text-lg font-bold">Conversación no disponible</h1>

          <p className="mt-2 text-sm text-zinc-500">
            {errorMessage || "No pudimos encontrar esta conversación."}
          </p>

          <Link
            href="/inbox"
            className="mt-5 inline-block rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            Volver al inbox
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        {/* HEADER */}

        <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link
              href="/inbox"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100"
            >
              <ArrowLeft size={20} />
            </Link>

            <Link
              href={`/seller/${otherUsername}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              {/* AVATAR */}

              {otherUser?.avatar_url ? (
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                  <img
                    src={otherUser.avatar_url}
                    alt={otherDisplayName}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                  {otherUser ? avatarInitial : <UserRound size={17} />}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{otherDisplayName}</p>

                <p className="truncate text-xs text-zinc-400">
                  @{otherUsername}
                </p>
              </div>
            </Link>
          </div>
        </header>

        {/* MESSAGES */}

        <section className="flex-1 px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
                <UserRound size={22} className="text-zinc-400" />
              </div>

              <h2 className="mt-4 font-bold">Inicia la conversación</h2>

              <p className="mt-2 max-w-[260px] text-sm leading-5 text-zinc-400">
                Envía un mensaje a {otherDisplayName}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const isMine = message.sender_id === currentUserId;

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isMine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                        isMine
                          ? "rounded-br-md bg-black text-white"
                          : "rounded-bl-md bg-zinc-100 text-black"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-5">
                        {message.body}
                      </p>

                      <p
                        className={`mt-1 text-right text-[9px] ${
                          isMine ? "text-zinc-400" : "text-zinc-400"
                        }`}
                      >
                        {formatMessageTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        {/* ERROR */}

        {errorMessage && (
          <div className="mx-4 mb-2 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {/* MESSAGE INPUT */}

        <div className="sticky bottom-0 border-t border-zinc-100 bg-white p-3">
          <form onSubmit={sendMessage} className="flex items-end gap-2">
            <div className="flex min-h-12 flex-1 items-center rounded-2xl bg-zinc-100 px-4">
              <textarea
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                placeholder="Escribe un mensaje..."
                maxLength={2000}
                rows={1}
                className="max-h-32 min-h-12 w-full resize-none bg-transparent py-3 text-sm outline-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();

                    if (!sending && newMessage.trim()) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
              />
            </div>

            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-white transition disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("es-PA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
