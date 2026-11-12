/**
 * Single place to rebrand the product. Change the name / tagline here (or set
 * NEXT_PUBLIC_APP_NAME) and adjust the colour tokens in src/app/globals.css.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Convoly",
  tagline: "Chat automation that grows your business",
  description:
    "Build chatbots without code, automate conversations on Telegram, WhatsApp, Messenger, Instagram and your website, and turn chats into customers.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com",
};
