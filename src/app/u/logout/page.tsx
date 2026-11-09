"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Logout() {
  const router = useRouter();
  useEffect(() => {
    localStorage.removeItem("tharkoo-user");
    router.replace("/");
  }, [router]);
  return <p>Logging out…</p>;
}
