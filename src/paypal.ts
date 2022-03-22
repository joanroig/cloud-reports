import axios from "axios";

export async function getToken() {
  const {
    data: { access_token },
  } = await axios({
    url: `${process.env.url}/oauth2/token`,
    method: "post",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en_US",
      "content-type": "application/x-www-form-urlencoded",
    },
    auth: {
      username: process.env.client_id,
      password: process.env.client_secret,
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
  const start = startDate.format("YYYY-MM-DDT00:00:00-00:00");
  const end = endDate.format("YYYY-MM-DDT00:00:00-00:00");
  const { data } = await axios({
    url: `${process.env.url}/reporting/transactions?start_date=${start}&end_date=${end}`,
    method: "get",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
}
