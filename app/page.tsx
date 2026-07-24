import { LandingPage } from "@/components/landing/LandingPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LandingPage initialSession={{ signedIn: false }} />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <LandingPage
      initialSession={{
        signedIn: true,
        user: {
          name:
            profile?.display_name ||
            user.user_metadata.full_name ||
            user.user_metadata.name,
          email: user.email,
          picture: profile?.avatar_url || user.user_metadata.avatar_url,
        },
      }}
    />
  );
}
