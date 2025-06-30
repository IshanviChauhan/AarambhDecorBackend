const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET_KEY;

const verifyToken = (req, res, next) => {
    try {
        // Get token from cookies or Authorization header
        const token = req.cookies.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

        if (!token) {
            return res.status(401).json({ message: 'Token not found' });
        }

        const decoded = jwt.verify(token, JWT_SECRET); // Verify token
        req.userId = decoded.userId; // Attach userId to request object
        req.role = decoded.role; // Attach role to request object
        next(); // Proceed to the next middleware
    } catch (error) {
        console.error('Error verifying token:', error.message); // Log error message
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

module.exports = verifyToken;
