import type { Metadata } from "next";

import IntegrationGuide from "@/components/integration-guide";

export const metadata: Metadata = {
  title: "ESP32 Integration",
  description: "Endpoint reference and JSON examples for the Light Control backend.",
};

export default function IntegrationPage() {
  return <IntegrationGuide />;
}
