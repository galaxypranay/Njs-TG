// Vercel Serverless Function - Telegram Webhook Handler
// Route: /api/webhook

const TELEGRAM_API = "https://api.telegram.org/bot";
const FREEMODEL_API_URL = "https://api.freemodel.dev/v1/chat/completions";

export default async function handler(req, res) {
  // Telegram sirf POST requests bhejta hai. GET aane par bot zinda hai ye batao.
  if (req.method !== "POST") {
    return res.status(200).send("Telegram AI Bot is running ✅");
  }

  try {
    const update = req.body;
    const message = update?.message;

    // Agar text message nahi hai (sticker, photo, etc) to ignore karo
    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();

    // /start aur /help command handle karo
    if (userText === "/start") {
      await sendTelegramMessage(
        chatId,
        "👋 Namaste! Main ek AI bot hoon (freemodel.dev se powered).\n\nMujhse kuch bhi puch sakte ho, main jawab dene ki koshish karunga."
      );
      return res.status(200).json({ ok: true });
    }

    if (userText === "/help") {
      await sendTelegramMessage(
        chatId,
        "ℹ️ Bas mujhe normal message bhejo, main AI se jawab laake dunga.\n\nCommands:\n/start - bot shuru karo\n/help - help dekho\n/model - abhi konsa AI model use ho raha hai dekho"
      );
      return res.status(200).json({ ok: true });
    }

    // /model command ya "kaunsa model" jaisa natural sawal puchne par model ka naam bata do
    if (userText === "/model" || isAskingAboutModel(userText)) {
      const modelName = process.env.FREEMODEL_MODEL || "gpt-3.5-turbo";
      await sendTelegramMessage(
        chatId,
        `🧠 Abhi main *${modelName}* model use kar raha hoon (via freemodel.dev).`
      );
      return res.status(200).json({ ok: true });
    }

    // "Typing..." action bhejo taaki user ko pata chale bot kaam kar raha hai
    sendTypingAction(chatId).catch(() => {});

    // AI se response lo
    const aiReply = await getAIResponse(userText);

    // Telegram message ki limit ~4096 chars hai, isliye split kar dete hain
    await sendLongMessage(chatId, aiReply);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    // Telegram ko hamesha 200 bhejo, warna wo retry karta rahega
    return res.status(200).json({ ok: true });
  }
}

// User "kaunsa model use ho raha hai" type ka sawal pooch raha hai kya, ye detect karta hai
function isAskingAboutModel(text) {
  const t = text.toLowerCase();
  const hasModelWord = t.includes("model");
  const hasAskingWord =
    t.includes("kaun") ||
    t.includes("kon") ||
    t.includes("kya") ||
    t.includes("which") ||
    t.includes("what") ||
    t.includes("naam");
  return hasModelWord && hasAskingWord;
}

// freemodel.dev API ko call karta hai
async function getAIResponse(userText) {
  try {
    const response = await fetch(FREEMODEL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FREEMODEL_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.FREEMODEL_MODEL || "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "Tum ek helpful Telegram assistant ho. Hindi/Hinglish me clear aur short jawab do.",
          },
          { role: "user", content: userText },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("freemodel.dev API error:", response.status, errText);
      return "⚠️ Sorry, abhi AI se response nahi mil paaya. Thodi der baad try karo.";
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;

    return reply || "🤔 Sorry, main samajh nahi paaya. Dobara try karo.";
  } catch (err) {
    console.error("getAIResponse error:", err);
    return "⚠️ Kuch technical error aaya hai. Baad me try karo.";
  }
}

// Telegram ko ek message bhejne ka helper
async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `${TELEGRAM_API}${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("sendTelegramMessage error:", errText);
  }
}

// "typing..." status dikhane ke liye
async function sendTypingAction(chatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `${TELEGRAM_API}${token}/sendChatAction`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });
}

// Lambe messages ko Telegram ki 4096 char limit ke hisaab se todta hai
async function sendLongMessage(chatId, text) {
  const MAX_LEN = 4000;
  if (text.length <= MAX_LEN) {
    return sendTelegramMessage(chatId, text);
  }

  for (let i = 0; i < text.length; i += MAX_LEN) {
    await sendTelegramMessage(chatId, text.slice(i, i + MAX_LEN));
  }
}
