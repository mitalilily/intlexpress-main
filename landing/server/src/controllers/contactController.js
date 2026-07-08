import { Contact } from "../models/Contact.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const createContact = asyncHandler(async (req, res) => {
  const contact = await Contact.create(req.body);
  res.status(201).json({
    message: "Your inquiry has been saved for the Intlexpress team.",
    contact,
  });
});

export const listContacts = asyncHandler(async (req, res) => {
  const contacts = await Contact.find().sort({ createdAt: -1 });
  res.json({ count: contacts.length, contacts });
});
