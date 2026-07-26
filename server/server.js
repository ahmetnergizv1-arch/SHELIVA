import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");

const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const REVIEWS_FILE = path.join(DATA_DIR, "reviews.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

function ensureFile(file, initial) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf8");
  }
}

ensureFile(PRODUCTS_FILE, []);
ensureFile(ORDERS_FILE, []);
ensureFile(REVIEWS_FILE, []);

function read(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function nextId(list) {
  return list.length
    ? Math.max(...list.map(x => Number(x.id) || 0)) + 1
    : 1;
}

function totalProductStock(product) {
  if (!Array.isArray(product.colors)) {
    return Number(product.stock || 0);
  }

  return product.colors.reduce((sum, color) => {
    return sum + Object.values(color.sizes || {})
      .reduce((s, value) => s + Number(value || 0), 0);
  }, 0);
}

function saveBase64Image(dataUrl, prefix = "product") {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return null;
  }

  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);

  if (!match) return null;

  let ext = match[1].toLowerCase();

  if (ext === "jpeg") ext = "jpg";
  if (ext === "svg+xml") ext = "svg";

  const filename =
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

  fs.writeFileSync(
    path.join(UPLOAD_DIR, filename),
    Buffer.from(match[2], "base64")
  );

  return `/uploads/${filename}`;
}


/* =====================================================
   HEALTH
   ===================================================== */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    server: "SHELIVA",
    time: new Date().toISOString()
  });
});


/* =====================================================
   PRODUCTS
   ===================================================== */

app.get("/api/products", (req, res) => {
  const products = read(PRODUCTS_FILE);

  res.json(
    products.map(p => ({
      ...p,
      stock: totalProductStock(p)
    }))
  );
});


app.post("/api/products", (req, res) => {
  const products = read(PRODUCTS_FILE);

  const id = nextId(products);

  const colors = Array.isArray(req.body.colors)
    ? req.body.colors.map((color, index) => {
        let image = color.image || "";

        if (color.imageData) {
          const saved = saveBase64Image(
            color.imageData,
            `product-${id}-color-${index + 1}`
          );

          if (saved) image = saved;
        }

        return {
          id: color.id || `CLR-${index + 1}`,
          name: color.name || `Renk ${index + 1}`,
          image,
          sizes: color.sizes || {}
        };
      })
    : [];

  let image = req.body.image || colors[0]?.image || "";

  if (req.body.imageData) {
    const saved = saveBase64Image(
      req.body.imageData,
      `product-${id}`
    );

    if (saved) image = saved;
  }

  const product = {
    id,
    code:
      req.body.code ||
      `SHL-${String(id).padStart(4, "0")}`,

    name: req.body.name || "Yeni Ürün",
    category: req.body.category || "Yazlık",

    price: Number(req.body.price || 0),
    discount: Number(req.body.discount ?? 15),

    active: req.body.active !== false,
    newest: req.body.newest !== false,

    description: req.body.description || "",

    image,
    colors,

    createdAt: new Date().toISOString()
  };

  products.push(product);
  write(PRODUCTS_FILE, products);

  res.status(201).json({
    ...product,
    stock: totalProductStock(product)
  });
});


app.put("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);
  const products = read(PRODUCTS_FILE);

  const index = products.findIndex(p => Number(p.id) === id);

  if (index === -1) {
    return res.status(404).json({
      error: "Ürün bulunamadı."
    });
  }

  const old = products[index];

  let colors = req.body.colors ?? old.colors ?? [];

  colors = colors.map((color, i) => {
    let image = color.image || "";

    if (color.imageData) {
      const saved = saveBase64Image(
        color.imageData,
        `product-${id}-color-${i + 1}`
      );

      if (saved) image = saved;
    }

    return {
      id: color.id || `CLR-${i + 1}`,
      name: color.name || `Renk ${i + 1}`,
      image,
      sizes: color.sizes || {}
    };
  });

  let image = req.body.image ?? old.image ?? "";

  if (req.body.imageData) {
    const saved = saveBase64Image(
      req.body.imageData,
      `product-${id}`
    );

    if (saved) image = saved;
  }

  products[index] = {
    ...old,
    ...req.body,
    id,
    image,
    colors,

    price: Number(req.body.price ?? old.price ?? 0),
    discount: Number(req.body.discount ?? old.discount ?? 15),

    updatedAt: new Date().toISOString()
  };

  delete products[index].imageData;

  products[index].colors =
    products[index].colors.map(c => {
      const copy = { ...c };
      delete copy.imageData;
      return copy;
    });

  write(PRODUCTS_FILE, products);

  res.json({
    ...products[index],
    stock: totalProductStock(products[index])
  });
});


