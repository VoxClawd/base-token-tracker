# Base Token Tracker 🚀

Real-time Base token deployment tracker with an improved card-based UI. Monitors [szn.zone/base](https://szn.zone/base) and displays new token deployments in a clean, horizontal grid layout.

![Base Token Tracker](https://via.placeholder.com/800x400?text=Base+Token+Tracker)

## Features ✨

- **Real-time Updates**: WebSocket connection for instant token notifications
- **Card Grid Layout**: Clean horizontal cards (3-4 per row)
- **Dark Mode**: Eye-friendly interface for crypto traders
- **Quick Actions**: Copy contract, view on BaseScan, trade on Uniswap
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Infinite Scroll**: Automatically loads more tokens as you scroll

## Tech Stack 🛠️

- **Frontend**: React + Vite
- **Backend**: Node.js + Express + WebSocket
- **Scraping**: Puppeteer
- **Hosting**: GitHub Pages (frontend) + Render (backend)

## Getting Started 🏁

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/VoxClawd/base-token-tracker.git
cd base-token-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Create frontend `.env`:
```bash
cp frontend/.env.example frontend/.env
```

### Development

Run both frontend and backend:
```bash
npm run dev
```

Or run separately:

**Backend only:**
```bash
npm run server
```

**Frontend only:**
```bash
npm run client
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Production Deployment 🚀

### Backend (Render/Railway)

1. Push code to GitHub
2. Create new Web Service on Render/Railway
3. Set environment variables:
   - `PORT=3001`
   - `NODE_ENV=production`
4. Deploy command: `npm start`

### Frontend (GitHub Pages)

1. Build the frontend:
```bash
npm run build
```

2. Deploy to GitHub Pages:
```bash
# Install gh-pages if not already installed
npm install -g gh-pages

# Deploy
gh-pages -d dist
```

3. Enable GitHub Pages in repository settings

4. Update `frontend/.env` with production WebSocket URL:
```
VITE_WS_URL=wss://your-backend.render.com
```

## Configuration ⚙️

### Environment Variables

**Backend (.env):**
```
PORT=3001
NODE_ENV=development
```

**Frontend (frontend/.env):**
```
VITE_WS_URL=ws://localhost:3001
```

For production, use `wss://` instead of `ws://`.

## API Documentation 📚

### WebSocket Events

**Client → Server:**
- No specific events required (connection only)

**Server → Client:**

1. **INITIAL_TOKENS**
```json
{
  "type": "INITIAL_TOKENS",
  "data": [
    {
      "name": "Example Token",
      "symbol": "EXT",
      "contract": "0x1234...",
      "liquidity": "$10.5K",
      "creator": "0xabcd...",
      "timestamp": 1234567890000
    }
  ],
  "timestamp": 1234567890000
}
```

2. **NEW_TOKEN**
```json
{
  "type": "NEW_TOKEN",
  "data": {
    "name": "New Token",
    "symbol": "NEW",
    "contract": "0x5678...",
    "liquidity": "$5K",
    "creator": "0xefgh...",
    "timestamp": 1234567890000
  },
  "timestamp": 1234567890000
}
```

## Project Structure 📁

```
base-token-tracker/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── Header.css
│   │   │   ├── TokenCard.jsx
│   │   │   └── TokenCard.css
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   └── .env.example
├── server.js
├── vite.config.js
├── package.json
├── .env.example
└── README.md
```

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License 📄

This project is licensed under the ISC License.

## Acknowledgments 🙏

- Data source: [szn.zone](https://szn.zone/base)
- Built for better token tracking on Base

## Support ⭐

If you found this helpful, give it a star! ⭐

---

**Made with ⚡ by VoxClawd**
