#include <algorithm>
#include <cctype>
#include <cmath>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

struct Product {
  int id = 0;
  std::string name;
  std::string material;
  double price = 0.0;
};

struct Purchase {
  int productId = 0;
  int selectedAge = 0;
  double amount = 0.0;
};

struct Recommendation {
  int productId = 0;
  std::string name;
  std::string material;
  double price = 0.0;
  double score = 0.0;
};

std::string readAll() {
  std::ostringstream buffer;
  buffer << std::cin.rdbuf();
  return buffer.str();
}

std::string extractSection(const std::string& input, const std::string& key) {
  const std::string marker = "\"" + key + "\":[";
  std::size_t start = input.find(marker);
  if (start == std::string::npos) {
    return "";
  }
  start += marker.size();
  int depth = 1;

  for (std::size_t index = start; index < input.size(); ++index) {
    if (input[index] == '[') {
      ++depth;
    } else if (input[index] == ']') {
      --depth;
      if (depth == 0) {
        return input.substr(start, index - start);
      }
    }
  }

  return "";
}

std::vector<std::string> splitObjects(const std::string& section) {
  std::vector<std::string> objects;
  int depth = 0;
  std::size_t objectStart = 0;

  for (std::size_t index = 0; index < section.size(); ++index) {
    if (section[index] == '{') {
      if (depth == 0) {
        objectStart = index;
      }
      ++depth;
    } else if (section[index] == '}') {
      --depth;
      if (depth == 0) {
        objects.push_back(section.substr(objectStart, index - objectStart + 1));
      }
    }
  }

  return objects;
}

std::string extractString(const std::string& object, const std::string& key) {
  const std::string marker = "\"" + key + "\":";
  std::size_t start = object.find(marker);
  if (start == std::string::npos) {
    return "";
  }
  start += marker.size();

  while (start < object.size() && std::isspace(static_cast<unsigned char>(object[start]))) {
    ++start;
  }

  if (start >= object.size()) {
    return "";
  }

  if (object[start] == '"') {
    ++start;
    std::size_t end = start;
    while (end < object.size()) {
      if (object[end] == '"' && object[end - 1] != '\\') {
        break;
      }
      ++end;
    }
    return object.substr(start, end - start);
  }

  std::size_t end = start;
  while (end < object.size() && object[end] != ',' && object[end] != '}') {
    ++end;
  }

  return object.substr(start, end - start);
}

int extractInt(const std::string& object, const std::string& key) {
  std::string value = extractString(object, key);
  if (value.empty()) {
    return 0;
  }
  return std::stoi(value);
}

double extractDouble(const std::string& object, const std::string& key) {
  std::string value = extractString(object, key);
  if (value.empty()) {
    return 0.0;
  }
  return std::stod(value);
}

std::string ageBand(int age) {
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

std::vector<Product> parseProducts(const std::string& input) {
  std::vector<Product> products;
  for (const auto& object : splitObjects(extractSection(input, "products"))) {
    Product product;
    product.id = extractInt(object, "id");
    product.name = extractString(object, "name");
    product.material = extractString(object, "material");
    product.price = extractDouble(object, "price");
    products.push_back(product);
  }
  return products;
}

std::vector<Purchase> parsePurchases(const std::string& input, const std::string& key) {
  std::vector<Purchase> purchases;
  for (const auto& object : splitObjects(extractSection(input, key))) {
    Purchase purchase;
    purchase.productId = extractInt(object, "productId");
    purchase.selectedAge = extractInt(object, "selectedAge");
    purchase.amount = extractDouble(object, "amount");
    purchases.push_back(purchase);
  }
  return purchases;
}

int parseSelectedAge(const std::string& input) {
  return extractInt(input, "selectedAge");
}

int main() {
  const std::string input = readAll();
  const auto products = parseProducts(input);
  const auto recentPurchases = parsePurchases(input, "recentPurchases");
  const auto allPurchases = parsePurchases(input, "allPurchases");
  const int selectedAge = parseSelectedAge(input);

  std::map<std::string, std::map<int, double>> ageBandSales;
  std::map<std::string, double> materialAffinity;
  std::map<int, double> totalSold;
  std::vector<int> recentIds;

  for (const auto& purchase : allPurchases) {
    ageBandSales[ageBand(purchase.selectedAge)][purchase.productId] += purchase.amount;
    totalSold[purchase.productId] += purchase.amount;
  }

  for (const auto& purchase : recentPurchases) {
    recentIds.push_back(purchase.productId);
    auto productIt = std::find_if(products.begin(), products.end(), [&](const Product& product) {
      return product.id == purchase.productId;
    });

    if (productIt != products.end()) {
      materialAffinity[productIt->material] += 1.6;
    }
  }

  std::vector<Recommendation> recommendations;
  const std::string currentBand = ageBand(selectedAge);

  for (const auto& product : products) {
    double score = 1.0;

    if (std::find(recentIds.begin(), recentIds.end(), product.id) != recentIds.end()) {
      score += 4.0;
    }

    score += ageBandSales[currentBand][product.id] * 1.5;
    score += materialAffinity[product.material];
    score += totalSold[product.id] * 0.25;

    recommendations.push_back({product.id, product.name, product.material, product.price, std::round(score * 100.0) / 100.0});
  }

  std::sort(recommendations.begin(), recommendations.end(), [](const Recommendation& left, const Recommendation& right) {
    return left.score > right.score;
  });

  std::cout << "[";
  for (std::size_t index = 0; index < recommendations.size() && index < 3; ++index) {
    const auto& item = recommendations[index];
    if (index > 0) {
      std::cout << ",";
    }
    std::cout << "{"
              << "\"productId\":" << item.productId << ","
              << "\"name\":\"" << item.name << "\","
              << "\"material\":\"" << item.material << "\","
              << "\"price\":" << item.price << ","
              << "\"score\":" << item.score
              << "}";
  }
  std::cout << "]";

  return 0;
}
