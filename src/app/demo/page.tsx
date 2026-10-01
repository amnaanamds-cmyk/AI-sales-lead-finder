import type { Metadata } from "next";
import { DemoApp } from "./DemoApp";

export const metadata: Metadata = {
  title: "LeadNama live demo",
  description:
    "Try LeadNama with sample Pakistani businesses: find leads, see their gaps, write WhatsApp pitches in Urdu, Roman Urdu or English, and track deals.",
};

export default function DemoPage() {
  return <DemoApp signupHref="/login" />;
}
