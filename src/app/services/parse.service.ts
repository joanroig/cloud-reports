import currency from "currency.js";
import "dotenv/config";
import moment from "moment";
import { exit } from "process";
import { Logger } from "../common/logger";
import * as PaypalService from "./paypal.service";

const logger = Logger.getLogger("Parse");

export async function run(): Promise<string> {
  const token = await PaypalService.getToken();

  const minusMonths = 1;
  const startDate = moment().subtract({ months: minusMonths }).startOf("month");
  const endDate = moment(startDate).add({ months: 1 });

  let res;
  try {
    res = await PaypalService.getTransactions(token, startDate, endDate);
  } catch (error) {
    logger.error(error.response.data);
  }

  // Filter transactions by the subject and build an array of transaction_info
  const sales = res.transaction_details.flatMap((o: any) =>
    o.transaction_info.transaction_subject === process.env.paypal_subject
      ? [o.transaction_info]
      : []
  );

  const { total, fees } = sales.reduce(
    (acc: { total: number; fees: number }, sale: any) => {
      const amount = Number(sale.transaction_amount.value);
      const fee = Number(sale.fee_amount.value);
      if (
        sale.transaction_amount.currency_code !== "EUR" ||
        sale.fee_amount.currency_code !== "EUR"
      ) {
        exit(1);
      }

      acc.total = currency(acc.total).add(amount).value;
      acc.fees = currency(acc.fees).add(fee).value;
      return acc;
    },
    { total: 0, fees: 0 }
  );

  const output =
    `Sales of ${startDate.format("MMMM")}: ${sales.length} | ` +
    `Gross: ${total} € | Fees: ${fees} € | Net: ${currency(total).add(fees)} €`;
  logger.info(output);
  return output;
}
