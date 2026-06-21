import mongoose from 'mongoose';
import User from '../api/models/user.model.js';
import { 
  getManagementUsers, 
  getManagementAdmins, 
  getDeletedAccounts, 
  getManagementTabCounts 
} from '../api/controllers/management.controller.js';

const MONGO_URI = "mongodb+srv://Rajashekar:Rajashekar@mern-estate.kzrjh.mongodb.net/mern-estate?retryWrites=true&w=majority&appName=mern-estate&tls=true&tlsAllowInvalidCertificates=true";

async function runTests() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    // Find the seeded default admin
    const adminUser = await User.findOne({ email: 'adminvijay@gmail.com' });
    if (!adminUser) {
      console.error("Default admin user not found in database! Seed first.");
      return;
    }
    console.log(`Using admin: ${adminUser.email} (ID: ${adminUser._id})`);

    // Helper to mock Express response
    const mockRes = () => {
      const res = {};
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.body = data;
        return res;
      };
      return res;
    };

    const next = (err) => {
      if (err) {
        console.error("Express Next Error:", err);
      }
    };

    // 1. Test Tab Counts
    console.log("\n--- Testing getManagementTabCounts ---");
    const reqCounts = { user: { id: adminUser._id.toString() } };
    const resCounts = mockRes();
    await getManagementTabCounts(reqCounts, resCounts, next);
    console.log("Tab Counts Response:", resCounts.body);

    // 2. Test Users Tab (Page 1, Limit 2)
    console.log("\n--- Testing getManagementUsers (Page 1, Limit 2) ---");
    const reqUsers = { 
      user: { id: adminUser._id.toString() },
      query: { page: 1, limit: 2 } 
    };
    const resUsers = mockRes();
    await getManagementUsers(reqUsers, resUsers, next);
    console.log("Users Response: success =", resUsers.body?.success, ", total =", resUsers.body?.total, ", items count =", resUsers.body?.items?.length);
    if (resUsers.body?.items?.length > 0) {
      console.log("Sample user:", {
        username: resUsers.body.items[0].username,
        email: resUsers.body.items[0].email,
        listingsCount: resUsers.body.items[0].listingsCount,
        appointmentsCount: resUsers.body.items[0].appointmentsCount
      });
    }

    // 3. Test Users Tab with search query
    console.log("\n--- Testing getManagementUsers with query 'admin' ---");
    const reqUsersSearch = { 
      user: { id: adminUser._id.toString() },
      query: { page: 1, limit: 2, q: 'admin' } 
    };
    const resUsersSearch = mockRes();
    await getManagementUsers(reqUsersSearch, resUsersSearch, next);
    console.log("Search 'admin' results total =", resUsersSearch.body?.total, ", items count =", resUsersSearch.body?.items?.length);

    // 4. Test Admins Tab (Page 1, Limit 2)
    console.log("\n--- Testing getManagementAdmins (Page 1, Limit 2) ---");
    const reqAdmins = { 
      user: { id: adminUser._id.toString() },
      query: { page: 1, limit: 2 } 
    };
    const resAdmins = mockRes();
    await getManagementAdmins(reqAdmins, resAdmins, next);
    console.log("Admins Response: success =", resAdmins.body?.success, ", total =", resAdmins.body?.total, ", items count =", resAdmins.body?.items?.length);

    // 5. Test Softbanned Accounts (isPurged = false)
    console.log("\n--- Testing getDeletedAccounts (Softbanned, page 1) ---");
    const reqSoftbanned = { 
      user: { id: adminUser._id.toString() },
      query: { page: 1, limit: 2, isPurged: 'false' } 
    };
    const resSoftbanned = mockRes();
    await getDeletedAccounts(reqSoftbanned, resSoftbanned, next);
    console.log("Softbanned Response: success =", resSoftbanned.body?.success, ", total =", resSoftbanned.body?.total, ", items count =", resSoftbanned.body?.items?.length);

    // 6. Test Purged Accounts (isPurged = true)
    console.log("\n--- Testing getDeletedAccounts (Purged, page 1) ---");
    const reqPurged = { 
      user: { id: adminUser._id.toString() },
      query: { page: 1, limit: 2, isPurged: 'true' } 
    };
    const resPurged = mockRes();
    await getDeletedAccounts(reqPurged, resPurged, next);
    console.log("Purged Response: success =", resPurged.body?.success, ", total =", resPurged.body?.total, ", items count =", resPurged.body?.items?.length);

  } catch (error) {
    console.error("Test function failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

runTests();
