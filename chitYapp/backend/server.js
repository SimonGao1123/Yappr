import express from 'express';
import cors from 'cors';
import userLoginRouter from './routes/userLogin.js';
import session from 'express-session'; 

const app = express();
app.use(express.json());

app.use(cors({
  origin: "http://localhost:5173",  // frontend origin
  credentials: true                 // allow cookies
})); // TEMPORARY

app.use(session({
  name: "chat.sid",
  secret: "super-secret-key", // TEMPORARY, NEED TO SECURE IN .ENV
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,     // can’t be read by JS (good)
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    sameSite: "lax",   // allows cross-origin cookies
    secure: false       // must be false on localhost
  }
}));


// ROUTES
app.use("/userLogins", userLoginRouter);



app.listen(3000, () => console.log("http://localhost:3000")); // temporary (for development)