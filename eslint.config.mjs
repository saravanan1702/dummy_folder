import next from "eslint-config-next";

const config = [
  { ignores: ["src/generated/**", ".next/**", "public/widget.js", "node_modules/**"] },
  ...next,
  {
    // Workspace switching, sign-out and session expiry deliberately do a full reload so no
    // client cache from the previous workspace or user survives.
    rules: { "@next/next/no-location-assign-relative-destination": "off" },
  },
];

export default config;
