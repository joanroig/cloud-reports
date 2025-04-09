<h1 align="center">Cloud Reports for PayPal</h1>
<p align="center">
  <img src="img/logo.png" alt="logo" width="340px"/>
  <br>
  <i>Node.js project to track PayPal sales in a Google Sheets document.<br>Deployable to Google App Engine and automatable using Apps Script.</i>
</p>
<p align="center">
    Start your own <a href="https://docs.google.com/spreadsheets/d/1_w5chXmgYmthW2v_MMZhcRmXX0uLrlW1DyxhJKkd98c/copy"><strong>spreadsheet report</strong></a>.
</p>
<p align="center">
  <i>Related project: <a href="https://github.com/joanroig/cloud-invoicing"><strong>Cloud Invoicing</strong></a></i>
</p>
<hr>

## Features

- Track PayPal transactions automatically in Google Sheets
- Filter transactions based on event codes and subjects
- Automatically update existing transactions with new information
- Process transactions month by month to avoid API limitations

### Integrations

- PayPal API for transaction data retrieval
- Google Sheets for data storage and visualization
- Google Cloud Platform for automation and scheduling

> :warning: **Disclaimer: _As stated in the [license](LICENSE), I am by no means responsible for the use of this software._** _Please note that this was made for my own needs and may not fit your use case._

## Requirements

You will need Node.js >16 installed in your environment.

### Node

