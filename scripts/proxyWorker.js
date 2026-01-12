const axios = require("axios");
const { SocksProxyAgent } = require("socks-proxy-agent");
const pLimit = require("p-limit").default;

const DATABASE_URL =
  "https://proxy-cf6c5-default-rtdb.firebaseio.com";
const DATABASE_SECRET =
  "3HMgkYtC2RlIRFKGH5iwThpcALmsGirFGwsAT5tu";

const PROXY_SOURCE =
  "https://raw.githubusercontent.com/databay-labs/free-proxy-list/refs/heads/master/socks5.txt";

const TEST_URL = "https://api.sansekai.my.id/api/flickreels/latest";
const TIMEOUT = 15000;
const CONCURRENT = 30;

const limit = pLimit(CONCURRENT);

async function fetchProxyList() {
  const res = await axios.get(PROXY_SOURCE, { timeout: 15000 });
  return res.data.split("\n").map(p => p.trim()).filter(Boolean);
}

async function checkProxy(proxy) {
  try {
    const agent = new SocksProxyAgent(`socks5://${proxy}`);
    const start = Date.now();

    await axios.get(TEST_URL, {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: TIMEOUT,
    });

    return {
      proxy,
      alive: true,
      latency: Date.now() - start,
    };
  } catch {
    return { proxy, alive: false };
  }
}

async function saveToRTDB(result) {
  const key = result.proxy.replace(/\./g, "_");
  const url = `${DATABASE_URL}/proxies/${key}.json?auth=${DATABASE_SECRET}`;

  await axios.put(url, {
    proxy: result.proxy,
    alive: result.alive,
    latency: result.latency ?? null,
    lastChecked: Date.now(),
  });
}

async function runProxyWorker() {
  console.log("📥 Fetching proxies...");
  const proxies = await fetchProxyList();

  await Promise.all(
    proxies.map(proxy =>
      limit(async () => {
        const result = await checkProxy(proxy);
        await saveToRTDB(result);

        console.log(
          result.alive
            ? `✅ LIVE ${proxy} (${result.latency}ms)`
            : `❌ DEAD ${proxy}`
        );
      })
    )
  );

  return { ok: true, total: proxies.length };
}

module.exports = { runProxyWorker };
