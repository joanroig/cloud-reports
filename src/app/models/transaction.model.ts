import { Expose, Transform } from "class-transformer";
import Utils from "../common/utils";

export class Transaction {
  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_id)
  tr_id = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.invoice_id)
  invoice_id = "";

  // Documentation: https://developer.paypal.com/docs/reports/reference/tcodes/
  // T1107 = refund; T0113 = fee;
  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_event_code)
  tr_event_code = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_status)
  tr_status = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_subject)
  tr_subject = "";

  // BUG: PayPal does not return consistent instrument_type data
  // @Expose()
  // @Transform(({ obj }) => obj.transaction_info.instrument_type)
  // tr_medium= ""

  // Updated date is the date considered by PayPal when retrieving data, not the creation date
  @Expose()
  @Transform(({ obj }) =>
    Utils.reportTime(obj.transaction_info.transaction_updated_date).format("DD.MM.YYYY"),
  )
  tr_updated_date = "";

  @Expose()
  @Transform(({ obj }) =>
    Utils.reportTime(obj.transaction_info.transaction_updated_date).format("HH:mm:ss"),
  )
  tr_updated_time = "";

  @Expose()
  @Transform(({ obj }) =>
    Utils.reportTime(obj.transaction_info.transaction_updated_date).format("DD.MM.YYYY"),
  )
  tr_insert_date = "";

  @Expose()
  @Transform(({ obj }) =>
    Utils.reportTime(obj.transaction_info.transaction_updated_date).format("HH:mm:ss"),
  )
  tr_insert_time = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_amount?.value.replace(".", ","))
  tr_amount = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_amount?.currency_code)
  tr_currency = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.fee_amount?.value.replace(".", ","))
  tr_fee_amount = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.fee_amount?.currency_code)
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

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.transaction_note)
  tr_note = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.paypal_reference_id)
  pp_ref_id = "";

  @Expose()
  @Transform(({ obj }) => obj.transaction_info.paypal_reference_id_type)
  pp_ref_id_type = "";
}
