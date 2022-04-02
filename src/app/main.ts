import config from "config";
import "dotenv/config";
import { GoogleSpreadsheet } from "google-spreadsheet";
import moment from "moment";
import "reflect-metadata";
import { Logger } from "./common/logger";
import Utils from "./common/utils";
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
  await PaypalService.reloadToken();

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
    const reloadFrom = moment(configRow["Reload From"], "MM.YYYY").startOf("month");
    if (reloadFrom.isBefore(start)) {
      Utils.throw(
        `Reload date could not be earlier than initial date: ` +
          `${reloadFrom.format("DD.MM.YYYY")} !< ` +
          `${start.format("DD.MM.YYYY")}`,
      );
    }
    // Reload the needed rows
    result = await ProcessService.runReload(sheet, reloadFrom, today);
    // Turn off reload
    configRow["Reload"] = "FALSE";
  } else {
    const lastRun = moment(configRow["Last Run"], "DD.MM.YYYY HH:mm:ss");
    // Update all transactions since last run and get result string
    result = await ProcessService.runUpdate(sheet, lastRun, today);
  }

  // Update run information
  configRow["Last Run"] = today.format("DD.MM.YYYY HH:mm:ss");
  configRow["Last Run Log"] = result;
  // Save the changes in the configuration row
  await configRow.save();

  logger.info(result);
  return result;
}
