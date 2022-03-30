import config from "config";
import "dotenv/config";
import { GoogleSpreadsheet } from "google-spreadsheet";
import moment from "moment";
import "reflect-metadata";
import { Logger } from "./common/logger";
import * as PaypalService from "./services/paypal.service";
import * as ProcessService from "./services/process.service";

const logger = Logger.getLogger("Main");

// Sheets connection
let doc: GoogleSpreadsheet;

export async function run(): Promise<string> {
  const today = moment().utcOffset(config.get("server-timezone"));

  logger.info(`# STARTING AT ${today.format("DD.MM.YYYY HH:mm:ss")} #`);

  // Conect to Google Sheets
  logger.info("Connecting to Google Sheets");
  doc = new GoogleSpreadsheet(process.env.spreadsheet_id);

  // Load credentials
  await doc.useServiceAccountAuth({
    client_email: process.env.client_email,
    private_key: process.env.private_key,
  });

  // Load document properties and worksheets
  await doc.loadInfo();
  logger.info(`Google Sheets title: ${doc.title}`);

  // PayPal connection
  const token = await PaypalService.getToken();

  // Get configuration row
  const configSheet = doc.sheetsByTitle["Configuration"];
  const configRow = (await configSheet.getRows())[0];
  const reload = configRow["Reload"];

  // Prepare to manage transactions
  const sheet = doc.sheetsByTitle["Transactions"];
  let result;

  // Process transaction data
  if (reload === "TRUE") {
    // Prepare range to reload
    const start = moment(configRow["Start Date"], "MM.YYYY").startOf("month");
    const since = moment(configRow["Reload Since"], "MM.YYYY").startOf("month");
    // Reload the needed rows
    result = await ProcessService.reloadRows(token, sheet, today, start, since);
    // Turn off reload in the spreadsheet
    configRow["Reload"] = "FALSE";
    await configRow.save();
  } else {
    // Update all transactions from one month until today
    result = await ProcessService.updateTransactions(token, sheet, today);
  }

  // Save run information in the configuration row
  configRow["Last Run"] = today.format("DD.MM.YYYY HH:mm:ss");
  configRow["Last Run Log"] = result;
  await configRow.save();

  logger.info(result);
  return result;
}
