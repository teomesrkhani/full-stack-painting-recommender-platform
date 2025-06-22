# Full Stack Art Recommender Platform
MERN stack + PyTorch-based recommender system for paintings using the WikiArt API.
<img width="1552" alt="Screenshot 2025-06-20 at 10 14 54 PM" src="https://github.com/user-attachments/assets/a7dfb800-4feb-4240-a02a-7a9089388a21" />


## Running Locally:
To run the program locally, follow the steps below:

## Tech Stack

- Frontend: React
- Backend: Node.js, Express, Python, PyTorch, Flask
- Database: MongoDB

## Prerequisites

- Node.js (v14 or later)
- Python (v3.7 or later)
- [MongoDB Altas account](https://www.mongodb.com/docs/atlas/getting-started/ 'Link title')

## Running Locally

1. Clone the repository:
```
git clone https://github.com/teomesrkhani/full-stack-painting-recommender-platform
```

2. Install dependencies:
```
(cd client && npm install) && (cd server && npm install)
```

3. Navigate to the `server` directory:
```
cd server
```

4. Open the `config.env` file and add your own MongoDB Atlas URI, replacing the placeholder values with your actual connection details:
```
ATLAS_URI=mongodb+srv://<username>:<password>@<cluster>.<projectId>.mongodb.net/employees?retryWrites=true&w=majority
```

5. Run the server
```
npm run server
```

6. Open a new terminal window, navigate to the client directory and run client server:
```
cd client && npm run start
```

7. Open a third terminal window, navigate generate_painting and run Flask backend:
```
cd server/generate_painting && FLASK_APP=generate_painting.py flask run --host=0.0.0.0 --port=5001
```

7. Open your browser and navigate to `http://localhost:5173/paintingrecommender/` to view the application.
