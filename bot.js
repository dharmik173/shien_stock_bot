const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");

// 🔹 Telegram Bot Token
const BOT_TOKEN = "8315557085:AAEZaJRt0Sx5Fi_xXwX29xVVMyjXlv4ZtDc";

// 🔹 JSON file where chat IDs are stored
const CHAT_FILE = "subscribers.json";

// ✅ Load chat IDs from file
let CHAT_IDS = [];
try {
  if (fs.existsSync(CHAT_FILE)) {
    const data = fs.readFileSync(CHAT_FILE, "utf8");
    CHAT_IDS = JSON.parse(data);
    console.log(`✅ Loaded ${CHAT_IDS.length} subscribers from file.`);
  }
} catch (err) {
  console.error("❌ Error reading subscribers file:", err);
  CHAT_IDS = [];
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const SHEIN_URL =
  "https://www.sheinindia.in/api/category/sverse-5939-37961?fields=SITE&currentPage=0&pageSize=45&format=json&query=%3Arelevance%3Agenderfilter%3AMen&sortBy=relevance&gridColumns=5&customerType=Existing&facets=genderfilter%3AMen&segmentIds=13%2C19%2C10&customertype=Existing&advfilter=true&platform=Desktop&showAdsOnNextPage=false&is_ads_enable_plp=true&displayRatings=true&&store=shein";

const headers = {
  accept: "application/json",
  "x-tenant-id": "SHEIN",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};

// ✅ Save chat IDs to JSON file
const saveSubscribers = () => {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(CHAT_IDS, null, 2), "utf8");
  console.log("💾 Subscribers saved to file.");
};

// ✅ Send message to all subscribers
const sendToAll = async (text) => {
  for (const id of CHAT_IDS) {
    try {
      await bot.sendMessage(id, text);
    } catch (err) {
      console.error(`❌ Failed to send message to ${id}:`, err.message);
    }
  }
};

// ✅ Fetch product data
const fetchProducts = async () => {
  try {
    const { data } = await axios.get(SHEIN_URL);
    const products = data?.products || data?.productList || [];
    const count = products.length;

    console.log(`Fetched ${count} products`);

    if (count >= 15) {
      await sendToAll(`🚨 ALERT! SHEIN Product Count is now ${count} (above 15)`);
    } else {
      console.log("ℹ️ Count below or equal to 15 — no alert sent");
    }
  } catch (error) {
    console.error("❌ Error fetching products:", error.message);
    await sendToAll("⚠️ Error fetching SHEIN data.");
  }
};

// ⏱️ Fetch every 30 second
setInterval(fetchProducts, 30 * 1000);

// ✅ Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id.toString();

  if (!CHAT_IDS.includes(chatId)) {
    CHAT_IDS.push(chatId);
    saveSubscribers(); // 💾 Save to file
    console.log(`✅ New chat subscribed: ${chatId}`);
  }

  bot.sendMessage(
    chatId,
    "👋 Bot started! You'll get SHEIN product alerts when count > 15."
  );
});

// ✅ Handle /stop command to unsubscribe
bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id.toString();

  if (CHAT_IDS.includes(chatId)) {
    CHAT_IDS = CHAT_IDS.filter((id) => id !== chatId);
    saveSubscribers(); // 💾 Update file
    bot.sendMessage(chatId, "🛑 You've been unsubscribed from SHEIN alerts.");
    console.log(`🚫 Chat unsubscribed: ${chatId}`);
  } else {
    bot.sendMessage(chatId, "You’re not subscribed yet.");
  }
});
