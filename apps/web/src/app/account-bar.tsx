import Link from "next/link";
import { formatIndianPhone, type SessionUser } from "@stealth/shared";
import { currentUser } from "@/server/session";
import { SignOutButton } from "./sign-out-button";

function roleLabels(user: SessionUser): string[] {
  return [user.isAdmin && "admin", user.creatorId && "creator", user.sellerIds.length > 0 && "seller"].filter(
    (r): r is string => Boolean(r),
  );
}

export async function AccountBar() {
  const user = await currentUser();
  if (!user) {
    return (
      <Link href="/login" className="text-sm font-semibold text-pink-600">
        Sign in
      </Link>
    );
  }
  const roles = roleLabels(user);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span>
        {user.name ?? formatIndianPhone(user.phone)}
        {roles.length > 0 && <span className="ml-1 text-zinc-500">({roles.join(", ")})</span>}
      </span>
      <SignOutButton />
    </div>
  );
}
