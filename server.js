const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { readStore, writeStore, nextId } = require("./lib/store");
const { generateRecommendations } = require("./lib/recommender");

const host = "127.0.0.1";
const requestedPort = Number(process.env.PORT || 3000);
const publicDir = path.join(process.cwd(), "public");
let currentPort = requestedPort;

const sessions = new Map();

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType
  });
  response.end(payload);
}

function serveStatic(response, filePath) {
  if (!fs.existsSync(filePath)) {
    sendText(response, 404, "Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = extension === ".css"
    ? "text/css; charset=utf-8"
    : extension === ".js"
      ? "application/javascript; charset=utf-8"
      : "text/plain; charset=utf-8";

  sendText(response, 200, fs.readFileSync(filePath), contentType);
}

function parseCookies(request) {
  const cookieHeader = request.headers.cookie || "";
  return cookieHeader.split(";").reduce((cookies, chunk) => {
    const [name, ...rest] = chunk.trim().split("=");
    if (!name) {
      return cookies;
    }
    cookies[name] = decodeURIComponent(rest.join("="));
    return cookies;
  }, {});
}

function getSession(request) {
  const cookies = parseCookies(request);
  const sessionId = cookies.sessionId;
  if (!sessionId || !sessions.has(sessionId)) {
    return null;
  }
  return sessions.get(sessionId);
}

function requireAuth(request, response) {
  const session = getSession(request);
  if (!session) {
    sendJson(response, 401, { error: "Unauthorized" });
    return null;
  }
  return session;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function pageTemplate({ title, pageKey, userName }) {
  const authPage = pageKey === "login" || pageKey === "signup";
  const bodyClass = authPage ? "login-shell" : "app-shell";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="${bodyClass}" data-page="${pageKey}">
  ${authPage ? `
  <main class="login-page">
    <section class="login-card glass-card">
      <p class="eyebrow">JewelManage</p>
      <h1>${pageKey === "login" ? "Login" : "Create Account"}</h1>
      <form id="${pageKey === "login" ? "login-form" : "signup-form"}" class="stack-form">
        <label>
          <span>Email</span>
          <input type="email" name="email" placeholder="owner@jewelmanage.com" required />
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" placeholder="Enter password" required />
        </label>
        ${pageKey === "signup" ? `
        <label>
          <span>Shop Name</span>
          <input type="text" name="shopName" placeholder="My Jewellery Shop" required />
        </label>
        ` : ""}
        <button type="submit">${pageKey === "login" ? "Login" : "Sign Up"}</button>
      </form>
      <p id="${pageKey === "login" ? "login-message" : "signup-message"}" class="status-line"></p>
      <div style="margin-top: 1rem; text-align: center;">
        ${pageKey === "login" 
          ? `<a href="/signup" style="color: var(--color-cyan); text-decoration: none;">Create an account</a>` 
          : `<a href="/login" style="color: var(--color-cyan); text-decoration: none;">Account exists? Login</a>`}
      </div>
    </section>
  </main>
  ` : `
  <div class="dashboard-layout">
    <aside class="sidebar glass-card">

      <nav class="sidebar-nav">
        <a href="/dashboard" data-nav="dashboard">Dashboard</a>
        <a href="/dashboard/products" data-nav="products">Jewelleries</a>
        <a href="/dashboard/customers" data-nav="customers">Customers</a>
        <a href="/dashboard/purchases" data-nav="purchases">Purchases</a>
        <a href="/dashboard/recommendations" data-nav="recommendations">Recommendations</a>
        <a href="/dashboard/analytics" data-nav="analytics">Analytics</a>
      </nav>
      <button id="logout-button" class="ghost-button" type="button">Logout</button>
    </aside>
    <main class="content-area">
      <header class="topbar" style="background: transparent; box-shadow: none; border: none;">
        <div>
          <h1 id="page-title">${title}</h1>
        </div>
      </header>
      <section id="app-root"></section>
    </main>
  </div>
  `}
  <script src="/app.js"></script>
</body>
</html>`;
}

function getPageMeta(pathname) {
  const pageMap = {
    "/login": { title: "Login", pageKey: "login" },
    "/dashboard": { title: "Dashboard", pageKey: "dashboard" },
    "/dashboard/products": { title: "Jewelleries", pageKey: "products" },
    "/dashboard/customers": { title: "Customers", pageKey: "customers" },
    "/dashboard/purchases": { title: "Purchases", pageKey: "purchases" },
    "/dashboard/recommendations": { title: "Recommendations", pageKey: "recommendations" },
    "/dashboard/analytics": { title: "Analytics", pageKey: "analytics" },
    "/signup": { title: "Sign Up", pageKey: "signup" }
  };

  return pageMap[pathname] || null;
}

function normalizeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    material: product.material,
    price: Number(product.price),
    priceLabel: formatCurrency(product.price),
    createdAt: product.createdAt
  };
}

function normalizeCustomer(customer) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone || "",
    age: Number(customer.age),
    photo: customer.photo || "",
    createdAt: customer.createdAt
  };
}

function normalizePurchase(purchase) {
  return {
    id: purchase.id,
    customerId: purchase.customerId,
    customerName: purchase.customerName,
    selectedAge: Number(purchase.selectedAge),
    productId: purchase.productId,
    productName: purchase.productName,
    amount: Number(purchase.amount),
    createdAt: purchase.createdAt
  };
}

function ensureOwnerRevenue(store) {
  if (!Array.isArray(store.ownerRevenue)) {
    store.ownerRevenue = [];
  }
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getOwnerRevenueRecord(store, ownerId) {
  ensureOwnerRevenue(store);
  let record = store.ownerRevenue.find((item) => item.ownerId === ownerId);
  if (!record) {
    record = {
      ownerId,
      daily: {}
    };
    store.ownerRevenue.push(record);
  }
  if (!record.daily || typeof record.daily !== "object") {
    record.daily = {};
  }
  return record;
}

function sortNewestFirst(items) {
  return [...items].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

async function handleApi(request, response, pathname) {
  let session = null;
  if (pathname !== "/api/auth/login" && pathname !== "/api/auth/logout" && pathname !== "/api/auth/signup") {
    session = requireAuth(request, response);
    if (!session) {
      return;
    }
  }

  const store = readStore();
  const belongsToOwner = item => item.ownerId === session?.userId || (!item.ownerId && session?.userId === 1);

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(request);
    const user = store.users.find(
      (item) => item.email === String(body.email || "").trim() && item.password === String(body.password || "")
    );

    if (!user) {
      sendJson(response, 401, { error: "Invalid email or password" });
      return;
    }

    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
      userId: user.id,
      name: user.name,
      email: user.email
    });

    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": `sessionId=${sessionId}; HttpOnly; Path=/; SameSite=Lax`
    });
    response.end(JSON.stringify({ success: true, redirectTo: "/dashboard" }));
    return;
  }

  if (request.method === "POST" && pathname === "/api/auth/signup") {
    const body = await readBody(request);
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    const shopName = String(body.shopName || "").trim();

    if (!email || !password || !shopName) {
      sendJson(response, 400, { error: "Email, password, and shop name required" });
      return;
    }

    if (store.users.find(u => u.email === email)) {
      sendJson(response, 400, { error: "Email already in use" });
      return;
    }

    const newUser = {
      id: nextId(store.users),
      email,
      password,
      name: shopName
    };
    store.users.push(newUser);
    getOwnerRevenueRecord(store, newUser.id);
    writeStore(store);

    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email
    });

    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": `sessionId=${sessionId}; HttpOnly; Path=/; SameSite=Lax`
    });
    response.end(JSON.stringify({ success: true, redirectTo: "/dashboard" }));
    return;
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    const cookies = parseCookies(request);
    if (cookies.sessionId) {
      sessions.delete(cookies.sessionId);
    }
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": "sessionId=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
    });
    response.end(JSON.stringify({ success: true }));
    return;
  }

  if (request.method === "GET" && pathname === "/api/session") {
    const session = getSession(request);
    sendJson(response, 200, { authenticated: Boolean(session), session: session || null });
    return;
  }

  if (request.method === "GET" && pathname === "/api/products") {
    const myProducts = store.products.filter(belongsToOwner);
    sendJson(response, 200, sortNewestFirst(myProducts).map(normalizeProduct));
    return;
  }

  if (request.method === "POST" && pathname === "/api/products") {
    const body = await readBody(request);
    if (!body.name || !body.material || body.price === undefined) {
      sendJson(response, 400, { error: "Name, material, and price are required" });
      return;
    }

    const product = {
      id: nextId(store.products),
      ownerId: session.userId,
      name: String(body.name).trim(),
      material: String(body.material).trim(),
      price: Number(body.price),
      createdAt: new Date().toISOString()
    };

    store.products.push(product);
    writeStore(store);
    sendJson(response, 201, normalizeProduct(product));
    return;
  }

  if (request.method === "GET" && pathname === "/api/customers") {
    const myCustomers = store.customers.filter(belongsToOwner);
    sendJson(response, 200, sortNewestFirst(myCustomers).map(normalizeCustomer));
    return;
  }

  if (request.method === "POST" && pathname === "/api/customers") {
    const body = await readBody(request);
    if (!body.name || body.age === undefined) {
      sendJson(response, 400, { error: "Name and age are required" });
      return;
    }

    const customer = {
      id: nextId(store.customers),
      ownerId: session.userId,
      name: String(body.name).trim(),
      phone: String(body.phone || "").trim(),
      age: Number(body.age),
      createdAt: new Date().toISOString()
    };

    store.customers.push(customer);
    writeStore(store);
    sendJson(response, 201, normalizeCustomer(customer));
    return;
  }

  if (request.method === "GET" && pathname === "/api/purchases") {
    const myPurchases = store.purchases.filter(belongsToOwner);
    sendJson(response, 200, sortNewestFirst(myPurchases).map(normalizePurchase));
    return;
  }

  if (request.method === "POST" && pathname === "/api/purchases") {
    const body = await readBody(request);
    const customer = store.customers.find((item) => item.id === Number(body.customerId));
    const product = store.products.find((item) => item.id === Number(body.productId));

    if (!customer || !product || body.amount === undefined || body.selectedAge === undefined) {
      sendJson(response, 400, { error: "Customer, age, product, and amount are required" });
      return;
    }

    const purchase = {
      id: nextId(store.purchases),
      ownerId: session.userId,
      customerId: customer.id,
      customerName: customer.name,
      selectedAge: Number(body.selectedAge),
      productId: product.id,
      productName: product.name,
      amount: Number(body.amount),
      createdAt: new Date().toISOString()
    };

    store.purchases.push(purchase);
    const ownerRevenue = getOwnerRevenueRecord(store, session.userId);
    const todayKey = getTodayKey();
    const purchaseRevenue = Number(purchase.amount) * Number(product.price);
    ownerRevenue.daily[todayKey] = Number(ownerRevenue.daily[todayKey] || 0) + purchaseRevenue;
    writeStore(store);
    sendJson(response, 201, normalizePurchase(purchase));
    return;
  }

  if (request.method === "POST" && pathname === "/api/recommendations/generate") {
    const body = await readBody(request);
    const customer = store.customers.find((item) => item.id === Number(body.customerId));

    if (!customer || body.age === undefined) {
      sendJson(response, 400, { error: "Customer and age are required" });
      return;
    }

    const customerPurchases = store.purchases.filter((purchase) => purchase.customerId === customer.id);
    const recentPurchases = sortNewestFirst(customerPurchases).slice(0, Math.min(10, Math.max(3, customerPurchases.length)));

    const myProducts = store.products.filter(belongsToOwner);
    const myPurchases = store.purchases.filter(belongsToOwner);

    const payload = {
      selectedAge: Number(body.age),
      products: myProducts.map(normalizeProduct),
      recentPurchases: recentPurchases.map(normalizePurchase),
      allPurchases: myPurchases.map(normalizePurchase)
    };

    const recommendations = generateRecommendations(payload);
    const responsePayload = recommendations.map((item) => ({
      ...item,
      priceLabel: formatCurrency(item.price)
    }));

    store.recommendationHistory.push({
      id: nextId(store.recommendationHistory),
      customerId: customer.id,
      selectedAge: Number(body.age),
      generatedAt: new Date().toISOString(),
      results: responsePayload
    });
    writeStore(store);
    sendJson(response, 200, responsePayload);
    return;
  }

  if (request.method === "GET" && pathname === "/api/dashboard-stats") {
    const myPurchases = store.purchases.filter(belongsToOwner);
    const myCustomers = store.customers.filter(belongsToOwner);
    const ownerRevenue = getOwnerRevenueRecord(store, session.userId);
    
    // Revenue logic
    const revenueDay = Number(ownerRevenue.daily[getTodayKey()] || 0);
    let revenueMonth = 0;
    let revenueYear = 0;
    
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisYear = new Date(now.getFullYear(), 0, 1);
    
    for (const p of myPurchases) {
      const pDate = new Date(p.createdAt);
      const product = store.products.find(item => item.id === p.productId);
      const price = product ? Number(product.price) : 0;
      const totalAmount = Number(p.amount) * price;
      
      if (pDate >= thisMonth) revenueMonth += totalAmount;
      if (pDate >= thisYear) revenueYear += totalAmount;
    }
    
    // Unique customers logic
    const uniqueCustomers = new Set();
    for (const c of myCustomers) {
      const key = `${String(c.name).toLowerCase()}-${String(c.phone) || ""}-${c.age}`;
      uniqueCustomers.add(key);
    }
    const totalCustomers = uniqueCustomers.size;
    
    sendJson(response, 200, {
      revenueDay,
      revenueMonth,
      revenueYear,
      totalCustomers
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/analytics") {
    const aggregation = new Map();
    const myPurchases = store.purchases.filter(belongsToOwner);
    const myProducts = store.products.filter(belongsToOwner);

    for (const purchase of myPurchases) {
      const product = myProducts.find((item) => item.id === purchase.productId);
      if (!product) {
        continue;
      }

      const current = aggregation.get(product.id) || {
        productId: product.id,
        name: product.name,
        material: product.material,
        totalUnits: 0,
        purchaseCount: 0
      };

      current.totalUnits += Number(purchase.amount);
      current.purchaseCount += 1;
      aggregation.set(product.id, current);
    }

    const topProducts = Array.from(aggregation.values())
      .sort((left, right) => right.totalUnits - left.totalUnits || right.purchaseCount - left.purchaseCount)
      .slice(0, 5);

    sendJson(response, 200, topProducts);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;

    if (pathname === "/styles.css" || pathname === "/app.js") {
      serveStatic(response, path.join(publicDir, pathname.slice(1)));
      return;
    }

    if (pathname.startsWith("/api/")) {
      await handleApi(request, response, pathname);
      return;
    }

    if (pathname === "/") {
      response.writeHead(302, { Location: "/login" });
      response.end();
      return;
    }

    const pageMeta = getPageMeta(pathname);
    if (!pageMeta) {
      if (pathname === "/favicon.ico") {
        sendText(response, 404, "Not found");
        return;
      }
      sendText(response, 404, "Page not found");
      return;
    }

    const session = getSession(request);
    const isAuthPage = pageMeta.pageKey === "login" || pageMeta.pageKey === "signup";
    
    if (!isAuthPage && !session) {
      response.writeHead(302, { Location: "/login" });
      response.end();
      return;
    }

    if (isAuthPage && session) {
      response.writeHead(302, { Location: "/dashboard" });
      response.end();
      return;
    }

    sendText(response, 200, pageTemplate({
      ...pageMeta,
      userName: session?.name || "Owner"
    }), "text/html; charset=utf-8");
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Internal server error" });
  }
});

function startServer(portToTry) {
  currentPort = portToTry;
  server.listen(portToTry, host, () => {
    console.log(`JewelManage running at http://${host}:${portToTry}`);
  });
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const busyPort = currentPort;
    const nextPort = Number(busyPort) + 1;

    console.log(`Port ${busyPort} is busy. Retrying on http://${host}:${nextPort}`);
    setTimeout(() => {
      startServer(nextPort);
    }, 150);
    return;
  }

  throw error;
});

startServer(requestedPort);
