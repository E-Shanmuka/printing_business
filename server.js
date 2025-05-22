const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3001;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// MySQL Database Connection (Clever Cloud)
const sequelize = new Sequelize('byxbpgvhrl5xibxn0wli', 'u1mnzcc7unkxm650', 'UMAsdig94CzpjcRsj1ur', {
  host: 'byxbpgvhrl5xibxn0wli-mysql.services.clever-cloud.com',
  dialect: 'mysql',
  logging: false
});

// Define models
const ReachMe = sequelize.define('reachme', {
  name: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  message: { type: DataTypes.TEXT }
}, {
  tableName: 'reachme',
  timestamps: false
});

const News = sequelize.define('news', {
  content: { type: DataTypes.TEXT }
}, {
  tableName: 'news',
  timestamps: false
});

const Service = sequelize.define('service', {
  name: { type: DataTypes.STRING },
  price: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  imageUrl: { type: DataTypes.STRING }
}, {
  tableName: 'services',
  timestamps: false
});

// Sync DB and create tables if not exists
sequelize.sync({ alter: true })
  .then(() => console.log("✅ Connected & synced with DB"))
  .catch(err => console.error("❌ DB Sync Error:", err));

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'shannuazshannu@gmail.com',
    pass: 'vkni jcfc ubsr ffic'
  }
});

// Serve static files
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); // Serve static files from current directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve admin.html for the admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// POST: Save contact form
app.post('/api/reach', async (req, res) => {
  try {
    const { name, phone, email, message } = req.body;
    await ReachMe.create({ name, phone, email, message });

    try {
      // Send email notification
      const mailOptions = {
        from: 'academehubmca@gmail.com',
        to: 'academehubmca@gmail.com',
        subject: 'New Contact Form Submission',
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong> ${message}</p>
        `
      };

      await transporter.sendMail(mailOptions);
      res.json({ message: "✅ Submitted successfully! Email notification sent." });
    } catch (emailError) {
      console.error('Email error:', emailError);
      // Still return success if message was saved to database
      res.json({ message: "✅ Message saved successfully! (Email notification failed)" });
    }
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ message: "❌ Error saving message" });
  }
});

// GET: All reachme entries
app.get('/api/reach', async (req, res) => {
  try {
    const entries = await ReachMe.findAll();
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Error fetching messages" });
  }
});

// DELETE: Delete reachme entry by ID
app.delete('/api/reach/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await ReachMe.destroy({ where: { id } });
    res.json({ message: "🗑️ Deleted successfully!" });
  } catch (err) {
    res.status(500).json({ message: "❌ Error deleting" });
  }
});

// POST: Update news ticker
app.post('/api/news', async (req, res) => {
  try {
    const { content } = req.body;
    // Delete existing news
    await News.destroy({ where: {} });
    // Create new news
    await News.create({ content });
    res.json({ message: "✅ News updated successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Error updating news" });
  }
});

// GET: Get news ticker content
app.get('/api/news', async (req, res) => {
  try {
    const news = await News.findOne();
    res.json(news || { content: "Welcome to our printing services!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Error fetching news" });
  }
});

// POST: Update service with image upload
app.post('/api/services', upload.single('image'), async (req, res) => {
    try {
        const { id, name, price, description } = req.body;
        
        // Validate required fields
        if (!name || !price || !description) {
            return res.status(400).json({ message: "❌ Name, price, and description are required" });
        }

        let imageUrl = null;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }

        let service;
        if (id) {
            // Update existing service
            const oldService = await Service.findByPk(id);
            if (oldService && oldService.imageUrl && req.file) {
                // Delete old image if exists
                const oldImagePath = path.join(__dirname, oldService.imageUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            
            await Service.update(
                { name, price, description, imageUrl },
                { where: { id } }
            );
            service = await Service.findByPk(id);
        } else {
            // Create new service
            service = await Service.create({ name, price, description, imageUrl });
        }
        
        res.json({ 
            message: "✅ Service updated successfully!",
            service: service
        });
    } catch (err) {
        console.error('Service update error:', err);
        res.status(500).json({ message: "❌ Error updating service" });
    }
});

// GET: Get all services
app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.findAll();
    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Error fetching services" });
  }
});

// GET: Get service by ID
app.get('/api/services/:id', async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (service) {
      res.json(service);
    } else {
      res.status(404).json({ message: "Service not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Error fetching service" });
  }
});

// DELETE: Delete service by ID
app.delete('/api/services/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const service = await Service.findByPk(id);
        
        if (service && service.imageUrl) {
            // Delete the image file
            const imagePath = path.join(__dirname, service.imageUrl);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        await Service.destroy({ where: { id } });
        res.json({ message: "🗑️ Service deleted successfully!" });
    } catch (err) {
        res.status(500).json({ message: "❌ Error deleting service" });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "❌ Something went wrong!" });
});

// Start server with error handling
const server = app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use. Please try a different port or kill the existing process.`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
  }
});
