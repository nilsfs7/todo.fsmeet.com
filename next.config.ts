import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep AGENTS.md as the product requirements. Next would otherwise append its own rules.
  agentRules: false,
};

export default nextConfig;
