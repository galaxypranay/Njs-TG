# 🤖 Telegram AI Bot (Vercel + freemodel.dev)

Node.js me bana hua Telegram bot, jo Vercel par serverless function ke roop me deploy hota hai aur AI replies ke liye `https://api.freemodel.dev/v1/chat/completions` API use karta hai.

## 📁 Project Structure

```
telegram-ai-bot/
├── api/
│   └── webhook.js       # Telegram webhook handler (Vercel function)
├── scripts/
│   └── set-webhook.js   # Deploy ke baad Telegram ko webhook URL batane ka script
├── package.json
├── vercel.json
├── .env.example
└── .gitignore
```

## 🚀 Step 1: Telegram Bot Banao

1. Telegram me [@BotFather](https://t.me/BotFather) ko open karo
2. `/newbot` bhejo, naam aur username do
3. Jo **token** milega use save kar lo (kuch aisa dikhega: `123456789:ABCdefGhIJklmNOPqrstuVWXyz`)

## 🔑 Step 2: freemodel.dev se API Key lo

`https://freemodel.dev` par account banao aur API key generate karo.

## 📦 Step 3: GitHub Par Push Karo

```bash
cd telegram-ai-bot
git init
git add .
git commit -m "Initial commit: Telegram AI bot"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## ☁️ Step 4: Vercel Par Deploy Karo

1. [vercel.com](https://vercel.com) par login karo (GitHub se)
2. **"Add New Project"** click karo, apna GitHub repo select karo
3. **Environment Variables** add karo (Settings → Environment Variables):

   | Key                  | Value                          |
   |-----------------------|---------------------------------|
   | `TELEGRAM_BOT_TOKEN`  | BotFather se mila token         |
   | `FREEMODEL_API_KEY`   | freemodel.dev ki API key        |
   | `FREEMODEL_MODEL`     | (optional) jaise `gpt-3.5-turbo`|

4. **Deploy** click karo. Deploy hone ke baad ek URL milega, jaise:
   `https://telegram-ai-bot-xyz.vercel.app`

## 🔗 Step 5: Telegram Ko Webhook URL Batao

Apne local machine ya terminal me ye command chalao (Node.js installed hona chahiye):

```bash
TELEGRAM_BOT_TOKEN=your_token VERCEL_URL_FULL=https://telegram-ai-bot-xyz.vercel.app node scripts/set-webhook.js
```

Agar response me `"ok": true` aaye, to webhook successfully set ho gaya hai. ✅

> Alternative (browser se bhi kar sakte ho):
> ```
> https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.vercel.app/api/webhook
> ```

## 🧪 Step 6: Test Karo

Telegram me apne bot ko open karo, `/start` bhejo, fir koi bhi sawal type karo — bot freemodel.dev se AI response laake reply karega.

## ⚙️ Notes

- Bot Telegram ko hamesha `200 OK` return karta hai, taaki Telegram retry storm na kare.
- Lambe AI replies (4096+ characters) automatically multiple messages me split ho jaate hain.
- `/start` aur `/help` commands already handled hain.
- Agar webhook kaam na kare, check karo:
  - Vercel function logs (Vercel dashboard → Deployments → Functions)
  - Env vars sahi se set hain ya nahi
  - `getWebhookInfo` API call karke dekho: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

## 🛠 Local Testing (Optional)

```bash
npm i -g vercel
vercel dev
```

Phir [ngrok](https://ngrok.com) jaise tool se local server ko expose karke webhook test kar sakte ho.
