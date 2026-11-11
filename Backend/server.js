const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();

const corsOptions = {
  origin: 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images/");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",  
  database: process.env.DB_NAME || "tastebite_db",
  port: process.env.DB_PORT || 3306
});

// Test connection
db.connect((err) => {
  if (err) {
    console.log("❌ DB connection error:", err);
    return;
  }
  console.log("✅ Connected to MySQL database");
});

// Auth middleware
const auth = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ error: "Please authenticate" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Please authenticate" });
  }
};

// Test route
app.get("/", (req, res) => {
  res.json({ message: "TasteBite API is working ✅" });
});

// ==================== AUTH ROUTES ====================
// Register user
app.post("/api/auth/register", (req, res) => {
  try {
    console.log("Registration attempt:", req.body);
    
    const { name, email, password, phone, address } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }
    
    // Check if user exists
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (results.length > 0) {
        return res.status(400).json({ error: "User already exists" });
      }
      
      // Insert user with plain password (NO HASHING)
      db.query(
        "INSERT INTO users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)",
        [name, email, password, phone, address],
        (err, result) => {
          if (err) {
            console.error("Insert error:", err);
            return res.status(500).json({ error: "Failed to create user" });
          }
          
          // Create token
          const token = jwt.sign(
            { userId: result.insertId, email },
            process.env.JWT_SECRET || "your_jwt_secret",
            { expiresIn: "24h" }
          );
          
          res.status(201).json({
            message: "User registered successfully",
            token,
            user: { id: result.insertId, name, email, phone }
          });
        }
      );
    });
    
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Login user - FIXED VERSION
app.post("/api/auth/login", (req, res) => {
  try {
    console.log("🔵 LOGIN ATTEMPT for:", req.body.email);
    
    const { email, password } = req.body;
    
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }
      
      if (results.length === 0) {
        console.log("❌ No user found with email:", email);
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const user = results[0];
      console.log("✅ User found:", user.email);
      
      // Handle case-insensitive column names
      // MySQL might return 'password' or 'PASSWORD' depending on setup
      const userPassword = user.password || user.PASSWORD;
      
      console.log("🔑 Comparing passwords...");
      console.log("Input password:", password);
      console.log("DB password:", userPassword);
      console.log("Match?", password === userPassword);
      
      // Verify password (direct comparison - NO HASHING)
      if (password !== userPassword) {
        console.log("❌ Password mismatch!");
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      console.log("✅ Password correct!");
      
      // Create token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || "your_jwt_secret",
        { expiresIn: "24h" }
      );
      
      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address
        }
      });
    });
    
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get user profile
app.get("/api/auth/profile", auth, (req, res) => {
  db.query(
    "SELECT id, name, email, phone, address FROM users WHERE id = ?",
    [req.user.userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(results[0]);
    }
  );
});

