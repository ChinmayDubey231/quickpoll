import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || '7d',
  });

const authResponse = (user, res, statusCode = 200) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
};

// POST /api/auth/register
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const user = await User.create({ name, email, password });
  authResponse(user, res, 201);
};

// POST /api/auth/login
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  authResponse(user, res);
};
