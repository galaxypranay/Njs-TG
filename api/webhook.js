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
        "ℹ️ Bas mujhe normal message bhejo, main AI se jawab laake dunga.\n\nCommands:\n/start - bot shuru karo\n/help - help dekho\n/model - abhi konsa AI model use ho raha hai dekho\n/clear - purani yaad (memory) bhula do"
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

    // /clear command - purani yaad (memory) delete karne ke liye
    if (userText === "/clear") {
      await saveHistory(chatId, []);
      await sendTelegramMessage(chatId, "🧹 Theek hai bhai, sab bhula diya. Naye se shuru karte hain.");
      return res.status(200).json({ ok: true });
    }

    // "Typing..." action bhejo taaki user ko pata chale bot kaam kar raha hai
    sendTypingAction(chatId).catch(() => {});

    // Purani conversation history uthao (memory ke liye)
    const history = await getHistory(chatId);

    // AI se response lo (history ke saath)
    const aiReply = await getAIResponse(userText, history);

    // Naya exchange history me save karo (last N messages tak limit rakhte hain)
    const updatedHistory = [
      ...history,
      { role: "user", content: userText },
      { role: "assistant", content: aiReply },
    ];
    await saveHistory(chatId, updatedHistory);

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

// Bot ki personality - savage/taunting dost, lekin real hate speech/slurs ke bina
const SYSTEM_PROMPT = `Tum ek savage, masti-khor Telegram dost ho - jaise koi local tapori dost jo pyaar se gaali deta hai.

Tumhara style:
- Hinglish me baat karo, casual aur funny tone me
- Halka-fulka taana maaro, roast karo, mazaak udao (jaise "saale", "pagal hai kya tu", "bhai dimaag ghar pe chhod aaya kya", "ullu ke pattha", "nalla")
- Faltu/random bakar bhi kar sakte ho, seedha-saadha boring jawab mat do
- Phir bhi asal me helpful raho - jo sawal pucha hai uska sahi jawab bhi do, bas usko masti wale tone me wrap karo
- User ki pichli baatein yaad rakho aur unka reference do jaise ek dost karta hai

STRICT LIMITS (kabhi cross nahi karna):
- Kisi ki caste, religion, gender, sexuality, disability, ya kisi group ko target karke gaali/slur kabhi mat do
- Sexual abuse, threats, ya real harassment wali language mat use karo
- Kisi real (asli) insaan ko, jo conversation me nahi hai, abuse mat karo
- Agar user genuinely upset/sad/serious problem share kare, to mazaak chhod ke seedha supportive ban jao`;

// freemodel.dev API ko call karta hai (conversation history ke saath)
async function getAIResponse(userText, history = []) {
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
          { role: "system", content: SYSTEM_PROMPT },
          ...history,
          { role: "user", content: userText },
        ],
        temperature: 0.9,
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

// Upstash Redis se chat ki purani history uthata hai
async function getHistory(chatId) {
  try {
    const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!baseUrl || !token) return []; // memory env set nahi hai to khaali history

    const res = await fetch(`${baseUrl}/get/chat_history:${chatId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data?.result) return [];

    return JSON.parse(data.result);
  } catch (err) {
    console.error("getHistory error:", err);
    return [];
  }
}

// Upstash Redis me chat ki history save karta hai (last 20 messages tak)
async function saveHistory(chatId, history) {
  try {
    const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!baseUrl || !token) return; // memory env set nahi hai to skip

    const MAX_MESSAGES = 20; // ~10 exchanges yaad rakhega
    const trimmed = history.slice(-MAX_MESSAGES);

    await fetch(`${baseUrl}/set/chat_history:${chatId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(JSON.stringify(trimmed)),
    });
  } catch (err) {
    console.error("saveHistory error:", err);
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
