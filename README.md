# JewelManage -  Your Jewellery Recommendation Platform
JewelManage is a **multi-tenant SaaS platform** designed for jewellery shop owners to manage their inventory, track repeat customers, and generate personalized product recommendations using **C++-based algorithms**.

It is built for **local jewellery businesses** that rely on customer relationships, helping them understand purchase patterns, improve upselling, and make faster, data-driven decisions during in-store interactions.



## Badges

![Next.js](https://img.shields.io/badge/Frontend-Next.js-black)
![Node.js](https://img.shields.io/badge/Backend-Node.js-green)
![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue)
![C++](https://img.shields.io/badge/Algorithms-C++-00599C)
![SaaS](https://img.shields.io/badge/Architecture-SaaS-purple)
![DSA](https://img.shields.io/badge/Core-Algorithm%20Driven-red)
![Status](https://img.shields.io/badge/Status-Active-success)
## 🔗 API Example

POST /api/products

Body:
{
  "name": "Gold Ring",
  "material": "Gold",
  "price": 50000
}
## 🧠 Recommendation Logic

The system uses a scoring-based approach:

- Recent purchases → higher weight
- Age group trends → moderate weight
- Material preference → boosted score
- Overall popularity → baseline score

Top 3 products are selected using greedy ranking.
## 🚀 Future Improvements

- Cloud deployment of C++ engine
- Image storage integration
- Advanced recommendation models
