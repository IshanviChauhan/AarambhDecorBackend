const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');


const userSchema = new Schema({
    username: {type: String, required: true, unique: true},
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    profileImage: { type: String }, 
    phone: { 
        type: String,
        validate: {
            validator: function(phone) {
                // Allow empty phone numbers or valid 10-digit Indian mobile numbers
                return !phone || /^[6-9]\d{9}$/.test(phone);
            },
            message: 'Phone number must be a 10-digit Indian mobile number starting with 6, 7, 8, or 9'
        }
    },
    shippingAddress: {
        address: { type: String },
        city: { type: String },
        state: { 
            type: String,
            validate: {
                validator: function(state) {
                    if (!state) return true; // Allow empty state
                    
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
                    
                    return validStates.includes(state);
                },
                message: 'Please select a valid Indian state or union territory'
            }
        },
        pincode: { 
            type: String,
            validate: {
                validator: function(pincode) {
                    // Allow empty pincode or valid 6-digit Indian pincode (cannot start with 0)
                    return !pincode || (/^\d{6}$/.test(pincode) && !pincode.startsWith('0'));
                },
                message: 'Pincode must be exactly 6 digits and cannot start with 0'
            }
        }
    },
    createdAt: { type: Date, default: Date.now },
})

// hashpassword

userSchema.pre('save', async function (next) {
    const user = this;
    if (!user.isModified('password')) return next();
    const hashedPassword = await bcrypt.hash(user.password, 10);
    user.password = hashedPassword;
    next();
});


// match password
userSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};




const User = new model('User', userSchema);

module.exports = User;
