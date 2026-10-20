import { Suspense } from "react";
import { DEMO_ADMIN, DEMO_CREATOR, DEMO_SELLERS, DEMO_SHOPPER, formatIndianPhone } from "@stealth/shared";
import { LoginForm, type DemoAccount } from "./login-form";

export const metadata = { title: "Sign in" };

// Quick-fill buttons for the seeded accounts. Development only; they never ship to production.
const DEMO_ACCOUNTS: DemoAccount[] =
  process.env.NODE_ENV === "production"
    ? []
    : [
        { label: "Shopper", phone: formatIndianPhone(DEMO_SHOPPER.phone) },
        { label: "Creator", phone: formatIndianPhone(DEMO_CREATOR.phone) },
        { label: "Seller", phone: formatIndianPhone(DEMO_SELLERS[0].phone) },
        { label: "Admin", phone: formatIndianPhone(DEMO_ADMIN.phone) },
      ];

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm p-6">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-500">We&apos;ll send a 6-digit code to your phone.</p>
      {/* useSearchParams reads the request, so it needs a Suspense boundary. */}
      <Suspense>
        <LoginForm demoAccounts={DEMO_ACCOUNTS} />
      </Suspense>
    </main>
  );
}
