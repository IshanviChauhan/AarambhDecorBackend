const express = require('express');

const User = require('./user.model');
const generateToken = require('../middleware/generateToken');
const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

const OTP = require('./otp.model');

const crypto = require("crypto");
const { sendEmail } = require("./../../utils/emailService"); // Import email service

// register

router.post('/register', async (req, res) => {
  try{
    const { email, password, username } = req.body;
    const user = new User({ email, password, username });
    await user.save();

    res.status(201).send({ message: "User registered successfully" });
  }
  catch(error){
    console.error('Error registering user:', error);
        res.status(500).send({ message: 'Registration failed' });
  }

})

//login


router.post("/send-otp", async (req, res) => {
  try {
      const { email } = req.body;
      const otp = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit OTP
      await OTP.create({ email, otp, expiresAt: Date.now() + 10 * 60 * 1000 });
      await sendEmail(email, "Aarambh Decor - Email Verification Code", 
`Hello
Thank you for choosing Aarambh Decor!
To complete your verification process, please use the following OTP:

Your Verification Code: ${otp}
        
The code is valid for 10 minutes only. Please do not share this code with anyone for security purposes.
        
If you didn't request this verification, please ignore this email.

Best regards,
Aarambh Decor Team`);
      res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to send OTP" });
  }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
      const { email, otp } = req.body;
      const otpRecord = await OTP.findOne({ email, otp });
      if (!otpRecord || otpRecord.expiresAt < Date.now()) {
          return res.status(400).json({ message: "Invalid or expired OTP" });
      }
      
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to verify OTP" });
  }
});


router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find the OTP in the database
    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord || otpRecord.expiresAt < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Remove OTP record after verification
    await OTP.deleteOne({ _id: otpRecord._id });

    // Proceed with registration or other logic
    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
});



router.post('/login', async (req, res) => {
  const { email, password } = req.body;
 try {
  const user = await User.findOne({ email }); 
  if (!user) {
    return res.status(404).send({ message: 'User not found' });
}
const isMatch = await user.comparePassword(password);
if (!isMatch) {
    return res.status(401).send({ message: 'Invalid credentials' });
}
const token = await generateToken(user._id); 

 res.cookie('token',token, { httpOnly: true,
  secure: true, // Ensure this is true for HTTPS
  sameSite: 'None'})



res.status(200).send({ message: 'Logged in successfully', token, user :
  {
    _id: user._id,
    email: user.email,
    username: user.username,
    role: user.role,
    profileImage: user.profileImage,
    phone: user.phone,
    shippingAddress: user.shippingAddress,
  }

});
 }
 
 
 catch (err) {
  console.error('Error logged in user user:', error);
  res.status(500).send({ message: 'Registration failed' });

 }

})

//logoutendpoint

router.post('/logout', (req, res) => {
  res.clearCookie('token'); 
  res.status(200).send({ message: 'Logged out successfully' });
});

router.delete('/users/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const user = await User.findByIdAndDelete(id);
      if (!user) {
          return res.status(404).send({ message: 'User not found' });
      }
      res.status(200).send({ message: 'User deleted successfully' });
  } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).send({ message: 'Failed to delete user' });
  }
}
)


router.get('/users', async (req, res) => {
  try {
      const users = await User.find({}, 'id email role').sort({ createdAt: -1 });
      res.status(200).send(users);
  } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).send({ message: 'Failed to fetch users' });
  }
});


// update a user role
router.put('/users/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const { role } = req.body;
      const user = await User.findByIdAndUpdate(id, { role }, { new: true });
      if (!user) {
          return res.status(404).send({ message: 'User not found' });
      }
      res.status(200).send({ message: 'User role updated successfully', user });
  } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).send({ message: 'Failed to update user role' });
  }
});

router.patch('/edit-profile', verifyToken, async (req, res) => {
  try {
      // Get userId from token payload (set by verifyToken middleware)
      const userId = req.userId;
      
      // Destructure fields from the request body
      const { username, profileImage, phone, shippingAddress } = req.body;

      // Validate phone number if provided
      if (phone && phone.trim() !== '') {
          if (!/^[6-9]\d{9}$/.test(phone)) {
              return res.status(400).send({ 
                  message: 'Phone number must be a 10-digit Indian mobile number starting with 6, 7, 8, or 9' 
              });
          }
      }

      // Validate state if provided
      if (shippingAddress?.state && shippingAddress.state.trim() !== '') {
          const validStates = [
              'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
              'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
              'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
              'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
              'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
              'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
              // Union Territories
              'Andaman and Nicobar Islands', 'Chandigarh', 
              'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
              'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
          ];
          
          if (!validStates.includes(shippingAddress.state)) {
              return res.status(400).send({ 
                  message: 'Please select a valid Indian state or union territory' 
              });
          }
      }

      // Validate pincode if provided
      if (shippingAddress?.pincode && shippingAddress.pincode.trim() !== '') {
          if (!/^\d{6}$/.test(shippingAddress.pincode) || shippingAddress.pincode.startsWith('0')) {
              return res.status(400).send({ 
                  message: 'Pincode must be exactly 6 digits and cannot start with 0' 
              });
          }
      }

      // Find user by ID
      const user = await User.findById(userId);
      if (!user) {
          return res.status(404).send({ message: 'User not found' });
      }

      // Update the user's profile with provided fields
      if (username !== undefined) user.username = username;
      if (profileImage !== undefined) user.profileImage = profileImage;
      if (phone !== undefined) user.phone = phone;
      if (shippingAddress !== undefined) {
          if (!user.shippingAddress) user.shippingAddress = {};
          if (shippingAddress.address !== undefined) user.shippingAddress.address = shippingAddress.address;
          if (shippingAddress.city !== undefined) user.shippingAddress.city = shippingAddress.city;
          if (shippingAddress.state !== undefined) user.shippingAddress.state = shippingAddress.state;
          if (shippingAddress.pincode !== undefined) user.shippingAddress.pincode = shippingAddress.pincode;
      }

      // Save the updated user profile
      await user.save();

      // Send the updated user profile as the response
      res.status(200).send({
          message: 'Profile updated successfully',
          user: {
              _id: user._id,
              username: user.username,
              email: user.email,
              role: user.role,
              profileImage: user.profileImage,
              phone: user.phone,
              shippingAddress: user.shippingAddress,
          }
      });
  } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).send({ message: 'Profile update failed' });
  }
});

module.exports = router;