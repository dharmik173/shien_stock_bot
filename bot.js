const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");
const express = require("express");
const app = express();

// 🔹 Telegram Bot Token
const BOT_TOKEN = "8315557085:AAEZaJRt0Sx5Fi_xXwX29xVVMyjXlv4ZtDc";

// 🔹 JSON files
const CHAT_FILE = "subscribers.json";
const SENT_FILE = "sentProducts.json"; // stores sent product codes with timestamp

// 🔹 Known product codes to ignore
const KNOWN_CODES = [
  "443319481010",
  "443316116007",
  "443320652011",
  "443322681004",
  "443316952008",
  "443317438008",
  "443316558002",
  "443319906013",
  "443317440008",
];

// ✅ Load subscribers
let CHAT_IDS = [];
try {
  if (fs.existsSync(CHAT_FILE)) {
    CHAT_IDS = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
    console.log(`✅ Loaded ${CHAT_IDS.length} subscribers`);
  }
} catch {
  CHAT_IDS = [];
}

// ✅ Load previously sent products
let SENT_PRODUCTS = {};
try {
  if (fs.existsSync(SENT_FILE)) {
    SENT_PRODUCTS = JSON.parse(fs.readFileSync(SENT_FILE, "utf8"));
  }
} catch {
  SENT_PRODUCTS = {};
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const SHEIN_URL =
  "https://www.sheinindia.in/api/category/sverse-5939-37961?fields=SITE&currentPage=0&pageSize=45&format=json&query=%3Arelevance%3Agenderfilter%3AMen&sortBy=relevance&gridColumns=5&customerType=Existing&facets=genderfilter%3AMen&segmentIds=13%2C19%2C10&customertype=Existing&advfilter=true&platform=Desktop&showAdsOnNextPage=false&is_ads_enable_plp=true&displayRatings=true&&store=shein";

// ✅ Save chat IDs
const saveSubscribers = () =>
  fs.writeFileSync(CHAT_FILE, JSON.stringify(CHAT_IDS, null, 2), "utf8");

// ✅ Save sent product data
const saveSentProducts = () =>
  fs.writeFileSync(SENT_FILE, JSON.stringify(SENT_PRODUCTS, null, 2), "utf8");

// ✅ Send to all subscribers
const sendToAll = async (text) => {
  for (const id of CHAT_IDS) {
    try {
      await bot.sendMessage(id, text, {
        parse_mode: "HTML",
        disable_web_page_preview: false,
      });
    } catch (err) {
      console.error(`❌ Failed to send message to ${id}:`, err.message);
    }
  }
};

// ✅ Fetch and filter product data
const fetchProducts = async () => {
  try {
    const { data } = await axios.get(SHEIN_URL); // 🚫 no headers
    const products = data?.products || data?.productList || [];

    console.log(`📦 Fetched ${products.length} products`);
    const now = Date.now();
    const oneHour = 5 * 60 * 1000;

    const newProducts = products.filter((p) => {
      if (!p?.code) return false;
      if (KNOWN_CODES.includes(p.code)) return false;

      const lastSent = SENT_PRODUCTS[p.code];
      return !lastSent || now - lastSent > oneHour; // only if not sent in last 1hr
    });

    if (newProducts.length > 0) {
      console.log(`🚨 Found ${newProducts.length} NEW product(s)!`);

      for (const prod of newProducts) {
        const message = `
🆕 <b>NEW PRODUCT FOUND!</b>
<b>${prod.name}</b>
💰 Price: ${prod.offerPrice?.displayformattedValue || prod.price?.displayformattedValue}
🏷️ Code: ${prod.code}
📦 Status: ${prod.couponStatus || "Unknown"}
🔗 <a href="https://www.sheinindia.in${prod.url}">View Product</a>
`;

        await sendToAll(message);
        SENT_PRODUCTS[prod.code] = now; // mark as sent
      }

      saveSentProducts();
    } else {
      console.log("✅ No new products found.");
    }
  } catch (error) {
    console.error("❌ Fetch error:", error.response?.status || error.message);
  }
};

// 🔁 Fetch every 10 sec
setInterval(fetchProducts, 5 * 1000);

// ✅ Telegram Commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (!CHAT_IDS.includes(chatId)) {
    CHAT_IDS.push(chatId);
    saveSubscribers();
    console.log(`✅ New chat subscribed: ${chatId}`);
  }
  bot.sendMessage(
    chatId,
    "👋 Bot started! You’ll get Shein product alerts whenever new products appear."
  );
});

bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (CHAT_IDS.includes(chatId)) {
    CHAT_IDS = CHAT_IDS.filter((id) => id !== chatId);
    saveSubscribers();
    bot.sendMessage(chatId, "🛑 You’ve been unsubscribed from Shein alerts.");
  } else {
    bot.sendMessage(chatId, "You’re not subscribed yet.");
  }
});

// ✅ Keep-alive endpoint for UptimeRobot
app.get("/", (req, res) => {
  res.send("✅ Shein Stock Bot is running fine!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
