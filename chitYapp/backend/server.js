import express from 'express';
import cors from 'cors';
import userLoginRouter from './routes/userLogin.js';
const app = express();
app.use(express.json());
app.use(cors());
app.use("/userLogins", userLoginRouter);

app.listen(3000, () => console.log("http://localhost:3000")); // temporary (for development)