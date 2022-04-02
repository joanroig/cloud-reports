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

const logger = Logger.getLogger("Sheet");

// Separate rows into chunks and save them into the sheet, Google Sheets takes maximum 60 insertions per minute
export async function insertRows(sheet: GoogleSpreadsheetWorksheet, rows: any[]) {
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

// Add all transactions between a date range into the spreadsheet, existing transactions will be updated if necessary
export async function updateRange(
  sheet: GoogleSpreadsheetWorksheet,
  startDate: moment.Moment,
  endDate: moment.Moment,
) {
  logger.info(
    `===== Updating transactions from ${startDate.format("DD.MM.YYYY")} ` +
      `to ${endDate.format("DD.MM.YYYY")} =====`,
  );
  // Get transactions from last run to the end of today
  const sales = await getTransactions(startDate, endDate);
  const rows = await sheet.getRows();

  let edited = 0;
  const newRows = [];

  // Check every row to know if it already exists or if it is a new row
  for (const sale of sales.values()) {
    // Check if the row exists in the spreadsheet, unique transactions are identified by tr_id and tr_event_code
    const row = rows.find(
      (row) => row["tr_id"] === sale.tr_id && row["tr_event_code"] === sale.tr_event_code,
    );
    if (row) {
      // Update row data if needed
      edited += await updateRow(row, sale);
    } else {
      // Schedule the new row to be inserted
      newRows.push(sale as any);
    }
  }

  // Update sheet with all new rows
  await insertRows(sheet, newRows);
  return { created: newRows.length, edited };
}

// Check and update row values if needed. Returns 1 if the row has been edited, 0 instead.
async function updateRow(row: GoogleSpreadsheetRow, sale: any) {
  let edited = false;

  Object.entries(sale).forEach(([key, val]) => {
    // Update cell if the new value is defined and is different from the one in the sheet
    if (val && row[key] !== val) {
      logger.info(`Updated value for ${key}: ${row[key]} -> ${val}`);
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

// Fetch transactions from a certain period of time
async function getTransactions(
  startDate: moment.Moment,
  endDate: moment.Moment,
): Promise<Transaction[]> {
  let transactions: object[] = [];
  try {
    transactions = await PaypalService.getTransactions(startDate, endDate);
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
    validator: { skipMissingProperties: true },
  });

  logger.info(
    `From ${startDate.format("DD.MM.YYYY")} to ${endDate.format("DD.MM.YYYY")} ` +
      `there have been ${totalTansactionsCount} transactions of which ${sales.length} are considered for accounting`,
  );

  return sales;
}
