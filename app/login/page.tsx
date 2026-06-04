import { Suspense } from "react";
import { LoginPanel } from "@/components/login/LoginPanel";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page" />}>
      <LoginPanel />
    </Suspense>
  );
}
