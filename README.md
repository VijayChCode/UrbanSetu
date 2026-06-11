## 🏡 UrbanSetu – AI-Powered Smart Real Estate Platform

🚀 Introducing UrbanSetu – A Next-Gen Real Estate Ecosystem with AI-enabled discovery, support, and analytics + MERN + AWS 🏠
Excited to unveil my project — UrbanSetu is a full-stack real estate platform built with MERN architecture, featuring AI-powered discovery, secure authentication, admin workflows, and scalable cloud infrastructure.
This platform showcases enterprise-level full-stack architecture, combining secure cloud infrastructure with intelligent automation to bridge the gap between people and property.

## 🔹 Key Features

### 🏠 Smart Discovery
AI Search (Llama 3.3), Route Planner, ESG(Environment Secure Governance) Analytics, Properties Management, Bookings and more...

### 💰 Fintech Suite
Rent Wallet, ROI Calculators, Digital Rental Loans & Monthly Payment Gateways

### 🎮 Gamified Loyalty System
Earn SetuCoins, unlock Badges, and climb Leaderboards through community interactions

### 🛡️ Fortified Security
Real-time session management, device audits, fraud detection & force logout

### 🤝 Signature Features
RentLock(fixed-rent digital contracts) & SaleLock(token-based property blocking)

### 🗣️ Community & Support
User blogs, Community forums, 24/7 AI chatbot & WhatsApp-style real-time messaging, Help-Center

### 🔔 User Engagement
Omni-channel notifications, watchlist alerts & automated email reports (Brevo SMTP)

### 🔒 Enterprise-Grade Authentication
Role-based access(RootAdmin/Admins/Users), JWT security & OTP/reCAPTCHA verification, CSRF Protection

### ☁️ Cloud-Native Architecture
Scalable AWS(S3, Lambda) + Cloudinary with optimized geospatial queries.

## 🚀 Role Based Features

###  👤 User Features
- User registration and authentication
- Property browsing and search
- Property listings with detailed information
- Wishlist functionality
- Appointment booking with real estate agents
- Profile management
- Password change functionality

### 🛠️ Admin Features
- **Admin Approval System**: New admin signups require approval from the default admin only
- **Default Admin(Root Admin)**: Pre-configured admin account with exclusive approval privileges
- Property management (create, edit, delete)
- Appointment management with status updates
- User management
- Admin dashboard with analytics
- Admin request management page (default admin only)

### 🔒 Default Admin Account(Also rephrased as Root Admin)

The system includes a default admin account with exclusive privileges:
- **Status**: Pre-approved (no approval required)
- **Privileges**: Only Default Admin can approve new admin requests

### Admin Privileges:
- **Default Admin (Root Admin)**:
  - Can approve/reject new admin requests
  - Has access to all admin functionality
  - Can manage properties, appointments, etc.
  - Exclusive access to admin approval system

- **Approved Admins (Admin)**:
  - Can access all admin functionality except approval system
  - Cannot approve/reject new admin requests
  - Can manage properties, appointments, etc.

## 🧰 Tech Stack

### Backend
- **Node.js** + **Express.js**(API Layer)
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Multer** for file uploads
- **Groq (Llama 3.3 70B Model)** for Chatbot

### Frontend
- **React.js** with Vite
- **Redux Toolkit** for state management
- **React Router** for navigation
- **Tailwind CSS** for styling
- **React Icons** for icons
- **Animated Glassmorphism** for Seamless User Interface

### DataBase
- **MongoDB Atlas (Geo Queries)** for Database and Querying

### Cloud Storage
- **AWS S3** for Cloud Storage of files above 100MB
- **Cloudinary** for Cloud Storage of files below 100MB
- **Dynamic Shifting** of upload files between AWS and Cloudinary based on size 

### Cloud Deployment
- **Vercel** for Frontend
- **Render** for Frontend
- **Render** for Backend

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Backend Setup
```bash
cd urbansetu/api
npm install
```

Create a `.env` file in the `api` directory:
```env
MONGO=your_mongodb_connection_string
JWT_TOKEN=your_jwt_secret
PORT=3000
```

### Frontend Setup
```bash
cd urbansetu/web
npm install
```

### Run Application
```bash
# Start backend (from api directory)
npm start

# Start frontend (from web directory)
npm run dev
```
## 📁 Project Structure

```bash
UrbanSetu/
├── api/                    # Backend
│   ├── controllers/       # Route controllers
│   ├── models/           # MongoDB models
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   ├── seedDefaultAdmin.js # Default admin seeding script
│   └── index.js          # Server entry point
├── web/                  # Frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── redux/        # Redux store
│   │   └── main.jsx      # App entry point
│   └── package.json
└── uploads/              # File uploads
```
(Structure is Variable)

## 🔐 Security Features

- HttpOnly Cookies 
- CSRF Protection 
- Rate Limiting 
- Session Auditing and Logging
- Encryption
- DevOps & Cloud
- JWT-based authentication
- Password hashing with bcryptjs
- Admin approval system with exclusive default admin privileges
- Default admin bypass for initial setup
- Protected routes for admin functionality
- Input validation and sanitization

## ⚡ High-Availability Dual Frontend Strategy: Running actively on Vercel and Render.
### 🔗 Live Links
### 🌐 Primary Website: [Visit UrbanSetu](https://urbansetu.vercel.app/) (Primary site on hold please use backup site)
### 🔄 Backup Access:  [Visit UrbanSetu](https://urbansetuglobal.onrender.com/) (If the primary site takes time to load, please use the Backup link) 

## 🧪 Try UrbanSetu (Demo)

You can experience the platform using demo credentials:

**Demo User Login**
- 👤 Email: `mockuser@nullsto.edu.pl`  
- 🔒 Password: `Mockuser@12`

Or you can sign up and start your own property journey 🚀



## 🤝 Contributing

Contributions are welcome and appreciated! 🚀  
If you'd like to improve UrbanSetu, follow these guidelines:
### How to Contribute
1. Fork the repository  
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
3. Commit changes:
  ```bash
   git commit -m "Add: meaningful description"
```
4. Push and open a Pull Request
  ```bash
   git push origin feature/your-feature-name
```
5.Open a Pull Request (PR)

## 📩 For contribution discussions, contact:
- auth.urbansetu@gmail.com
- urbansetu.noreply@gmail.com
- info.urbansetu@gmail.com

## 📄 License

Copyright © 2026 UrbanSetu.
This project is shared publicly for learning, portfolio, and collaboration purposes.  
Commercial reuse or redistribution without permission is not allowed.

Made with ❤️ for real estate
