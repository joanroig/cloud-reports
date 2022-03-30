import config from "config";
import currency from "currency.js";
import moment from "moment";
import { Logger } from "./logger";

const logger = Logger.getLogger("Utils");

export default class Utils {
  // // Read euro-formatted values from the spreadsheet
  // static euro = (value: string | number) =>
  //   currency(value, {
  //     separator: " ",
  //     decimal: ",",
  //     symbol: "€",
  //     pattern: "# !",
  //     negativePattern: "-# !",
  //   });

  // Convert amount from PayPal to be readable by the Google Sheets
  static euroFormat = (value: string | number) =>
    currency(value).format({
      separator: " ",
      decimal: ",",
      symbol: "€",
      pattern: "#",
      negativePattern: "-#",
    });

  // Separate an array into chunks
  static chunkArray(array: any[], chunkSize: number) {
    return Array.from({ length: Math.ceil(array.length / chunkSize) }, (_, index) =>
      array.slice(index * chunkSize, (index + 1) * chunkSize),
    );
  }

  // Shift a PayPal transaction datetime to match the timezone used in PayPal reports by adding an hour offset
  static reportTime(date: string) {
    const d = moment(date, "YYYY-MM-DDTHH:mm:ss");
    const m = moment(d).add({ hours: Number(config.get("report-timezone-offset")) });
    return m;
  }

  // Wait specified amount of seconds
  static sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

  // Log and throw error
  static throw(str: string) {
    logger.error(str);
    throw new Error(str);
  }
}
