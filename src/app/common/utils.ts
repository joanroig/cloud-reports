import config from "config";
import moment from "moment";
import { Logger } from "./logger";

const logger = Logger.getLogger("Utils");

export default class Utils {
  /**
   * Separate an array into an array of chunks
   * @param array list to convert to chunks
   * @param chunkSize chunk size
   * @returns array of chunks as any[][], where each chunk matches the chunkSize or lower
   */
  static chunkArray(array: any[], chunkSize: number) {
    return Array.from({ length: Math.ceil(array.length / chunkSize) }, (_, index) =>
      array.slice(index * chunkSize, (index + 1) * chunkSize),
    );
  }

  /**
   * Shift a PayPal transaction datetime to match the timezone used in PayPal reports by adding an hour offset
   * @param date
   * @returns date in the proper timezone
   */
  static reportTime(date: string): moment.Moment {
    const d = moment(date, "YYYY-MM-DDTHH:mm:ss");
    const m = moment(d).add({ hours: Number(config.get("report-timezone-offset")) });
    return m;
  }

  /**
   * Subtract one day from a given moment date, this is used to:
   *  - Prevent missing data in case the last update had not all data available from previous day
   *  - Prevent missing data due timezone offset
   *
   * Explanation: If the timezone offset was used when importing transactions, the transaction dates in
   * the spreadsheet will not match the ones provided by PayPal. Subtracting one day from the start date
   * will fetch transactions that may fall in the timezone offset, so no transaction will be lost. This
   * implies the need of checking for duplicate transactions between the retrieved transactions and the
   * ones already in the spreadsheet.
   *
   * @param date
   * @returns the day before the provided date, at the dtart of the day (00:00:00)
   */
  static prepareStartDate(date: moment.Moment): moment.Moment {
    return moment(date).startOf("day").subtract({ days: 1 });
  }

  /**
   * Wait specified amount of seconds
   * @param s seconds to wait
   * @returns promise, the caller should use await to effectively wait
   */
  static sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

  /**
   * Log and throw error
   * @param str error string
   */
  static throw(str: string) {
    logger.error(str);
    throw new Error(str);
  }
}
