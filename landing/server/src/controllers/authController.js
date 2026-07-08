import { User } from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

function buildAuthResponse(user) {
  return {
    token: generateToken(user._id),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    },
  };
}

export const registerUser = asyncHandler(async (req, res) => {
  const existingUser = await User.findOne({ email: req.body.email });

  if (existingUser) {
    res.status(409);
    throw new Error("A user with this email already exists.");
  }

  const user = await User.create(req.body);

  res.status(201).json(buildAuthResponse(user));
});

export const loginUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user || !(await user.comparePassword(req.body.password))) {
    res.status(401);
    throw new Error("Invalid email or password.");
  }

  res.json(buildAuthResponse(user));
});

export const getProfile = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