- #### Node installation on Windows

  Go to the [official Node.js website](https://nodejs.org/) and download the installer.
  Be sure to have `git` available in your PATH, `npm` might need it (you can find git [here](https://git-scm.com/)).

- #### Node installation on Ubuntu

  Install nodejs and npm with apt install, just run the following commands:

      $ sudo apt install nodejs
      $ sudo apt install npm

- #### Other Operating Systems
  You can find more information about the installation on the [official Node.js website](https://nodejs.org/) and the [official NPM website](https://npmjs.org/).

If the installation was successful, you should be able to run the following commands:

    $ node --version
    v18.12.1

    $ npm --version
    8.19.2

## Prepare the project folder

Download the project and install its dependencies:

    $ git clone https://github.com/joanroig/cloud-reports
    $ cd cloud-reports
    $ yarn install

## Configuration

Create a `.env` file in the root directory based on the provided `.env.example`, then you will need to:

- Create a PayPal developer account and create a REST API app to get your client ID and secret [here](https://developer.paypal.com/developer/applications/).
- Put your PayPal credentials in the `.env` file (`paypal_client_id` and `paypal_client_secret`).
- Create a Google Cloud project, activate the Google Sheets API, and create a service account as explained in [this guide](https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication).
- Put the `private_key` and `client_email` values from the JSON of the service account you obtained in the previous step in the `.env` file.
- [Do a copy](https://docs.google.com/spreadsheets/d/1_w5chXmgYmthW2v_MMZhcRmXX0uLrlW1DyxhJKkd98c/copy) of the provided Google Sheets template.
- Share the spreadsheet with the email of your service account (this allows the service account to access your spreadsheet). To do this, go to your copy of the template and press the share button, then enter the service account email and send the invitation.
- Put the spreadsheet ID from the URL of your Google Sheets document into the `spreadsheet_id` of the `.env` file, the ID should look similar to this: `1_w5chXmgYmthW2v_MMZhcRmXX0uLrlW1DyxhJKkd98c`

## Running the project manually

Once the configuration is set up, you can run the project:

    $ yarn start:once

This will retrieve PayPal transactions and add them to your Google Sheets document. You may need to clean the demo data from the Transactions tab, and use the Configuration tab to set your preferences.

## Run the production server locally

The project can run as a server to execute the transaction updates on demand. You can test it locally by executing the following commands, and then access http://localhost:8080/update in your browser to trigger the update:

    $ yarn build
    $ yarn start

## Google Cloud Platform (GCP) integration

After verifying locally that everything works, you may want to automate the transaction updates in the cloud.

> :warning: **Developing and running the project on GCP did not exceed the free quotas for most use cases, but please note that you must enable billing at your own risk. You can configure a Cloud Function to prevent unwanted billings by following the [official documentation](https://cloud.google.com/billing/docs/how-to/notify).**

### Google App Engine setup

The App Engine is where the production server will be deployed and where the transaction updates will be executed.

- [Enable billing](https://console.cloud.google.com/billing) for your Google Cloud project.
- [Install the Google Cloud CLI](https://cloud.google.com/sdk/docs/install-sdk), run `gcloud init` in the project root folder and connect it to your project.
- Update the `project_id` of the `.env` file with the Project ID of your Google Cloud project (get it [here](https://console.cloud.google.com/home/dashboard)).
- Run the command `yarn gcloud:deploy` in the root directory to upload the Node.js project.
- The application will be deployed to Google App Engine, and you can access it at `https://[YOUR_PROJECT_ID].appspot.com/update`

### Setting up Identity-Aware Proxy (IAP)

For enhanced security, you can protect your App Engine application using Identity-Aware Proxy:

- [Enable IAP](https://console.cloud.google.com/security/iap) for your project (create OAuth consent screen if asked).
- Toggle IAP for your App Engine app.
- Select the App Engine app row and add your Gmail accounts by pressing the "Add Principal" button.
- Assign the role `IAP-secured Web App User` to these accounts.

This way, only authorized users can trigger transaction updates.

### Apps Script Integration

The template spreadsheet already includes the Apps Script files, follow all these steps to configure it:

1. Open your spreadsheet, and in the menu open `Extensions > Apps Script`.
2. Go to the settings of the Apps Script and toggle the `Show "appsscript.json" manifest file in editor` checkbox.
3. Assign the Project Number of your Google Cloud project (available [here](https://console.cloud.google.com/home/dashboard)).
4. Go to [credentials](https://console.cloud.google.com/apis/credentials) and create a new OAuth 2.0 Client ID of type `Web application`.
5. Provide a redirect URL with the format `https://script.google.com/macros/d/{SCRIPT_ID}/usercallback`, where SCRIPT_ID is the ID found in the Apps Script settings.
6. (OPTIONAL: Do only if the files are missing) Copy the following files into your Apps Script project:
   - `examples/Apps Script/appscripts.json` to `appsscript.json`
   - `examples/Apps Script/Code.gs` to `Code.gs`
7. Edit the `Code.gs` file to add your own credentials:
   - Set `CLIENT_ID` and `CLIENT_SECRET` to the values from your OAuth client.
   - If IAP is enabled, set `IAP_CLIENT_ID` to the Client ID of your `IAP-App-Engine-app` (find it in [credentials](https://console.cloud.google.com/apis/credentials)).
   - Set `IAP_URL` to your App Engine URL that ends with `.appspot.com/update`.

After saving the script, you'll have a "PayPal" menu in your spreadsheet with a "Run update now" option (refresh the page if not).

## Running in the cloud

Click the "Run update now" option. On the first run you will need to login with your gmail and enable the access and check the Apps Script executions for details (you should find an URL to enable the access in the execution log).

### Setting up automatic updates with Cloud Scheduler

You can use the included cron configuration to automatically update your transactions:

    $ yarn gcloud:schedule-cron

This sets up a cron job to run the update every 12 hours. You can modify the schedule in `cron/start/cron.yaml`.

To stop the automatic updates:

    $ yarn gcloud:stop-cron

### Debugging

Something is not working? Then check the latest run logs on Google App Engine by running the following command:

    $ yarn gcloud:logs

Remember that you can always redeploy by running:

    $ yarn gcloud:deploy

> :warning: **The provided deploy script always replaces the same version on App Engine to prevent exceeding the Cloud Storage free thresholds. This is managed by adding `--version=staging` in the deploy command. If you did some deploys without the flag, you can remove old versions of your project [here](https://console.cloud.google.com/appengine/versions).**

## Customization

### Transaction filtering

By default, the application doesn't filter any transactions. You can enable filtering in `config/default.json`:

```json
"filter": {
  "activate": true,
  "subjects": ["YOUR_SUBJECT_1", "YOUR_SUBJECT_2"],
  "tcodes": ["T0000", "T0003", "T0006", "T0011", "T0113", "T1107"]
}
```

### Reload functionality

If you need to reload transactions from a specific date:

1. Open your Google Sheets document
2. Go to the "Configuration" sheet
3. Set the "Reload From" cell to your desired month (format: "MM.YYYY")
4. Set the "Reload" cell to "TRUE"
5. Run the application manually or wait for the next scheduled run

## Known issues

### **PayPal API limitations**

PayPal's Transaction Search API has a limit of one month per request and can only retrieve transactions from the last 3 years.

### **Google Sheets rate limits**

The application implements delays and batch processing to avoid hitting Google Sheets API rate limits.

# Credits

_All trademarks, logos and brand names are the property of their respective owners._

- App Scripts to IAP from: https://github.com/googleworkspace/apps-script-oauth2/blob/master/samples/CloudIdentityAwareProxy.gs
- Logger based on: https://gist.github.com/euikook/d72a40b3864856af57a6dcbec9d97007
