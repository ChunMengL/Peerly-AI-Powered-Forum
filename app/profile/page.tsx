import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const name = session.name || "Peerly User";
  const email = session.email || "No email available";

  return (
    <main className="profile-page">
      <section className="profile-card">
        <div className="profile-top">
          <div
            aria-hidden={!session.picture}
            className="profile-avatar"
            style={
              session.picture
                ? { backgroundImage: `url(${session.picture})` }
                : undefined
            }
          />
          <div>
            <h1>{name}</h1>
            <p>{email}</p>
          </div>
        </div>
        <div className="profile-actions">
          <Link className="primary" href="/">
            Back to home
          </Link>
          <Link href="/auth/logout">Sign out</Link>
        </div>
      </section>
    </main>
  );
}
