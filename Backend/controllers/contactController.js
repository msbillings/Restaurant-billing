import Contact from '../models/Contact.js';

export const submitContactForm = async (req, res) => {
  try {
    const { name, email, restaurantName, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email, and message are required fields.' });
    }

    const newContact = new Contact({
      name,
      email,
      restaurantName,
      phone,
      message
    });

    await newContact.save();

    res.status(201).json({ message: 'Contact message submitted successfully!' });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ message: 'Server error while submitting the form.' });
  }
};
