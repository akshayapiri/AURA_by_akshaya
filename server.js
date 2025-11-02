const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Route all requests to index.html (for client-side routing if needed)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AURA Chatbot server is running on port ${PORT}`);
});

