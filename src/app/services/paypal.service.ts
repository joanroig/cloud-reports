import axios from "axios";
import { Logger } from "../common/logger";

const logger = Logger.getLogger("PayPal");

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

export async function getTransactions(
  token: string,
  startDate: moment.Moment,
  endDate: moment.Moment
) {
  logger.info(`Getting transactions of ${startDate.format("MMMM")}`);

  const start = startDate.format("YYYY-MM-DDT00:00:00-00:00");
  const end = endDate.format("YYYY-MM-DDT00:00:00-00:00");
  const { data } = await axios({
    url: `${process.env.paypal_url}/reporting/transactions?start_date=${start}&end_date=${end}`,
    method: "get",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
}
