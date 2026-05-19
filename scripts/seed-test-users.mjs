// Seed de usuários de teste persistentes para o ambiente HML.
//
// Cria/atualiza um conjunto fixo de usuários (e-mail/senha conhecidos), com roles
// distintos, para que QA, designers ou stakeholders possam testar a aplicação
// manualmente. Reexecutar é seguro: se o usuário já existe, apenas garante a senha,
// role e nome.
//
// Uso:
//   node --env-file=.env.test scripts/seed-test-users.mjs
//   node --env-file=.env.test scripts/seed-test-users.mjs --cleanup   (apaga os usuários)

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE) {
  console.error("❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.test)");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Usuários persistentes — cobrem os principais perfis e cenários:
//  - admin: configurações, jogadores, métricas, logs
//  - moderator: confirma/cancela partidas, edita placares
//  - players: registram, confirmam, contestam, recebem notificações
//  - rivalry pair: usados para criar fluxos de h2h, conquistas, etc.
const SEED_USERS = [
  { email: "qa.admin@rankingpong.test",     name: "QA Admin",        role: "admin"     },
  { email: "qa.moderator@rankingpong.test", name: "QA Moderator",    role: "moderator" },
  { email: "qa.player1@rankingpong.test",   name: "QA Player Um",    role: "player"    },
  { email: "qa.player2@rankingpong.test",   name: "QA Player Dois",  role: "player"    },
  { email: "qa.player3@rankingpong.test",   name: "QA Player Três",  role: "player"    },
  { email: "qa.player4@rankingpong.test",   name: "QA Player Quatro",role: "player"    },
  { email: "qa.rival1@rankingpong.test",    name: "QA Rival A",      role: "player"    },
  { email: "qa.rival2@rankingpong.test",    name: "QA Rival B",      role: "player"    },
];

const PASSWORD = "Pong#QA2026!";

async function findByEmail(email) {
  // Lista paginada — usamos email como filtro client-side porque o admin API
  // do supabase-js não tem filtro por email built-in em todas as versões.
  let page = 1;
  // Limite razoável para ambientes de HML
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (!data?.users || data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

async function ensureUser(seed) {
  const existing = await findByEmail(seed.email);
  let userId;

  if (existing) {
    // Atualiza senha e meta — garante consistência
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: seed.name },
    });
    if (error) throw error;
    userId = existing.id;
    console.log(`  ↻ atualizado: ${seed.email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: seed.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: seed.name },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`  + criado:    ${seed.email}`);
  }

  // Garante a linha em public.users com role correto
  const { error: upsertErr } = await admin
    .from("users")
    .upsert(
      {
        id: userId,
        email: seed.email,
        name: seed.name,
        full_name: seed.name,
        role: seed.role,
        rating_atual: 250,
        is_active: true,
      },
      { onConflict: "id" }
    );
  if (upsertErr) throw upsertErr;

  return userId;
}

async function cleanup() {
  console.log("🧹 Removendo usuários de seed...");
  for (const seed of SEED_USERS) {
    const u = await findByEmail(seed.email);
    if (u) {
      await admin.auth.admin.deleteUser(u.id);
      console.log(`  − removido: ${seed.email}`);
    }
  }
}

async function main() {
  if (process.argv.includes("--cleanup")) {
    await cleanup();
    return;
  }
  console.log("🌱 Seed de usuários QA");
  console.log(`   URL:      ${URL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log("");
  for (const seed of SEED_USERS) {
    await ensureUser(seed);
  }
  console.log("");
  console.log("✅ Pronto. Use as credenciais acima para login manual em https://hml.rankingpong.com.br");
  console.log("");
  console.log("   E-mails seedados:");
  for (const seed of SEED_USERS) {
    console.log(`     - ${seed.email}  (${seed.role})`);
  }
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
