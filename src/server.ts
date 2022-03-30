import express from "express";
import * as Main from "./app/main";

// Express server to expose endpoints
const app = express();

// Prevent multiple executions at the same time
let updateRunning = false;

app.get("/update", (req, res) => {
  if (updateRunning) {
    res.status(400).send("Update already running, please retry in a minute.");
  } else {
    updateRunning = true;
    Main.run()
      .then(
        (result) => {
          res.send(result);
        },
        (error) => {
          res.status(400).send(error.message);
        },
      )
      .finally(() => (updateRunning = false));
  }
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
