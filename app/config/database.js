module.exports = {
  adminConfirm: true,
  adminEmail: process.env.ADMIN_EMAIL || 'foo@gmail.com',
  url: process.env.MONGODB_URL || 'mongodb://localhost:27017/pdfs',
  secretKey: process.env.SECRET_KEY || 'you are reading pdfs'
};
