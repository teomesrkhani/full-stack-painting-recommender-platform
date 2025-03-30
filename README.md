# Full Stack Art Recommender Platform
MERN stack + PyTorch-based recommender system for paintings using the WikiArt API.

## Running Locally:
To run the program locally, follow the steps below:

## Tech Stack

- Frontend: React
- Backend: Node.js, Express, Python, PyTorch
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

7. Open your browser and go to http://localhost:5173 to view the application.
