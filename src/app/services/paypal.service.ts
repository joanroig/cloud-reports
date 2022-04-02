import axios from "axios";
import config from "config";
import { Logger } from "../common/logger";

const logger = Logger.getLogger("PayPal");
let token = "";

// Set a token to do requests to the PayPal API
export async function reloadToken() {
  logger.info("Getting PayPal token");
  const {
    data: { access_token },
  } = await axios({
    url: `${process.env.paypal_url}/oauth2/token`,
    method: "post",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en_US",
      "content-type": "application/x-www-form-urlencoded",
    },
    auth: {
      username: process.env.paypal_client_id,
      password: process.env.paypal_client_secret,
    },
    params: {
      grant_type: "client_credentials",
    },
  });
  token = access_token;
}

// Get transactions in a date range. The date range should be one month maximum, and within the last 3 years.
export async function getTransactions(
  startDate: moment.Moment,
  endDate: moment.Moment,
): Promise<object[]> {
  const start = startDate.format("YYYY-MM-DDTHH:mm:ss") + "Z";
  const end = endDate.format("YYYY-MM-DDTHH:mm:ss") + "Z";
  const pageSize = config.get("upload-row-chunks");
  let totalPages = 1;
  const transactions = [];
  logger.info(`Getting transactions from ${start} to ${end}`);

  // Load transactions in chunks
  for (let page = 1; page <= totalPages; page++) {
    const { data } = await axios({
      url: `${process.env.paypal_url}/reporting/transactions?start_date=${start}&end_date=${end}&fields=all&page_size=${pageSize}&page=${page}`,
      method: "get",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    // Get the number of pages left
    if (page === 1) {
      totalPages = data.total_pages;
    }
    logger.info(
      `Loaded page ${data.page} of ${data.total_pages} ` +
        `with ${data.transaction_details.length} transactions`,
    );
    transactions.push(...data.transaction_details);
  }
  return transactions;
}
