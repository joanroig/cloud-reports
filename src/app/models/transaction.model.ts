import { Expose, Transform } from "class-transformer";
import moment from "moment";
import Utils from "../common/utils";

export class Transaction {
  @Expose()
  @Transform(({ obj }) => obj.transaction_info.invoice_id)
  invoice_id = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_id)
  tr_id = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_event_code)
  tr_event_code = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_status)
  tr_status = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_subject)
  tr_subject = "";

  // BUG: PayPal does not return consistent data
  // @Expose()
  // @Transform(({ obj }) => obj.transaction_info.instrument_type)
  // tr_medium= ""

  @Expose()
  @Transform(({ obj }) =>
    moment(
      obj.transaction_info.transaction_initiation_date.substring(0, 10)
    ).format("DD.MM.YYYY")
  )
  tr_date = "";

  @Expose()
  @Transform(({ obj }) =>
    obj.transaction_info.transaction_initiation_date.substring(11, 19)
  )
  tr_time = "";

  @Expose()
  @Transform(({ obj }) =>
    Utils.euroFormat(obj.transaction_info.transaction_amount.value)
  )
  tr_amount = Utils.euroFormat(0);

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_amount.currency_code)
  tr_currency = "";

  @Expose()
  @Transform(({ obj }) =>
    Utils.euroFormat(obj.transaction_info.fee_amount.value)
  )
  tr_fee_amount = Utils.euroFormat(0);

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.fee_amount.currency_code)
  tr_fee_currency = "";

  @Expose()
  @Transform(({ obj }) => obj.payer_info.account_id)
  payer_id = "";

  @Expose()
  @Transform(({ obj }) => obj.payer_info.email_address)
  payer_email = "";

  @Expose()
  @Transform(({ obj }) => obj.payer_info.payer_name.alternate_full_name)
  payer_name = "";

  @Expose()
  @Transform(({ obj }) => obj.payer_info.country_code)
  payer_country_code = "";
}
