// Usage:
//   TELEGRAM_BOT_TOKEN=xxxx VERCEL_URL_FULL=https://your-app.vercel.app node scripts/set-webhook.js
//
// Ye script Telegram ko bata deta hai ki updates kahan (kis URL par) bhejne hain.

const token = process.env.TELEGRAM_BOT_TOKEN;
const vercelUrl = process.env.VERCEL_URL_FULL; // e.g. https://your-app.vercel.app (NO trailing slash)

if (!token || !vercelUrl) {
  console.error(
    "❌ TELEGRAM_BOT_TOKEN aur VERCEL_URL_FULL dono env vars set karo.\n" +
      "Example: TELEGRAM_BOT_TOKEN=123:ABC VERCEL_URL_FULL=https://my-bot.vercel.app node scripts/set-webhook.js"
  );
  process.exit(1);
}

const webhookUrl = `${vercelUrl.replace(/\/$/, "")}/api/webhook`;
const apiUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(
  webhookUrl
)}`;

fetch(apiUrl)
  .then((res) => res.json())
  .then((data) => {
    console.log("Telegram response:", data);
    if (data.ok) {
      console.log(`✅ Webhook set ho gaya: ${webhookUrl}`);
    } else {
      console.log("❌ Webhook set nahi ho paaya. Upar ka response check karo.");
    }
  })
  .catch((err) => console.error("Error:", err));
