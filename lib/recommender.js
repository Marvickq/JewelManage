const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const binDir = path.join(process.cwd(), "bin");
const cppDir = path.join(process.cwd(), "cpp");
const sourcePath = path.join(cppDir, "recommendation_engine.cpp");
const binaryPath = path.join(binDir, "recommendation_engine.exe");

function ensureBinary() {
  if (fs.existsSync(binaryPath)) {
    return true;
  }

  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  try {
    execFileSync("g++", [sourcePath, "-O2", "-std=c++17", "-o", binaryPath], {
      stdio: "ignore"
    });
    return true;
  } catch (error) {
    return false;
  }
}

function buildFallbackRecommendations(payload) {
  const recentProductIds = payload.recentPurchases.map((purchase) => purchase.productId);
  const ageBandProducts = new Map();
  const materialAffinity = new Map();

  for (const purchase of payload.allPurchases) {
    const band = ageBand(purchase.selectedAge);
    const current = ageBandProducts.get(band) || new Map();
    current.set(purchase.productId, (current.get(purchase.productId) || 0) + Number(purchase.amount || 1));
    ageBandProducts.set(band, current);
  }

  for (const purchase of payload.recentPurchases) {
    const product = payload.products.find((item) => item.id === purchase.productId);
    if (!product) {
      continue;
    }
    materialAffinity.set(product.material, (materialAffinity.get(product.material) || 0) + 1.6);
  }

  const currentBand = ageBand(payload.selectedAge);

  const scored = payload.products.map((product) => {
    let score = 1;
    const recencyBoost = recentProductIds.includes(product.id) ? 4 : 0;
    const popularity = (ageBandProducts.get(currentBand)?.get(product.id) || 0) * 1.5;
    const affinity = materialAffinity.get(product.material) || 0;
    const totalSold = payload.allPurchases
      .filter((purchase) => purchase.productId === product.id)
      .reduce((sum, purchase) => sum + Number(purchase.amount || 0), 0);

    score += recencyBoost + popularity + affinity + totalSold * 0.25;

    return {
      productId: product.id,
      name: product.name,
      material: product.material,
      price: Number(product.price),
      score: Number(score.toFixed(2))
    };
  });

  return scored.sort((left, right) => right.score - left.score).slice(0, 3);
}

function ageBand(age) {
  if (age <= 25) {
    return "young";
  }
  if (age <= 40) {
    return "adult";
  }
  if (age <= 60) {
    return "mature";
  }
  return "senior";
}

function generateRecommendations(payload) {
  if (ensureBinary()) {
    try {
      const output = execFileSync(binaryPath, [], {
        input: JSON.stringify(payload),
        encoding: "utf8"
      });

      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return buildFallbackRecommendations(payload);
    }
  }

  return buildFallbackRecommendations(payload);
}

module.exports = {
  generateRecommendations
};
