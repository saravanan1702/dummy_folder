import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { getAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await getAuth()) redirect("/app");
  return <SignupForm />;
}
