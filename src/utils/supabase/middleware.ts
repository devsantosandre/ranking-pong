import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Não usar env.ts aqui para evitar problemas de importação no middleware
// O middleware roda em edge runtime e pode ter restrições
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

// Lista de cookies do Supabase que podem precisar ser limpos
const SUPABASE_COOKIE_PREFIXES = [
  "sb-",
  "supabase-auth-token",
  "supabase.auth.token",
];

function clearSupabaseCookies(response: NextResponse, request: NextRequest) {
  // Limpar todos os cookies do Supabase
  request.cookies.getAll().forEach((cookie) => {
    if (
      SUPABASE_COOKIE_PREFIXES.some((prefix) => cookie.name.startsWith(prefix))
    ) {
      response.cookies.set(cookie.name, "", {
        path: "/",
        expires: new Date(0),
        maxAge: 0,
      });
    }
  });
  return response;
}

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const isLoginPage = request.nextUrl.pathname === "/login";

  // Verificar autenticação com tratamento de erro robusto
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      // Se houver erro de autenticação (token inválido, expirado, etc)
      // limpar cookies corrompidos e redirecionar para login
      if (!isLoginPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        const redirectResponse = NextResponse.redirect(url);
        return clearSupabaseCookies(redirectResponse, request);
      }
      // Se já está na página de login, apenas limpar os cookies
      return clearSupabaseCookies(supabaseResponse, request);
    }

    user = data.user;
  } catch {
    // Em caso de erro inesperado, limpar cookies e redirecionar para login
    if (!isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const redirectResponse = NextResponse.redirect(url);
      return clearSupabaseCookies(redirectResponse, request);
    }
    return clearSupabaseCookies(supabaseResponse, request);
  }

  // Se não está autenticado e não está na página de login, redireciona para login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Se está autenticado e está na página de login, redireciona para home
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
};







