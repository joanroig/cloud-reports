import "dotenv/config";
import { GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import moment from "moment";
import "reflect-metadata";
import { Logger } from "../common/logger";
import Utils from "../common/utils";
import { Transaction } from "../models/transaction.model";
import * as SheetService from "./sheet.service";

const logger = Logger.getLogger("Process");

// Reload all transactions from a certain month, keeping the older ones
export async function runReload(
  sheet: GoogleSpreadsheetWorksheet,
  reloadFrom: moment.Moment,
  today: moment.Moment,
): Promise<string> {
  if (today.isBefore(reloadFrom)) {
    Utils.throw(`Reload date should not be in the future.`);
  }

  logger.info(`🔨 RUNNING RELOAD: from ${reloadFrom.format("DD.MM.YYYY")} onwards`);

  const rows = await sheet.getRows();

  // Gather values before reloadFrom to be restored after clearing the spreadsheet
  const previous = rows.filter((row) =>
    moment(row["tr_updated_date"], "DD.MM.YYYY").isBefore(reloadFrom),
  );

  logger.info(`Clearing table data`);

  // Clear table data
  await sheet.clear();

  // Add the object keys as headers
  await sheet.setHeaderRow(Object.keys(new Transaction()));
  await sheet.saveUpdatedCells();

  // Restore previous rows if needed
  if (previous.length > 0) {
    logger.info(`Restoring data before ${reloadFrom.format("DD.MM.YYYY")}`);
    await SheetService.insertRows(sheet, previous);
  }

  return updateTransactions(sheet, reloadFrom, today);
}

// Update transactions from one day before last run until last minute of today
export async function runUpdate(
  sheet: GoogleSpreadsheetWorksheet,
  lastRun: moment.Moment,
  today: moment.Moment,
): Promise<string> {
  // Subtract one day from the start date just in case the last update had not all data available from previous day.
  const startDate = moment(lastRun).startOf("day").subtract({ days: 1 });
  const endDate = moment(today).endOf("day");

  if (endDate.isBefore(startDate)) {
    Utils.throw(`Last run date should not be in the future.`);
  }

  logger.info(`🔨 RUNNING UPDATE: last update was on ${lastRun.format("DD.MM.YYYY HH:mm:ss")}`);

  return updateTransactions(sheet, startDate, endDate);
}

// Load data from month to month, until end of current month
async function updateTransactions(
  sheet: GoogleSpreadsheetWorksheet,
  startDate: moment.Moment,
  endDate: moment.Moment,
) {
  let created = 0;
  let edited = 0;

  let startRange = startDate;
  let endRange;
  while (moment(startRange).startOf("month").isSameOrBefore(endDate)) {
    // Check if the start range (month and year) is the same as the end date
    if (startRange.isSame(endDate, "month")) {
      // Range will be until the end date
      endRange = endDate;
    } else {
      // Range will be full month
      endRange = moment(startRange).endOf("month");
    }
    // Update the transactions between the range
    const res = await SheetService.updateRange(sheet, startRange, endRange);
    // Update result counters
    created += res.created;
    edited += res.edited;
    // Next date start range will be the first day of next month
    startRange = moment(startRange).add({ months: 1 }).startOf("month");
  }

  // Return result details.
  let result;
  if (created === 0 && edited === 0) {
    result = "No changes";
  } else if (created > 0 && edited > 0) {
    result =
      `${created} new transaction${created === 1 ? "" : "s"} ` +
      `and ${edited} transaction${edited === 1 ? "" : "s"} edited`;
  } else if (created > 0) {
    result = `${created} new transaction${created === 1 ? "" : "s"}`;
  } else {
    result = `${edited} transaction${edited === 1 ? "" : "s"} edited`;
  }

  return `${result} from ${startDate.format("DD.MM.YYYY")} to ${endDate.format("DD.MM.YYYY")}.`;
}