// ==================== MENU ROUTES ====================
// Get all menu items
app.get("/api/menu", (req, res) => {
  const q = "SELECT * FROM menu_items ORDER BY category, name";
  
  db.query(q, (err, data) => {
    if (err) {
      console.error("Error getting menu:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(data);
  });
});

// Get menu item by ID
app.get("/api/menu/:id", (req, res) => {
  const q = "SELECT * FROM menu_items WHERE id = ?";
  
  db.query(q, [req.params.id], (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    
    if (data.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    
    res.json(data[0]);
  });
});

// Add menu item (Admin only)
app.post("/api/menu", auth, upload.single("image"), (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    const image_url = req.file ? `/images/${req.file.filename}` : null;
    
    const q = "INSERT INTO menu_items (name, description, price, category, image_url) VALUES (?, ?, ?, ?, ?)";
    
    db.query(q, [name, description, parseFloat(price), category, image_url], (err, result) => {
      if (err) {
        console.error("Error adding menu item:", err);
        return res.status(500).json({ error: "Failed to add menu item" });
      }
      
      res.status(201).json({
        message: "Menu item added successfully",
        id: result.insertId
      });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update menu item
app.put("/api/menu/:id", auth, upload.single("image"), (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    const id = req.params.id;
    
    let q = "UPDATE menu_items SET name = ?, description = ?, price = ?, category = ?";
    const values = [name, description, parseFloat(price), category];
    
    // If new image uploaded, update image_url
    if (req.file) {
      q += ", image_url = ?";
      values.push(`/images/${req.file.filename}`);
    }
    
    q += " WHERE id = ?";
    values.push(id);
    
    db.query(q, values, (err, result) => {
      if (err) {
        console.error("Error updating menu:", err);
        return res.status(500).json({ error: "Failed to update menu item" });
      }
      
      res.json({ message: "Menu item updated successfully" });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete menu item
app.delete("/api/menu/:id", auth, (req, res) => {
  const q = "DELETE FROM menu_items WHERE id = ?";
  
  db.query(q, [req.params.id], (err, result) => {
    if (err) {
      console.error("Error deleting menu:", err);
      return res.status(500).json({ error: "Failed to delete menu item" });
    }
    
    res.json({ message: "Menu item deleted successfully" });
  });
});

// ==================== ORDER ROUTES ====================
// Create order
app.post("/api/orders", auth, (req, res) => {
  try {
    const { items, total_price, delivery_address, customer_name, customer_phone } = req.body;
    const userId = req.user.userId;
    
    // Start transaction
    db.beginTransaction((err) => {
      if (err) {
        return res.status(500).json({ error: "Transaction error" });
      }
      
      // Create order
      const orderQuery = `
        INSERT INTO orders (user_id, total_price, delivery_address, customer_name, customer_phone) 
        VALUES (?, ?, ?, ?, ?)
      `;
      
      db.query(orderQuery, [userId, parseFloat(total_price), delivery_address, customer_name, customer_phone], 
        (err, orderResult) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json({ error: "Failed to create order" });
            });
          }
          
          const orderId = orderResult.insertId;
          let completedItems = 0;
          
          // Add order items
          items.forEach((item) => {
            const itemQuery = `
              INSERT INTO order_items (order_id, menu_item_id, quantity, price) 
              VALUES (?, ?, ?, ?)
            `;
            
            db.query(itemQuery, [orderId, item.id, item.quantity, item.price], (err) => {
              if (err) {
                return db.rollback(() => {
                  res.status(500).json({ error: "Failed to add order items" });
                });
              }
              
              completedItems++;
              
              // If all items added, commit transaction
              if (completedItems === items.length) {
                db.commit((err) => {
                  if (err) {
                    return db.rollback(() => {
                      res.status(500).json({ error: "Transaction commit failed" });
                    });
                  }
                  
                  res.status(201).json({
                    message: "Order placed successfully",
                    orderId,
                    estimatedDelivery: "30-45 minutes"
                  });
                });
              }
            });
          });
        }
      );
    });
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get user's orders
app.get("/api/orders/my-orders", auth, (req, res) => {
  const userId = req.user.userId;
  
  const q = `
    SELECT o.*, 
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', mi.id,
          'name', mi.name,
          'quantity', oi.quantity,
          'price', oi.price
        )
      ) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE o.user_id = ?
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `;
  
  db.query(q, [userId], (err, results) => {
    if (err) {
      console.error("Error getting orders:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    // Parse JSON strings
    const orders = results.map(order => ({
      ...order,
      items: JSON.parse(order.items)
    }));
    
    res.json(orders);
  });
});

// Get all orders (Admin)
app.get("/api/orders", auth, (req, res) => {
  const q = `
    SELECT o.*, u.name as customer_name, u.email as customer_email 
    FROM orders o 
    LEFT JOIN users u ON o.user_id = u.id 
    ORDER BY o.created_at DESC
  `;
  
  db.query(q, (err, results) => {
    if (err) {
      console.error("Error getting all orders:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    res.json(results);
  });
});

// Update order status
app.patch("/api/orders/:id/status", auth, (req, res) => {
  const { status } = req.body;
  
  const q = "UPDATE orders SET status = ? WHERE id = ?";
  
  db.query(q, [status, req.params.id], (err, result) => {
    if (err) {
      console.error("Error updating order:", err);
      return res.status(500).json({ error: "Failed to update order" });
    }
    
    res.json({ message: "Order status updated successfully" });
  });
});

// ==================== USER ROUTES ====================
// Get all users (Admin)
app.get("/api/users", auth, (req, res) => {
  const q = "SELECT id, name, email, phone, address, created_at FROM users ORDER BY created_at DESC";
  
  db.query(q, (err, results) => {
    if (err) {
      console.error("Error getting users:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    res.json(results);
  });
});

// Update user profile
app.put("/api/users/profile", auth, (req, res) => {
  const { name, phone, address } = req.body;
  const userId = req.user.userId;
  
  const q = "UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?";
  
  db.query(q, [name, phone, address, userId], (err, result) => {
    if (err) {
      console.error("Error updating profile:", err);
      return res.status(500).json({ error: "Failed to update profile" });
    }
    
    res.json({ message: "Profile updated successfully" });
  });
});

// Add sample data endpoint
app.post("/api/sample-data", (req, res) => {
  // Add sample menu items
  const sampleMenu = [
    ["Margherita Pizza", "Fresh tomatoes, mozzarella, basil, and olive oil", 10.99, "Main", "/images/pizza.jpg"],
    ["Caesar Salad", "Crisp romaine with Caesar dressing and croutons", 7.49, "Appetizer", "/images/salad.jpg"],
    ["Chocolate Cake", "Rich chocolate cake with creamy frosting", 5.99, "Dessert", "/images/cake.jpg"],
    ["Pepperoni Pizza", "Classic pepperoni with extra cheese", 12.99, "Main", "/images/pizza2.jpg"],
    ["Garlic Bread", "Toasted bread with garlic butter", 4.99, "Appetizer", "/images/garlic_bread.jpg"],
    ["Ice Cream", "Vanilla ice cream with toppings", 3.99, "Dessert", "/images/icecream.jpg"]
  ];
  
  sampleMenu.forEach((item) => {
    db.query(
      "INSERT INTO menu_items (name, description, price, category, image_url) VALUES (?, ?, ?, ?, ?)",
      item,
      (err) => {
        if (err) console.error("Error adding sample item:", err);
      }
    );
  });
  
  res.json({ message: "Sample data added successfully" });
});

// Debug endpoint to check users
app.get("/api/debug/users", (req, res) => {
  db.query("SELECT id, name, email, password, created_at FROM users", (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    console.log("Users in database:", results);
    res.json(results);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});