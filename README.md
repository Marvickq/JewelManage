#JewelManage — Algorithm-Based Jewellery SaaS Platform

Overview
JewelManage is a multi-tenant SaaS platform designed for jewellery shop owners to manage inventory, track repeat customers, and generate personalized recommendations using C++ algorithms.

The system focuses on real-world usability, fast transactions, and data-driven decision-making for small to medium jewellery businesses.

🎯 Core Features
💍 Jewellery Management
Add and manage jewellery items (name, material, price)
Sequential display (oldest → newest)
Category-based organization

👤 Customer Management
Store customer details (name, phone, age)
Unique customer tracking per shop
Persistent purchase history

🧾 Purchase Tracking
Record purchases with:
Customer
Product
Amount
Auto timestamp
Maintains full transaction history

🧠 Recommendation Engine (C++)
Top 3 personalized recommendations
Based on:
Purchase history
Age-group patterns
Material preference
Global popularity
Uses greedy ranking + scoring heuristics

📊 Analytics
Displays most popular jewellery items
Based on aggregate purchase frequency
Helps in inventory decisions


🏗 Tech Stack
1. Frontend
Next.js (App Router)
TypeScript
Tailwind CSS (Cyan + Black theme)
ShadCN UI
2. Backend
Node.js (Next.js API routes)
Prisma ORM
3. Database
PostgreSQL (via Prisma)
4. Algorithm Engine
C++ (compiled executable)
Connected via Node.js (child_process)

🔄 System Flow
Frontend (Dashboard UI)
        ↓
Node.js API
        ↓
Prisma ORM (Database)
        ↓
C++ Engine (Recommendation)
        ↓
Response → Frontend Display


⚙️ How It Works
Owner logs in
Adds jewellery products
Adds customers
Records purchases
Selects a customer
Triggers recommendation engine
C++ computes Top 3 items
Results displayed instantly


🧠 Algorithms Used
Greedy Selection (Top-K recommendations)
Heuristic Scoring Model
Age-based segmentation
Frequency-based ranking
Sorting (O(n log n))
