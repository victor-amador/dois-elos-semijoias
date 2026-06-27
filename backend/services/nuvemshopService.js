const nuvemshopConfig = {
  accessToken: process.env.NUVEMSHOP_ACCESS_TOKEN || "",
  storeId: process.env.NUVEMSHOP_STORE_ID || "",
};

function isNuvemshopConfigured() {
  return Boolean(nuvemshopConfig.accessToken && nuvemshopConfig.storeId);
}

async function syncProducts(products) {
  return {
    provider: "nuvemshop",
    configured: isNuvemshopConfigured(),
    entity: "products",
    total: products.length,
    mode: isNuvemshopConfigured() ? "ready_for_api" : "placeholder",
  };
}

async function syncCategories(categories) {
  return {
    provider: "nuvemshop",
    configured: isNuvemshopConfigured(),
    entity: "categories",
    total: categories.length,
    mode: isNuvemshopConfigured() ? "ready_for_api" : "placeholder",
  };
}

async function syncInventory(products) {
  return {
    provider: "nuvemshop",
    configured: isNuvemshopConfigured(),
    entity: "inventory",
    total: products.length,
    mode: isNuvemshopConfigured() ? "ready_for_api" : "placeholder",
  };
}

async function syncOrders(orders) {
  return {
    provider: "nuvemshop",
    configured: isNuvemshopConfigured(),
    entity: "orders",
    total: orders.length,
    mode: isNuvemshopConfigured() ? "ready_for_api" : "placeholder",
  };
}

module.exports = {
  isNuvemshopConfigured,
  syncCategories,
  syncInventory,
  syncOrders,
  syncProducts,
};
