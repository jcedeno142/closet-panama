import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const otherUserId =
      typeof body.otherUserId === "string"
        ? body.otherUserId.trim()
        : "";

    if (!otherUserId) {
      return NextResponse.json(
        { error: "Usuario inválido." },
        { status: 400 }
      );
    }

    if (otherUserId === user.id) {
      return NextResponse.json(
        {
          error:
            "No puedes iniciar una conversación contigo mismo.",
        },
        { status: 400 }
      );
    }

    // Make sure the other user/profile actually exists.
    const {
      data: otherProfile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", otherUserId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    if (!otherProfile) {
      return NextResponse.json(
        { error: "El usuario no existe." },
        { status: 404 }
      );
    }

    /*
     * Look for an existing conversation in either
     * direction:
     *
     * Joshua -> Ana
     * OR
     * Ana -> Joshua
     */
    const {
      data: existingConversation,
      error: existingError,
    } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(user_one_id.eq.${user.id},user_two_id.eq.${otherUserId}),and(user_one_id.eq.${otherUserId},user_two_id.eq.${user.id})`
      )
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (existingConversation) {
      return NextResponse.json({
        conversationId:
          existingConversation.id,
        created: false,
      });
    }

    /*
     * Create a new conversation.
     */
    const {
      data: newConversation,
      error: createError,
    } = await supabase
      .from("conversations")
      .insert({
        user_one_id: user.id,
        user_two_id: otherUserId,
      })
      .select("id")
      .single();

    /*
     * The unique pair index prevents duplicates.
     * Two simultaneous requests could technically
     * race, so if creation fails we try one final
     * lookup before returning an error.
     */
    if (createError) {
      const {
        data: conversationAfterRace,
      } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(user_one_id.eq.${user.id},user_two_id.eq.${otherUserId}),and(user_one_id.eq.${otherUserId},user_two_id.eq.${user.id})`
        )
        .maybeSingle();

      if (conversationAfterRace) {
        return NextResponse.json({
          conversationId:
            conversationAfterRace.id,
          created: false,
        });
      }

      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversationId:
        newConversation.id,
      created: true,
    });
  } catch (error) {
    console.error(
      "Start conversation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No pudimos iniciar la conversación.",
      },
      { status: 500 }
    );
  }
}