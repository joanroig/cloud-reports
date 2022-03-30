import { transformAndValidate } from "class-transformer-validator";
import config from "config";
import "dotenv/config";
import { GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import moment from "moment";
import "reflect-metadata";
import { Logger } from "../common/logger";
import Utils from "../common/utils";
import { Transaction } from "../models/transaction.model";
import * as PaypalService from "./paypal.service";

const logger = Logger.getLogger("Process");

// Reload rows from
export async function reloadRows(
  token: string,
  sheet: GoogleSpreadsheetWorksheet,
  today: moment.Moment,
  iniDate: moment.Moment,
  reloadSince: moment.Moment,
): Promise<string> {
  let previousSales: any[] = [];

  if (reloadSince > today || iniDate > today) {
    Utils.throw(`Reload date and initial date should not be in the future.`);
  }

  if (reloadSince >= iniDate) {
    logger.info(
      `===== Reloading transactions since ` + `${reloadSince.format("DD.MM.YYYY")} =====`,
    );
    const rows = await sheet.getRows();

    // Gather values before reloadSince to be restored after clearing the spreadsheet
    previousSales = rows.filter((row) =>
      moment(row["tr_updated_date"], "DD.MM.YYYY").isBefore(reloadSince),
    );
  } else {
    Utils.throw(
      `Reload date could not be earlier than initial date: ` +
        `${reloadSince.format("DD.MM.YYYY")} !< ` +
        `${iniDate.format("DD.MM.YYYY")}`,
    );
  }

  logger.info(`Clearing table data`);

  // CLear table data
  await sheet.clear();

  // Add the object keys as headers
  await sheet.setHeaderRow(Object.keys(new Transaction()));
  await sheet.saveUpdatedCells();

  // Restore previous rows if needed
  if (previousSales.length > 0) {
    logger.info(`Restoring data before ${reloadSince.format("DD.MM.YYYY")}`);
    await insertRows(sheet, previousSales);
  }

  const startDate = moment(reloadSince.startOf("month"));

  let duplicatesFound = false;

  // Reload data from month to month, until end of current month
  while (startDate < moment(today).endOf("month")) {
    const endDate = moment(startDate).endOf("month");
    logger.info(
      `===== Report from ${startDate.format("MMMM DD")} ` + `to ${endDate.format("MMMM DD")} =====`,
    );
    let sales = await getSales(token, startDate, endDate);

    // Check for duplicates between rows and sales
    const rows = await sheet.getRows();
    const duplicateSales = sales.filter((sale) => rows.some((row) => sale.tr_id === row["tr_id"]));

    if (duplicateSales.length > 0) {
      duplicatesFound = true;
      logger.error(
        `Found duplicates while reloading, this is not intended. ` +
          `List of duplicated tr_id: ${duplicateSales.flatMap((d) => d.tr_id)}`,
      );
      // Insert only the non-duplicated sales
      sales = sales.filter((sale) => duplicateSales.indexOf(sale) < 0);

      // Update row data if needed (the row already exists and this should not happen, but we check if the fetched sale has updated data)
      for (const sale of duplicateSales.values()) {
        // Get the row
        const row = rows.find((row) => row["tr_id"] === sale.tr_id);
        if (row) {
          // Update row data if needed
          await updateRow(row, sale);
        }
      }
    }

    // Update sheet and prepare next month
    await insertRows(sheet, sales);
    startDate.add({ months: 1 });
  }

  // Return result text
  let result = "";
  if (duplicatesFound) {
    result += `ERROR: Duplicates found, please check the logs. `;
  }
  result += `Reloaded all transactions since ` + `${reloadSince.format("DD.MM.YYYY")}`;
  return result;
}

export async function updateTransactions(
  token: string,
  sheet: GoogleSpreadsheetWorksheet,
  today: moment.Moment,
): Promise<string> {
  const endOfToday = moment(today).endOf("day");
  const startDate = moment(endOfToday).startOf("day").subtract({ months: 1 });
  // Get transactions from one month ago until end of today
  const sales = await getSales(token, startDate, endOfToday);
  logger.info("===== Updating last month transactions =====");
  const rows = await sheet.getRows();

  let editCount = 0;
  const newRows = [];

  // Check every row to know if it already exists or if it is a new row
  for (const sale of sales.values()) {
    // Check if the row exists in the spreadsheet
    const row = rows.find((row) => row["tr_id"] === sale.tr_id);
    if (row) {
      // Update row data if needed
      editCount += await updateRow(row, sale);
    } else {
      // Schedule the new row to be inserted
      newRows.push(sale as any);
    }
  }

  // Update sheet with all new rows
  await insertRows(sheet, newRows);

  // Update result text
  if (newRows.length === 0 && editCount === 0) {
    return "No changes.";
  } else if (newRows.length > 0 && editCount > 0) {
    return `${newRows.length} new sale${
      newRows.length === 1 ? "" : "s"
    } added and ${editCount} transaction${editCount === 1 ? "" : "s"} edited.`;
  } else if (newRows.length > 0) {
    return `${newRows.length} new sale${newRows.length === 1 ? "" : "s"} added.`;
  } else {
    return `${editCount} transaction${editCount === 1 ? "" : "s"} edited.`;
  }
}

// Check and update row values if needed. Returns 1 if the row has been edited, 0 instead.
async function updateRow(row: GoogleSpreadsheetRow, sale: any) {
  let edited = false;
  Object.entries(sale).forEach(([key, val]) => {
    if (row[key] !== val) {
      logger.info(`Found updated transaction value: ${row[key]} -> ${val}`);
      row[key] = val;
      edited = true;
    }
  });

  if (edited) {
    // Save the updated row
    logger.info(`Updating row with transaction ID ${row["tr_id"]} and waiting 1 second...`);
    await row.save();
    await Utils.sleep(1);
  }
  return edited ? 1 : 0;
}

// Separate rows into chunks and save them into the sheet, Google Sheets takes maximum 60 insertions per minute
async function insertRows(sheet: GoogleSpreadsheetWorksheet, rows: any[]) {
  const chunks = Utils.chunkArray(rows, config.get("upload-row-chunks"));
  if (rows.length > 0) {
    logger.info(`Uploading ${rows.length} rows to google sheets:`);
    for (const chunk of chunks) {
      logger.info(`Adding ${chunk.length} rows and waiting 1 second...`);
      await sheet.addRows(chunk);
      await Utils.sleep(1);
    }
  } else {
    logger.info(`Nothing new to upload.`);
  }
}

// Get sales from a certain period of time, transactions are filtered by the subject to identify the sales from transactions
async function getSales(
  token: string,
  startDate: moment.Moment,
  endDate: moment.Moment,
): Promise<Transaction[]> {
  let transactions: object[] = [];
  try {
    transactions = await PaypalService.getTransactions(token, startDate, endDate);
  } catch (error) {
    Utils.throw(error);
  }

  const totalTansactionsCount = transactions.length;

  if (config.has("filter") && config.get("filter.activate") === true) {
    logger.info("Filtering transactions");
    // Filter transactions
    transactions = transactions.filter((o: any) => {
      // Check if it is an expense (negative amount, starting with T00)
      if (
        o.transaction_info.transaction_amount.value < 0 &&
        o.transaction_info.transaction_event_code.startsWith("T00")
      ) {
        logger.warn(`Skipped expense: ${o.transaction_info.transaction_id}`);
        return false;
      }

      // Keep the ones having a matching subject
      if (config.has("filter.subjects")) {
        const f = config.get("filter.subjects") as string[];
        if (f.includes(o.transaction_info.transaction_subject)) {
          return true;
        }
      }

      // Keep the ones having a matching tcode
      if (config.has("filter.tcodes")) {
        const f = config.get("filter.tcodes") as string[];
        if (f.includes(o.transaction_info.transaction_event_code)) {
          return true;
        }
      }

      // Check if it is a hold (starting with T15, T21 or T1110, T1111)
      if (
        ["T15", "T21", "T1110", "T1111"].some((v) =>
          o.transaction_info.transaction_event_code.includes(v),
        )
      ) {
        logger.warn(`Skipped hold: ${o.transaction_info.transaction_id}`);
      } else {
        logger.warn(`Skipped: ${o.transaction_info.transaction_id}`);
      }
      // Skip all other transactions, like withdrawals
      return false;
    });
  }

  // Transform and validate request body
  const sales = await transformAndValidate(Transaction, transactions, {
    transformer: {
      excludeExtraneousValues: true,
    },
    validator: { skipUndefinedProperties: true },
  });

  logger.info(
    `From ${startDate.format("MMMM DD")} to ${endDate.format("MMMM DD")} ` +
      `there have been ${totalTansactionsCount} transactions of which ${sales.length} are considered for accounting`,
  );

  return sales;
}
