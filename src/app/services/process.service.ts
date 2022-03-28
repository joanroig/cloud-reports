import { transformAndValidate } from "class-transformer-validator";
import config from "config";
import "dotenv/config";
import { GoogleSpreadsheetWorksheet } from "google-spreadsheet";
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
  reloadSince: moment.Moment
): Promise<string> {
  let previousSales: any[] = [];

  if (reloadSince > today || iniDate > today) {
    Utils.throw(`Reload date and initial date should not be in the future.`);
  }

  if (reloadSince >= iniDate) {
    logger.info(
      `===== Reloading transactions since ` +
        `${reloadSince.format("DD.MM.YYYY")} =====`
    );
    const rows = await sheet.getRows();

    // Gather values before reloadSince to be restored after clearing the spreadsheet
    previousSales = rows.filter((row) =>
      moment(row["tr_date"], "DD.MM.YYYY").isBefore(reloadSince)
    );
  } else {
    Utils.throw(
      `Reload date could not be earlier than initial date: ` +
        `${reloadSince.format("DD.MM.YYYY")} !< ` +
        `${iniDate.format("DD.MM.YYYY")}`
    );
  }

  if (previousSales.length > 0) {
    logger.info(`Clearing table and restoring previous data`);
  } else {
    logger.info(`Clearing table data`);
  }

  // CLear table data
  await sheet.clear();

  // Add the object keys as headers
  await sheet.setHeaderRow(Object.keys(new Transaction()));
  await sheet.saveUpdatedCells();

  // Restore previous rows if needed
  if (previousSales.length > 0) {
    await insertRows(sheet, previousSales);
  }

  const startDate = reloadSince.startOf("month");

  // Reload data from month to month
  while (startDate < today) {
    const endDate = moment(startDate).add({ months: 1 });
    logger.info(
      `===== Report from ${startDate.format("MMMM")} ` +
        `to ${endDate.format("MMMM")} =====`
    );
    const sales = await getSales(token, startDate, endDate);
    // Update sheet and prepare next month
    await insertRows(sheet, sales);
    startDate.add({ months: 1 });
  }

  // Return result text
  return (
    `Reloaded all transactions since ` + `${reloadSince.format("DD.MM.YYYY")}`
  );
}

export async function updateTransactions(
  token: string,
  sheet: GoogleSpreadsheetWorksheet,
  today: moment.Moment
): Promise<string> {
  const startDate = moment(today).subtract({ months: 1 });
  // Get transactions from one month ago until today
  const sales = await getSales(token, startDate, today);
  logger.info("===== Updating last month transactions =====");
  const rows = await sheet.getRows();

  let editCount = 0;
  const newRows = [];

  // Check every row to know if it already exists or if it is a new row
  for (const sale of sales.values()) {
    // Check if the exists in the spreadsheet
    const row = rows.find((row) => row["invoice_id"] === sale.invoice_id);
    if (row) {
      // Check if any data has been updated
      let edited = false;
      Object.entries(sale).forEach(([key, val]) => {
        if (row[key] !== val) {
          logger.info(`Found updated transaction value: ${row[key]} != ${val}`);
          row[key] = val;
          edited = true;
        }
      });

      if (edited) {
        // Save the updated row
        logger.info(
          `Updating row with invoice ID ${row["invoice_id"]} and waiting 1 second...`
        );
        await row.save();
        await Utils.sleep(1);
        editCount++;
      }
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
    return `${newRows.length} new sale${
      newRows.length === 1 ? "" : "s"
    } added.`;
  } else {
    return `${editCount} transaction${editCount === 1 ? "" : "s"} edited.`;
  }
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
  endDate: moment.Moment
): Promise<any[]> {
  let res;
  try {
    res = await PaypalService.getTransactions(token, startDate, endDate);
  } catch (error) {
    logger.error(error.response.data);
  }

  // Filter transactions by the subject and build an array of transaction_info
  const salesJson = res.transaction_details.filter(
    (o: any) =>
      o.transaction_info.transaction_subject === process.env.paypal_subject
  );

  let sales;

  try {
    // Transform and validate request body
    sales = (await transformAndValidate(Transaction, salesJson, {
      transformer: { excludeExtraneousValues: true },
    })) as Transaction[];
  } catch (err) {
    Utils.throw("Unable to transform and validate json data: " + salesJson);
  }

  logger.info(
    `From ${startDate.format("MMMM")} to ${endDate.format("MMMM")} ` +
      `there have been ${res.transaction_details.length} transactions of which ${sales.length} are sales`
  );

  return sales;
}
