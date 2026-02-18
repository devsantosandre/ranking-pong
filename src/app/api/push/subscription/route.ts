import { NextResponse } from "next/server";
import { hasAdminConfig } from "@/lib/env";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

type IncomingSubscription = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

type PostBody = {
  subscription?: IncomingSubscription;
  platform?: string | null;
};

type DeleteBody = {
  endpoint?: string;
};

function parseJson<T>(raw: unknown): T {
  return raw as T;
}

function isValidSubscription(subscription?: IncomingSubscription): subscription is {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  return !!(
    subscription?.endpoint &&
    subscription?.keys?.p256dh &&
    subscription?.keys?.auth
  );
}

async function getAuthenticatedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = parseJson<PostBody>(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (!isValidSubscription(body.subscription)) {
    return NextResponse.json({ error: "Subscription inválida" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    endpoint: body.subscription.endpoint,
    p256dh: body.subscription.keys.p256dh,
    auth: body.subscription.keys.auth,
    user_agent: request.headers.get("user-agent"),
    platform: body.platform || null,
    disabled_at: null,
    last_error: null,
    updated_at: now,
  };

  if (hasAdminConfig()) {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("push_subscriptions")
      .upsert(row, { onConflict: "endpoint" });

    if (error) {
      return NextResponse.json(
        { error: "Erro ao salvar subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(row, { onConflict: "user_id,endpoint" });

  if (error) {
    return NextResponse.json(
      { error: "Erro ao salvar subscription" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: DeleteBody = {};
  try {
    body = parseJson<DeleteBody>(await request.json());
  } catch {
    body = {};
  }

  const now = new Date().toISOString();

  if (hasAdminConfig()) {
    const adminClient = createAdminClient();
    let query = adminClient
      .from("push_subscriptions")
      .update({ disabled_at: now, updated_at: now })
      .eq("user_id", userId)
      .is("disabled_at", null);

    if (body.endpoint) {
      query = query.eq("endpoint", body.endpoint);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Erro ao desativar subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  const supabase = await createClient();
  let query = supabase
    .from("push_subscriptions")
    .update({ disabled_at: now, updated_at: now })
    .eq("user_id", userId)
    .is("disabled_at", null);

  if (body.endpoint) {
    query = query.eq("endpoint", body.endpoint);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Erro ao desativar subscription" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
