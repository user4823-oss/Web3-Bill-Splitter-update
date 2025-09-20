const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Data file path
const dataFile = path.join(__dirname, 'data', 'bills.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize bills file if it doesn't exist
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

// Helper functions
const readBills = () => {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const writeBills = (bills) => {
  fs.writeFileSync(dataFile, JSON.stringify(bills, null, 2));
};

// Routes

// Get all bills for a specific wallet
app.get('/api/bills/:walletAddress', (req, res) => {
  try {
    const walletAddress = req.params.walletAddress.toLowerCase();
    const bills = readBills();
    
    // Filter bills where user is creator or participant
    const userBills = bills.filter(bill => 
      bill.creator.toLowerCase() === walletAddress || 
      bill.participants.some(p => p.address.toLowerCase() === walletAddress)
    );
    
    res.json(userBills);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// Create a new bill
app.post('/api/bills', (req, res) => {
  try {
    const { title, totalAmount, creator, participants, description } = req.body;
    
    if (!title || !totalAmount || !creator || !participants || participants.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bills = readBills();
    
    const newBill = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title,
      description: description || '',
      totalAmount: parseFloat(totalAmount),
      creator: creator.toLowerCase(),
      participants: participants.map(p => ({
        address: p.address.toLowerCase(),
        name: p.name || p.address,
        share: parseFloat(p.share) || (parseFloat(totalAmount) / participants.length),
        paid: false,
        txHash: null
      })),
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    bills.push(newBill);
    writeBills(bills);
    
    res.status(201).json(newBill);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create bill' });
  }
});

// Update payment status
app.put('/api/bills/:billId/payment', (req, res) => {
  try {
    const { billId } = req.params;
    const { participantAddress, txHash } = req.body;
    
    const bills = readBills();
    const billIndex = bills.findIndex(b => b.id === billId);
    
    if (billIndex === -1) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const participantIndex = bills[billIndex].participants.findIndex(
      p => p.address.toLowerCase() === participantAddress.toLowerCase()
    );
    
    if (participantIndex === -1) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    bills[billIndex].participants[participantIndex].paid = true;
    bills[billIndex].participants[participantIndex].txHash = txHash;
    
    // Check if all participants have paid
    const allPaid = bills[billIndex].participants.every(p => p.paid);
    if (allPaid) {
      bills[billIndex].status = 'completed';
    }

    writeBills(bills);
    res.json(bills[billIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// Get specific bill
app.get('/api/bills/detail/:billId', (req, res) => {
  try {
    const { billId } = req.params;
    const bills = readBills();
    const bill = bills.find(b => b.id === billId);
    
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bill' });
  }
});

// Delete bill (only creator can delete)
app.delete('/api/bills/:billId', (req, res) => {
  try {
    const { billId } = req.params;
    const { walletAddress } = req.body;
    
    const bills = readBills();
    const billIndex = bills.findIndex(b => b.id === billId);
    
    if (billIndex === -1) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    if (bills[billIndex].creator.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Only bill creator can delete' });
    }

    bills.splice(billIndex, 1);
    writeBills(bills);
    
    res.json({ message: 'Bill deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bill' });
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to view the app`);
});