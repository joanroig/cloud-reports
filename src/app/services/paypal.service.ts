import axios from "axios";
import { Logger } from "../common/logger";

const logger = Logger.getLogger("PayPal");

// Get a token to do requests to the PayPal API
export async function getToken() {
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
  return access_token;
}

// Get transactions in a date range. The date range should be one month maximum, and within the last 3 years.
export async function getTransactions(
  token: string,
  startDate: moment.Moment,
  endDate: moment.Moment
) {
  logger.info(
    `Getting transactions from ${startDate.format("DD.MM.YYYY")} ` +
      `to ${endDate.format("DD.MM.YYYY")}`
  );

  const start = startDate.format("YYYY-MM-DDT00:00:00-00:00");
  const end = endDate.format("YYYY-MM-DDT00:00:00-00:00");
  const { data } = await axios({
    url: `${process.env.paypal_url}/reporting/transactions?start_date=${start}&end_date=${end}&fields=all`,
    method: "get",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
}