app.delete("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);

  const products = read(PRODUCTS_FILE);

  const next = products.filter(
    p => Number(p.id) !== id
  );

  write(PRODUCTS_FILE, next);

  res.json({ ok: true });
});


/* =====================================================
   ORDERS
   ===================================================== */

app.get("/api/orders", (req, res) => {
  const orders = read(ORDERS_FILE);

  res.json(
    [...orders].sort(
      (a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    )
  );
});


app.post("/api/orders", (req, res) => {
  const orders = read(ORDERS_FILE);
  const products = read(PRODUCTS_FILE);

  const items = Array.isArray(req.body.items)
    ? req.body.items
    : [];

  if (!items.length) {
    return res.status(400).json({
      error: "Sepet boş."
    });
  }

  for (const item of items) {
    const product = products.find(
      p => Number(p.id) === Number(item.productId)
    );

    if (!product) {
      return res.status(400).json({
        error: `${item.name} ürünü bulunamadı.`
      });
    }

    const color = (product.colors || []).find(
      c => c.id === item.colorId
    );

    if (!color) {
      return res.status(400).json({
        error: `${product.name} renk varyantı bulunamadı.`
      });
    }

    const requestedQty = Math.max(1, Number(item.qty || 1));

    const current =
      Number(color.sizes?.[String(item.size)] || 0);

    if (current <= 0 || requestedQty > current) {
      return res.status(400).json({
        error:
          `${product.name} / ${color.name} / ${item.size} stok yetersiz.`
      });
    }
  }

  for (const item of items) {
    const product = products.find(
      p => Number(p.id) === Number(item.productId)
    );

    const color = product.colors.find(
      c => c.id === item.colorId
    );

    const key = String(item.size);

    color.sizes[key] =
      Number(color.sizes[key] || 0) -
      Math.max(1, Number(item.qty || 1));
  }

  write(PRODUCTS_FILE, products);

  const id = nextId(orders);

  const total = items.reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
      Number(item.qty || 1),
    0
  );

  const order = {
    id,
    orderNo:
      `SH-${String(id).padStart(6, "0")}`,

    customer: {
      name: req.body.customer?.name || "",
      phone: req.body.customer?.phone || "",
      email: req.body.customer?.email || "",
      city: req.body.customer?.city || "",
      district: req.body.customer?.district || "",
      address: req.body.customer?.address || ""
    },

    items,

    total,

    status: "Yeni",

    createdAt: new Date().toISOString(),

    approvedAt: null,
    shippedAt: null,
    deliveredAt: null,

    cargoCompany: "",
    cargoTracking: ""
  };

  orders.push(order);
  write(ORDERS_FILE, orders);

  res.status(201).json(order);
});


app.put("/api/orders/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const orders = read(ORDERS_FILE);

  const index = orders.findIndex(
    order => Number(order.id) === id
  );

  if (index === -1) {
    return res.status(404).json({
      error: "Sipariş bulunamadı."
    });
  }

  const status = req.body.status;

  orders[index].status = status;

  if (status === "Hazırlanıyor") {
    orders[index].approvedAt =
      orders[index].approvedAt ||
      new Date().toISOString();
  }

  if (status === "Kargoya Verildi") {
    orders[index].shippedAt =
      new Date().toISOString();

    orders[index].cargoCompany =
      req.body.cargoCompany ??
      orders[index].cargoCompany;

    orders[index].cargoTracking =
      req.body.cargoTracking ??
      orders[index].cargoTracking;
  }

  if (status === "Teslim Edildi") {
    orders[index].deliveredAt =
      new Date().toISOString();
  }

  write(ORDERS_FILE, orders);

  res.json(orders[index]);
});


/* =====================================================
   REVIEWS
   ===================================================== */

app.get("/api/reviews", (req, res) => {
  res.json(read(REVIEWS_FILE));
});


app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("====================================");
  console.log(" SHELIVA SERVER CALISIYOR");
  console.log(" http://localhost:3001");
  console.log("====================================");
  console.log("");
});


