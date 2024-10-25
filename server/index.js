import express from "express";
import logger from "morgan";

import dotenv from "dotenv";

import { Server } from "socket.io";
import { createServer } from "http";

//SQL
import { createClient } from "@libsql/client";

const PORT = process.env.PORT || 3000;
dotenv.config();

const app = express();
const server = createServer(app);

const io = new Server(server, {
  connectionStateRecovery: {},
});

//SQL DB CONNECTION
const db = createClient({
  url: "libsql://sensible-steel-miguelgnz.turso.io",
  authToken: process.env.DB_TOKEN,
});

//TABLE CREATION
await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT
    )
`);

io.on("connection", async (socket) => {
  console.log("A user has connected");

  socket.on("disconnect", () => {
    console.log("A user has disconnected");
  });

  socket.on("chat message", async (msg) => {
    let result;
    try {
      result = await db.execute({
        sql: "INSERT INTO messages (content) VALUES (:message)",
        args: {
          message: msg,
        },
      });
    } catch (error) {
      console.error(error);
      return;
    }

    io.emit("chat message", msg, result.lastInsertRowid.toString());
  });

  if (!socket.recovered) {
    try {
      const results = await db.execute({
        sql: "SELECT id, content FROM messages WHERE id > ?",
        args: [socket.handshake.auth.serverOffset ?? 0],
      });

      results.rows.forEach((row) => {
        socket.emit("chat message", row.content, row.id.toString());
      });
    } catch (error) {
      console.error(error);
      return;
    }
  }
});

app.use(logger("dev"));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/client/index.html");
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
