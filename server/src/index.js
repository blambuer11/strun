import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRouter from "./routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const origins = (process.env.APP_ORIGINS || "http://localhost:5173").split(",");

app.use(cors({ origin: origins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", apiRouter);

app.get("/", (_, res) => res.json({ ok: true, version: "strun-server-1" }));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});