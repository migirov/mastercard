---
title: API Reference
---

The following table summarizes the Cross-Border Service APIs that facilitate fund transfers. The [Use Cases](https://developer.mastercard.com/cross-border-services/documentation/use-cases/) show how you can use these APIs to provide your cross-border fund transfer solution.

| API | Request Method | Use |
| :--- | :--- | :--- |
| [Quotes API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/) | POST | Calculates, for **configured service corridors**, the amount Senders should fund or Recipients will receive for a payment, based on the transaction instruction.  <br>*   The calculation uses the applicable Mastercard FX Rate and Mastercard Transaction Fees to determine the Settlement Amount.  <br>    <br>*   A Quote response is informational only and does not initiate the movement of funds.  <br>    <br>*   A Proposal ID returned with a Quote can be associated with a Payment to ensure the information obtained with the Quote is utilized for the Payment Transaction. |
| [Quote Confirmation APIs](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/) | GET, POST | Provides a host of services which will allow the customer to: Confirm Quote, Cancel Confirmed Quote, Retrieve Confirmed Quote and obtain Consolidate Status Change feedback. |
| [Carded Rate API and Push Notification](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/) | POST | Obtains FX rates for currency pairs before the payment transaction is initiated. |
| [Payment API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/) | POST | Creates a payment transaction to send funds to a Recipient. |
| [Address Validation API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/address-validation-api/) | POST | Helps to check whether the address in a given country is valid as per the country’s convention before sending a payment to Mastercard XBS so that payments do not get rejected because of invalid address. |
| [Account Validation APIs](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/) | POST | An opt-in service which allows customer to generate, validate and look up both account and bank related information. |
| [Endpoint Guide Adapter API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/endpoint-guide-adapter_api/) | GET | Provides both technical and business specifications to support payment initiation. |
| [Status Change Push](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/) | POST | Offered as an opt-in functionality to obtain a near real-time status update. |
| [Retrieve Payment API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/) | GET | Searches details of a payment transaction by transaction ID or transaction reference. |
| [RFI APIs](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/) | GET, POST | Suite of APIs to send and receive information with the Mastercard Request for Information (RFI) team to address RFI issues. |
| [Cancel  <br>Payment API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cancel-payment-api/) | POST | Cancels a payment transaction that was initiated earlier.  <br>ONLY applicable to cash-out and some mobile money providers. |
| [Balance API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/) | GET | Provides near real-time account balance. |

To use these APIs, you create a Mastercard Developers project with the **Mastercard Cross-Border Services** API service and set up the project keys, which are used for authenticating API access and encrypting/decrypting the request and response payloads. For more information, see [Getting Started with the APIs](https://developer.mastercard.com/cross-border-services/documentation/api-basics/getting-started-oauth1a/).  

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, you must connect using [OAuth2.0 Authorization Code flow](https://developer.mastercard.com/cross-border-services/documentation/ref-app/oauth2-access-token-based-authentication-details/) for Balance APIs and [OAuth2.0 Request Token based flow](https://developer.mastercard.com/cross-border-services/documentation/ref-app/oauth2-request-token-based-authentication-details/) for all APIs (except Balance API) as the authentication mechanism to ensure compliance with the relevant jurisdiction based Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2). Please proceed to [Getting Started with APIs using OAuth2.0](https://developer.mastercard.com/cross-border-services/documentation/api-basics/getting-started-oauth2/) for step by step instructions on how to setup.

> [!NOTE]
> 
> We reserve the right to add parameters to resource actions/services and to add new fields to resource representations returned in responses. These types of changes are considered backward compatible and will added without changing the API version. Applications consuming these resources should be written such that new fields appearing in returned resource representations will not cause errors. We reserve the right to truncate data, when required to comply with constraints of financial messages initiated through calls to the Cross-Border Service API. We will not modify the consumer data in storage, but will perform any required truncation when the financial message is constructed.

---
title: Quotes API
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, refer the [Quotes API specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-eu-quotes-api/) and [Quotes API specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-uk-quotes-api/) section respectively to ensure compliance with the relevant jurisdiction based Regulatory Technical Standards (either EU or UK) derived from the revised Payment Services Directive (PSD2).

Calculates for **configured service corridors**, the amount Senders should fund or Recipients will receive for a payment, depending on the Transaction Instruction.  

*   The calculation uses the applicable Mastercard FX Rate and Mastercard Transaction Fees to determine the Settlement Amount.  
    
*   A Quote response is informational only and does not initiate the movement of funds.  
    
*   A Proposal ID returned with a Quote can be associated with a Payment to ensure the information obtained with the Quote is utilized for the Payment Transaction.

  
If you opt-in for Quote confirmation suite, you will receive ‘ConfirmationExpiry time’ in the API response.  

See [Payment with Quote](https://developer.mastercard.com/cross-border-services/documentation/use-cases/payment-with-quote/) to understand how you can use Quote API with a payment transaction.

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/quotes
```

```production
https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder/quotes
```

> [!NOTE]
> 
> **Sandbox** and **MTF** environments share the same url but are differentiated by partner id.

# API

  
Alternatively, here is a tabular view of the request/ response parameter:  (1MB)  

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/#operation/quotes)

Provides information before a payment is initiated and submitted.

Sandbox URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/quotes

MTF URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/quotes

Production URL

https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder/quotes

*   **Formats supported**: XML/ JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example - application/json

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

## Test cases

The Sandbox server returns simulated, static responses. You can use the following test cases to produce specific responses.

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Forward Quote with fees included | 1\. Send Quote using ‘transaction\_reference’ number starting with ‘08’ and Ends with ‘ACFQ’  <br>2\. Make sure to pass the quoterequest.quote\_type.forward object with fees-included =true in the request. |
| Success | Forward Quote without sender and recipient account URIs including 2 additional data fields (701 and 7260) | 1\. Send Quote using ‘transaction\_reference’ number starting with ‘08’ and Ends with ‘AOCFQ’  <br>2\. Make sure to pass the quoterequest.quote\_type.forward object with fees-included =true in the request. |
| Success | Forward Quote with fees not included | 1\. Send Quote using ‘transaction\_reference’ number starting with ‘08’ and Ends with ‘ACFQ’  <br>2\. Make sure to pass the quoterequest.quote\_type.forward object with fees-included =false in the request. |
| Success | Reverse Quote | 1\. Send Quote using ‘transaction\_reference’ number starting with ‘08’ and Ends with ‘ACRQ’  <br>2\. Make sure to pass the quoterequest.quote\_type.reverse object in the request. |
| Success | Reverse Quote without sender and recipient account URIs including 2 additional data fields (701 and 7260) | 1\. Send Quote using ‘transaction\_reference’ number starting with ‘08’ and Ends with ‘AOCRQ’  <br>2\. Make sure to pass the quoterequest.quote\_type.reverse object in the request. |
| Rejected with Specific Error | Quote - responds with specific error code | Send a Quote using ‘transaction\_reference’ number starting with ‘1’ and ending with the desired error code.  <br>For example: Transaction reference ‘1XXXXXXXX130105’ will REJECT quote and return 130105 error code in response. |
| Rejected - Can be successfully resubmitted | 150001 System Error: Quote is resubmitted successfully | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘22S’ and ends with ‘501’.  <br>For example: Transaction reference ‘22SXXXXXXXXXX501’ will REJECT payment and return 150001 error code in the quote response.  <br>2\. Resubmit the initial quote using the same ‘transaction\_reference’ and same input parameters.  <br>Transaction will be processed with status “Success.” |
| Rejected - Resubmitted request rejected | 150001 System Error: Quote is resubmitted with different parameters and rejected | 1\. Send a Quote using ‘transaction\_reference’ number starting with starting with ‘22S’ and ends with ‘501’.  <br>For example: Transaction reference ‘22SXXXXXXXXXX501’ will REJECT payment and return 150001 error code in the payment response.  <br>2\. Resubmit the quote using the same ‘transaction\_reference’ with different input parameters; like different value for sender\_account\_uri.  <br>Transaction will be rejected with 82000 error code. |
| Rejected | Forward Quote without sender and recipient account URIs including 1 additional data field 701 | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘2’ and ending with 092000.  <br>For example: Transaction reference ‘2XXXXXXXX092000’ will REJECT quote and return 092000 error code and source “Additional Data-7260-Beneficiary payment instrument” in the response. |

## Sandbox Test cases for Wires

The Sandbox server returns simulated, static responses. For customers who are interested or enabled to instruct wire transactions, can use the following test cases to produce specific responses.

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Forward Quote with fees included for BANKWIRE | 1\. Send Quote using ‘transaction\_reference’ number starting with ‘08’ and Ends with ‘ACFQ’  <br>2\. Make sure to pass the quoterequest.quote\_type.forward object with fees-included =true in the request.  <br>3\. Provide Additional fields ‘701’ with Recipient country and ‘7260’ with ‘BANKWIRE’. |
| Success | Forward Quote with fees not included for BANKWIRE | 1\. Send Quote using ‘transaction\_reference’ number starting with ‘08’ and Ends with ‘ACFQ’  <br>2\. Make sure to pass the quoterequest.quote\_type.forward object with fees-included =false in the request.  <br>3\. Provide Additional fields ‘701’ with Recipient country and ‘7260’ with ‘BANKWIRE’. |
| Success | reverse Quote for BANKWIRE | 1\. Send Quote using ‘transaction\_reference’ number starting with ‘08’ and Ends with ‘ACRQ’  <br>2\. Make sure to pass the quoterequest.quote\_type.reverse object in the request.  <br>3\. Provide Additional fields ‘701’ with Recipient country and ‘7260’ with ‘BANKWIRE’ |
| Rejected with Specific Error | Quote - responds with specific error code for BANKWIRE | Send a Quote using ‘transaction\_reference’ number starting with ‘1’ and ending with the desired error code and provide Additional fields ‘701’ with Recipient country and ‘7260’ with ‘BANKWIRE’.  <br>For example: Transaction reference ‘1XXXXXXXX130105’ will REJECT quote and return 130105 error code in response. |
| Rejected - Can be successfully resubmitted | 150001 System Error: Quote is resubmitted successfully for BANKWIRE | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘22S’ and ends with ‘501’ and provide Additional fields ‘701’ with Recipient country and ‘7260’ with ‘BANKWIRE’.  <br>For example: Transaction reference ‘22SXXXXXXXXXX501’ will REJECT payment and return 150001 error code in the quote response.  <br>2\. Resubmit the initial quote using the same ‘transaction\_reference’ and same input parameters.  <br>Transaction will be processed with status “Success.” |
| Rejected - Resubmitted request rejected | 150001 System Error: Quote is resubmitted with different parameters and rejected for BANKWIRE | 1\. Send a Quote using ‘transaction\_reference’ number starting with starting with ‘22S’ and ends with ‘501’ and provide Additional fields ‘701’ with Recipient country and ‘7260’ with ‘BANKWIRE’.  <br>For example: Transaction reference ‘22SXXXXXXXXXX501’ will REJECT payment and return 150001 error code in the payment response.  <br>2\. Resubmit the quote using the same ‘transaction\_reference’ with different input parameters; like different value for sender\_account\_uri.  <br>Transaction will be rejected with 82000 error code. |

# Sample Request

## Request with Sender and Recipient URI fields:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
 <quoterequest>
   <transaction_reference>07-DXF-CA-UERTYGH2909202wfnvpobv00734_8</transaction_reference>
   <sender_account_uri>tel:+25406005</sender_account_uri>
   <recipient_account_uri>tel:+254069832</recipient_account_uri>
   <payment_amount>
     <amount>105.65</amount>
     <currency>USD</currency>
   </payment_amount>
   <payment_origination_country>USA</payment_origination_country>
   <payment_type>P2P</payment_type>
   <quote_type>
     <forward>
       <receiver_currency>GBP</receiver_currency>
     </forward>
   </quote_type>
 </quoterequest>
 
```

```json
{
   "quoterequest": {
     "transaction_reference": "07-DXF-CA-UERTYGH2909202wfnvpobv00734_8",
     "sender_account_uri": "tel:+25406005",
     "recipient_account_uri": "tel:+254069832",
     "payment_amount": {
       "amount": "105.15",
       "currency": "USD"
     },
     "payment_origination_country": "USA",
     "payment_type": "P2P",
     "quote_type": {
       "forward": {
         "receiver_currency": "GBP"
       }
     }
   }
 }
 
```

## Request without Sender and Recipient Account URI:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
 <quoterequest>
     <transaction_reference>07-DXF-CA-UERTYGH2909202wfnvpobv00734_8</transaction_reference>
     <payment_amount>
         <amount>105.65</amount>
         <currency>USD</currency>
     </payment_amount>
     <payment_origination_country>USA</payment_origination_country>
     <payment_type>P2P</payment_type>
     <quote_type>
         <forward>
             <receiver_currency>GBP</receiver_currency>
         </forward>
     </quote_type>
     <additional_data>
       <data_field>
         <name>701</name>
         <value>USA</value>
       </data_field>
       <data_field>
         <name>7260</name>
         <value>CARD</value>
       </data_field>
     </additional_data>
 </quoterequest>
 
```

```json
{
    "quoterequest": {
       "transaction_reference": "07-DXF-CA-UERTYGH2909202wfnvpobv00734_8",
       "payment_amount": {
          "amount": "105.15",
          "currency": "USD"
       },
       "payment_origination_country": "USA",
       "payment_type": "P2P",
       "quote_type": {
          "forward": {
             "receiver_currency": "GBP"
          }
       },
      "additional_data": {
        "data_field": [
          {
            "name": "701",
            "value": "USA"
          },
          {
            "name": "7260",
            "value": "CARD"
          }
        ]
      }
    }
 }
 
```

## Request for BANKWIRE:

```xml
<?xml version="1.0" encoding="UTF-8"?>
 <quoterequest>
    <transaction_reference>07-DXF-CA-UERTYGH2909202wfnvpobv00734_8</transaction_reference>
    <sender_account_uri>tel:+25406005</sender_account_uri>
    <recipient_account_uri>ban:45678993;bic=UNBECNSHXXX</recipient_account_uri>
    <payment_amount>
       <amount>105.65</amount>
       <currency>USD</currency>
    </payment_amount>
    <payment_origination_country>USA</payment_origination_country>
    <payment_type>P2P</payment_type>
    <quote_type>
       <forward>
          <receiver_currency>USD</receiver_currency>
       </forward>
    </quote_type>
    <additional_data>
       <data_field>
          <name>701</name>
          <value>CHN</value>
       </data_field>
       <data_field>
          <name>7260</name>
          <value>BANKWIRE</value>
       </data_field>
    </additional_data>
 </quoterequest>
 
```

```json
{
     "quoterequest": {
         "transaction_reference": "07-DXF-CA-UERTYGH2909202wfnvpobv00734_8",
         "sender_account_uri": "tel:+25406005",
         "recipient_account_uri": "ban:45678993;bic=UNBECNSHXXX",
         "payment_amount": {
             "amount": "105.15",
             "currency": "USD"
         },
         "payment_origination_country": "USA",
         "payment_type": "P2P",
         "quote_type": {
             "forward": {
                 "receiver_currency": "USD"
             }
         },
         "additional_data": {
             "data_field": [
                 {
                     "name": "701",
                     "value": "CHN"
                 },
                 {
                     "name": "7260",
                     "value": "BANKWIRE"
                 }
             ]
         }
     }
 }
 
```

# Sample Response

## Successful Response:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <quote>
 <transaction_reference>07-LKS-HT-XBMTYU2909202wfnvpobv931455_2</transaction_reference>
     <payment_type>P2P</payment_type>
     <proposals>
         <proposal>
             <id>pen_40000796299942448699062004</id>
             <resource_type>proposal</resource_type>
             <fees_included>true</fees_included>
             <charged_amount>
                 <currency>USD</currency>
                 <amount>5.25</amount>
             </charged_amount>
             <credited_amount>
                 <currency>GBP</currency>
                 <amount>82.63</amount>
             </credited_amount>
             <principal_amount>
                 <currency>USD</currency>
                 <amount>110.50</amount>
             </principal_amount>
             <expiration_date>2019-09-09T02:12:11.750-05:00</expiration_date>
             <additional_data_list>
                 <resource_type>list</resource_type>
                 <item_count>2</item_count>
                 <data>
                     <data_field>
                         <name>851</name>
                         <value>456</value>
                     </data_field>
                     <data_field>
                         <name>813</name>
                         <value>123</value>
                     </data_field>
                 </data>
             </additional_data_list>
             <quote_fx_rate>3.7833456828</quote_fx_rate>
         </proposal>
     </proposals>
 </quote>
 
```

```json
{
    "quote": {
       "transaction_reference": "07-LKS-HT-XBMTYU2909202wfnvpobv931455_2",
       "payment_type": "P2P",
       "proposals": {
          "proposal": {
             "id": "pen_40000796299942448699062004",
             "resource_type": "proposal",
             "fees_included": "true",
             "charged_amount": {
                "currency": "USD",
                "amount": "5.25"
             },
             "credited_amount": {
                "currency": "GBP",
                "amount": "82.63"
             },
             "principal_amount": {
                "currency": "USD",
                "amount": "110.50"
             },
             "expiration_date": "2019-09-09T02:12:11-05:00",
             "additional_data_list": {
                "resource_type": "list",
                "item_count": "2",
                "data": {
                   "data_field": [
                      {
                         "name": "851",
                         "value": "456"
                      },
                      {
                         "name": "813",
                         "value": "123"
                      }
                   ]
                }
             },
             "quote_fx_rate": "3.7833456828"
          }
       }
    }
 }
 
```

## Successful Response of Quote without URIs (Sender and Recipient) and with 2 Additional Data Fields, 701 and 7260 :

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <quote>
 <transaction_reference>090785ec9d59464997894fd</transaction_reference>
     <payment_type>P2P</payment_type>
     <proposals>
         <proposal>
             <id>pen_4000191467510582680686724</id>
             <resource_type>proposal</resource_type>
             <fees_included>true</fees_included>
             <charged_amount>
                 <currency>EUR</currency>
                 <amount>4.2</amount>
             </charged_amount>
             <credited_amount>
                 <currency>EUR</currency>
                 <amount>40</amount>
             </credited_amount>
             <principal_amount>
                 <currency>EUR</currency>
                 <amount>4.00</amount>
             </principal_amount>
             <expiration_date>2023-02-10T05:30:59-06:00</expiration_date>
             <additional_data_list>
                 <resource_type>list</resource_type>
                 <item_count>8</item_count>
                 <data>
                     <data_field>
                         <name>851</name>
                         <value>456</value>
                     </data_field>
                     <data_field>
                         <name>813</name>
                         <value>123</value>
                     </data_field>
                     <data_field>
                         <name>111</name>
                         <value>Oak Street</value>
                     </data_field>
                     <data_field>
                         <name>112</name>
                         <value>any city</value>
                     </data_field>
                     <data_field>
                         <name>701</name>
                         <value>USA</value>
                     </data_field>
                     <data_field>
                         <name>7260</name>
                         <value>CARD</value>
                     </data_field>
                     <data_field>
                         <name>700</name>
                         <value>FRA</value>
                     </data_field>
                     <data_field>
                         <name>299</name>
                         <value>USD</value>
                     </data_field>
                 </data>
             </additional_data_list>
             <quote_fx_rate>777</quote_fx_rate>
         </proposal>
     </proposals>
 </quote>
 
```

```json
{
   "quote": {
     "transaction_reference": "090785ec9d59464997894fd",
     "payment_type": "P2P",
     "proposals": {
       "proposal": [
         {
           "id": "pen_4000191467510582680686724",
           "resource_type": "proposal",
           "fees_included": true,
           "charged_amount": {
             "amount": "4.2",
             "currency": "EUR"
           },
           "credited_amount": {
             "amount": "40",
             "currency": "EUR"
           },
           "principal_amount": {
             "amount": "4.00",
             "currency": "EUR"
           },
           "expiration_date": "2023-02-10T05:30:59-06:00",
           "additional_data_list": {
             "resource_type": "list",
             "item_count": "8",
             "data": {
               "data_field": [
                 {
                   "name": "851",
                   "value": "456"
                 },
                 {
                   "name": "813",
                   "value": "123"
                 },
                 {
                   "name": "111",
                   "value": "Oak Street"
                 },
                 {
                   "name": "112",
                   "value": "any city"
                 },
                 {
                   "name": "701",
                   "value": "USA"
                 },
                 {
                   "name": "7260",
                   "value": "CARD"
                 },
                 {
                   "name": "700",
                   "value": "FRA"
                 },
                 {
                   "name": "299",
                   "value": "USD"
                 }
               ]
             }
           },
           "quote_fx_rate": "777"
         }
       ]
     }
   }
 }
 
```

## Successful Response for BANKWIRE:

```xml
<?xml version="1.0" encoding="UTF-8"?>
 <quote>
    <transaction_reference>06d1df139c-bc13-4713-a64d-9c9ac898af4e</transaction_reference>
    <payment_type>P2P</payment_type>
    <proposals>
       <proposal>
          <id>21pnbzep2tis52g935pzk47re9</id>
          <resource_type>proposal</resource_type>
          <fees_included>true</fees_included>
          <charged_amount>
             <amount>6.65</amount>
             <currency>USD</currency>
          </charged_amount>
          <credited_amount>
             <amount>6.65</amount>
             <currency>USD</currency>
          </credited_amount>
          <principal_amount>
             <amount>6.65</amount>
             <currency>USD</currency>
          </principal_amount>
          <expiration_date>2023-09-21T05:33:49.874-05:00</expiration_date>
          <additional_data_list>
             <resource_type>list</resource_type>
             <item_count>2</item_count>
             <data>
                <data_field>
                   <name>813</name>
                   <value>1.000000</value>
                </data_field>
                <data_field>
                   <name>840</name>
                   <value>f19tis9fg4gkeg11h0dkc1kybea</value>
                </data_field>
             </data>
          </additional_data_list>
          <quote_fx_rate>1.000000</quote_fx_rate>
          <confirmation_expiry_time>2023-09-21T05:33:49.874-05:00</confirmation_expiry_time>
       </proposal>
    </proposals>
 </quote>
 
```

```json
{
     "quote": {
         "transaction_reference": "77-DXF-CA-UERTYGH2909202wfnvpobv00734_8",
         "payment_type": "P2P",
         "proposals": {
             "proposal": [
                 {
                     "id": "2uc8sd7m5vjk32s0kc84zo7r4t",
                     "resource_type": "proposal",
                     "fees_included": true,
                     "charged_amount": {
                         "amount": "5.15",
                         "currency": "USD"
                     },
                     "credited_amount": {
                         "amount": "5.15",
                         "currency": "USD"
                     },
                     "principal_amount": {
                         "amount": "5.15",
                         "currency": "USD"
                     },
                     "expiration_date": "2023-09-25T05:48:07-05:00",
                     "additional_data_list": {
                         "resource_type": "list",
                         "item_count": "2",
                         "data": {
                             "data_field": [
                                 {
                                     "name": "813",
                                     "value": "1.000000"
                                 },
                                 {
                                     "name": "840",
                                     "value": "5juubzclkyqpt1g71viray0zpg"
                                 }
                             ]
                         }
                     },
                     "quote_fx_rate": "1.000000",
                     "confirmation_expiry_time": "2023-09-25T05:48:07-05:00"
                 }
             ]
         }
     }
 }
 
```

## Rejected Response with source:

```xml
<Errors>
    <Error>
       <RequestId>7623048</RequestId>
       <Source>Additional Data-1200-Destination Service Tag</Source>
       <ReasonCode>INVALID_INPUT_VALUE</ReasonCode>
       <Description>Invalid Input Value</Description>
       <Recoverable>false</Recoverable>
       <Details>
          <Detail>
             <Name>ErrorDetailCode</Name>
             <Value>082000</Value>
          </Detail>
       </Details>
    </Error>
 </Errors>
 
```

```json
{
    "Errors": {
       "Error": {
          "RequestId": "7623048",
          "Source": "Additional Data-1200-Destination Service Tag",
          "ReasonCode": "INVALID_INPUT_VALUE",
          "Description": "Invalid Input Value",
          "Recoverable": "false",
          "Details": {
             "Detail": {
                "Name": "ErrorDetailCode",
                "Value": "082000"
             }
          }
       }
    }
 }
 
```

## Rejected Response without source:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <Errors>
     <Error>
         <RequestId>170114</RequestId>
         <Source></Source>
         <ReasonCode>DECLINE</ReasonCode>
         <Description>No routing option for beneficiary URI provided</Description>
         <Details>
             <Detail>
                 <Name>ErrorDetailCode</Name>
                 <Value>130113</Value>
             </Detail>
         </Details>
     </Error>
 </Errors>
 
```

```json
{
    "Errors": {
       "Error": {
          "RequestId": "170114",
          "Source": "",
          "ReasonCode": "DECLINE",
          "Description": "No routing option for beneficiary URI provided",
          "Details": {
             "Detail": {
                "Name": "ErrorDetailCode",
                "Value": "130113"
             }
          }
       }
    }
 }
 
```

## Rejected Response for BANKWIRE:

```xml
<?xml version="1.0" encoding="UTF-8"?>
 <Errors>
    <Error>
       <RequestId>120405226</RequestId>
       <Source />
       <ReasonCode>DECLINE</ReasonCode>
       <Description>Invalid recipient currency</Description>
       <Recoverable>false</Recoverable>
       <Details>
          <Detail>
             <Name>ErrorDetailCode</Name>
             <Value>130101</Value>
          </Detail>
       </Details>
    </Error>
 </Errors>
 
```

```json
{
     "Errors": {
         "Error": {
             "RequestId": "120405304",
             "Source": "",
             "ReasonCode": "DECLINE",
             "Description": "Invalid recipient currency",
             "Recoverable": "false",
             "Details": {
                 "Detail": {
                     "Name": "ErrorDetailCode",
                     "Value": "130101"
                 }
             }
         }
     }
 }
 
```

## Validation Failure Response:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <Errors>
   <Error>
     <RequestId>170022</RequestId>
     <Source>recipient_account_uri</Source>
     <ReasonCode>MISSING_REQUIRED_INPUT</ReasonCode>
     <Description>Missing Required Input</Description>
     <Recoverable>false</Recoverable>
     <Details>
       <Detail>
         <Name>ErrorDetailCode</Name>
         <Value>092000</Value>
       </Detail>
     </Details>
   </Error>
   <Error>
     <RequestId>170022</RequestId>
     <Source>payment_amount.currency</Source>
     <ReasonCode>INVALID_INPUT_FORMAT</ReasonCode>
     <Description>Value contains invalid character</Description>
     <Recoverable>false</Recoverable>
     <Details>
       <Detail>
         <Name>ErrorDetailCode</Name>
         <Value>062000</Value>
       </Detail>
     </Details>
   </Error>
 </Errors>
 
```

```json
{
   "Errors": {
     "Error": [
       {
         "RequestId": "170022",
         "Source": "recipient_account_uri",
         "ReasonCode": "MISSING_REQUIRED_INPUT",
         "Description": "Missing Required Input",
         "Recoverable": "false",
         "Details": {
           "Detail": {
             "Name": "ErrorDetailCode",
             "Value": "092000"
           }
         }
       },
       {
         "RequestId": "170022",
         "Source": "payment_amount.currency",
         "ReasonCode": "INVALID_INPUT_FORMAT",
         "Description": "Value contains invalid character",
         "Recoverable": "false",
         "Details": {
           "Detail": {
             "Name": "ErrorDetailCode",
             "Value": "062000"
           }
         }
       }
     ]
   }
 }
 
```

## Rejected Response of Quote without URIs (Sender and Recipient) and with 1 Additional Data Field, 701 :

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <Errors>
   <Error>
     <RequestId>55875692</RequestId>
     <Source>Additional Data-7260-Beneficiary payment instrument</Source>
     <ReasonCode>MISSING_REQUIRED_INPUT</ReasonCode>
     <Description>Missing Required Input</Description>
     <Recoverable>false</Recoverable>
     <Details>
       <Detail>
         <Name>ErrorDetailCode</Name>
         <Value>092000</Value>
       </Detail>
     </Details>
   </Error>
 </Errors>
 
```

```json
{
   "Errors": {
     "Error": [
       {
         "RequestId": "55875692",
         "Source": "Additional Data-7260-Beneficiary payment instrument",
         "ReasonCode": "MISSING_REQUIRED_INPUT",
         "Description": "Missing Required Input",
         "Recoverable": "false",
         "Details": {
           "Detail": {
             "Name": "ErrorDetailCode",
             "Value": "092000"
           }
         }
       }
     ]
   }
 }
 
```

## Rejected Response of Quote with Sender URI and with 2 Additional Data Fields, 701 and 7260 :

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <Errors>
   <Error>
     <RequestId>55875692</RequestId>
     <Source>recipient_account_uri</Source>
     <ReasonCode>MISSING_REQUIRED_INPUT</ReasonCode>
     <Description>Missing Required Input</Description>
     <Recoverable>false</Recoverable>
     <Details>
       <Detail>
         <Name>ErrorDetailCode</Name>
         <Value>092000</Value>
       </Detail>
     </Details>
   </Error>
 </Errors>
 
```

```json
{
   "Errors": {
     "Error": [
       {
         "RequestId": "55875692",
         "Source": "recipient_account_uri",
         "ReasonCode": "MISSING_REQUIRED_INPUT",
         "Description": "Missing Required Input",
         "Recoverable": "false",
         "Details": {
           "Detail": {
             "Name": "ErrorDetailCode",
             "Value": "092000"
           }
         }
       }
     ]
   }
 }
 
```

## Rejected Response of Quote with Recipient URI and with 2 Additional Data Fields, 701 and 7260 :

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <Errors>
   <Error>
     <RequestId>55875692</RequestId>
     <Source>sender_account_uri</Source>
     <ReasonCode>MISSING_REQUIRED_INPUT</ReasonCode>
     <Description>Missing Required Input</Description>
     <Recoverable>false</Recoverable>
     <Details>
       <Detail>
         <Name>ErrorDetailCode</Name>
         <Value>092000</Value>
       </Detail>
     </Details>
   </Error>
 </Errors>
 
```

```json
{
   "Errors": {
     "Error": [
       {
         "RequestId": "55875692",
         "Source": "sender_account_uri",
         "ReasonCode": "MISSING_REQUIRED_INPUT",
         "Description": "Missing Required Input",
         "Recoverable": "false",
         "Details": {
           "Detail": {
             "Name": "ErrorDetailCode",
             "Value": "092000"
           }
         }
       }
     ]
   }
 }
 
```

# Error Codes

Refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/#sandbox-testing)
*   [Sample Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/#sample-request)
*   [Sample Response](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/#sample-response)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/#error-codes)


---
title: Quote Confirmation APIs
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, please proceed to [Quotes Confirmation API Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-eu-quote-confirmation-apis/) and [Quotes Confirmation API Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-uk-quote-confirmation-apis/) respectively to ensure compliance with the relevant jurisdiction based Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

# Quote Confirmation API Suite

Enrolling in the Quote Confirmation suite API includes the following APIs:  
Note: If you would like real time Payment and Quote status updates then enroll in the [Status Change Push Notification](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/).

# Environment Domains

## Quote Confirmation

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/partners/{partner-id}/crossborder/quotes/confirmations
 
```

```Production
https://api.mastercard.com/send/partners/{partner-id}/crossborder/quotes/confirmations
```

## Cancel Confirmed Quote

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/partners/{partner-id}/crossborder/quotes/cancellations
 
```

```Production
https://api.mastercard.com/send/partners/{partner-id}/crossborder/quotes/cancellations
```

## Retrieve Confirmed Quote

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/partners/{partner-id}/crossborder/quotes/{transaction-reference}/proposals/{proposal-id}
 
```

```Production
https://api.mastercard.com/send/partners/{partner-id}/crossborder/quotes/{transaction-reference}/proposals/{proposal-id}
```

> [!NOTE]
> 
> **Sandbox** and **MTF** environments share the same url but are differentiated by partner id.

# API

  
Enrolling in the Quote Confirmation Service includes the following APIs:  
Note: If you would like real time Payment and Quote status updates then enroll in the [Status Change Push](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/).

## Quote Confirmation API

This API is used to confirm the FX rate quote that you received in the Quotes API. This confirmation is mandatory prior to submitting a payment transaction. The Quote Confirmation needs to be done within the ‘confirmationExpiryTime’ that is received in the Quotes API response. Getting a successful Quote Confirmation incurs a reserve of funds.  
If you opt-in ‘Late Quote Confirmation policy’ and you confirm the quote after `confirmationExpiryTime`, the original quote will be considered as ‘Expired’ and new quote will be sent in the Quote Confirmation API response. You can now confirm the new quote within the `ConfirmationExpirytime`. The late confirmation will be allowed for maximum of three (3) attempts; afterwards, the confirmation will be declined.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#operation/confirmQuote)

Confirm FX rate quote.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/quotes/confirmations

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/quotes/confirmations

## Cancel Confirmed Quote API

This API is used to cancel a confirmed FX rate quote/proposal. If Confirmed Quote cancellation is sent before the payment initiation, the cancellation will result in return of reserved funds. If cancellation is sent after payment initiation, the Confirmed Quote Cancellation will be declined.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#operation/cancelQuote)

Cancel a confirmed FX rate quote or proposal.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/quotes/cancellations

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/quotes/cancellations

## Retrieve Confirmed Quote API

If you opt-in in Quote Confirmation Suite, you can use this API to retrieve quote details requested for payment utilization.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#operation/retrieveQuote)

Retrieve quote details requested for payment utilization.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/quotes/{transaction\_reference}/proposals/{proposal\_id}

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/quotes/{transaction\_reference}/proposals/{proposal\_id}

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required OAuth 1.0a Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

## Sandbox Test cases

The Sandbox server returns simulated, static responses. You can use the following test cases to produce specific responses.

### Quote Confirmation

| Status | Test Case | Action |
| --- | --- | --- |
| Confirmed | Quote Confirmation successful response | 1\. Send Quote request using ‘transactionReference’ number starting with ‘40’  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1. |
| Pending Ambiguous | Quote Confirmation pending due to technical reason | 1\. Send Quote request using ‘transactionReference’ number starting with ‘41’  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1. |
| Pending Expired | Enrolled in late Quote Confirmation policy and submits Quote Confirmation after ‘confirmationExpiryTime’ receives ‘Pending Expired’ in the Quote Confirmation API response with new proposal details. | 1\. Send Quote using ‘transactionReference’ number starting with ‘42’  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1 after a min. |
| Rejected with 130194 error code | Quote Confirmation response with duplicate Quote Confirmation | 1\. Send Quote request using ‘transactionReference’ number starting with ‘44’ and ending with the 130194 error code.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1.  <br>For example: Transaction reference ‘44XXXXXXXX130194’ will REJECT quote and return 130194 error code in response |
| Rejected with 130195 error code | ‘Quote Confirmation is performed after ‘confirmationExpiryTime’ exceeds | 1\. Send Quote request using ‘transactionReference’ number starting with ‘44’ and ending with the 130195 error code.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1.  <br>For example: Transaction reference ‘44XXXXXXXX130195’ will REJECT quote and return 130195 error code in response |
| Rejected with 130196 error code | Enrolled in pre-funding and does not have sufficient balances in the prefunding account | 1\. Send Quote request using ‘transactionReference’ number starting with ‘44’ and ending with the 130196 error code.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1.  <br>For example: Transaction reference ‘44XXXXXXXX130196’ will REJECT quote and return 130196 error code in response |
| Rejected with 082000 error code | Input validation failure | 1\. Send Quote request using ‘transactionReference’ number starting with ‘44’ and ending with ‘082000’.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1.  <br>For example: Transaction reference ‘44XXXXXXXX082000’ will REJECT quote and return 082000 error code in response |
| Rejected- Can be resubmitted | 150001 System Error: Quote Confirmation can be resubmitted | 1\. Send Quote request using ‘transactionReference’ number starting with ‘41CR’ and ends with ‘501’.  <br>2\. Send a Quote Confirmation using same transaction\_reference’ number same proposal id from step 1  <br>For example: Transaction reference ‘41CRXXXXXXXXXX501’ will REJECT Quote Confirmation and return 150001 error code in the Quote Confirmation response.  <br>3\. Resubmit the initial quote using the same ‘transactionReference’ after 5 min upto 15 min with same input parameters. Transaction will be processed with status “Success.” |

### Cancel Confirmed Quote

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Cancel Confirmed Quote successful response | 1\. Send Quote request using ‘transactionReference’ number starting with ‘401R’  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1  <br>3\. Send Quote Cancellation request using the transactionReference and proposalId from step 1 |
| Pending Ambiguous | Cancellation Pending for Confirmed Quote due to technical failure | 1\. Send Quote request using ‘transactionReference’ number starting with ‘402’ and ends with ‘504’ or ‘505’  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1  <br>3\. Send Quote Cancellation request using the transactionReference and proposalId from step 1 |
| Rejected with 130197 error | Received error for cancellation already requested | 1\. Send Quote request using ‘transactionReference’ number starting with ‘401’ and ending with the 130197 error code.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1  <br>3\. Send Quote Cancellation request using the transactionReference and proposalId from step 1  <br>For example: Transaction reference ‘401XXXXXXXX130197’ will REJECT quote and return 130197 error code in response |
| Rejected with 130111 error | Try and cancel Confirmed Quote that was already cancelled | 1\. Send Quote request using ‘transactionReference’ number starting with ‘401’ and ending with the 130111 error code.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1  <br>3\. Send Quote Cancellation request using the transactionReference and proposalId from step 1  <br>For example: Transaction reference ‘401XXXXXXXX130111’ will REJECT quote and return 130111 error code in response |
| Rejected with 082000 error | Input validation failure | 1\. Send Quote request using ‘transactionReference’ number starting with ‘401’ and ending with ‘082000’.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1.  <br>3\. Send Quote Cancellation request using the transactionReference and proposalId from step 1.  <br>For example: Transaction reference ‘401XXXXXXXX082000’ will REJECT quote and return 082000 error code in response. |
| Rejected- Can be resubmitted | 150001 System Error: Quote Cancellation is resubmitted successfully | 1\. Send Quote request using ‘transactionReference’ number starting with ‘402CR’ and ends with ‘501’.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1  <br>3\. Send Quote Cancellation request using the transactionReference and proposalId from step 1  <br>For example: Transaction reference ‘402CRXXXXXXXXXX501’ will REJECT Quote Cancellation and return 150001 error code in the quote response.  <br>4\. Resubmit the Quote Cancellation using the same ‘transactionReference’ and same input parameters after a minute but within 30 minutes after the initial quote call,  <br>Transaction will be processed with status “Success.” |

### Retrieve Confirmed Quote

| Status | Test Case | Action |
| --- | --- | --- |
| Record not found | Retrieve Quote - responds with error code - 110507 | Retrieve quote using any ‘transactionReference’ and proposalId that is not used before. |
| Success | Retrieve a Confirmed Quote | 1\. Create quote with transactionReference starting with ‘40’.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1  <br>3\. Retrieve quote with transactionReference and proposalId given in step 2 |
| Success | Retrieve Cancelled Confirmed Quote | 1\. Create quote with Transaction Reference starting with ‘401R’.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1  <br>3\. Send Quote Cancellation request using the transactionReference and proposalId from step 2  <br>4\. Retrieve Quote with transactionReference and proposalId given in step 2 |
| Success | Retrieve a quote where status is pending and stage is expired | 1\. Create quote with Transaction Reference starting with ‘42’.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1  <br>3\. Retrieve quote with transactionReference and proposalId given in step 2 |
| Success | Retrieve a quote where status is pending and stage is ambiguous | 1\. Create quote with Transaction Reference starting with ‘41’.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1  <br>3\. Retrieve quote with transactionReference and proposalId given in step 2 |
| Success | Retrieve a Rejected Quote | 1\. Create quote with transactionReference starting with ‘44’ and ending with any expected Quote Confirmation error code. For example: Transaction reference ‘44XXXXXXXX130195’.  <br>2\. Send Quote Confirmation request using the transactionReference and proposalId from step 1.  <br>3\. Retrieve quote with transactionReference and proposalId given in step 2. |
| Success | Retrieve Quote before the Quote Confirmation , Status and stage will be blank. | 1\. Create quote with transactionReference starting with ‘4’.  <br>2\. Retrieve quote with transactionReference given in step 1 |

# Quote Confirmation Sample Request

```JSON
{
  "transactionReference": "41C12344311006563",
  "proposalId": "pen_4000767745894923464866186"
}

```

# Quote Confirmation Sample Response

## Successful Response

```JSON
{
    "transactionReference": "40C12344311006662",
    "status": "CONFIRMED",
    "proposalId": "pen_4000837491233982545990059",
    "paymentSubmissionExpiryTime": "2022-01-28T05:00:35-06:00"
}

```

## Pending Ambiguous Response:

```JSON
{
    "transactionReference": "41C12344311006663",
    "status": "PENDING",
    "stage": "Ambiguous",
    "proposalId": "pen_4000353661783596006753363"
}
```

## Pending Expired Response:

```JSON
{
   "transactionReference":"42a2421f21e486494799635",
   "status":"PENDING",
   "stage":"Expired",
   "proposalId":"pen_4000033672217723533692871",
   "proposedQuote":{
      "proposals":[
         {
            "id":"pen_4000986534202938713628905",
            "resourceType":"proposal",
            "feesIncluded":true,
            "expirationDate":"2022-01-30T23:44:03-06:00",
            "quoteFxRate":"777",
            "chargedAmount":{
               "amount":"105.13",
               "currency":"USD"
            },
            "creditedAmount":{
               "amount":"1001.2",
               "currency":"USD"
            },
            "principalAmount":{
               "amount":"100.12",
               "currency":"USD"
            },
            "confirmationExpiryTime":"2022-01-30T23:44:03-06:00"
         }
      ]
   }
}
```

## Rejected with Specific Error Response:

```JSON
{
   "Errors":{
      "Error":[
         {
            "RequestId":"48883924",
            "ReasonCode":"DECLINE",
            "Description":"Confirmation requested for Expired Quote",
            "Recoverable":false,
            "Details":{
               "Detail":[
                  {
                     "Name":"ErrorDetailCode",
                     "Value":"130195"
                  }
               ]
            }
         }
      ]
   }
}
```

## Rejected - Can be resubmitted Response:

```JSON
{
   "Errors":{
      "Error":[
         {
            "RequestId":"48883968",
            "Source":"ConfirmQuote",
            "ReasonCode":"SYSTEM_ERROR",
            "Description":"A system error has occurred",
            "Recoverable":false,
            "Details":{
               "Detail":[
                  {
                     "Name":"ErrorDetailCode",
                     "Value":"150001"
                  }
               ]
            }
         }
      ]
   }
}
```

# Quote Cancellation Sample Request

```JSON
{
  "transactionReference": "41C12344311006563",
  "proposalId": "pen_4000767745894923464866186"
}

```

# Quote Cancellation Sample Response

## Cancelled Response:

```JSON
{
   "transactionReference":"401Rb0ebea981f17468d9c4fd",
   "status":"CANCELLED",
   "proposalId":"pen_4000555569304844118706334",
   "releasedReservedAmount":{
      "amount":"22.06",
      "currency":"USD"
   }
}

```

## Pending Ambiguous Response:

```JSON
{
   "transactionReference":"402Ff86769988b7e455b90022504",
   "status":"PENDING",
   "stage":"Ambiguous",
   "proposalId":"pen_4000134910763449861927718"
}
```

## Rejected with Specific Error Response:

```JSON
{
    "Errors": {
        "Error": [
            {
                "RequestId": "186917",
                "Source": "proposalId",
                "ReasonCode": "DECLINE ",
                "Description": "Cancellation not permitted on this transaction",
                "Recoverable": false,
                "Details": {
                    "Detail": [
                        {
                            "Name": "ErrorDetailCode",
                            "Value": "130111"
                        }
                    ]
                }
            }
        ]
    }
}
```

## Rejected- Can be resubmitted Response:

```JSON
{
   "Errors":{
      "Error":[
         {
            "RequestId":"48883968",
            "Source":"CancelQuote",
            "ReasonCode":"SYSTEM_ERROR",
            "Description":"A system error has occurred",
            "Recoverable":false,
            "Details":{
               "Detail":[
                  {
                     "Name":"ErrorDetailCode",
                     "Value":"150001"
                  }
               ]
            }
         }
      ]
   }
}
```

# Retrieve Quote sample response

## Retrieve a Confirmed Quote response

```JSON
{
    "transactionReference": "40C12344311006762",
    "resourceType": "quote",
    "created": "2022-01-31T15:00:31+05:30",
    "proposalId": "pen_4000195143736799198306423",
    "confirmStatus": {
        "status": "CONFIRMED"
    },
    "paymentSubmissionExpiryTime": "2022-01-31T17:00:24+05:30",
    "quote": {
        "proposals": [
            {
                "resourceType": "proposal",
                "feesIncluded": true,
                "expirationDate": "2022-01-31T15:00:31+05:30",
                "chargedAmount": {
                    "amount": "105.13",
                    "currency": "USD"
                },
                "creditedAmount": {
                    "amount": "1001.2",
                    "currency": "USD"
                },
                "principalAmount": {
                    "amount": "100.12",
                    "currency": "USD"
                },
                "confirmationExpiryTime": "2022-01-31T15:00:31+05:30"
            }
        ]
    },
    "statusTimestamp": "2022-01-31T15:00:31+05:30"
}
```

## Retrieve a Cancelled Quote response

```JSON
{
    "transactionReference": "401R12344311006762",
    "resourceType": "quote",
    "created": "2022-02-01T08:16:57+05:30",
    "proposalId": "pen_4000414553565328012680992",
    "cancelStatus": {
        "status": "CANCELLED"
    },
    "paymentSubmissionExpiryTime": "2022-02-01T10:15:14+05:30",
    "quote": {
        "proposals": [
            {
                "resourceType": "proposal",
                "feesIncluded": true,
                "expirationDate": "2022-02-01T08:16:57+05:30",
                "chargedAmount": {
                    "amount": "105.13",
                    "currency": "USD"
                },
                "creditedAmount": {
                    "amount": "1001.2",
                    "currency": "USD"
                },
                "principalAmount": {
                    "amount": "100.12",
                    "currency": "USD"
                },
                "confirmationExpiryTime": "2022-02-01T08:16:57+05:30"
            }
        ]
    },
    "statusTimestamp": "2022-02-01T08:16:57+05:30"
}
```

## Retrieve a pending expired quote response

```JSON
{
    "transactionReference": "42112344311006762",
    "resourceType": "quote",
    "created": "2022-02-01T08:40:41+05:30",
    "proposalId": "pen_4000942245429356229084729",
    "confirmStatus": {
        "status": "PENDING",
        "pendingStage": "Expired"
    },
    "quote": {
        "proposals": [
            {
                "resourceType": "proposal",
                "feesIncluded": true,
                "expirationDate": "2022-02-01T08:40:41+05:30",
                "chargedAmount": {
                    "amount": "105.13",
                    "currency": "USD"
                },
                "creditedAmount": {
                    "amount": "1001.2",
                    "currency": "USD"
                },
                "principalAmount": {
                    "amount": "100.12",
                    "currency": "USD"
                },
                "confirmationExpiryTime": "2022-02-01T08:40:41+05:30"
            }
        ]
    },
    "statusTimestamp": "2022-02-01T08:40:41+05:30"
}
```

## Retrieve a pending ambiguous quote response

```JSON
{
    "transactionReference": "41C12344311006663",
    "resourceType": "quote",
    "created": "2022-01-28T14:02:23+05:30",
    "proposalId": "pen_4000353661783596006753363",
    "confirmStatus": {
        "status": "PENDING",
        "pendingStage": "Ambiguous"
    },
    "quote": {
        "proposals": [
            {
                "resourceType": "proposal",
                "feesIncluded": true,
                "expirationDate": "2022-01-28T14:02:23+05:30",
                "chargedAmount": {
                    "amount": "105.13",
                    "currency": "USD"
                },
                "creditedAmount": {
                    "amount": "1001.2",
                    "currency": "USD"
                },
                "principalAmount": {
                    "amount": "100.12",
                    "currency": "USD"
                },
                "confirmationExpiryTime": "2022-01-28T14:02:23+05:30"
            }
        ]
    },
    "statusTimestamp": "2022-01-28T14:02:23+05:30"
}
```

## Retrieve a Rejected Quote Confirmation

```JSON
{
    "transactionReference": "44157453474311130195",
    "resourceType": "quote",
    "created": "2022-02-01T13:12:55+05:30",
    "proposalId": "pen_4000903991319632726051612",
    "confirmStatus": {
        "status": "REJECTED",
        "errorCode": "150001",
        "errorMessage": "A system error has occurred"
    },
    "quote": {
        "proposals": [
            {
                "resourceType": "proposal",
                "feesIncluded": true,
                "expirationDate": "2022-02-01T13:12:55+05:30",
                "chargedAmount": {
                    "amount": "105.13",
                    "currency": "USD"
                },
                "creditedAmount": {
                    "amount": "1001.2",
                    "currency": "USD"
                },
                "principalAmount": {
                    "amount": "100.12",
                    "currency": "USD"
                },
                "confirmationExpiryTime": "2022-02-01T13:12:55+05:30"
            }
        ]
    },
    "statusTimestamp": "2022-02-01T13:12:55+05:30"
}
```

## Retrieve a Rejected Quote cancellation

```JSON
{
    "transactionReference": "44157453474311130195",
    "resourceType": "quote",
    "created": "2022-02-01T13:12:55+05:30",
    "proposalId": "pen_4000903991319632726051612",
    "cancelStatus": {
        "status": "REJECTED",
        "errorCode": "130111",
        "errorMessage": "Cancellation not permitted on this transaction"
    },
    "quote": {
        "proposals": [
            {
                "resourceType": "proposal",
                "feesIncluded": true,
                "expirationDate": "2022-02-01T13:12:55+05:30",
                "chargedAmount": {
                    "amount": "105.13",
                    "currency": "USD"
                },
                "creditedAmount": {
                    "amount": "1001.2",
                    "currency": "USD"
                },
                "principalAmount": {
                    "amount": "100.12",
                    "currency": "USD"
                },
                "confirmationExpiryTime": "2022-02-01T13:12:55+05:30"
            }
        ]
    },
    "statusTimestamp": "2022-02-01T13:12:55+05:30"
}
```

## Retrieve quote prior to confirmation response

```JSON
{
    "transactionReference": "40C12344311006762",
    "resourceType": "quote",
    "created": "2022-01-31T14:57:38+05:30",
    "proposalId": "pen_4000195143736799198306423",
    "quote": {
        "proposals": [
            {
                "resourceType": "proposal",
                "feesIncluded": true,
                "expirationDate": "2022-01-31T14:57:38+05:30",
                "chargedAmount": {
                    "amount": "105.13",
                    "currency": "USD"
                },
                "creditedAmount": {
                    "amount": "1001.2",
                    "currency": "USD"
                },
                "principalAmount": {
                    "amount": "100.12",
                    "currency": "USD"
                },
                "confirmationExpiryTime": "2022-01-31T14:57:38+05:30"
            }
        ]
    }
}
```

## Status and Stage matrix

| Status | Stage | Description |
| --- | --- | --- |
| Confirmed |     | Quote is confirmed |
| Cancelled |     | Quote is cancelled |
| Pending | Ambiguous | Technical error |
| Pending | Expired | Quote is expired and new quote is sent for  <br>customers opting in late Quote Confirmation policy |
| Rejected |     | Quote request is rejected.  <br>Accompanied by error code and error message. |

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

On this page

*   [Quote Confirmation API Suite](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#quote-confirmation-api-suite)
*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#sandbox-testing)
*   [Quote Confirmation Sample Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#quote-confirmation-sample-request)
*   [Quote Confirmation Sample Response](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#quote-confirmation-sample-response)
*   [Quote Cancellation Sample Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#quote-cancellation-sample-request)
*   [Quote Cancellation Sample Response](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#quote-cancellation-sample-response)
*   [Retrieve Quote sample response](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#retrieve-quote-sample-response)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/#error-codes)


---
title: Carded Rate Pull API and Carded Rate Push
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, please proceed to [Carded Rate API Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-eu-carded-rate-api/) and [Carded Rate API Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-uk-carded-rate-api/) respectively to ensure compliance with the relevant jurisdiction based Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

Carded Rate is offered, **for configured service corridors**, as an opt-in functionality to obtain the FX rates for the currency pairs that you, as the Customer support, for a valid period of time. Please see [Payment with Carded Rate](https://developer.mastercard.com/cross-border-services/documentation/use-cases/payment-with-carded-rate/) for more information on usage of the carded rates. The two options available to obtain the carded rates are as follows:  

1.  FX Rate Pull API: This is a Pull API that you may send a request to obtain Carded Rate, and  
    
2.  FX Rate Push Notification: This is a push notifictaion where Mastercard would send the notifications as and when the rates are available.  
    

This page describes the details on both the options available for obtaining the carded rates.

> [!NOTE]
> 
> Prior to using these API/ Notification, you must opt-in for this service by contacting your Mastercard representative.

# Environment Domains

## FX Rate Pull

```Sandbox
Sandbox testing is unavailable for Carded Rate APIs.
```

```MTF
https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/rates
```

```Production
https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder/rates
```

## FX Rate Push

*   This is a push Notification and webhook endpoint will need to be provided by you for Mastercard to send the FX Rates.

> [!NOTE]
> 
> *   Contact your mastercard representative for mTLS push notification mastercard public certificate. This certificate needs to be trusted by the receiving application. Also, please share the server certificate chain for validation (via KMP portal), if those are accepted on mastercard infrastructure.
> *   Once done, FX rates can be sent by Mastercard to the other party.
> *   During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production).

# API

Alternatively, here is a tabular view of the request/ response parameter:  (264KB)

## FX Rate Pull

  
The FX Rate Pull API will require you to create a scheduler, **for configured service corridors**, that will call this API based on the refresh times per currency pair provided by Cross-Border Services.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#operation/getFxRates)

Used as the primary mechanism to retrieve FX rates.

Sandbox URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/rates

MTF URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/rates

Production URL

https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder/rates

*   **Formats supported**: XML/ JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example - application/json

## FX Rate Push

  
The FX Rate Push, once coded to, will provide the ability for Cross-Border Services to push all FX rates, **for configured service corridors**, to the Customer that are refreshing at the time of the push without any requests by the Customer. Depending on the number and FX refresh schedules of the rates, the Customer should expect to receive multiple pushes a day.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#operation/Carded%20PUSH)

Push all FX rates to the Origination Institution.

https://static.developer.mastercard.com/callbackpath

> [!TIP]
> 
> It is a Cross-Border Services best practice for any customer who codes to the Push API to also code to the Pull API so that the pull API can be used as a backup in case FX rates are not received for any reason.

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/json  
    content-length: Length of the inbound content body in octets.

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

Sandbox Testing is unavailable for Carded Rate APIs.

# Sample Requests

## FX Rate Pull

No Request body

## FX Rate Push

```XML
<?xml version="1.0" encoding="UTF-8" ?>
<rates>
    <account_type>BANK</account_type>
    <partner_id>BEL_MCSXB1HS5fd</partner_id>
    <type>single</type>
    <use>CMSP</use>
    <from_currency_code>MXN</from_currency_code>
    <to_currency_code>INR</to_currency_code>
    <valid_from>2020-04-02T15:07:00Z</valid_from>
    <valid_to>2020-04-02T16:07:00Z</valid_to>
    <tier_identifier_rate/>
    <tiers>
        <from_amount/>
        <rate_id>3ciq8g5gkkike1a5hkhi3hgvkd</rate_id>
        <ask_rate/>
        <mid_rate/>
        <bid_rate>3.239881</bid_rate>
    </tiers>
    <card_segment_name>EMEA</card_segment_name>
</rates>
<rates>
    <account_type>BANK</account_type>
    <partner_id>BEL_MCSXB1HS5fd</partner_id>
    <type>single</type>
    <use>CMSP</use>
    <from_currency_code>MXN</from_currency_code>
    <to_currency_code>THB</to_currency_code>
    <valid_from>2020-04-02T15:07:00Z</valid_from>
    <valid_to>2020-04-02T16:07:00Z</valid_to>
    <tier_identifier_rate/>
    <tiers>
        <from_amount/>
        <rate_id>3t1ia5kupk0ud1sl0yow12x9pq</rate_id>
        <ask_rate/>
        <mid_rate/>
        <bid_rate>1.395389</bid_rate>
    </tiers>
    <card_segment_name>EMEA</card_segment_name>
</rates>
```

```JSON
{
  "rates": [
    {
      "type": "single",
      "use": "CMSP",
      "from_currency_code": "MXN",
      "to_currency_code": "INR",
      "valid_from": "2020-04-02T15:07:00Z",
      "valid_to": "2020-04-02T16:07:00Z",
      "tier_identifier_rate": "",
      "account_type": "BANK",
      "partner_id": "BEL_MCSXB1HS5fd",
      "tiers": [
        {
          "from_amount": "",
          "rate_id": "3ciq8g5gkkike1a5hkhi3hgvkd",
          "ask_rate": "",
          "mid_rate": "",
          "bid_rate": "3.239881"
        }
      ],
      "card_segment_name": "EMEA"
    },
    {
      "type": "single",
      "use": "CMSP",
      "from_currency_code": "MXN",
      "to_currency_code": "THB",
      "valid_from": "2020-04-02T15:07:00Z",
      "valid_to": "2020-04-02T16:07:00Z",
      "tier_identifier_rate": "",
      "account_type": "BANK",
      "partner_id": "BEL_MCSXB1HS5fd",
      "tiers": [
        {
          "from_amount": "",
          "rate_id": "3t1ia5kupk0ud1sl0yow12x9pq",
          "ask_rate": "",
          "mid_rate": "",
          "bid_rate": "1.395389"
        }
      ],
      "card_segment_name": "EMEA"
    }
  ],
  "event_ref": "ref_u0lVpKKZ0Evx0UExr05VuD8frOFw",
  "event_type": "CARDFX_PUB"
}
```

# Sample Responses

## FX Rate Pull

```XML
<?xml version="1.0" encoding="UTF-8" ?>
<rates>
  <rate>
    <account_type>BANK</account_type>
    <partner_id>BEL_MCSXB1HS5fd</partner_id>
    <type>single</type>
    <use>CMSP</use>
    <from_currency_code>MXN</from_currency_code>
    <to_currency_code>INR</to_currency_code>
    <valid_from>2020-04-02T15:07:00Z</valid_from>
    <valid_to>2020-04-02T16:07:00Z</valid_to>
    <tier_identifier_rate/>
    <tiers>
      <tier>
        <from_amount/>
        <rate_id>3ciq8g5gkkike1a5hkhi3hgvkd</rate_id>
        <ask_rate/>
        <mid_rate/>
        <bid_rate>3.239881</bid_rate>
      </tier>
    </tiers>
    <card_segment_name>EMEA</card_segment_name>
  </rate>
</rates>
```

```JSON
{
  "rates": {
    "rate": [
      {
        "type": "single",
        "use": "CMSP",
        "from_currency_code": "MXN",
        "to_currency_code": "INR",
        "valid_from": "2020-04-02T15:07:00Z",
        "valid_to": "2020-04-02T16:07:00Z",
        "tier_identifier_rate": "",
        "account_type": "BANK",
        "partner_id": "BEL_MCSXB1HS5fd",
        "tiers": {
          "tier": [
            {
              "from_amount": "",
              "rate_id": "3ciq8g5gkkike1a5hkhi3hgvkd",
              "ask_rate": "",
              "mid_rate": "",
              "bid_rate": "3.239881"
            }
          ]
        },
        "card_segment_name": "EMEA"
      },
      {
        "type": "single",
        "use": "CMSP",
        "from_currency_code": "MXN",
        "to_currency_code": "THB",
        "valid_from": "2020-04-02T15:07:00Z",
        "valid_to": "2020-04-02T16:07:00Z",
        "tier_identifier_rate": "",
        "account_type": "BANK",
        "partner_id": "BEL_MCSXB1HS5fd",
        "tiers": {
          "tier": [
            {
              "from_amount": "",
              "rate_id": "3t1ia5kupk0ud1sl0yow12x9pq",
              "ask_rate": "",
              "mid_rate": "",
              "bid_rate": "1.395389"
            }
          ],
          "card_segment_name": "EMEA"
        }
      }
    ],
    "event_ref": "ref_u0lVpKKZ0Evx0UExr05VuD8frOFw",
    "event_type": "CARDFX_PUB"
  }
}
```

## FX Rate Push

No Response body

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

# Push Notification Configuration Details

For more information on configuring a push notification, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/push-notifications-details/).

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#sandbox-testing)
*   [Sample Requests](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#sample-requests)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#error-codes)
*   [Push Notification Configuration Details](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/#push-notification-configuration-details)

---
title: Payment API
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, please proceed to [Payment API Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-eu-payment-api/) and [Payment API Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-uk-payment-api/) respectively to ensure compliance with the relevant jurisdiction based on Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

You can use this API to submit a payment transaction to transfer fund to a cross-border recipient. If you opt-in for quote confirmation services, remember to confirm the quote before initiating the payment request.  
Look at the [Payment](https://developer.mastercard.com/cross-border-services/documentation/use-cases/) use cases for details on how to use the payment API for a cross border fund transfer solution.

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/payment
```

```Production
https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder/payment
```

> [!NOTE]
> 
> **Sandbox** and **MTF** environments share the same url but are differentiated by partner id.

# API

  
Alternatively, here is a tabular view of the request/ response parameter:  (1MB)  
  

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/#operation/Payment)

Initiate and submit a payment.

Sandbox URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/payment

MTF URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/payment

Production URL

https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder/payment

> [!NOTE]
> 
> In order to provide ease of processing and to avoid any potential keying errors, when a Quote is utilized and the Quote Proposal ID information is provided for payment initiation, the quote transaction details (sending/receiving accounts, amounts, currencies, etc.) are used to fill the payment request.

*   **Formats supported**: XML/ JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example - application/json

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

## Sandbox Test cases

The Sandbox server returns simulated, static responses. You can use the following test cases to produce specific responses in sandbox.

### Payment with Quote

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Payment with Quote - responds with successful payment | 1\. Send a Quote using ‘transaction\_reference’ number starting with ’09’  <br>2\. Send a Payment using the same ‘transaction\_reference’ and the proposal ID from the quote response. |
| Success | Payment with Quote - responds with successful payment ( URIs not provided in quote) | 1\. Send a Quote using ‘transaction\_reference’ number starting with ’09’  <br>2\. Send a Payment using the same ‘transaction\_reference’ and the proposal ID from the quote response. |
| Pending | Payment with Quote- responds with pending payment | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘06’  <br>2\. Send a Payment using the same ‘transaction\_reference’ and the proposal ID from the quote response and recipient\_account\_uri’s last 6 digits as ‘10####’ (# is not literal but can be any number). |
| Pending | Payment with Quote- responds with pending payment (URIs not provided in quote) | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘06’  <br>2\. Send a Payment using the same ‘transaction\_reference’ and the proposal ID from the quote response and recipient\_account\_uri’s last 6 digits as ‘10####’ (# is not literal but can be any number). |
| Rejected | Payment with Quote - responds with rejected payment | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘04’  <br>2\. Send a Payment using the same ‘transaction\_reference’ and the proposal ID from the quote response and recipient\_account\_uri’s last 6 digits as ‘10####’ (# is not literal but can be any number). |
| Rejected | Payment with Quote - responds with rejected payment (URIs not provided in quote) | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘04’  <br>2\. Send a Payment using the same ‘transaction\_reference’ and the proposal ID from the quote response and recipient\_account\_uri’s last 6 digits as ‘10####’ (# is not literal but can be any number). |
| Rejected with specific error | Payment with Quote - responds with rejected payment with specific error code | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘2’ and ending with the desired error code. For example: Transaction reference ‘2XXXXXXXX130105’ will REJECT payment and return 130105 error code in the payment response.  <br>2\. Send a Payment using the ‘proposal\_id’ from the quote. |
| Rejected- Can be resubmitted | 150001 System Error: Payment with Quote is resubmitted successfully | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘11S’ and ends in ‘501’.  <br>For example: Transaction reference ‘11SXXXXXXXXXX501’ will return a successful response.  <br>2\. Send a Payment using the ‘transaction\_reference’ and ‘proposal\_id’ (response) from the above quote request in step 1. The sandbox will return Pending status with Ambiguous Stage.  <br>3\. Resubmit the payment using the same ‘transaction\_reference’ after 10 mins from the payment request with same input parameters. Transaction will be processed with status “Success”.  <br>  <br>Note – For the sandbox environment to simulate the desired responses, please resubmit the payment (step 3) after 10 minutes from the payment request (step 2) and within 30 minutes after the initial quote call (step 1). |
| Rejected - Resubmitted request rejected | 150001 System Error: Payment with Quote is resubmitted with different parameters and rejected | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘11S’ and ends in ‘501’.  <br>For example: Transaction reference ‘11SXXXXXXXXXX501’ will return a successful response.  <br>2\. Send a Payment using the ‘proposal\_id’ from the above quote request in step 1. The sandbox will return Pending status with Ambiguous Stage.  <br>3\. Resubmit the payment using the same ‘transaction\_reference’ and different input parameters(like different value for sender\_account\_uri. ) Transaction will be rejected with 82000 error code |

**Note**: For test scenarios to make a Quote API call, please look at the **Sandbox Test cases** section [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quotes-api/)

### Payment without Quote

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Payment (forward with fees included) - responds with successful payment | 1.Send Payment using ‘transaction\_reference’ number starting with ‘09’  <br>2\. Make sure to pass the paymentrequest.fx\_type.forward object with fees-included =true in the request. |
| Success | Payment (forward with fees not included) - responds with successful payment | 1.Send Payment using ‘transaction\_reference’ number starting with ‘09’  <br>2\. Make sure to pass the paymentrequest.fx\_type.forward object with fees-included = false in the request. |
| Success | Payment (reverse) - responds with successful payment | 1\. Send Payment using ‘transaction\_reference’ number starting with ‘09’  <br>2\. Make sure to pass the paymentrequest.fx\_type.reverse object in the request. |
| Pending | Payment (forward with fees included) - responds with pending payment | 1\. Send a Payment using ‘transaction\_reference’ number starting with ‘06’ and recipient\_account\_uri’s last 6 digits as ‘10####’ (# is not literal but can be any number).  <br>2\. Make sure to pass the paymentrequest.fx\_type.forward object with fees-included =true in the request. |
| Pending | Payment (forward with fees not included) - responds with pending payment | 1\. Send a Payment using ‘transaction\_reference’ number starting with ‘06’ and recipient\_account\_uri’s last 6 digits as ‘10####’ (# is not literal but can be any number).  <br>2\. Make sure to pass the paymentrequest.fx\_type.forward object with fees-included =false in the request. |
| Pending | Payment (reverse) - responds with pending payment | 1\. Send a Payment using ‘transaction\_reference’ number starting with ‘06’ and recipient\_account\_uri’s last 6 digits as ‘10####’ (# is not literal but can be any number).  <br>2\. Make sure to pass the paymentrequest.fx\_type.reverse object in the request. |
| Rejected | Payment (forward with fees included) - responds with rejected payment | Send a Payment using ‘transaction\_reference’ number starting with ‘04’ and recipient\_account\_uri’s last 6 digits as ‘10####’ (# is not literal but can be any number). |
| Rejected with specific error | Payment - responds with rejected payment with specific error code | Send a Payment using ‘transaction\_reference’ number starting with ‘2’ and ending with the desired error code. For example: Transaction reference ‘2XXXXXXXX130105’ will REJECT payment and return 130105 error code in response |
| Rejected - Can be resubmitted | 150001 System Error: Payment is resubmitted successfully | 1\. Send a Payment using ‘transaction\_reference’ number starting with ‘11S’ and ends with ‘501’.  <br>For example: Transaction reference ‘11SXXXXXXXXXX501’’ . The sandbox will return Pending status with Ambiguous Stage.  <br>2\. Resubmit the payment using the same ‘transaction\_reference’ after 10 min with same input parameters.  <br>  <br>Note – For the sandbox environment to simulate the desired responses, please resubmit the payment (step 2) after 10 minutes from step 1 and within 30 minutes from the initial payment request (step 1). |
| Rejected - Resubmitted request rejected | 150001 System Error: Payment is resubmitted with different parameters and rejected | 1\. Send a Payment using ‘transaction\_reference’ number starting with ‘11S’ and ends with ‘501’.  <br>For example: Transaction reference ‘11SXXXXXXXXXX501’’ . The sandbox will return Pending status with Ambiguous Stage.  <br>2\. Resubmit the payment using the same ‘transaction\_reference’ and different parameters (like different value for sender\_account\_uri. ) Transaction will be rejected with 82000 error code. |

## Sandbox Test cases for Wires

The Sandbox server returns simulated, static responses. For customers who are interested or enabled to instruct wire transactions, can use the following test cases to produce specific responses in sandbox.

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Payment with Quote - responds with successful payment for BANKWIRE | 1\. Send a Quote using ‘transaction\_reference’ number starting with ’09’ and provide additional fields ‘701’ with Recipient country and ‘7260’ with ‘BANKWIRE’.  <br>2\. Send a Payment using the same ‘transaction\_reference’ and the proposal ID from the quote response. |
| Success | Payment (forward with fees included) - responds with successful payment for BANKWIRE | 1.Send Payment using ‘transaction\_reference’ number starting with ‘09’.  <br>2\. Make sure to pass the paymentrequest.fx\_type.forward object with fees-included =true in the request.  <br>3\. Provide Additional fields ‘701’ with Recipient country and ‘7260’ with ‘BANKWIRE’. |
| Rejected | Payment with Quote - responds with rejected payment for BANKWIRE | 1\. Send a Quote using ‘transaction\_reference’ number starting with ‘04’ and provide Additional fields ‘701’ with Recipient country and ‘7260’ with ‘BANKWIRE’.  <br>2\. Send a Payment using the same ‘transaction\_reference’ and the proposal ID from the quote response and recipient\_account\_uri’s last 6 digits as ‘10####’ (# is not literal but can be any number). |
| Rejected | Payment (forward with fees included) - responds with rejected payment for BANKWIRE | Send a Payment using ‘transaction\_reference’ number starting with ‘04’ and provide Additional fields ‘701’ with Recipient country and ‘7260’ with ‘BANKWIRE’ and recipient\_account\_uri’s last 6 digits as ‘10####’ (# is not literal but can be any number). |

# Sample Requests

## Payment Request Without Quote

```XML
<?xml version="1.0" encoding="UTF-8" ?>
 <paymentrequest>
   <transaction_reference>07-PYT-WQ-JHSDFR909202wfnvpkubv931455_4</transaction_reference>
   <sender_account_uri>tel:+254108989</sender_account_uri>
   <recipient_account_uri>tel:+254068989</recipient_account_uri>
   <payment_amount>
     <amount>100.25</amount>
     <currency>USD</currency>
   </payment_amount>
   <payment_origination_country>USA</payment_origination_country>
   <receiving_bank_name>Royal Exchange</receiving_bank_name>
   <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
   <bank_code>NP021</bank_code>
   <payment_type>P2B</payment_type>
   <source_of_income>Sal</source_of_income>
   <sender>
     <first_name>John</first_name>
     <middle_name>L</middle_name>
     <last_name>Doe</last_name>
     <nationality>USA</nationality>
     <address>
       <line1>123MainStreet</line1>
       <line2>#5A</line2>
       <city>Arlington</city>
       <country_subdivision>VA</country_subdivision>
       <postal_code>22207</postal_code>
       <country>USA</country>
     </address>
     <date_of_birth>1980-01-20</date_of_birth>
   </sender>
   <recipient>
     <organization_name>WU</organization_name>
     <address>
       <line1>123MainStreet</line1>
       <line2>#5A</line2>
       <city>Arlington</city>
       <country_subdivision>VA</country_subdivision>
       <postal_code>22207</postal_code>
       <country>CAN</country>
     </address>
     <email>customer@gmail.com</email>
   </recipient>  
   <payment_file_identifier>1abdtr236</payment_file_identifier>
 </paymentrequest>
 
```

```JSON
{
    "paymentrequest": {
       "transaction_reference": "07-PYT-WQ-JHSDFR909202wfnvpkubv931455_4",
       "sender_account_uri": "tel:+254108989",
       "recipient_account_uri": "tel:+254068989",
       "payment_amount": {
          "amount": "100.25",
          "currency": "USD"
       },
       "payment_origination_country": "USA",
       "receiving_bank_name": "Royal Exchange",
       "receiving_bank_branch_name": "Quad Cities",
       "bank_code": "NP021",
       "payment_type": "P2B",
       "source_of_income": "Sal",
       "sender": {
          "first_name": "John",
          "middle_name": "L",
          "last_name": "Doe",
          "nationality": "USA",
          "address": {
             "line1": "123MainStreet",
             "line2": "#5A",
             "city": "Arlington",
             "country_subdivision": "VA",
             "postal_code": "22207",
             "country": "USA"
          },
          "date_of_birth": "1980-01-20"
       },
       "recipient": {
          "organization_name": "WU",
          "address": {
             "line1": "123MainStreet",
             "line2": "#5A",
             "city": "Arlington",
             "country_subdivision": "VA",
             "postal_code": "22207",
             "country": "CAN"
          },
          "email": "customer@gmail.com"
       },
       "payment_file_identifier": "1abdtr236"
    }
 }
 
```

## Payment (Without Quote) Request for BANKWIRE

```XML
<?xml version="1.0" encoding="UTF-8"?>
 <paymentrequest>
    <transaction_reference>07-PYT-WoQ-JHSDFR909202wfnvpkubv931455_4</transaction_reference>
    <sender_account_uri>tel:+254108989</sender_account_uri>
    <recipient_account_uri>ban:45678993;bic=UNBECNSHXXX</recipient_account_uri>
    <payment_amount>
       <amount>100.25</amount>
       <currency>USD</currency>
    </payment_amount>
    <payment_origination_country>USA</payment_origination_country>
    <receiving_bank_name>Royal Exchange</receiving_bank_name>
    <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
    <bank_code>NP021</bank_code>
    <payment_type>P2B</payment_type>
    <source_of_income>Sal</source_of_income>
    <sender>
       <first_name>John</first_name>
       <middle_name>L</middle_name>
       <last_name>Doe</last_name>
       <nationality>USA</nationality>
       <address>
          <line1>123MainStreet</line1>
          <line2>#5A</line2>
          <city>Arlington</city>
          <country_subdivision>VA</country_subdivision>
          <postal_code>22207</postal_code>
          <country>USA</country>
       </address>
       <date_of_birth>1980-01-20</date_of_birth>
    </sender>
    <recipient>
       <organization_name>WU</organization_name>
       <address>
          <line1>123MainStreet</line1>
          <line2>#5A</line2>
          <city>Arlington</city>
          <country_subdivision>VA</country_subdivision>
          <postal_code>22207</postal_code>
          <country>CHN</country>
       </address>
       <email>customer@gmail.com</email>
    </recipient>
    <additional_data>
       <data_field>
          <name>701</name>
          <value>CHN</value>
       </data_field>
       <data_field>
          <name>7260</name>
          <value>BANKWIRE</value>
       </data_field>
    </additional_data>
    <payment_file_identifier>1abdtr236</payment_file_identifier>
 </paymentrequest>
 
```

```JSON
{
     "paymentrequest": {
         "transaction_reference": "07-PYT-WoQ-JHSDFR909202wfnvpkubv931455_4",
         "sender_account_uri": "tel:+254108989",
         "recipient_account_uri": "ban:45678993;bic=UNBECNSHXXX",
         "payment_amount": {
             "amount": "100.25",
             "currency": "USD"
         },
         "payment_origination_country": "USA",
         "receiving_bank_name": "Royal Exchange",
         "receiving_bank_branch_name": "Quad Cities",
         "bank_code": "NP021",
         "payment_type": "P2B",
         "source_of_income": "Sal",
         "sender": {
             "first_name": "John",
             "middle_name": "L",
             "last_name": "Doe",
             "nationality": "USA",
             "address": {
                 "line1": "123MainStreet",
                 "line2": "#5A",
                 "city": "Arlington",
                 "country_subdivision": "VA",
                 "postal_code": "22207",
                 "country": "USA"
             },
             "date_of_birth": "1980-01-20"
         },
         "recipient": {
             "organization_name": "WU",
             "address": {
                 "line1": "123MainStreet",
                 "line2": "#5A",
                 "city": "Arlington",
                 "country_subdivision": "VA",
                 "postal_code": "22207",
                 "country": "CHN"
             },
             "email": "customer@gmail.com"
         },
         "additional_data": {
             "data_field": [
                 {
                     "name": "701",
                     "value": "CHN"
                 },
                 {
                     "name": "7260",
                     "value": "BANKWIRE"
                 }
             ]
         },
         "payment_file_identifier": "1abdtr236"
     }
 }
 
```

## Payment Request With Quote

### Sender and Recipient Account URI not provided in payment

**Note**: Unlike the above shown “Payment without Quote” request, the payment and account information is not sent again in the request, but a proposal ID is provided instead. Proposal ID is obtained from a previously submitted quote request.

```XML
<?xml version="1.0" encoding="UTF-8" ?>
 <paymentrequest>
     <transaction_reference>02-PYT-WQ-TGFSWECVBN-0094565645615222_6</transaction_reference>
     <proposal_id>pen_40000994037586571936330328</proposal_id>
     <receiving_bank_name>Royal Exchange</receiving_bank_name>
     <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
     <source_of_income>Sal</source_of_income>
     <sender>
         <first_name>John</first_name>
         <middle_name>L</middle_name>
         <last_name>Doe</last_name>
         <nationality>USA</nationality>
         <address>
             <line1>123MainStreet</line1>
             <line2>5A</line2>
             <city>Arlington</city>
             <country_subdivision>VA</country_subdivision>
             <postal_code>22207</postal_code>
             <country>USA</country>
         </address>
         <government_ids>
             <government_id_uri>ppn:123456789;expiration-date=2019-05-27;issue-date=2011-07-12;country=USA</government_id_uri>
         </government_ids>
         <date_of_birth>1985-06-24</date_of_birth>
     </sender>
     <recipient>
         <first_name>Lee</first_name>
         <middle_name>M</middle_name>
         <last_name>Cardholder</last_name>
         <nationality>USA</nationality>
         <address>
             <line1>123MainStreet</line1>
             <line2>5A</line2>
             <city>Arlington</city>
             <country_subdivision>VA</country_subdivision>
             <postal_code>22207</postal_code>
             <country>USA</country>
         </address>
         <government_ids>
             <government_id_uri>ppn:541235632;expiration-date=2021-05-27;issue-date=2011-07-12;country=USA</government_id_uri>
         </government_ids>
         <phone>0016367224357</phone>
         <email>customer@gmail.com</email>
     </recipient>
 </paymentrequest>
 
```

```JSON
{
    "paymentrequest": {
       "transaction_reference": "02-PYT-WQ-TGFSWECVBN-0094565645615222_6",
       "proposal_id": "pen_40000994037586571936330328",
       "receiving_bank_name": "Royal Exchange",
       "receiving_bank_branch_name": "Quad Cities",
       "source_of_income": "Sal",
       "sender": {
          "first_name": "John",
          "middle_name": "L",
          "last_name": "Doe",
          "nationality": "USA",
          "address": {
             "line1": "123MainStreet",
             "line2": "5A",
             "city": "Arlington",
             "country_subdivision": "VA",
             "postal_code": "22207",
             "country": "USA"
          },
          "government_ids": {
             "government_id_uri": "ppn:123456789;expiration-date=2019-05-27;issue-date=2011-07-12;country=USA"
          },
          "date_of_birth": "1985-06-24"
       },
       "recipient": {
          "first_name": "Lee",
          "middle_name": "M",
          "last_name": "Cardholder",
          "nationality": "USA",
          "address": {
             "line1": "123MainStreet",
             "line2": "5A",
             "city": "Arlington",
             "country_subdivision": "VA",
             "postal_code": "22207",
             "country": "USA"
          },
          "government_ids": {
             "government_id_uri": "ppn:541235632;expiration-date=2021-05-27;issue-date=2011-07-12;country=USA"
          },
          "phone": "0016367224357",
          "email": "customer@gmail.com"
       }
    }
 }
 
```

## Payment Request With Quote

### Sender and Recipient Account URI provided in payment

**Note**: Proposal ID does not contain Sender and Recipient URI so this is provided in payment request.

```XML
<paymentrequest>
    <transaction_reference>0653d8effce785434a8f353</transaction_reference>
    <proposal_id>23aees8siaftk05tc19lxy0afv</proposal_id>
    <recipient_account_uri>tel:+54010894</recipient_account_uri>
    <sender_account_uri>tel:+54010894</sender_account_uri>
    <sender>
     <first_name>John</first_name>
     <middle_name>L</middle_name>
     <last_name>Doe</last_name>
     <nationality>USA</nationality>
     <address>
      <line1>123MainStreet</line1>
      <line2>#5A</line2>
      <city>Arlington</city>
      <country_subdivision>NA</country_subdivision>
      <postal_code>12345</postal_code>
      <country>USA</country>
     </address>
     <date_of_birth>1980-01-20</date_of_birth>
    </sender>
    <recipient>
     <first_name>John</first_name>
     <middle_name>L</middle_name>
     <last_name>Doe</last_name>
     <nationality>USA</nationality>
     <address>
      <line1>123MainStreet</line1>
      <line2>#5A</line2>
      <city>Arlington</city>
      <country_subdivision>NA</country_subdivision>
      <postal_code>12345</postal_code>
     <country>CAN</country>.</address>
    <email>customer@gmail.com</email>
    </recipient>
    <source_of_income>Regular Income</source_of_income>
    <receiving_bank_name>Royal Exchange</receiving_bank_name>
    <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
   <payment_file_identifier>123456789</payment_file_identifier>
 </paymentrequest>
 
```

```JSON
 {
  	"paymentrequest": {
  		"transaction_reference": "0653d8effce785434a8f353",
     "proposal_id": "23aees8siaftk05tc19lxy0afv",
  		"sender_account_uri": "tel:+54010894",
  		"recipient_account_uri": "tel:+54010894",
  		"sender": {
  			"first_name": "John",
  			"middle_name": "L",
  			"last_name": "Doe",
  			"nationality": "USA",
  			"address": {
  				"line1": "123MainStreet",
  				"line2": "#5A",
  				"city": "Arlington",
  				"country_subdivision": "NA",
  				"postal_code": "12345",
  				"country": "USA"
  			},
  			"date_of_birth": "1980-01-20"
  		},
  		"recipient": {
  			"first_name": "DMS",
  			"middle_name": "M",
  			"last_name": "Abeysundera",
  			"nationality": "USA",
  			"address": {
  				"line1": "Nawam Mawatha",
  				"line2": "#5A",
  				"city": "Arlington",
  				"country_subdivision": "NA",
  				"postal_code": "12345",
  				"country": "CAN"
  			},
  			"email": "customer@gmail.com"
  		},
  		"receiving_bank_name": "Royal Exchange",
  		"receiving_bank_branch_name": "Quad Cities",
  		"payment_file_identifier": "123456789"
  	}
  }
 
```

## Payment with Quote for BANKWIRE

```XML
<?xml version="1.0" encoding="UTF-8"?>
 <paymentrequest>
    <transaction_reference>02-PYT-WQ-TGFSWECVBN-0094565645615222_6</transaction_reference>
    <proposal_id>pen_40000994037586571936330328</proposal_id>
    <receiving_bank_name>Royal Exchange</receiving_bank_name>
    <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
    <source_of_income>Sal</source_of_income>
    <sender>
       <first_name>John</first_name>
       <middle_name>L</middle_name>
       <last_name>Doe</last_name>
       <nationality>USA</nationality>
       <address>
          <line1>123MainStreet</line1>
          <line2>5A</line2>
          <city>Arlington</city>
          <country_subdivision>VA</country_subdivision>
          <postal_code>22207</postal_code>
          <country>USA</country>
       </address>
       <government_ids>
          <government_id_uri>ppn:123456789;expiration-date=2019-05-27;issue-date=2011-07-12;country=USA</government_id_uri>
       </government_ids>
       <date_of_birth>1985-06-24</date_of_birth>
    </sender>
    <recipient>
       <first_name>Lee</first_name>
       <middle_name>M</middle_name>
       <last_name>Cardholder</last_name>
       <nationality>USA</nationality>
       <address>
          <line1>123MainStreet</line1>
          <line2>5A</line2>
          <city>Arlington</city>
          <country_subdivision>VA</country_subdivision>
          <postal_code>22207</postal_code>
          <country>USA</country>
       </address>
       <government_ids>
          <government_id_uri>ppn:541235632;expiration-date=2021-05-27;issue-date=2011-07-12;country=USA</government_id_uri>
       </government_ids>
       <phone>0016367224357</phone>
       <email>customer@gmail.com</email>
    </recipient>
    <additional_data>
       <data_field>
          <name>701</name>
          <value>USA</value>
       </data_field>
       <data_field>
          <name>7260</name>
          <value>BANKWIRE</value>
       </data_field>
    </additional_data>
 </paymentrequest>
 
```

```JSON
{
     "paymentrequest": {
         "transaction_reference": "02-PYT-WQ-TGFSWECVBN-0094565645615222_6",
         "proposal_id": "pen_40000994037586571936330328",
         "receiving_bank_name": "Royal Exchange",
         "receiving_bank_branch_name": "Quad Cities",
         "source_of_income": "Sal",
         "sender": {
             "first_name": "John",
             "middle_name": "L",
             "last_name": "Doe",
             "nationality": "USA",
             "address": {
                 "line1": "123MainStreet",
                 "line2": "5A",
                 "city": "Arlington",
                 "country_subdivision": "VA",
                 "postal_code": "22207",
                 "country": "USA"
             },
             "government_ids": {
                 "government_id_uri": "ppn:123456789;expiration-date=2019-05-27;issue-date=2011-07-12;country=USA"
             },
             "date_of_birth": "1985-06-24"
         },
         "recipient": {
             "first_name": "Lee",
             "middle_name": "M",
             "last_name": "Cardholder",
             "nationality": "USA",
             "address": {
                 "line1": "123MainStreet",
                 "line2": "5A",
                 "city": "Arlington",
                 "country_subdivision": "VA",
                 "postal_code": "22207",
                 "country": "USA"
             },
             "government_ids": {
                 "government_id_uri": "ppn:541235632;expiration-date=2021-05-27;issue-date=2011-07-12;country=USA"
             },
             "phone": "0016367224357",
             "email": "customer@gmail.com"
         },
         "additional_data": {
             "data_field": [
                 {
                     "name": "701",
                     "value": "USA"
                 },
                 {
                     "name": "7260",
                     "value": "BANKWIRE"
                 }
             ]
         }
     }
 }
 
```

## Payment with Carded Rate Request

```XML
<paymentrequest>
   <transaction_reference>09-PYT-WCR-HDFsWERTYLKR-883166274207676</transaction_reference>
   <sender_account_uri>tel:+254108989</sender_account_uri>
   <recipient_account_uri>ban:106050018728;bic=900</recipient_account_uri>
   <payment_amount>
     <amount>117.15</amount>
     <currency>EUR</currency>
   </payment_amount>
   <payment_origination_country>FRA</payment_origination_country>
   <payment_type>P2P</payment_type>
   <sender>
     <first_name>John</first_name>
     <middle_name>L</middle_name>
     <last_name>Doe</last_name>
     <nationality>USA</nationality>
     <address>
       <line1>123MainStreet</line1>
       <line2>#5A</line2>
       <city>Arlington</city>
       <country_subdivision>VA</country_subdivision>
       <postal_code>22207</postal_code>
       <country>FRA</country>
     </address>
     <date_of_birth>1980-01-20</date_of_birth>
   </sender>
   <recipient>
     <first_name>DMS</first_name>
     <middle_name>M</middle_name>
     <last_name>Abeysundera</last_name>
     <nationality>USA</nationality>
     <address>
       <line1>Nawam Mawatha</line1>
       <line2>#5A</line2>
       <city>Arlington</city>
       <country_subdivision>VA</country_subdivision>
       <postal_code>200</postal_code>
       <country>LKA</country>
     </address>
     <email>customer@gmail.com</email>
   </recipient>
   <receiving_bank_name>Royal Exchange</receiving_bank_name>
   <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
   <payment_file_identifier>1awedgt9</payment_file_identifier>
   <fx_type>
     <forward>
       <fees_included>false</fees_included>
     </forward>
   </fx_type>
   <additional_data>
     <data_field>
       <name>1200</name>
       <value>LKA-BK</value>
     </data_field>
     <data_field>
       <name>701</name>
       <value>LKA</value>
     </data_field>
     <data_field>
       <name>600</name>
       <value>7214</value>
     </data_field>
   </additional_data>
   <card_rate_id>3whws68ojogpe16vc75sbx0lhn</card_rate_id>
 </paymentrequest>
 
```

```JSON
 {
  	"paymentrequest": {
  		"transaction_reference": "09-PYT-WCR-HDFsWERTYLKR-883166274207676",
  		"sender_account_uri": "tel:+254108989",
  		"recipient_account_uri": "ban:106050018728;bic=900",
  		"payment_amount": {
  			"amount": "117.15",
  			"currency": "EUR"
  		},
  		"payment_origination_country": "FRA",
  		"payment_type": "P2P",
  		"sender": {
  			"first_name": "John",
  			"middle_name": "L",
  			"last_name": "Doe",
  			"nationality": "USA",
  			"address": {
  				"line1": "123MainStreet",
  				"line2": "#5A",
  				"city": "Arlington",
  				"country_subdivision": "VA",
  				"postal_code": "22207",
  				"country": "FRA"
  			},
  			"date_of_birth": "1980-01-20"
  		},
  		"recipient": {
  			"first_name": "DMS",
  			"middle_name": "M",
  			"last_name": "Abeysundera",
  			"nationality": "USA",
  			"address": {
  				"line1": "Nawam Mawatha",
  				"line2": "#5A",
  				"city": "Arlington",
  				"country_subdivision": "VA",
  				"postal_code": "200",
  				"country": "LKA"
  			},
  			"email": "customer@gmail.com"
  		},
  		"receiving_bank_name": "Royal Exchange",
  		"receiving_bank_branch_name": "Quad Cities",
  		"payment_file_identifier": "1awedgt9",
  		"fx_type": {
  			"forward": {
  				"fees_included": "false"
  			}
  		},
  		"additional_data": {
  			"data_field": [
  				{
  					"name": "1200",
  					"value": "LKA-BK"
  				},
  				{
  					"name": "701",
  					"value": "LKA"
  				},
  				{
  					"name": "600",
  					"value": "7214"
  				}
  			]
  		},
  		"card_rate_id": "3whws68ojogpe16vc75sbx0lhn"
  	}
  }
 
```

## Payment with Carded Rate Request for BANKWIRE

```XML
<?xml version="1.0" encoding="UTF-8"?>
 <paymentrequest>
    <transaction_reference>09-PYT-WCR-HDFsWERTYLKR-883166274207676</transaction_reference>
    <sender_account_uri>tel:+254108989</sender_account_uri>
    <recipient_account_uri>ban:106050018728;bic=900</recipient_account_uri>
    <payment_amount>
       <amount>117.15</amount>
       <currency>USD</currency>
    </payment_amount>
    <payment_origination_country>USA</payment_origination_country>
    <payment_type>P2P</payment_type>
    <sender>
       <first_name>John</first_name>
       <middle_name>L</middle_name>
       <last_name>Doe</last_name>
       <nationality>USA</nationality>
       <address>
          <line1>123MainStreet</line1>
          <line2>#5A</line2>
          <city>Arlington</city>
          <country_subdivision>VA</country_subdivision>
          <postal_code>22207</postal_code>
          <country>USA</country>
       </address>
       <date_of_birth>1980-01-20</date_of_birth>
    </sender>
    <recipient>
       <first_name>DMS</first_name>
       <middle_name>M</middle_name>
       <last_name>Abeysundera</last_name>
       <nationality>USA</nationality>
       <address>
          <line1>Nawam Mawatha</line1>
          <line2>#5A</line2>
          <city>Arlington</city>
          <country_subdivision>VA</country_subdivision>
          <postal_code>200</postal_code>
          <country>CHN</country>
       </address>
       <email>customer@gmail.com</email>
    </recipient>
    <receiving_bank_name>Royal Exchange</receiving_bank_name>
    <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
    <payment_file_identifier>1awedgt9</payment_file_identifier>
    <fx_type>
       <forward>
          <fees_included>false</fees_included>
       </forward>
    </fx_type>
    <additional_data>
       <data_field>
          <name>260</name>
          <value>1985-06-24</value>
       </data_field>
       <data_field>
          <name>701</name>
          <value>CHN</value>
       </data_field>
       <data_field>
          <name>7260</name>
          <value>BANKWIRE</value>
       </data_field>
    </additional_data>
    <card_rate_id>3whws68ojogpe16vc75sbx0lhn</card_rate_id>
 </paymentrequest>
 
```

```JSON
 {
     "paymentrequest": {
         "transaction_reference": "09-PYT-WCR-HDFsWERTYLKR-883166274207676",
         "sender_account_uri": "tel:+254108989",
         "recipient_account_uri": "ban:106050018728;bic=900",
         "payment_amount": {
             "amount": "117.15",
             "currency": "USD"
         },
         "payment_origination_country": "FRA",
         "payment_type": "P2P",
         "sender": {
             "first_name": "John",
             "middle_name": "L",
             "last_name": "Doe",
             "nationality": "USA",
             "address": {
                 "line1": "123MainStreet",
                 "line2": "#5A",
                 "city": "Arlington",
                 "country_subdivision": "VA",
                 "postal_code": "22207",
                 "country": "USA"
             },
             "date_of_birth": "1980-01-20"
         },
         "recipient": {
             "first_name": "DMS",
             "middle_name": "M",
             "last_name": "Abeysundera",
             "nationality": "CHN",
             "address": {
                 "line1": "Nawam Mawatha",
                 "line2": "#5A",
                 "city": "Arlington",
                 "country_subdivision": "VA",
                 "postal_code": "200",
                 "country": "CHN"
             },
             "email": "customer@gmail.com"
         },
         "receiving_bank_name": "Royal Exchange",
         "receiving_bank_branch_name": "Quad Cities",
         "payment_file_identifier": "1awedgt9",
         "fx_type": {
             "forward": {
                 "fees_included": "false"
             }
         },
         "additional_data": {
             "data_field": [
                 {
                     "name": "260",
                     "value": "1985-06-24"
                 },
                 {
                     "name": "701",
                     "value": "CHN"
                 },
                 {
                     "name": "7260",
                     "value": "BANKWIRE"
                 }
             ]
         },
         "card_rate_id": "3whws68ojogpe16vc75sbx0lhn"
     }
 }
 
```

# Sample Responses

The response fields would be same regardless if it’s a payment with quote or payment with carded rate or payment without quote/ carded rate.

## Successful response:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <payment>
     <transaction_reference>02-PYT-SR-KSQTYUBNM-0094565645615222_76</transaction_reference>
     <status>SUCCESS</status>
     <id>rem_zoALfF30XHku95_NCWQvAS24d1M</id>
     <proposal_id>pen_40000994037586571936330328</proposal_id>
     <resource_type>payment</resource_type>
     <created>2019-09-09T04:46:19-05:00</created>
     <status_timestamp>2019-09-09T04:47:00-05:00</status_timestamp>
     <fees_amount>
         <currency>USD</currency>
         <amount>5.35</amount>
     </fees_amount>
     <charged_amount>
         <currency>EUR</currency>
         <amount>10.25</amount>
     </charged_amount>
     <credited_amount>
         <currency>GBP</currency>
         <amount>82.63</amount>
     </credited_amount>
     <principal_amount>
         <currency>USD</currency>
         <amount>105.50</amount>
     </principal_amount>
     <sender_account_uri>tel:+25406005</sender_account_uri>
     <recipient_account_uri>tel:+254069832</recipient_account_uri>
     <payment_amount>
         <currency>USD</currency>
         <amount>121.10</amount>
     </payment_amount>
     <payment_origination_country>USA</payment_origination_country>
     <fx_type>
         <forward>
             <fees_included>true</fees_included>
             <receiver_currency>GBP</receiver_currency>
         </forward>
     </fx_type>
     <receiving_bank_name>Royal Exchange</receiving_bank_name>
     <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
     <payment_type>P2P</payment_type>
     <source_of_income>Sal</source_of_income>
     <settlement_details>
         <currency>GBP</currency>
         <amount>23.12</amount>
     </settlement_details>
     <fx_rate>3.7833456828</fx_rate>
     <additional_data_list>
         <resource_type>list</resource_type>
         <item_count>37</item_count>
         <data>
             <data_field>
                 <name>810</name>
                 <value>123</value>
             </data_field>
             <data_field>
                 <name>851</name>
                 <value>456</value>
             </data_field>
             <data_field>
                 <name>813</name>
                 <value>18.22</value>
             </data_field>
             <data_field>
                 <name>831</name>
                 <value>CARDEDRATEID1</value>
             </data_field>
             <data_field>
                 <name>225</name>
                 <value>customer@gmail.com</value>
             </data_field>
             <data_field>
                 <name>700</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>7202</name>
                 <value>W</value>
             </data_field>
             <data_field>
                 <name>111</name>
                 <value>123MainStreet 5A</value>
             </data_field>
             <data_field>
                 <name>112</name>
                 <value>Arlington</value>
             </data_field>
             <data_field>
                 <name>114</name>
                 <value>VA</value>
             </data_field>
             <data_field>
                 <name>141</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>113</name>
                 <value>22207</value>
             </data_field>
             <data_field>
                 <name>140</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>101</name>
                 <value>John</value>
             </data_field>
             <data_field>
                 <name>102</name>
                 <value>L</value>
             </data_field>
             <data_field>
                 <name>103</name>
                 <value>Doe</value>
             </data_field>
             <data_field>
                 <name>160</name>
                 <value>1985-06-24</value>
             </data_field>
             <data_field>
                 <name>151</name>
                 <value>PassportNumber</value>
             </data_field>
             <data_field>
                 <name>152</name>
                 <value>123456789</value>
             </data_field>
             <data_field>
                 <name>156</name>
                 <value>2019-05-27</value>
             </data_field>
             <data_field>
                 <name>155</name>
                 <value>2011-07-12</value>
             </data_field>
             <data_field>
                 <name>154</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>211</name>
                 <value>123MainStreet 5A</value>
             </data_field>
             <data_field>
                 <name>212</name>
                 <value>Arlington</value>
             </data_field>
             <data_field>
                 <name>214</name>
                 <value>VA</value>
             </data_field>
             <data_field>
                 <name>241</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>213</name>
                 <value>22207</value>
             </data_field>
             <data_field>
                 <name>201</name>
                 <value>Lee</value>
             </data_field>
             <data_field>
                 <name>202</name>
                 <value>M</value>
             </data_field>
             <data_field>
                 <name>203</name>
                 <value>Cardholder</value>
             </data_field>
             <data_field>
                 <name>221</name>
                 <value>0016367224357</value>
             </data_field>
             <data_field>
                 <name>251</name>
                 <value>PassportNumber</value>
             </data_field>
             <data_field>
                 <name>252</name>
                 <value>123456789</value>
             </data_field>
             <data_field>
                 <name>256</name>
                 <value>2019-05-27</value>
             </data_field>
             <data_field>
                 <name>255</name>
                 <value>2011-07-12</value>
             </data_field>
             <data_field>
                 <name>254</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>240</name>
                 <value>USA</value>
             </data_field>
         </data>
     </additional_data_list>
 </payment>
 
```

```JSON
  {
   	"payment": {
   		"transaction_reference": "02-PYT-SR-KSQTYUBNM-0094565645615222_76",
   		"status": "SUCCESS",
   		"id": "rem_zoALfF30XHku95_NCWQvAS24d1M",
   		"proposal_id": "pen_40000994037586571936330328",
   		"resource_type": "payment",
   		"created": "2019-09-09T04:46:19-05:00",
   		"status_timestamp": "2019-09-09T04:47:00-05:00",
   		"fees_amount": {
   			"currency": "USD",
   			"amount": "5.35"
   		},
   		"charged_amount": {
   			"currency": "EUR",
   			"amount": "10.25"
   		},
   		"credited_amount": {
   			"currency": "GBP",
   			"amount": "82.63"
   		},
   		"principal_amount": {
   			"currency": "USD",
   			"amount": "105.50"
   		},
   		"sender_account_uri": "tel:+25406005",
   		"recipient_account_uri": "tel:+254069832",
   		"payment_amount": {
   			"currency": "USD",
   			"amount": "121.10"
   		},
   		"payment_origination_country": "USA",
   		"fx_type": {
   			"forward": {
   				"fees_included": "true",
   				"receiver_currency": "GBP"
   			}
   		},
   		"receiving_bank_name": "Royal Exchange",
   		"receiving_bank_branch_name": "Quad Cities",
   		"payment_type": "P2P",
   		"source_of_income": "Sal",
   		"settlement_details": {
   			"currency": "EUR",
   			"amount": "23.12"
   		},
   		"fx_rate": "3.7833456828",
   		"additional_data_list": {
   			"resource_type": "list",
   			"item_count": "37",
   			"data": {
   				"data_field": [
   					{
   						"name": "810",
   						"value": "123"
   					},
   					{
   						"name": "851",
   						"value": "456"
   					},
   					{
   						"name": "813",
   						"value": "18.22"
   					},
   					{
   						"name": "831",
   						"value": "CARDEDRATEID1"
   					},
   					{
   						"name": "225",
   						"value": "customer@gmail.com"
   					},
   					{
   						"name": "700",
   						"value": "USA"
   					},
   					{
   						"name": "7202",
   						"value": "W"
   					},
   					{
   						"name": "111",
   						"value": "123MainStreet 5A"
   					},
   					{
   						"name": "112",
   						"value": "Arlington"
   					},
   					{
   						"name": "114",
   						"value": "VA"
   					},
   					{
   						"name": "141",
   						"value": "USA"
   					},
   					{
   						"name": "113",
   						"value": "22207"
   					},
   					{
   						"name": "140",
   						"value": "USA"
   					},
   					{
   						"name": "101",
   						"value": "John"
   					},
   					{
   						"name": "102",
   						"value": "L"
   					},
   					{
   						"name": "103",
   						"value": "Doe"
   					},
   					{
   						"name": "160",
   						"value": "1985-06-24"
   					},
   					{
   						"name": "151",
   						"value": "PassportNumber"
   					},
   					{
   						"name": "152",
   						"value": "123456789"
   					},
   					{
   						"name": "156",
   						"value": "2019-05-27"
   					},
   					{
   						"name": "155",
   						"value": "2011-07-12"
   					},
   					{
   						"name": "154",
   						"value": "USA"
   					},
   					{
   						"name": "211",
   						"value": "123MainStreet 5A"
   					},
   					{
   						"name": "212",
   						"value": "Arlington"
   					},
   					{
   						"name": "214",
   						"value": "VA"
   					},
   					{
   						"name": "241",
   						"value": "USA"
   					},
   					{
   						"name": "213",
   						"value": "22207"
   					},
   					{
   						"name": "201",
   						"value": "Lee"
   					},
   					{
   						"name": "202",
   						"value": "M"
   					},
   					{
   						"name": "203",
   						"value": "Cardholder"
   					},
   					{
   						"name": "221",
   						"value": "0016367224357"
   					},
   					{
   						"name": "251",
   						"value": "PassportNumber"
   					},
   					{
   						"name": "252",
   						"value": "123456789"
   					},
   					{
   						"name": "256",
   						"value": "2019-05-27"
   					},
   					{
   						"name": "255",
   						"value": "2011-07-12"
   					},
   					{
   						"name": "254",
   						"value": "USA"
   					},
   					{
   						"name": "240",
   						"value": "USA"
   					}
   				]
   			}
   		}
   	}
   }
 
```

## Successful Response for BANKWIRE:

```XML
<?xml version="1.0" encoding="UTF-8"?>
 <payment>
    <transaction_reference>060e3dbc44-d3ff-44aa-b02a-9b4c2bff2977</transaction_reference>
    <status>PENDING</status>
    <id>rem_JQXJoVqkZ7RPTAaoL7CnimjzTPk</id>
    <proposal_id>2h52tavntgsvi3mo0gwfuat8yu</proposal_id>
    <resource_type>payment</resource_type>
    <created>2023-08-24T07:49:49-05:00</created>
    <status_timestamp>2023-08-24T07:49:53-05:00</status_timestamp>
    <pending_stage>EligibleForSettlement</pending_stage>
    <pending_max_completion_date>2023-09-24T19:49:53.552-05:00</pending_max_completion_date>
    <fees_amount>
       <amount>1.00</amount>
       <currency>USD</currency>
    </fees_amount>
    <charged_amount>
       <amount>8.35</amount>
       <currency>USD</currency>
    </charged_amount>
    <credited_amount>
       <amount>7.35</amount>
       <currency>USD</currency>
    </credited_amount>
    <principal_amount>
       <amount>8.35</amount>
       <currency>USD</currency>
    </principal_amount>
    <sender_account_uri>tel:+25406006</sender_account_uri>
    <recipient_account_uri>iban:CH9300762011623852957</recipient_account_uri>
    <payment_amount>
       <amount>8.35</amount>
       <currency>USD</currency>
    </payment_amount>
    <payment_origination_country>USA</payment_origination_country>
    <fx_type>
       <forward>
          <fees_included>true</fees_included>
          <receiver_currency>USD</receiver_currency>
       </forward>
    </fx_type>
    <receiving_bank_name>Royal Exchange</receiving_bank_name>
    <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
    <bank_code>POFICHBEXXX</bank_code>
    <payment_type>P2P</payment_type>
    <source_of_income>Regular Income</source_of_income>
    <settlement_details>
       <amount>7.35</amount>
       <currency>USD</currency>
    </settlement_details>
    <fx_rate>1.000000</fx_rate>
    <additional_data_list>
       <resource_type>list</resource_type>
       <item_count>3</item_count>
       <data>
          <data_field>
             <name>813</name>
             <value>1.000000</value>
          </data_field>
          <data_field>
             <name>840</name>
             <value>f7eiopk6aid4b1074puuv8b3xn</value>
          </data_field>
          <data_field>
             <name>841</name>
             <value>QUOTE_HONORED</value>
          </data_field>
       </data>
    </additional_data_list>
    <payment_file_identifier>123456789</payment_file_identifier>
 </payment>
 
```

```JSON
{
     "payment": {
         "transaction_reference": "060e3dbc44-d3ff-44aa-b02a-9b4c2bff2977",
         "status": "PENDING",
         "id": "rem_JQXJoVqkZ7RPTAaoL7CnimjzTPk",
         "proposal_id": "2h52tavntgsvi3mo0gwfuat8yu",
         "resource_type": "payment",
         "created": "2023-08-24T07:49:49-05:00",
         "status_timestamp": "2023-08-24T07:49:53-05:00",
         "pending_stage": "EligibleForSettlement",
         "pending_max_completion_date": "2023-09-24T19:49:53.552-05:00",
         "fees_amount": {
             "amount": 1,
             "currency": "USD"
         },
         "charged_amount": {
             "amount": 8.35,
             "currency": "USD"
         },
         "credited_amount": {
             "amount": 7.35,
             "currency": "USD"
         },
         "principal_amount": {
             "amount": 8.35,
             "currency": "USD"
         },
         "sender_account_uri": "tel:+25406006",
         "recipient_account_uri": "iban:CH9300762011623852957",
         "payment_amount": {
             "amount": 8.35,
             "currency": "USD"
         },
         "payment_origination_country": "USA",
         "fx_type": {
             "forward": {
                 "fees_included": true,
                 "receiver_currency": "USD"
             }
         },
         "receiving_bank_name": "Royal Exchange",
         "receiving_bank_branch_name": "Quad Cities",
         "bank_code": "POFICHBEXXX",
         "payment_type": "P2P",
         "source_of_income": "Regular Income",
         "settlement_details": {
             "amount": 7.35,
             "currency": "USD"
         },
         "fx_rate": 1,
         "additional_data_list": {
             "resource_type": "list",
             "item_count": 3,
             "data": {
                 "data_field": [
                     {
                         "name": 813,
                         "value": 1
                     },
                     {
                         "name": 840,
                         "value": "f7eiopk6aid4b1074puuv8b3xn"
                     },
                     {
                         "name": 841,
                         "value": "QUOTE_HONORED"
                     }
                 ]
             }
         },
         "payment_file_identifier": 123456789
     }
 }
 
```

## Rejected Response with Source:

```XML
<Errors>
    <Error>
       <RequestId>7622332</RequestId>
       <Source>Additional Data-1200-Destination Service Tag</Source>
       <ReasonCode>MISSING_REQUIRED_INPUT</ReasonCode>
       <Description>Missing Required Input</Description>
       <Recoverable>false</Recoverable>
       <Details>
          <Detail>
             <Name>ErrorDetailCode</Name>
             <Value>092000</Value>
          </Detail>
       </Details>
    </Error>
 </Errors>
 
```

```JSON
{
    "Errors": {
       "Error": {
          "RequestId": "7622332",
          "Source": "Additional Data-1200-Destination Service Tag",
          "ReasonCode": "MISSING_REQUIRED_INPUT",
          "Description": "Missing Required Input",
          "Recoverable": "false",
          "Details": {
             "Detail": {
                "Name": "ErrorDetailCode",
                "Value": "092000"
             }
          }
       }
    }
 }
 
```

## Rejected Response without Source:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <Errors>
     <Error>
 	<RequestId>7622332</RequestId>
         <Source></Source>
         <ReasonCode>DECLINE</ReasonCode>
         <Description>Sending amount is greater than the maximum allowed per transaction</Description>
         <Recoverable>false</Recoverable>
         <Details>
             <Detail>
                 <Name>ErrorDetailCode</Name>
                 <Value>130118</Value>
             </Detail>
         </Details>
     </Error>
 </Errors>
 
```

```JSON
{
    "Errors": {
       "Error": {
          "RequestId": "7622332",
          "Source": "",
          "ReasonCode": "DECLINE",
          "Description": "Sending amount is greater than the maximum allowed per transaction",
          "Recoverable": "false",
          "Details": {
             "Detail": {
                "Name": "ErrorDetailCode",
                "Value": "130118"
             }
          }
       }
    }
 }
 
```

## Rejected Response for BANKWIRE:

```XML
<?xml version="1.0" encoding="UTF-8"?>
 <Errors>
    <Error>
       <RequestId>117201280</RequestId>
       <Source />
       <ReasonCode>DECLINE</ReasonCode>
       <Description>Invalid recipient currency</Description>
       <Recoverable>false</Recoverable>
       <Details>
          <Detail>
             <Name>ErrorDetailCode</Name>
             <Value>130101</Value>
          </Detail>
       </Details>
    </Error>
 </Errors>
 
```

```JSON
{
     "Errors": {
         "Error": {
             "RequestId": 117201280,
             "Source": "",
             "ReasonCode": "DECLINE",
             "Description": "Invalid recipient currency",
             "Recoverable": false,
             "Details": {
                 "Detail": {
                     "Name": "ErrorDetailCode",
                     "Value": 130101
                 }
             }
         }
     }
 }
 
```

## Validation Failure Response:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <Errors>
     <Error>
         <RequestId>170039</RequestId>
         <Source>recipient_account_uri</Source>
         <ReasonCode>MISSING_REQUIRED_INPUT</ReasonCode>
         <Description>Missing Required Input</Description>
         <Recoverable>false</Recoverable>
         <Details>
             <Detail>
                 <Name>ErrorDetailCode</Name>
                 <Value>092000</Value>
             </Detail>
         </Details>
     </Error>
     <Error>
         <RequestId>170039</RequestId>
         <Source>sender.address.country</Source>
         <ReasonCode>INVALID_INPUT_LENGTH</ReasonCode>
         <Description>Invalid length</Description>
         <Recoverable>false</Recoverable>
         <Details>
             <Detail>
                 <Name>ErrorDetailCode</Name>
                 <Value>072000</Value>
             </Detail>
         </Details>
     </Error>
 </Errors>
 
```

```JSON
{
    "Errors": {
       "Error": [
          {
             "RequestId": "170039",
             "Source": "recipient_account_uri",
             "ReasonCode": "MISSING_REQUIRED_INPUT",
             "Description": "Missing Required Input",
             "Recoverable": "false",
             "Details": {
                "Detail": {
                   "Name": "ErrorDetailCode",
                   "Value": "092000"
                }
             }
          },
          {
             "RequestId": "170039",
             "Source": "sender.address.country",
             "ReasonCode": "INVALID_INPUT_LENGTH",
             "Description": "Invalid length",
             "Recoverable": "false",
             "Details": {
                "Detail": {
                   "Name": "ErrorDetailCode",
                   "Value": "072000"
                }
             }
          }
       ]
    }
 }
 
```

## Pending Response:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <payment>
     <transaction_reference>05-PYT-PR-GAWERBNseYIOFUE-009675675_521</transaction_reference>
     <status>PENDING</status>
     <id>rem_AsJpZvQdkS9Rq779Bg93pmUOUqM</id>
     <proposal_id>pen_40000854024084319744151894</proposal_id>
     <resource_type>payment</resource_type>
     <created>2019-09-09T04:16:49-05:00</created>
     <status_timestamp>2019-09-09T04:17:30-05:00</status_timestamp>
     <pending_stage>Processing</pending_stage>
     <pending_max_completion_date>2019-09-09T04:19:53.435-05:00</pending_max_completion_date>
     <fees_amount>
         <currency></currency>
         <amount>5.25</amount>
     </fees_amount>
     <charged_amount>
         <currency></currency>
         <amount>10.25</amount>
     </charged_amount>
     <credited_amount>
         <currency>GBP</currency>
         <amount>82.63</amount>
     </credited_amount>
     <principal_amount>
         <currency>USD</currency>
         <amount>105.50</amount>
     </principal_amount>
     <sender_account_uri>tel:+25406005</sender_account_uri>
     <recipient_account_uri>tel:+254069832</recipient_account_uri>
     <payment_amount>
         <currency>USD</currency>
         <amount>121.10</amount>
     </payment_amount>
     <payment_origination_country>USA</payment_origination_country>
     <fx_type>
         <forward>
             <fees_included>true</fees_included>
             <receiver_currency>GBP</receiver_currency>
         </forward>
     </fx_type>
     <receiving_bank_name>Royal Exchange</receiving_bank_name>
     <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
     <payment_type>P2P</payment_type>
     <source_of_income>Sal</source_of_income>
     <settlement_details>
         <currency>EUR</currency>
         <amount>23.12</amount>
     </settlement_details>
     <cashout_code>123456</cashout_code>
     <fx_rate>3.7833456828</fx_rate>
     <additional_data_list>
         <resource_type>list</resource_type>
         <item_count>36</item_count>
         <data>
             <data_field>
                 <name>810</name>
                 <value>123</value>
             </data_field>
             <data_field>
                 <name>851</name>
                 <value>456</value>
             </data_field>
             <data_field>
                 <name>813</name>
                 <value>18.22</value>
             </data_field>
             <data_field>
                 <name>225</name>
                 <value>customer@gmail.com</value>
             </data_field>
             <data_field>
                 <name>700</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>7202</name>
                 <value>W</value>
             </data_field>
             <data_field>
                 <name>111</name>
                 <value>123MainStreet 5A</value>
             </data_field>
             <data_field>
                 <name>112</name>
                 <value>Arlington</value>
             </data_field>
             <data_field>
                 <name>114</name>
                 <value>VA</value>
             </data_field>
             <data_field>
                 <name>141</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>113</name>
                 <value>22207</value>
             </data_field>
             <data_field>
                 <name>140</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>101</name>
                 <value>John</value>
             </data_field>
             <data_field>
                 <name>102</name>
                 <value>L</value>
             </data_field>
             <data_field>
                 <name>103</name>
                 <value>Doe</value>
             </data_field>
             <data_field>
                 <name>160</name>
                 <value>1985-06-24</value>
             </data_field>
             <data_field>
                 <name>151</name>
                 <value>PassportNumber</value>
             </data_field>
             <data_field>
                 <name>152</name>
                 <value>123456789</value>
             </data_field>
             <data_field>
                 <name>156</name>
                 <value>2019-05-27</value>
             </data_field>
             <data_field>
                 <name>155</name>
                 <value>2011-07-12</value>
             </data_field>
             <data_field>
                 <name>154</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>211</name>
                 <value>123MainStreet 5A</value>
             </data_field>
             <data_field>
                 <name>212</name>
                 <value>Arlington</value>
             </data_field>
             <data_field>
                 <name>214</name>
                 <value>VA</value>
             </data_field>
             <data_field>
                 <name>241</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>213</name>
                 <value>22207</value>
             </data_field>
             <data_field>
                 <name>201</name>
                 <value>Lee</value>
             </data_field>
             <data_field>
                 <name>202</name>
                 <value>M</value>
             </data_field>
             <data_field>
                 <name>203</name>
                 <value>Cardholder</value>
             </data_field>
             <data_field>
                 <name>221</name>
                 <value>0016367224357</value>
             </data_field>
             <data_field>
                 <name>251</name>
                 <value>PassportNumber</value>
             </data_field>
             <data_field>
                 <name>252</name>
                 <value>123456789</value>
             </data_field>
             <data_field>
                 <name>256</name>
                 <value>2019-05-27</value>
             </data_field>
             <data_field>
                 <name>255</name>
                 <value>2011-07-12</value>
             </data_field>
             <data_field>
                 <name>254</name>
                 <value>USA</value>
             </data_field>
             <data_field>
                 <name>240</name>
                 <value>USA</value>
             </data_field>
         </data>
     </additional_data_list>
 </payment>
 
```

```JSON
 {
    "payment": {
       "transaction_reference": "05-PYT-PR-GAWERBNseYIOFUE-009675675_521",
       "status": "PENDING",
       "id": "rem_AsJpZvQdkS9Rq779Bg93pmUOUqM",
       "proposal_id": "pen_40000854024084319744151894",
       "resource_type": "payment",
       "created": "2019-09-09T04:16:49-05:00",
       "status_timestamp": "2019-09-09T04:17:30-05:00",
       "pending_stage": "Processing",
       "pending_max_completion_date": "2019-09-09T04:19:53-05:00",
       "fees_amount": {
          "currency": "",
          "amount": "5.35"
       },
       "charged_amount": {
          "currency": "",
          "amount": "10.25"
       },
       "credited_amount": {
          "currency": "GBP",
          "amount": "82.63"
       },
       "principal_amount": {
          "currency": "USD",
          "amount": "105.50"
       },
       "sender_account_uri": "tel:+25406005",
       "recipient_account_uri": "tel:+254069832",
       "payment_amount": {
          "currency": "USD",
          "amount": "121.10"
       },
       "payment_origination_country": "USA",
       "fx_type": {
          "forward": {
             "fees_included": "true",
             "receiver_currency": "USD"
          }
       },
       "receiving_bank_name": "Royal Exchange",
       "receiving_bank_branch_name": "Quad Cities",
       "payment_type": "P2P",
       "source_of_income": "Sal",
       "settlement_details": {
          "currency": "EUR",
          "amount": "23.12"
       },
       "cashout_code": "123456",
       "fx_rate": "3.7833456828",
       "additional_data_list": {
          "resource_type": "list",
          "item_count": "36",
          "data": {
             "data_field": [
                {
                   "name": "810",
                   "value": "123"
                },
                {
                   "name": "851",
                   "value": "456"
                },
                {
                   "name": "813",
                   "value": "18.22"
                },
                {
                   "name": "225",
                   "value": "customer@gmail.com"
                },
                {
                   "name": "700",
                   "value": "USA"
                },
                {
                   "name": "7202",
                   "value": "W"
                },
                {
                   "name": "111",
                   "value": "123MainStreet 5A"
                },
                {
                   "name": "112",
                   "value": "Arlington"
                },
                {
                   "name": "114",
                   "value": "VA"
                },
                {
                   "name": "141",
                   "value": "USA"
                },
                {
                   "name": "113",
                   "value": "22207"
                },
                {
                   "name": "140",
                   "value": "USA"
                },
                {
                   "name": "101",
                   "value": "John"
                },
                {
                   "name": "102",
                   "value": "L"
                },
                {
                   "name": "103",
                   "value": "Doe"
                },
                {
                   "name": "160",
                   "value": "1985-06-24"
                },
                {
                   "name": "151",
                   "value": "PassportNumber"
                },
                {
                   "name": "152",
                   "value": "123456789"
                },
                {
                   "name": "156",
                   "value": "2019-05-27"
                },
                {
                   "name": "155",
                   "value": "2011-07-12"
                },
                {
                   "name": "154",
                   "value": "USA"
                },
                {
                   "name": "211",
                   "value": "123MainStreet 5A"
                },
                {
                   "name": "212",
                   "value": "Arlington"
                },
                {
                   "name": "214",
                   "value": "VA"
                },
                {
                   "name": "241",
                   "value": "USA"
                },
                {
                   "name": "213",
                   "value": "22207"
                },
                {
                   "name": "201",
                   "value": "Lee"
                },
                {
                   "name": "202",
                   "value": "M"
                },
                {
                   "name": "203",
                   "value": "Cardholder"
                },
                {
                   "name": "221",
                   "value": "0016367224357"
                },
                {
                   "name": "251",
                   "value": "PassportNumber"
                },
                {
                   "name": "252",
                   "value": "123456789"
                },
                {
                   "name": "256",
                   "value": "2019-05-27"
                },
                {
                   "name": "255",
                   "value": "2011-07-12"
                },
                {
                   "name": "254",
                   "value": "USA"
                },
                {
                   "name": "240",
                   "value": "USA"
                }
             ]
          }
       }
    }
 }
 
```

# Pending Stages

Stages of a pending transaction:

| Pending Stage | Stage Description | Next Day Settlement Impact | Prefunding Settlement / Collateral Settlement Impact |
| --- | --- | --- | --- |
| Processing | Transaction has been accepted and is being processed.  <br>This is the initial Pending stage. | None | Reserved Balance increases, and the Available Balance decreases. If there was a Quote Confirmed, then there is no change to the Reserved Balance or Available Balance, when the Payment is Pending Processing. |
| QueuedForFutureProcessing | Future Dated transaction has been accepted and queued in system till scheduled date provided in the Payment | None | There is no impact to Reserved or available balance |
| EligibleForSettlement | Transaction has been accepted, passed initial system validations, and has been passed to the receiving provider. | Transaction is in this stage at any time before the Processing cutoff, the Transaction Settlement Amount will be included in the Net Settlement Position.  <br>If later Rejected, a credit for the eligible portion of the Settlement Amount will becredited. | If the Transaction was previously in a Pending Processing stage, the Reserve Balance decreases. The Processing Amount increases, and the Available Balance remains unchanged. |
| Ambiguous | Transaction has initially been accepted but a processing anomaly occurred. The system will reattempt Transactions in this stage of Pending.  <br>Certain amount fields may be blank in the response in this stage, and subsequently update when a status changes. Transaction status updates can obtained using the Retrieve Payment API or the Status Change Report. | None | The customer may use the Balance API or the Operational Details in the Balance Management tool, to monitor the balances. |
| InsufficientBalance | Transaction has been accepted and is being queued. System will keep the transaction in queue for a fixed time duration(max queue time), shared in response of the Payment request. Enough balance needs to be added to settlement account prior to expiry of the queue time, to successfully process the payment. | None | Queued Balance increase. There is no impact to Reserved or Available Balance. |
| Any other value | Some Receiving Systems may return a response that does not align to the above statuses. In this instance, the Transaction will be in the Pending Stage of “Any Other Value”. Customers should manage these miscellaneous indicators the same as a Transaction in the “Processing” stage and contact the support team if details on the exact meaning of the response are required. | None | The Customer may use the Balance API or the Operational Details in the Balance Management tool, to monitor the balances. |

# Error Codes

Refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/#sandbox-testing)
*   [Sample Requests](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/#sample-requests)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/#sample-responses)
*   [Pending Stages](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/#pending-stages)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/#error-codes)

---
title: Address Validation API
---

> [!ALERT]
> 
> If you are an Originating Institution contracted with MTS EU or MTS UK, please proceed to [Address Validation API Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-eu-address-validation-api/) and [Address Validation API Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-uk-address-validation-api/) respectively to ensure compliance with the relevant jurisdiction based Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

The Address Validation Service is an optional service which customers can use to confirm the validity of an address before sending a transaction to Mastercard Cross-Border Services.

Address validations with successful responses will return country specific address structure to be used for transactions.

List of supported countries will be maintained and activated for Mastercard Cross-Border Services. Mastercard Cross-Border Services will activate the usable countries. If the country is not in the usable list, any requests for that country will be rejected. The first country activated is United States.

# Environment Domains

```Sandbox
https://sandbox.api.mastercard.com/send/address-validation-service/addresses/validations
```

```Production
https://api.mastercard.com/send/address-validation-service/addresses/validations
```

# API

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/address-validation-api/#operation/validateAddress)

This resource is used to validate address and checks whether the address in a given country is valid as per the country's convention.

Sandbox URL

https://sandbox.api.mastercard.com/send/address-validation-service/addresses/validations

MTF URL

https://sandbox.api.mastercard.com/send/address-validation-service/addresses/validations

Production URL

https://api.mastercard.com/send/address-validation-service/addresses/validations

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/json  
    accept: Format of the inbound content being submitted. example: application/json  
    X-Mc-Correlation-Id : A unique correlation ID for tracking the request.  
    Partner-Ref-Id : A unique reference ID of the business partner.

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required OAuth 1.0a Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to originating institutions; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Originating Institution.

## Sandbox Test cases

> [!ALERT]
> 
> For the Address Validation Service all requests initiated in the Sandbox/MTF url must use the test cases specified in the following table. Please limit your testing requirements only to test cases available below.

The Sandbox server returns simulated, static responses. You can use the following test cases to produce specific responses.

| Status | Verification | Test Case | Request Payload |
| --- | --- | --- | --- |
| Valid | Verified | Valid address | “Address”: “4 CLARK STREET, EVERETT, MA, 02149”,“Country”: “US” |
| Valid | Partially Verified | Valid address, but partially verifiable | “Address”: “420 MONTGOMERY ST. SF CA”,“Country”: “US” |
| Invalid | Unverified | Invalid address because it cannot be verified | “Address”: “420 MAIN”,“Country”: “US” |
| Invalid | Ambiguous | Invalid address because it is ambiguous | “Address”: “7151 45TH SEATTLE WA”,“Country”: “US” |
| Valid | Verified | Valid address | “Address”: “4 CLARK STREET, EVERETT, MA, 02149”,“Country”: “USA” |
| Valid | Partially Verified | Valid address, but partially verifiable | “Address”: “420 MONTGOMERY ST. SF CA”,“Country”: “USA” |
| Invalid | Unverified | Invalid address because it cannot be verified | “Address”: “420 MAIN”,“Country”: “USA” |
| Invalid | Ambiguous | Invalid address because it is ambiguous | “Address”: “7151 45TH SEATTLE WA”,“Country”: “USA” |

# Sample Request

```JSON
{
  "country": "USA",
  "address": "4 CLARK STREET, EVERETT"
}
```

# Sample Response

## Successful Response: Below are samples for some of the successful responses.

### a) Valid Address sample

```JSON
{
  "status": "VALID",
  "verification": "VERIFIED",
  "addressMatch": {
    "address": "4 Clark St,Everett MA 02149-2015",
    "line1": "4 Clark St",
    "line2": "Everett MA 02149-2015",
    "line3": "",
    "country": "USA",
    "countrySubdivision": "MA",
    "city": "Everett",
    "streetName": "Clark St",
    "buildingNumber": 4,
    "postalCode": "02149-2015"
  }
}
```

### b) Partially verifiable Address sample

```JSON
{
  "status": "VALID",
  "verification": "PARTIALLY VERIFIED",
  "addressMatch": {
    "address": "420 Montgomery St,Santa Fe CA",
    "line1": "420 Montgomery St",
    "line2": "Santa Fe CA",
    "country": "USA",
    "countrySubdivision": "CA",
    "city": "Santa Fe",
    "streetName": "Montgomery St",
    "buildingNumber": "420"
  }
}
```

### c) Invalid Address sample

Invalid Address cannot be used for Payment Transactions.

```JSON
{
  "status": "INVALID",
  "verification": "UNVERIFIED",
  "addressMatch": {
    "address": "420 MAIN"
  }
}
```

### d) Ambiguous Address sample

Ambiguous Address cannot be used for Payment Transactions.

```JSON
{
  "status": "INVALID",
  "verification": "AMBIGUOUS",
  "addressMatch": {
    "address": "7151 45TH SEATTLE WA"
  }
}
```

## Rejected Response for invalid input value:

```JSON
{
    "Errors": {
        "Error": {
            "RequestId": "5",
            "Source": "country",
            "ReasonCode": "INVALID_INPUT_VALUE",
            "Description": "Invalid input value",
            "Recoverable": "false",
            "Details": {
                "Detail": {
                    "Name": "ErrorDetailCode",
                    "Value": "082000"
                }
            }
        }
    }
}
```

## Rejected Response for Unauthorized access:

```JSON
{
    "Errors": {
        "Error": {
            "RequestId": "6",
            "Source": "Partner-Ref-Id",
            "ReasonCode": "AUTHORIZATION_FAILED",
            "Description": "Unauthorized Access.",
            "Recoverable": "false",
            "Details": {
                "Detail": {
                    "Name": "ErrorDetailCode",
                    "Value": "050007"
                }
            }
        }
    }
}
```

## Rejected Response for unprocessable Entity:

```JSON
{
  "Errors": {
    "Error": {
      "RequestId": null,
      "Source": "test",
      "ReasonCode": "INVALID_INPUT_VALUE",
      "Description": "Invalid Input Value",
      "Recoverable": "false",
      "Details": {
        "Detail": {
          "Name": "ErrorDetailCode",
          "Value": "082000"
        }
      }
    }
  }
}
```

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/address-validation-api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/address-validation-api/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/address-validation-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/address-validation-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/address-validation-api/#sandbox-testing)
*   [Sample Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/address-validation-api/#sample-request)
*   [Sample Response](https://developer.mastercard.com/cross-border-services/documentation/api-ref/address-validation-api/#sample-response)


---
title: Account Validation APIs
---

> [!ALERT]
> 
> Mastercard will be migrating from Entrust to DigiCert CA certificates, in response to the announcement made by Google and Mozilla to move away from Entrust CA. Make sure to switch to DigiCert CA before March 10, 2025 in production to ensure a successful SSL handshake and avoid any service disruption. Please refer to the communication and  sent to your organization dated February 11, 2025 for more information.

The Account Validation APIs assist customers to process transactions with valid data for specific countries. This API allows customers to:

*   Generate account values
*   Validate and verify account values
*   Access account and bank-related information  
    

  
There are three types of Account Validation APIs:

# 1\. Account Validation API

The [Account Validation API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/) allows Customers to validate or verify recipient account information before submitting payment to Cross-Border Services.

*   **IBAN Validation Service** – Customers can validate account format and structure of an IBAN value provided for payload instruction.
*   **Account Status Verification** – Customers can verify the following elements of an account used for bank deposit services:
    *   Account Number
    *   Account Owner Name
    *   Account Activity Status
    *   Account Currency
*   **Card Eligibility Service** – Customers can validate debit or credit card account number format and structure. In addition, customers can receive payload feedback if an account can support cross-border transactions.

# 2\. Bank Information Lookup API

The [Bank Information Lookup API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/bank-information-lookup/) allows customers to retrieve specific details of the beneficiary bank which can be used for payment transaction.

# 3\. IBAN Generation API

The [IBAN Generation API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/iban-generation-api/) allows customers to generate IBAN account values using several bank identifying data elements.

> [!NOTE]
> 
>   
> \- Our Cross-Border Services provide account validation and verification services to help customers verify recipient account information. However, Mastercard does not guarantee payment transactions acceptance or processing at the financial institution of the recipient.  
> \- The financial institution hosting the recipient account can reject or return funds to the sending institution for various reasons that are outside of Mastercard control.


---
title: Account Validation API
---

> [!ALERT]
> 
> If you are an Originating Institution contracted with MTS EU or MTS UK, please proceed to [Account Validation API specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/psd2-eu-account-validation-apis/) and [Account Validation API specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/psd2-uk-account-validation-apis/) respectively to ensure compliance with the relevant jurisdiction based Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/partners/{partner_id}/crossborder/accounts/validations
```

```Production
https://api.mastercard.com/send/partners/{partner_id}/crossborder/accounts/validations
```

# API Specification

## Account Validation API

  
The Account Validation API is a feature within Account Validation Services which allows Customers to validate Recipient account information before submitting payment to Cross-Border Services.  
  
Customers deciding to code to this API will receive successful or rejection responses based on Receiving Account data provided for a specific corridor. This API functionality has been expanded to provide additional services including:

*   IBAN Validation Service – Customers can validate account format and structure of an IBAN value provided for payload instruction.
*   Card Eligibility Service – Customers can validate debit or credit card account number format and structure. In addition, customers can receive payload feedback if an account can support cross-border transactions.
*   Account Status Verification – Customers can verify the following elements of an account used for bank deposit services:
    *   Account Number
    *   Account Owner Name
    *   Account Status

  
Please note, while Cross-Border Services provide account validation and verification services to help customers verify recipient account information; this does not guarantee payment transactions will be accepted or processed at the recipient’s financial institution. The financial institution hosting the Recipient’s account can reject or return funds to the sending institution for various reasons outside of Mastercard control.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/#operation/accountValidation)

Validate an account prior to payment initiation.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts/validations

MTF URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts/validations

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts/validations

#### Account Validation Push Notification

Customers deciding to code for Account Status Verification and Card Eligibility Service functionalities will receive a push notification once Account Validation API processing finishes if an IN\_PROGRESS status was initially received.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/#operation/accountValidationResponse)

Webhook notification from Mastercard.

https://static.developer.mastercard.com/content/cross-border-services/swagger/webhooks

  

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

The different statuses for the Account Validation API are as follows:

| Status | Description |
| --- | --- |
| IN\_PROGRESS | The Request has been received successfully and is under progress. |
| SUCCESS | The Request has been processed successfully with final response. |
| FAILURE | The Request has failed due to errors like API syntax mismatch or Field length error. |

# Payload Encryption

All payload request sent to and from Cross-Border Services are encrypted.  
For more detailed information on payload **Encryption/Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to originating institutions; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Originating Institution.

## Sandbox Test cases

> [!ALERT]
> 
> For the Validation Services requests initiated in the Sandbox/MTF url must use the test cases specified in the following table. Please limit your testing requirements only to test cases available below.

The Sandbox server returns simulated, static responses. You can use the following test cases to produce specific responses.

Please note that the Sandbox Testing is unavailable for Req Type = “ASV”

### _Account Validation API_

| Status | Test Case | Request Payload |
| --- | --- | --- |
| Valid | Account (IBAN) is successfully verified. | {  <br>    “accountUri”: {  <br>        “type”: “IBAN”,  <br>        “value”: “FR070331234567890123456”  <br>    }  <br>} |
| Valid | Valid PAN eligible for cross border | {  <br>    “requestType”:“CES”,  <br>    “accountUri”: {  <br>        “type”: “PAN”,  <br>        “value”: “4000340000000515”  <br>    }  <br>} |
| Valid | Valid PAN not eligible for cross border | {  <br>    “requestType”:“CES”,  <br>    “accountUri”: {  <br>        “type”: “PAN”,  <br>        “value”: “2000000000000014”  <br>    }  <br>} |
| Invalid | Account (IBAN) not verified because data provided is insufficient | Send the request where AccountUri.value is null  <br>  <br>{  <br>    “accountUri”: {  <br>        “type”: “IBAN”,  <br>        “value”: “"  <br>    }  <br>} |
| Invalid | Account (IBAN) not verified because check digit in IBAN is invalid | Send the below request where AccountUri.value should end with ‘ER00102’  <br>  <br>{  <br>    “accountUri”: {  <br>        “type”: “IBAN”,  <br>        “value”: “GB83NWBK60161ER00102”  <br>    }  <br>} |
| Invalid | Account (IBAN) is not verified because country is not supported for this service | Send the below request where AccountUri.value should end with ‘ER00113’  <br>  <br>{  <br>    “accountUri”: {  <br>        “type”: “IBAN”,  <br>        “value”: “BJ66BJ061010010014439ER00113”  <br>    }  <br>} |

# Sample Request

## 1\. IBAN Validation Service

```JSON
{
  "accountUri": {
    "type": "IBAN",
    "value": "FR070331234567890123456"
  }
}
```

## 2\. Card Eligibility Service

```JSON
{
  "requestType": "CES",
  "accountUri": {
    "type": "PAN",
    "value": "4000340000000515"
  }
}
```

## 3\. Account Status Verification

```json
{
  "requestType": "ASV",
  "accountUri": {
    "type": "BAN",
    "value": "98000987651232"
  },
  "accountDetails": {
    "accountHolder": {
      "name": {
        "firstName": "John",
        "middleName": "Adam",
        "lastName": "Smith"
      }
    },
    "bic": {
      "value": "123456789",
      "type": "ABA"
    }
  }
}
```

# Sample Response

## 1\. Successful IBAN Account Validation Response:

```JSON
{
  "status": "SUCCESS",
  "message": "Valid IBAN Structure",
  "accountMatch": {
    "accounts": {
      "account": [
        {
          "type": "IBAN",
          "value": "FR070331234567890123456"
        },
        {
          "type": "BAN",
          "value": "30007999990424173200040"
        }
      ]
    },
    "bank": {
      "bic": {
        "type": "SWIFT BIC",
        "value": "NATXFRPP"
      },
      "name": "Natixis",
      "branchName": "",
      "branchCode": "3000799999",
      "address": {
        "line1": "30 Av Pierre Mendes-France",
        "city": "Paris",
        "postalCode": "75013",
        "country": "FRA"
      }
    }
  }
}
```

## 2\. Successful Card Eligibility Service response:

```JSON
{
  "status": "SUCCESS",
  "refId": "e5c6e10f-7d7d-4f69-8f7a-80be8ead68c3",
  "message": "Valid PAN",
  "accountMatch": {
    "accounts": {
      "account": [
        {
          "type": "PAN",
          "value": "4000340000000515"
        }
      ]
    },
    "bank": {
      "name": "Cassa di Risparmio di Bolzano SpA",
      "address": {
        "country": "ITA"
      }
    }
  },
  "receivingEligibility": {
    "crossBorder": {
      "eligible": "Y",
      "fasterFunds": "Y"
    },
    "paymentSystem": "MASTERCARD",
    "product": "Credit",
    "status": "ELIGIBLE"
  }
}
```

## 3\. Account Status Verification Service response:

API Status: In Progress

```json
{
  "requestType": "ASV",
  "accountUri": {
    "type": "BAN",
    "value": "98000987651232"
  },
  "accountDetails": {
    "accountHolder": {
      "name": {
        "firstName": "John",
        "middleName": "Adam",
        "lastName": "Smith"
      }
    },
    "bic": {
      "value": "123456789",
      "type": "ABA"
    }
  }
}
```

## 4\. Account Status Verification Service response:

API Status: Success

```json
{
  "requestType": "ASV",
  "accountUri": {
    "type": "BAN",
    "value": "98000987651232"
  },
  "accountDetails": {
    "accountHolder": {
      "name": {
        "firstName": "John",
        "middleName": "Adam",
        "lastName": "Smith"
      }
    },
    "bic": {
      "value": "123456789",
      "type": "ABA"
    }
  }
}
```

## 5\. Rejected account validation response for missing mandatory fields.

```JSON
{
  "Errors": {
    "Error": [
      {
        "RequestId": "1710",
        "Source": "accountUri.value",
        "ReasonCode": "MISSING_REQUIRED_INPUT",
        "Description": "Missing Required Input",
        "Recoverable": "false",
        "Details": {
          "Detail": [
            {
              "Name": "ErrorDetailCode",
              "Value": "092000"
            }
          ]
        }
      }
    ]
  }
}
```

## 6\. Rejected account validation response for invalid check digit.

```JSON
{
  "Errors": {
    "Error": [
      {
        "RequestId": "1711",
        "Source": "",
        "ReasonCode": "INVALID_CHECK_DIGIT",
        "Description": "Invalid check digit",
        "Recoverable": "false",
        "Details": {
          "Detail": [
            {
              "Name": "ErrorDetailCode",
              "Value": "130308"
            }
          ]
        }
      }
    ]
  }
}
```

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/#environment-domains)
*   [API Specification](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/#api-specification)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/#sandbox-testing)
*   [Sample Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/#sample-request)
*   [Sample Response](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/#sample-response)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/#error-codes)


---
title: Bank Information Lookup API
---

> [!ALERT]
> 
> If you are an Originating Institution contracted with MTS EU or MTS UK, proceed to [Bank Information Lookup API specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/psd2-eu-bank-information-lookup-api/) and [Bank Information Lookup API specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/psd2-uk-bank-information-lookup-api/) respectively to ensure compliance with the relevant jurisdiction-based Regulatory Technical Standards derived from the Revised Payment Services Directive (PSD2).

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/partners/{partner_id}/crossborder/banks/details
```

```Production
https://api.mastercard.com/send/partners/{partner_id}/crossborder/banks/details
```

# API Specification

## Bank Information LookUp API

  
The Bank Information Lookup API is a feature within Account Validation services which allows customers to retrieve specific details of beneficiary bank which can be used for payment transaction.  
Customers deciding to code to this API can use bank-related details such as bank name, bank address and bank code to obtain full bank identifying information for a specific branch within a desired country.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/bank-information-lookup/#operation/bankInfo)

Retrieve bank information for supported countries.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/banks/details

MTF URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/banks/details

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/banks/details

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:
    *   `content-type` : Format of the inbound content to be submitted. Example: application/json
    *   `accept`: Format of the inbound content to be submitted. Example: application/json
    *   `X-Mc-Correlation-Id` : A unique correlation ID for tracking the request.
    *   `Partner-Ref-Id` : A unique reference ID of the business partner.

# API Convention

Refer the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All payload request sent to and from Cross-Border Services are encrypted.  
For more detailed information on payload **Encryption/Decryption**, see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [Tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required Authorization Header.

> [!TIP]
> 
>   
> 
> *   During the onboarding process, Mastercard assigns a registered partner ID to test in the higher environments (MTF Test and Production).
> *   This partner ID cannot access the Sandbox environment, but the customer can still access the Sandbox by using the non-registered partner ID.
> *   you can use any correctly formatted partner ID in the Sandbox. As a best practice, use the first 15 digits of your institution name, containing alphanumeric and special characters but no spaces, as the `Partner_ID`.
> *   For testing in a Sandbox, use a unique `transaction_reference` on each run.

> [!NOTE]
> 
>   
> 
> *   The Sandbox does not return parameters unique to originating institutions, such as pricing, limits and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment.
> *   After completion of Sandbox testing, mastercard assigns a project manager to customers meeting the eligibility requirements to perform integrated testing in the test environment.
> *   This test environment can include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Originating Institution.

## Sandbox Test Cases

> [!ALERT]
> 
> *   For the Validation Services, requests initiated in the Sandbox/MTF url must use the test cases specified in the following table.
> *   Limit your testing requirements only to the test cases mentioned in the table.

The Sandbox server returns simulated, static responses. You can use the following test cases to produce specific responses:

### Bank Information LookUp API

| Status | Test Case | Request Payload |
| --- | --- | --- |
| Valid | Bank Info generated when country code , bic-type and bic-values are provided | Send this request where bic.value should end with ‘SUC20002’  <br>  <br>{  <br>  “bank”: {  <br>    “name”: null,  <br>    “branchName”: null,  <br>    “country”: “AUS”,  <br>    “bic”: {  <br>      “type”: “CHIPS”,  <br>      “value”: “9876SUC20002”  <br>    },  <br>    “address”: {  <br>      “city”: null,  <br>      “countrySubdivision”: null,  <br>      “postalCode”: null  <br>    }  <br>  }  <br>} |
| Valid | Bank Info generated with country code , bic-value and having bic-type as ANY. | Send this request where bic.value should end with ‘SUC20002’  <br>{  <br>  “bank”: {  <br>    “name”: null,  <br>    “branchName”: null,  <br>    “country”: “AUS”,  <br>    “bic”: {  <br>      “type”: “any”,  <br>      “value”: “9876SUC20002”  <br>    },  <br>    “address”: {  <br>      “city”: null,  <br>      “countrySubdivision”: null,  <br>      “postalCode”: null  <br>    }  <br>  }  <br>} |
| Valid | Bank Info generated when bank name is provided in the local language  <br>  <br><br>> [!NOTE]<br>> <br>> Refer to the list of local languages supported [here](https://static.developer.mastercard.com/content/cross-border-services/uploads/LocalLanguagesSupported.pdf). | Send this request where the bank.name should end with ‘SUC20003’  <br>  <br>{  <br>  “bank”: {  <br>    “name”: “\*农村商业银行股份有限公司半里铺分理处\*SUC20003”,  <br>    “branchName”: null,  <br>    “country”: “CHN”,  <br>    “bic”: {  <br>      “type”: null,  <br>      “value”: null  <br>    },  <br>    “address”: {  <br>      “city”: null,  <br>      “countrySubdivision”: null,  <br>      “postalCode”: null  <br>    }  <br>  }  <br>} |
| Valid | Bank Info generated when country code and partial bank name is provided | Send this request where bank.name should end with ‘SUC20004’  <br>  <br>{  <br>  “bank”: {  <br>    “name”: “\*of Africa United Kingdom\*SUC20004”,  <br>    “branchName”: null,  <br>    “country”: “GBR”,  <br>    “bic”: {  <br>      “type”: null,  <br>      “value”: null  <br>    },  <br>    “address”: {  <br>      “city”: null,  <br>      “countrySubdivision”: null,  <br>      “postalCode”: null  <br>    }  <br>  }  <br>} |
| Invalid | Bank Info is not generated as no records exist for the particular bank in the country requested. | Send this request where bank.name should end with ER20005  <br>  <br>{  <br>  ““bank””: {  <br>    ““name””: ““Bank Of IndiaER20005"”,  <br>    ““branchName””: null,  <br>    ““country””: ““AUS””,  <br>    ““bic””: {  <br>      ““type””: null,  <br>      ““value””: null  <br>    },  <br>    ““address””: {  <br>      ““city””: null,  <br>      ““countrySubdivision””: null,  <br>      ““postalCode””: null  <br>    }  <br>  }  <br>} |
| Invalid | Bank Info is not generated as either Bank Code or Bank Name is required. | {  <br>  “bank”: {  <br>    “name”: null,  <br>    “branchName”: null,  <br>    “country”: “AUS”,  <br>    “bic”: {  <br>      “type”: “CHIPS”,  <br>      “value”: null  <br>    },  <br>    “address”: {  <br>      “city”: null,  <br>      “countrySubdivision”: null,  <br>      “postalCode”: null  <br>    }  <br>  }  <br>} |

# Sample Request

```JSON
{
  "bank": {
    "name": "*of Africa United Kingdom*SUC20004",
    "branchName": null,
    "country": "GBR",
    "bic": {
      "type": null,
      "value": null
    },
    "address": {
      "city": null,
      "countrySubdivision": null,
      "postalCode": null
    }
  }
}
```

# Sample Response

## 1\. Successful Bank Info Lookup Response:

```JSON
{
  "bankInfo": {
    "total": "1",
    "banks": {
      "bankData": [
        {
          "bics": [
            {
              "type": "BICTYPE",
              "value": "9876SUC20002"
            }
          ],
          "name": "Commonwealth Commercial Bank",
          "branchName": "East Bay Branch",
          "address": {
            "line1": "221B Baker Street",
            "line2": null,
            "city": "Twizel",
            "country": "AUS",
            "countrySubdivision": "AUstate",
            "postalCode": "W1K 7QE"
          },
          "sanctionDetails": {
            "eu": false,
            "hmt": false,
            "ofac": false,
            "un": false
          }
        }
      ]
    }
  }
}
```

## 2\. Successful Bank Info Lookup Response with Fed ACH and Fed Wire:

```JSON
{
  "bankInfo": {
    "total": "1",
    "banks": {
      "bankData": [
        {
          "bics": [
            {
              "type": "ABA",
              "value": "123456789",
              "ach": {
                "enabled": true
              },
              "wire": {
                "enabled": false,
                "preferredRoutingNumber": "123456789"
              }
            }
          ],
          "name": "National Bank",
          "branchName": null,
          "address": {
            "line1": "500 W Street",
            "line2": null,
            "city": "Pittsburgh",
            "country": "USA",
            "countrySubdivision": "Pennsylvania",
            "postalCode": "12345"
          },
          "sanctionDetails": {
            "eu": false,
            "hmt": false,
            "ofac": false,
            "un": false
          }
        }
      ]
    }
  }
}
```

## 3\. Rejected Bank Info lookup response for invalid bank code or bank name.

```JSON
{    "Errors": {
  "Error": [
    {
      "RequestId": "1721",
      "Source": "bank.name or bank.bic.value",
      "ReasonCode": "REQUIRED_BANK_CODE_OR_BANK_NAME",
      "Description": "Either a bank code or bank name is a mandatory field and cannot be null",
      "Recoverable": "false",
      "Details": {
        "Detail": [
          {
            "Name": "ErrorDetailCode",
            "Value": "130303"
          }
        ]
      }
    }
  ]
}
}
```

## 4\. Rejected Bank Info lookup response for records not found due to incorrect search criteria.

```JSON
{
  "Errors": {
    "Error": [
      {
        "RequestId": "2809",
        "Source": "",
        "ReasonCode": "RESOURCE_UNKNOWN",
        "Description": "Record not found",
        "Recoverable": "false",
        "Details": {
          "details": [
            {
              "name": "ErrorDetailCode",
              "value": "110507"
            }
          ]
        }
      }
    ]
  }
}
```

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/bank-information-lookup/#environment-domains)
*   [API Specification](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/bank-information-lookup/#api-specification)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/bank-information-lookup/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/bank-information-lookup/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/bank-information-lookup/#sandbox-testing)
*   [Sample Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/bank-information-lookup/#sample-request)
*   [Sample Response](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/bank-information-lookup/#sample-response)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/bank-information-lookup/#error-codes)


---
title: IBAN Generation API
---

> [!ALERT]
> 
> If you are an Originating Institution contracted with MTS EU or MTS UK, please proceed to [IBAN Generation API specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/psd2-eu-iban-generation-api/) and [IBAN Generation API specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/psd2-uk-bank-iban-generation-api/) respectively to ensure compliance with the relevant jurisdiction based Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/partners/{partner_id}/crossborder/accounts/generate-ibans
```

```Production
https://api.mastercard.com/send/partners/{partner_id}/crossborder/accounts/generate-ibans
```

# API Specification

## IBAN Generation API

  
The IBAN Generation API is a feature within Account Validation services which allows customers to generate IBAN account values using several bank identifying data elements.  
Customers deciding to code to this API, would receive successful or rejection responses based on data elements used to create requested IBAN value. Some elements which are supported within this API are country, branch code and SWIFT BIC values.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/iban-generation-api/#operation/generateIban)

Generate an existing IBAN using relevant bank details.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts/generate-ibans

MTF URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts/generate-ibans

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts/generate-ibans

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All payload request sent to and from Cross-Border Services are encrypted.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to originating institutions; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Originating Institution.

## Sandbox Test cases

> [!ALERT]
> 
> For the Validation Services requests initiated in the Sandbox/MTF url must use the test cases specified in the following table. Please limit your testing requirements only to test cases available below.

The Sandbox server returns simulated, static responses. You can use the following test cases to produce specific responses.

| Status | Test Case | Request Payload |
| --- | --- | --- |
| Valid | IBAN is successfully generated when all mandatory and optional fields are present. | {  <br>  “accountUri”: {  <br>    “type”: “ban”,  <br>    “value”: “20041010050500013M02606”  <br>  },  <br>  “country”: “FRA”,  <br>  “branchCode”: “2004101005”,  <br>  “accountNo”: “0500013026”  <br>} |
| Valid | IBAN is successfully generated when the combination of BAN and country are provided as input | {  <br>  “accountUri”: {  <br>    “type”: “ban”,  <br>    “value”: “20041010050500013M02606”  <br>  },  <br>  “country”: “FRA”,  <br>  “branchCode”: null,  <br>  “accountNo”: null  <br>} |
| Valid | IBAN is successfully generated when the combination of Account number, Branch code and country are provided as input | {  <br>  “accountUri”: null,  <br>  “country”: “ITA”,  <br>  “branchCode”: “2004101005”,  <br>  “accountNo”: “0500013026”  <br>} |
| Invalid | IBAN is not generated due to invalid checksum of legacy account number | Send the below request where accountNo should end with ‘ER00216’  <br>  <br>{  <br>  “accountUri”: {  <br>    “type”: “ban”,  <br>    “value”: “10604511619000000000001”  <br>  },  <br>  “country”: “ITA”,  <br>  “branchCode”: “0604511619”,  <br>  “accountNo”: “000000000001ER00216”  <br>} |
| Invalid | IBAN is not generated due to invalid bank identifier | Send the below request where accountNo should end with ‘ER00203’  <br>  <br>{  <br>  “accountUri”: {  <br>    “type”: “ban”,  <br>    “value”: “10604511619000000000001”  <br>  },  <br>  “country”: “ITA”,  <br>  “branchCode”: “0601111619”,  <br>  “accountNo”: “0500013026ER00203”  <br>} |

# Sample Request

```JSON
{
  "accountUri": {
    "type": "ban",
    "value": "20041010050500013M02606"
  },
  "country": "FRA",
  "branchCode": "2004101005",
  "accountNo": "0500013026"
}
```

# Sample Response

## 1.Successful IBAN Generation Response:

```JSON
{
  "ibanDetails": {
    "accounts": {
      "account": [
        {
          "type": "IBAN",
          "value": "FR1420041010050500013M02606"
        },
        {
          "type": "BAN",
          "value": "20041010050500013M02606"
        }
      ]
    },
    "bank": {
      "bic": {
        "type": "SWIFT BIC",
        "value": "PSSTFRPPLIL"
      },
      "name": "La Banque Postale",
      "branchName": "Centre de Lille",
      "branchCode": "2004101005",
      "address": {
        "line1": "3 R Paul Duez",
        "city": "Lille",
        "postalCode": "59900 Cedex 9",
        "country": "FRA"
      }
    }
  }
}
```

## 2\. Rejected IBAN generation response for invalid input value.

```JSON
{
  "Errors": {
    "Error": [
      {
        "RequestId": "3969",
        "Source": "country",
        "ReasonCode": "INVALID_INPUT_VALUE",
        "Description": "Invalid Input Value",
        "Recoverable": "false",
        "Details": {
          "Detail": [
            {
              "Name": "ErrorDetailCode",
              "Value": "082000"
            }
          ]
        }
      }
    ]
  }
}
```

## 3\. Rejected IBAN generation response for invalid bank identifier.

```JSON
{
  "Errors": {
    "Error": [
      {
        "RequestId": "1716",
        "Source": "",
        "ReasonCode": "INVALID_BANK_IDENTIFIER",
        "Description": "Invalid bank identifier",
        "Recoverable": "false",
        "Details": {
          "Detail": [
            {
              "Name": "ErrorDetailCode",
              "Value": "130305"
            }
          ]
        }
      }
    ]
  }
}
```

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/iban-generation-api/#environment-domains)
*   [API Specification](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/iban-generation-api/#api-specification)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/iban-generation-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/iban-generation-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/iban-generation-api/#sandbox-testing)
*   [Sample Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/iban-generation-api/#sample-request)
*   [Sample Response](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/iban-generation-api/#sample-response)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/iban-generation-api/#error-codes)


---
title: Cash Pickup Locations API
---

The Cash Pickup API is an optional service that allows customers to access a directory of eligible cash pickup locations visible to the sender. This API allows data filtering as per various parameters that include location types, country, city, and currency, offering customization for various program preferences and needs.  

> [!NOTE]
> 
> Customers must opt-in to access the Cash Pickup API.

The Cash Pickup API has three cash pickup location types:

*   **Pickup Anywhere (PANY)**: This option allows cash pickup from any location of all available Receiving Service Providers (RSP) within the destination country. When the sender selects Pickup Anywhere option, the recipient has the flexibility to choose any convenient location for cash collection.  
    
*   **Within Network**: This option allows the recipient to pick up cash from any location of a particular RSP within the destination country. When the Sender selects to deliver cash to an Within Network RSP, the recipient has the flexibility to choose any of the cash pickup locations within the selected RSP network boundaries.  
    
*   **Directed**: This option provides a targeted solution for recipients who want to select a specific pickup location. Recipients collect their cash from one designated branch or retail site of a particular RSP in the destination country.
    

> [!ALERT]
> 
>   
> 
> If you are a customer contracted with Mastercard Transaction Services (MTS) EU or UK, proceed to [Cash Pickup API Specification for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-eu-cash-pickup-apis/) and [Cash Pickup API Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-uk-cash-pickup-apis/) respectively to ensure compliance with the relevant jurisdiction based on Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Service Directive (PSD2).

> [!NOTE]
> 
> For **Cash Pickup Type**, include the request parameters as specified:  
> 
> *   Pickup Anywhere : `PANY`
> *   Within Network : `IN_NETWORK`
> *   Directed: `DIRECT`

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/crossborder/cash-pickup
```

```Production
https://api.mastercard.com/crossborder/cash-pickup
```

> [!NOTE]
> 
> **Sandbox** and **MTF** environments share the same url but you can differentiate them by the partner ID.

# Catalog APIs

## Countries

*   Provides information about a list of supported countries where cash pickup is available for recipients.
*   This API is useful to retrieve the list of all cash pickup countries based on cash pickup type.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#operation/getCountries)

All the countries available for cash-pickup

Sandbox URL

https://sandbox.api.mastercard.com/crossborder/cash-pickup/countries?cash\_pickup\_type={cash\_pickup\_type}

Production URL

https://api.mastercard.com/crossborder/cash-pickup/countries?cash\_pickup\_type={cash\_pickup\_type}

  

## Cities

*   Provides information about a list of supported cities where cash pickup service is available. This API is useful to retrieve the list from specific city locations supporting _Branches_ type cash pickup.
*   The `CityName` available in the response helps to filter the Receiving Service Providers and specific locations.
*   The _Directed_ cash pickup type is for recipients who prefer to pick up cash from a specific designated locations.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#operation/getCities)

All the cities available for cash pickup. Applicable only for Directed Cash Pickup pickup.

Sandbox URL

https://sandbox.api.mastercard.com/crossborder/cash-pickup/cities?country={country}&currency={currency}&offset={offset}&limit={limit}

Production URL

https://api.mastercard.com/crossborder/cash-pickup/cities?country={country}&currency={currency}&offset={offset}&limit={limit}

  

## Receiving Service Providers

*   Provides information about the list of supported Receiving Service Providers offering cash pickup services.
*   This API helps to identify a particular provider for the _Within Network Cash Pickup_ type.
*   You can use this API for _Within RSP Network_ and _Branches_ type.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#operation/getProviders)

All the Receiving Service Providers available for cash pickup.

Sandbox URL

https://sandbox.api.mastercard.com/crossborder/cash-pickup/providers?country={country}&currency={currency}&cash\_pickup\_type={cash\_pickup\_type}&offset={offset}&limit={limit}

Production URL

https://api.mastercard.com/crossborder/cash-pickup/providers?country={country}&currency={currency}&cash\_pickup\_type={cash\_pickup\_type}&offset={offset}&limit={limit}

  

## Branches

*   Provides information about locations specific to supported Receiving Service Providers that offer cash pickup services.
*   The API helps to identify a particular location for _DirectCash Pickup Location_ cash pickup type.
*   Enter the `branchCode` you get in the response, in the `bankCode` field of the Payment API request.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#operation/getBranches)

All the available cash pickup locations for a specific Receiving Service Provider. Applicable only for Directed Cash Pickup pickup.

Sandbox URL

https://sandbox.api.mastercard.com/crossborder/cash-pickup/branches?provider\_id={provider\_id}&state={state}&city={city}&offset={offset}&limit={limit}

Production URL

https://api.mastercard.com/crossborder/cash-pickup/branches?provider\_id={provider\_id}&state={state}&city={city}&offset={offset}&limit={limit}

For further information on URL and input parameter restrictions, refer to the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) section.

*   **Formats supported**: JSON
*   **HTTP version**: 1.0/ 1.1
*   **Required HTTP header parameters**:
    *   `content-type` : Format of submitting the inbound content. Example: `application/json`
    *   `content-length`: Length of the inbound content body in octets.
    *   `partner-id`: String of alphanumeric special characters with a max length of 35. Example: `mts_4_006_interfaceid`.

> [!NOTE]
> 
> Mastercard recommends that you must update the catalog data once a week using the Catalog APIs.

# API Convention

Refer to the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) section for general guidelines.

# Payload Encryption

Encrypt all the request payload before sending them to Mastercard. Similarly, you must decrypt the payload sent by Mastercard.  
For more detailed information, refer to the [Encryption and Decryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/) section.

# Sandbox Testing

You can make API calls to the Sandbox environment from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/). This involves creating a project in Mastercard Developers, using the Sandbox keys to generate the required OAuth 1.0a Authorization Header.

> [!TIP]
> 
>   
> 
> *   During the onboarding process, Mastercard assigns a registered partner ID to test in the higher environments (MTF and Production). Customers cannot access the Sandbox environment using this partner ID but can still access the Sandbox by using the non-registered partner ID.
> *   You can use any correctly formatted partner ID in the Sandbox.
> *   As a best practice, use the first 15 digits of your institution name (alphanumeric and/or special characters, no spaces) as the partner ID.
> *   For testing in the Sandbox environment, use the unique `transaction_reference` on each run.

> [!NOTE]
> 
>   
> 
> *   The Sandbox does not return parameters unique to a specific customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment.
> *   After completion of the Sandbox testing, Mastercard assigns a project manager for customers meeting the eligibility requirements for integrated testing in the MTF environment.
> *   The MTF environment has configuration to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the customer.

# Sample Requests

## Common Request Headers

*   _Content-Type:_ application/json;charset=UTF-8
*   _Partner-Id:_ mts\_4\_006\_interfaceid

### 1\. Get countries based on cash pickup type

```http
https://sandbox.api.mastercard.com/crossborder/cash-pickup/countries?cash_pickup_type=PANY
```

*   _HTTP Method:_ GET
*   _Endpoint:_ `/crossborder/cash-pickup/countries`
*   _Query Parameters:_ `cash_pickup_type=PANY`
    
    > [!NOTE]
    > 
    > Here PANY is an example of cash pickup type.
    

### 2\. Get Cities based on the country and currency

```http
https://sandbox.api.mastercard.com/crossborder/cash-pickup/cities?country=GTM&currency=GTQ&offset=0&limit=2
```

*   _HTTP Method:_ GET
*   _Endpoint:_ `/crossborder/cash-pickup/cities`
*   _Query Parameters:_
    *   `country: GTM`
    *   `currency: GTQ`
    *   `offset: 0`
    *   `limit: 2`

### 3\. Get Receiving Services Providers based on the country and currency

```http
https://sandbox.api.mastercard.com/crossborder/cash-pickup/providers?country=ARE&currency=AED&cash_pickup_type=IN_NETWORK&offset=0&limit=5
```

_HTTP Method:_ GET

*   _Endpoint:_ `/crossborder/cash-pickup/providers`
*   _Query Parameters:_
    *   `country: ARE`
    *   `currency: AED`
    *   `cash_pickup_type: IN_NETWORK`
    *   `offset: 0`
    *   `limit: 5`

### 4\. Get Branches based on the provider ID

```http
https://sandbox.api.mastercard.com/crossborder/cash-pickup/branches?provider_id=ff1d9901-8e09-4840-b62b-464a22b1dd4e
```

*   _HTTP Method:_ GET
*   _Endpoint:_ `/crossborder/cash-pickup/branches`
*   _Query Parameters:_ `provider_id: ff1d9901-8e09-4840-b62b-464a22b1dd4e`

# Sample Responses

This section provides sample Cash Pickup API responses for different types of cash pickup locations.

## Cash Pickup Anywhere

### 1\. Get countries based on cash\_pickup\_type = PANY

Customers submit `PANY` payments through Payment API and provide the destination country in VSF 701. No additional catalog details related to `PANY` are required in the payment request. Customers can use the Get Countries API to retrieve destination country and currency details while initiating the payment.

#### Successful Get Countries API Response

> [!NOTE]
> 
> Results are based on the cash pickup type. This example shows the result for `"cashPickupType": "PANY"`.

```JSON
[
  {
    "items": [
      {
        "countryAlpha3": "QAT",
        "currency": "QAR",
        "cashPickupType": "PANY"
      },
      {
        "countryAlpha3": "BHR",
        "currency": "BHD",
        "cashPickupType": "PANY"
      },
      {
        "countryAlpha3": "GMB",
        "currency": "GMD",
        "cashPickupType": "PANY"
      },
      {
        "countryAlpha3": "ARE",
        "currency": "AED",
        "cashPickupType": "PANY"
      },
      {
        "countryAlpha3": "GIN",
        "currency": "GNF",
        "cashPickupType": "PANY"
      },
      {
        "countryAlpha3": "BFA",
        "currency": "XOF",
        "cashPickupType": "PANY"
      }
    ]
  }
]

```

## Within RSP Network

Customers submit `IN_NETWORK` payments through Payment API network and provide:

*   Destination country in VSF 701
*   Provider code in the bank code field

To retrieve the provider code, customers must call the following APIs in sequence:

### 1\. Get Countries API

#### Successful Get Countries API Response

```JSON
[
  {
    "items": [
      {
        "countryAlpha3": "QAT",
        "currency": "QAR",
        "cashPickupType": "IN_NETWORK"
      },
      {
        "countryAlpha3": "IND",
        "currency": "INR",
        "cashPickupType": "IN_NETWORK"
      },
      {
        "countryAlpha3": "BHR",
        "currency": "BHD",
        "cashPickupType": "IN_NETWORK"
      },
      {
        "countryAlpha3": "VNM",
        "currency": "USD",
        "cashPickupType": "IN_NETWORK"
      }
    ]
  }
]

```

### 2\. Get Providers API

#### Successful Get Providers API Response

```JSON
{
  "count": 3,
  "offset": 0,
  "limit": 50,
  "total": 3,
  "items": [
    {
      "providerId": "6532b90f-166d-41da-95ed-a24045c80f3e",
      "providerCode": "JA04",
      "providerName": "JMMB MONEY TRANSFER LIMITED",
      "country": "JAM",
      "currency": "JMD",
      "cashPickupType": "IN_NETWORK"
    },
    {
      "providerId": "90becc19-4b5e-456d-ade0-371300dc4bef",
      "providerCode": "JA05",
      "providerName": "JN MONEY",
      "country": "JAM",
      "currency": "JMD",
      "cashPickupType": "IN_NETWORK"
    },
    {
      "providerId": "7a05c930-a8fd-424c-a2a8-c376b9db6457",
      "providerCode": "JM02",
      "providerName": "VMBS MONEY TRANSFER SERVICES LTD",
      "country": "JAM",
      "currency": "JMD",
      "cashPickupType": "IN_NETWORK"
    }
  ]
}
```

## Branches

Customers submit DIRECT payments through the Payment API and provide:

*   Destination country in VSF 701
*   Branch code in the bank code field

To retrieve branch code details, customers must call the following APIs in sequence:

### 1\. Get Countries API.

#### Successful Get Countries API Response

```JSON
[
  {
    "items": [
      {
        "countryAlpha3": "NGA",
        "currency": "NGN",
        "cashPickupType": "DIRECT"
      },
      {
        "countryAlpha3": "IND",
        "currency": "INR",
        "cashPickupType": "DIRECT"
      },
      {
        "countryAlpha3": "HND",
        "currency": "HNL",
        "cashPickupType": "DIRECT"
      },
      {
        "countryAlpha3": "IDN",
        "currency": "USD",
        "cashPickupType": "DIRECT"
      },
      {
        "countryAlpha3": "IDN",
        "currency": "IDR",
        "cashPickupType": "DIRECT"
      }
    ]
  }
]
```

### 2\. Get Cities API.

To retrieve state and city details, customers must pass the Country and Currency in the Get Cities API.

#### Successful Cities API Response

```JSON
{
  "count": 5,
  "offset": 1,
  "limit": 5,
  "total": 20,
  "items": [
    {
      "country": "PER",
      "currency": "PEN",
      "city": "LA OROYA",
      "stateName": "PERU"
    },
    {
      "country": "PER",
      "currency": "PEN",
      "city": "SURQUILLO",
      "stateName": "PERU"
    },
    {
      "country": "PER",
      "currency": "PEN",
      "city": "JAEN",
      "stateName": "PERU"
    },
    {
      "country": "PER",
      "currency": "PEN",
      "city": "MAIRANA",
      "stateName": "BOLIVIA"
    },
    {
      "country": "PER",
      "currency": "PEN",
      "city": "CHORRILLOS",
      "stateName": "PERU"
    }
  ]
}

```

### 3\. Get Providers

Helps to retrieve RSPs based on country, currency, cash pickup type, and city.

#### Successful Receiving Service Providers API Response

```JSON
{
  "count": 1,
  "offset": 0,
  "limit": 50,
  "total": 1,
  "items": [
    {
      "providerId": "cf64ecdf-2823-44bb-9067-f7aeaca56c70",
      "providerCode": "PE29",
      "providerName": "BANCO DE CREDITO PERU - TN",
      "country": "PER",
      "currency": "PEN",
      "cashPickupType": "DIRECT"
    }
  ]
}

```

### 4\. Get Branches

Helps to retrieve branch-level details by passing the Provider ID from Get Providers API.

#### Successful Specific Location API Response

```JSON
{
  "count": 2,
  "offset": 0,
  "limit": 50,
  "total": 2,
  "items": [
    {
      "providerId": "78dabafc-c1a5-4fd8-959d-37334fc41a67",
      "providerCode": "PE24",
      "providerName": "JET PERU S.A.",
      "country": "PER",
      "currency": "USD",
      "cashPickupType": "DIRECT",
      "branchId": "6831b131-bb35-4e1d-ab14-faaf5892a7e1",
      "branchCode": "PE240314",
      "branchCity": "INDEPENDENCIA",
      "branchState": "PERU",
      "branchAddress": "AV. ALFREDO MENDIOLA NO.3900 LOC. 1160 SUPERMERCADO METRO"
    },
    {
      "providerId": "78dabafc-c1a5-4fd8-959d-37334fc41a67",
      "providerCode": "PE24",
      "providerName": "JET PERU S.A.",
      "country": "PER",
      "currency": "USD",
      "cashPickupType": "DIRECT",
      "branchId": "275bc15a-a9f7-4b98-b728-3a4986bc5b13",
      "branchCode": "PE240292",
      "branchCity": "INDEPENDENCIA",
      "branchState": "PERU",
      "branchAddress": "AV. GERARDO UNGER 6911 LOCAL LB-82 C.C. PLAZA NORTE TERMINAL TERRESTRE"
    }
  ]
}

```

## Sample Retrieve Failures

This section provides examples of error responses returned by Retrieve APIs.

### Rejected Response With Error Codes

#### 1.Invalid Input Value

##### Error Response

```JSON
{
  "Errors": {
    "Error": [
      {
        "RequestId": "2ra9lyarftumf01dpjnmo6jnw5",
        "Source": "cash_pickup_type",
        "ReasonCode": "MISSING_REQUIRED_INPUT",
        "Description": "Missing Required Input",
        "Recoverable": false,
        "Details": {
          "Detail": [
            {
              "name": "ErrorDetailCode",
              "value": "092000"
            }
          ]
        }
      }
    ]
  }
}

```

#### 2.Unauthorized Access

##### Error Response

```JSON
{
  "Errors": {
    "Error": [
      {
        "Source": "SYSTEM",
        "RequestId": "0.bf58d617.1729858126.38c9719",
        "ReasonCode": "AUTHORIZATION_FAILED",
        "Description": "Unauthorized Access",
        "Recoverable": "false",
        "Details": {
          "Detail": {
            "Name": "ErrorDetailCode",
            "Value": "050007"
          }
        }
      }
    ]
  }
}

```

## Sample Payment Request

A few samples of successful payment request as per the request parameters are:

### PANY

#### Sample Payment With Proposal ID

```XML
<paymentrequest>
  <transaction_reference>0653d8effce785434a8f353</transaction_reference>
  <proposal_id>23aees8siaftk05tc19lxy0afv</proposal_id>
  <sender_account_uri>tel:+54010894</sender_account_uri>
  <recipient_account_uri>ewallet:abcdefgh.fghh;sp=transpay</recipient_account_uri>
  <sender>
    <first_name>John</first_name>
    <middle_name>L</middle_name>
    <last_name>Doe</last_name>
    <nationality>USA</nationality>
    <address>
      <line1>123MainStreet</line1>
      <line2>#5A</line2>
      <city>Arlington</city>
      <country_subdivision>NA</country_subdivision>
      <postal_code>12345</postal_code>
      <country>USA</country>
    </address>
    <date_of_birth>1980-01-20</date_of_birth>
  </sender>
  <recipient>
    <first_name>John</first_name>
    <middle_name>L</middle_name>
    <last_name>Doe</last_name>
    <nationality>USA</nationality>
    <address>
      <line1>123MainStreet</line1>
      <line2>#5A</line2>
      <city>Arlington</city>
      <country_subdivision>NA</country_subdivision>
      <postal_code>12345</postal_code>
      <country>CAN</country>.</address>
    <email>customer@gmail.com</email>
  </recipient>
  <source_of_income>Regular Income</source_of_income>
  <receiving_bank_name>Royal Exchange</receiving_bank_name>
  <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
  <payment_file_identifier>123456789</payment_file_identifier>
  <fx_type>
    <forward>
      <sender_currency>USD</sender_currency>
    </forward>
  </fx_type>
  <payment_type>P2P</payment_type>
  <additional_data>
    <data_field>
      <name>7260</name>
      <value>CASH</value>
    </data_field>
    <data_field>
      <name>701</name>
      <value>ISR</value>
    </data_field>
  </additional_data>
</paymentrequest>
```

### IN NETWORK

#### Sample Payment With Carded Rate ID

```XML
<paymentrequest>
  <transaction_reference>{% uuid 'v4' %}</transaction_reference>
  <sender_account_uri>tel:+254167419</sender_account_uri>
  <recipient_account_uri>ewallet:abcdefgh.fghh;sp=transpay</recipient_account_uri>
  <payment_amount>
    <amount>100.12</amount>
    <currency>USD</currency>
  </payment_amount>
  <payment_origination_country>USA</payment_origination_country>
  <bank_code>JM04</bank_code>
  <payment_type>P2P</payment_type>
  <card_rate_id>1001z7atjei9t01ilf78s32vuy5</card_rate_id>
  <sender>
    <first_name>John</first_name> <middle_name>L</middle_name>  <last_name>Doe</last_name>
    <nationality>USA</nationality>
    <address>
      <line1>123MainStreet</line1>  <line2>#5A</line2>   <city>Arlington</city>
      <country_subdivision>NA</country_subdivision>
      <postal_code>12345</postal_code>
      <country>USA</country>
    </address>
    <date_of_birth>1980-01-20</date_of_birth>
  </sender>
  <recipient>
    <first_name>John</first_name>  <middle_name>L</middle_name>  <last_name>Doe</last_name>
    <nationality>JAM</nationality>
    <address>
      <line1>123MainStreet</line1>  <line2>#5A</line2>  <city>Arlington</city>
      <country_subdivision>NA</country_subdivision>
      <postal_code>12345</postal_code>
      <country>JAM</country>
    </address>
    <email>customer@gmail.com</email>
  </recipient>
  <source_of_income>Regular Income</source_of_income>
  <receiving_bank_name>Royal Exchange</receiving_bank_name>
  <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
  <payment_file_identifier>123456789</payment_file_identifier>
  <receiver_currency>JMD</receiver_currency>
  <additional_data>
    <data_field>
      <name>7260</name>
      <value>CASH</value>
    </data_field>

    <data_field>
      <name>701</name>
      <value>JAM</value>
    </data_field>
  </additional_data>
</paymentrequest>
```

### DIRECT

#### Sample Payment With One Shot

```XML
<paymentrequest>
  <transaction_reference>{% uuid 'v4' %}</transaction_reference>
  <sender_account_uri>tel:+254167419</sender_account_uri>
  <recipient_account_uri>ewallet:abcdefgh.fghh;sp=transpay</recipient_account_uri>
  <payment_amount>
    <amount>50.00</amount>
    <currency>USD</currency>
  </payment_amount>
  <payment_origination_country>USA</payment_origination_country>
  <bank_code>PE240294</bank_code>
  <payment_type>P2P</payment_type>
  <sender>
    <first_name>Jerry</first_name>
    <middle_name>L</middle_name>
    <last_name>Doe</last_name>
    <nationality>USA</nationality>
    <address>
      <line1>123MainStreet</line1>
      <line2>#5A</line2>
      <city>Arlington</city>
      <country_subdivision>NA</country_subdivision>
      <postal_code>12345</postal_code>
      <country>USA</country>
    </address>
    <date_of_birth>1980-01-20</date_of_birth>
    <government_ids>
      <government_id_uri>ppn:123456789;expiration-date=2024-05-27;issue-date=2011-07-12;country=USA</government_id_uri>
    </government_ids>
  </sender>
  <recipient>
    <first_name>ABC</first_name>
    <middle_name>L</middle_name>
    <last_name>Doe</last_name>
    <nationality>USA</nationality>
    <address>
      <line1>PERU</line1>
      <line2>Canton Vi Pila</line2>
      <city>HUARAL</city>
      <country_subdivision>PER</country_subdivision>
      <postal_code>41002</postal_code>
      <country>PER</country>
    </address>
    <email>customer@gmail.com</email>
  </recipient>
  <fx_type>
    <forward>
      <fees_included>true</fees_included>
      <receiver_currency>PEN</receiver_currency>
    </forward>
  </fx_type>
  <additional_data>

    <data_field>
      <name>701</name>
      <value>PER</value>
    </data_field>

    <data_field>
      <name>7260</name>
      <value>CASH</value>
    </data_field>

  </additional_data>
</paymentrequest>
```

# Error Codes

Refer to the complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes applicable to your API requests, refer to the [HTTP response codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/) section.

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#environment-domains)
*   [Catalog APIs](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#catalog-apis)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#sandbox-testing)
*   [Sample Requests](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#sample-requests)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cashpickup-api/#error-codes)

---
title: Endpoint Guide API
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, please proceed to [Endpoint Guide API Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-eu-endpoint-guide-adapter-api/) and [Endpoint Guide Adapter API Specifications for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-uk-endpoint-guide-adapter-api/) respectively to ensure compliance with the relevant jurisdiction based Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

The Endpoint Guide API serves as a comprehensive reference for retrieving configuration and operational details across all payment corridors. It provides structured information on both mandatory and optional request parameters, tailored to specific endpoint attributes such as destination currency, destination country, payment instrument, and payment type.

The API categorizes data into:

1.  Core data: Core request fields to be provided in the payment/quote request.
2.  Additional data: Optional or conditional fields required by the system for successful transaction processing or compliance and regulatory purposes.

This design ensures that integrators and partners can dynamically adapt their requests based on corridor-specific requirements, improving accuracy and reducing integration effort.

> [!TIP]
> 
> The API call should not be integrated in the Payment API. It is recommended to cache the endpoint guide specifications and refresh them once a week for better system performance. For any upcoming updates, please refer to the **Customer Notice** for **Payout Service Updates** to determine any additional refresh needed.

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/crossborder/endpoint-guide/specifications?payment_type={payment_type}&destination_country={destination_country}&destination_currency={destination_currency}&destination_payment_instrument={destination_payment_instrument}
```

```Production
https://api.mastercard.com/crossborder/endpoint-guide/specifications?payment_type={payment_type}&destination_country={destination_country}&destination_currency={destination_currency}&destination_payment_instrument={destination_payment_instrument}
```

> [!NOTE]
> 
>   
> 
> *   **Sandbox** and **MTF** environments share the same URL but are differentiated by partner ID.
> *   In the Sandbox environment, the technical rules are governed by generic endpoints setup.
> *   This API provides the specific rules for the given corridor after the customer has been onboarded.
> *   Hence, there is a possibility of differences in the rules across Sandbox and MTF environments.

# API

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/endpoint-guide-adapter_api/#operation/getDataRequirementFields)

Get a structured list of field-level requirements by providing endpoint details.

Production Server

https://api.mastercard.com/crossborder/endpoint-guide/specifications

MTF Server

https://sandbox.api.mastercard.com/crossborder/endpoint-guide/specifications

Sandbox server

https://sandbox.api.mastercard.com/crossborder/endpoint-guide/specifications

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/json  
    accept: Format of the inbound content being submitted. example: application/json  
    X-Mc-Correlation-Id : A unique correlation ID for tracking the request.  
    Partner-Ref-Id : A unique reference ID of the business partner.

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

## Sandbox Test cases

Use payment type, destination country, destination currency and destination payment instrument of a corridor for which the information is needed.

# Sample Requests

No Request body

# Sample Responses

## Retrieve Technical Data Requirements

#### Successful Response:

A example of successful Retrieve call are:  

```JSON
 [
  {
    "paymentType": "B2B",
    "destinationCountry": "PHL",
    "destinationCurrency": "PHP",
    "destinationPaymentInstrument": "BANK",
    "technical": {
      "specialNotes": "Deposit to Debit and Credit Card accounts, or 16 digit account numbers are not accepted\r\n\r\nMetrobank: 10 or 13 digit account #\r\nUnionbank: 12 digit account #",
      "lastUpdatedTime": "2025-05-14 00:54:27.0",
      "fields": [
        {
          "fieldName": "payment_type",
          "mandatory": "Yes",
          "supportedValues": [
            {
              "id": "1",
              "name": "B2B"
            }
          ]
        },
        {
          "fieldName": "recipient_account_uri",
          "mandatory": "Yes",
          "validationPattern": "^[0-9]{3,35}$"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "180",
          "additionalFieldName": "Sender relationship with beneficiary",
          "specialNotes": "Mandatory if equal to or above PHP 500,000",
          "lastUpdatedTime": "2025-05-14T00:53:32.000+00:00"
        },
        {
          "fieldName": "recipient.organization_name",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z-]{2,}([ ]{1}[a-zA-Z-]{2,}){1,3}$",
          "specialNotes": "Full legal name required. Avoid using acronyms or abbreviations unless they are officially part of the legal name.",
          "lastUpdatedTime": "2025-05-14T00:53:40.000+00:00"
        },
        {
          "fieldName": "source_of_income",
          "mandatory": "No",
          "validationPattern": "^[0-9a-zA-Z- ]{0,60}$",
          "specialNotes": "Mandatory if equal to or above PHP 500,000",
          "lastUpdatedTime": "2025-05-14T00:53:36.000+00:00",
          "supportedValues": [
            {
              "id": "1",
              "name": "ACCUMULATED OWN SALARY"
            },
            {
              "id": "2",
              "name": "BUSINESS"
            },
            {
              "id": "3",
              "name": "EMPLOYEES SALARY"
            },
            {
              "id": "4",
              "name": "FAMILY INCOME"
            },
            {
              "id": "5",
              "name": "LOANS"
            },
            {
              "id": "6",
              "name": "LOTTERY"
            },
            {
              "id": "7",
              "name": "PART TIME JOB"
            },
            {
              "id": "8",
              "name": "PENSION"
            },
            {
              "id": "9",
              "name": "SALARY AND OVERTIME"
            },
            {
              "id": "10",
              "name": "SAVINGS OR ACCUMULATED"
            },
            {
              "id": "11",
              "name": "BANK WITHDRAWAL"
            },
            {
              "id": "12",
              "name": "BONUS/FINAL SETTLEMENT BY THE EMPLOYER"
            },
            {
              "id": "13",
              "name": "OTHERS"
            },
            {
              "id": "14",
              "name": "INVESTMENTS"
            },
            {
              "id": "15",
              "name": "GIFT OR INHERITANCE"
            },
            {
              "id": "16",
              "name": "PROCEEDS OF SALE"
            },
            {
              "id": "17",
              "name": "WINNINGS"
            }
          ]
        },
        {
          "fieldName": "sender.address.line2",
          "mandatory": "Yes",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "lastUpdatedTime": "2025-05-14T00:53:33.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "^[0-9]{0,15}$",
          "additionalFieldId": "222",
          "additionalFieldName": "Recipient landline number",
          "lastUpdatedTime": "2025-05-14T00:53:40.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "Yes",
          "validationPattern": "^([0-9]{4}-[0-9]{2}-[0-9]{2}){0,1}$",
          "additionalFieldId": "260",
          "additionalFieldName": "Recipients Date of Birth",
          "lastUpdatedTime": "2025-05-14T00:53:39.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "261",
          "additionalFieldName": "Recipient Place of Birth",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:39.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "Yes",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "701",
          "additionalFieldName": "Destination Country",
          "lastUpdatedTime": "2025-05-14T00:53:38.000+00:00"
        },
        {
          "fieldName": "sender.last_name",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z-]{2,}([ ]{1}[a-zA-Z-]{2,}){1,3}$",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:36.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "^([a-zA-Z-]{2,}([ ]{1}[a-zA-Z-]{2,}){0,3}){0,1}$",
          "additionalFieldId": "108",
          "additionalFieldName": "Sender Alias Name",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:38.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1162",
          "additionalFieldName": "Intermediary Agent 2 Name",
          "lastUpdatedTime": "2025-05-14T00:53:35.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1163",
          "additionalFieldName": "Intermediary Agent 3 Name",
          "lastUpdatedTime": "2025-05-14T00:53:33.000+00:00"
        },
        {
          "fieldName": "recipient.address.line2",
          "mandatory": "Yes",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:36.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "501",
          "additionalFieldName": "Maximum Cash Pickup Duration",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:37.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "1200",
          "additionalFieldName": "Destination Service Tag",
          "specialNotes": "PHL-BK",
          "lastUpdatedTime": "2025-05-14T00:53:34.000+00:00",
          "supportedValues": [
            {
              "id": "1",
              "name": "PHL-BK"
            }
          ]
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "7260"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1160",
          "additionalFieldName": "Ultimate Debtor Name",
          "lastUpdatedTime": "2025-05-14T00:53:35.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "409",
          "additionalFieldName": "Additional Communication",
          "lastUpdatedTime": "2025-05-14T00:54:23.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1161",
          "additionalFieldName": "Intermediary Agent 1 Name",
          "lastUpdatedTime": "2025-05-14T00:53:35.000+00:00"
        },
        {
          "fieldName": "payment_origination_country",
          "mandatory": "Yes",
          "validationPattern": "^([a-zA-Z]{3}){0,1}$",
          "lastUpdatedTime": "2025-05-14T00:53:36.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "^[0-9a-zA-Z- ]{0,30}$",
          "additionalFieldId": "170",
          "additionalFieldName": "Sender Occupation",
          "specialNotes": "Mandatory if equal to or above PHP 500,000",
          "lastUpdatedTime": "2025-05-14T00:54:26.000+00:00",
          "supportedValues": [
            {
              "id": "1",
              "name": "ADMINISTRATIVE"
            },
            {
              "id": "2",
              "name": "ANALYTICAL & STATISTICAL"
            },
            {
              "id": "3",
              "name": "ARTS"
            },
            {
              "id": "4",
              "name": "CUSTOMER SERVICE"
            },
            {
              "id": "5",
              "name": "DOMESTIC ASSISTANCE"
            },
            {
              "id": "6",
              "name": "EDUCATION"
            },
            {
              "id": "7",
              "name": "FINANCE"
            },
            {
              "id": "8",
              "name": "FOOD"
            },
            {
              "id": "9",
              "name": "HEALTH"
            },
            {
              "id": "10",
              "name": "HOSPITALITY"
            },
            {
              "id": "11",
              "name": "LABOR"
            },
            {
              "id": "12",
              "name": "LEGAL"
            },
            {
              "id": "13",
              "name": "LEISURE"
            },
            {
              "id": "14",
              "name": "MEDIA"
            },
            {
              "id": "23",
              "name": "NOT EMPLOYED"
            },
            {
              "id": "15",
              "name": "PRODUCTION"
            },
            {
              "id": "16",
              "name": "PUBLIC SERVICE"
            },
            {
              "id": "17",
              "name": "SALES"
            },
            {
              "id": "18",
              "name": "SCIENCE"
            },
            {
              "id": "19",
              "name": "SECURITY"
            },
            {
              "id": "20",
              "name": "SPORTS & FITNESS"
            },
            {
              "id": "21",
              "name": "TECHNOLOGY"
            },
            {
              "id": "22",
              "name": "TRADES / SKILLED"
            }
          ]
        },
        {
          "fieldName": "sender.address.line1",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z0-9.\\s,\\-:#_\/]{0,200}$",
          "lastUpdatedTime": "2025-05-14T00:53:33.000+00:00"
        },
        {
          "fieldName": "recipient.government_ids[].government_id_uri",
          "mandatory": "Yes",
          "validationPattern": "^(ppn|ssn|ein|tin|aln|cus|idc|dln):[A-Za-z0-9]{1,80}(;expiration-date=\\d{4}-\\d{2}-\\d{2})?$",
          "lastUpdatedTime": "2025-05-14T00:53:37.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1159",
          "additionalFieldName": "Debtor Agent Address Country",
          "lastUpdatedTime": "2025-05-14T00:54:25.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "410",
          "additionalFieldName": "Communication Field",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:33.000+00:00"
        },
        {
          "fieldName": "recipient.address.line1",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z0-9.\\s,\\-:#_\/]{0,200}$",
          "lastUpdatedTime": "2025-05-14T00:53:37.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1154",
          "additionalFieldName": "Debtor Agent Address Street 1",
          "lastUpdatedTime": "2025-05-14T00:54:24.000+00:00"
        },
        {
          "fieldName": "sender.date_of_birth",
          "mandatory": "Yes",
          "validationPattern": "^([0-9]{4}-[0-9]{2}-[0-9]{2}){0,1}$",
          "specialNotes": "Mandatory if equal to or above PHP 500,000",
          "lastUpdatedTime": "2025-05-14T00:54:23.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "257"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1157",
          "additionalFieldName": "Debtor Agent Address Zip",
          "lastUpdatedTime": "2025-05-14T00:54:26.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1158",
          "additionalFieldName": "Debtor Agent Address State",
          "lastUpdatedTime": "2025-05-14T00:54:25.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1155",
          "additionalFieldName": "Debtor Agent Address Street 2",
          "lastUpdatedTime": "2025-05-14T00:54:24.000+00:00"
        },
        {
          "fieldName": "recipient.nationality",
          "mandatory": "No",
          "validationPattern": "^([a-zA-Z]{3}){0,1}$",
          "lastUpdatedTime": "2025-05-14T00:54:22.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1156",
          "additionalFieldName": "Debtor Agent Address City",
          "lastUpdatedTime": "2025-05-14T00:54:26.000+00:00"
        },
        {
          "fieldName": "recipient.email",
          "mandatory": "No",
          "validationPattern": "^([a-zA-Z0-9.!#$%&â€™*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*){0,1}$",
          "lastUpdatedTime": "2025-05-14T00:53:41.000+00:00"
        },
        {
          "fieldName": "receiving_bank_name",
          "mandatory": "No",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:40.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "1150",
          "additionalFieldName": "Debtor Agent Name",
          "lastUpdatedTime": "2025-05-14T00:54:27.000+00:00"
        },
        {
          "fieldName": "sender.address.postal_code",
          "mandatory": "No",
          "validationPattern": "^[0-9a-zA-Z]{0,10}$",
          "specialNotes": "Only mandatory if sender address country is USA or Canada. Format according to the respective official country address standard.",
          "lastUpdatedTime": "2025-05-14T00:53:33.000+00:00"
        },
        {
          "fieldName": "sender.address.city",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "specialNotes": "Only mandatory if sender address country is USA or Canada. Format according to the respective official country address standard.",
          "lastUpdatedTime": "2025-05-14T00:53:41.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "^[0-9]{0,15}$",
          "additionalFieldId": "121",
          "additionalFieldName": "Sender Mobile Phone Number",
          "lastUpdatedTime": "2025-05-14T00:54:27.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "^[0-9]{0,15}$",
          "additionalFieldId": "122",
          "additionalFieldName": "Sender Landline Number",
          "lastUpdatedTime": "2025-05-14T00:54:27.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "520",
          "additionalFieldName": "Recipient Notification",
          "lastUpdatedTime": "2025-05-14T00:53:34.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "161",
          "additionalFieldName": "Sender Place of Birth",
          "lastUpdatedTime": "2025-05-14T00:54:26.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "206",
          "additionalFieldName": "Recipient Middle Name (Other Language)",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:54:23.000+00:00"
        },
        {
          "fieldName": "sender.nationality",
          "mandatory": "Yes",
          "validationPattern": "^([a-zA-Z]{3}){0,1}$",
          "lastUpdatedTime": "2025-05-14T00:53:40.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "207",
          "additionalFieldName": "Recipient Last Name (Other Language)",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:38.000+00:00"
        },
        {
          "fieldName": "sender.organization_name",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z-]{2,}([ ]{1}[a-zA-Z-]{2,}){1,3}$",
          "specialNotes": "Full legal name required. Avoid using acronyms or abbreviations unless they are officially part of the legal name.",
          "lastUpdatedTime": "2025-05-14T00:53:39.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "Yes",
          "validationPattern": "^([a-zA-Z-]{2,}([ ]{1}[a-zA-Z-]{2,}){1,3}){0,}$",
          "additionalFieldId": "208",
          "additionalFieldName": "Recipient Alias Name",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:54:25.000+00:00"
        },
        {
          "fieldName": "sender.government_ids[].government_id_uri",
          "mandatory": "Yes",
          "validationPattern": "^(ppn|ssn|ein|tin|aln|cus|idc|dln):[A-Za-z0-9]{1,80}(;expiration-date=\\d{4}-\\d{2}-\\d{2})?$",
          "lastUpdatedTime": "2025-05-14T00:53:37.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "^([a-zA-Z0-9.!#$%&â€™*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*){0,1}$",
          "additionalFieldId": "125",
          "additionalFieldName": "Sender E-mail address",
          "lastUpdatedTime": "2025-05-14T00:54:25.000+00:00"
        },
        {
          "fieldName": "recipient.address.city",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "specialNotes": "Only mandatory if recipient address country is USA or Canada. Format according to the respective official country address standard.",
          "lastUpdatedTime": "2025-05-14T00:53:34.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "401",
          "additionalFieldName": "Originating Instrument Type",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:54:24.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "204",
          "additionalFieldName": "Recipientâ€‹ Name (English language)",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:54:23.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "205",
          "additionalFieldName": "Recipient First Name (Other Language)",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:36.000+00:00"
        },
        {
          "fieldName": "recipient.last_name",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z-]{2,}([ ]{1}[a-zA-Z-]{2,}){1,3}$",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:41.000+00:00"
        },
        {
          "fieldName": "bank_code",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "lastUpdatedTime": "2025-05-14T00:54:22.000+00:00"
        },
        {
          "fieldName": "recipient.address.country",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z]{2}$",
          "lastUpdatedTime": "2025-05-14T00:53:43.000+00:00"
        },
        {
          "fieldName": "recipient.address.postal_code",
          "mandatory": "No",
          "validationPattern": "^[0-9a-zA-Z]{0,10}$",
          "specialNotes": "Only mandatory if recipient address country is USA or Canada. Format according to the respective official country address standard.",
          "lastUpdatedTime": "2025-05-14T00:53:39.000+00:00"
        },
        {
          "fieldName": "recipient.address.country_subdivision",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "specialNotes": "Only mandatory if recipient address country is USA or Canada. Format according to the respective official country address standard.",
          "lastUpdatedTime": "2025-05-14T00:53:35.000+00:00"
        },
        {
          "fieldName": "sender.address.country",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z]{2}$"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "270",
          "additionalFieldName": "Recipient Occupation",
          "lastUpdatedTime": "2025-05-14T00:54:22.000+00:00"
        },
        {
          "fieldName": "recipient.first_name",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z-]{2,}([ ]{1}[a-zA-Z-]{2,}){1,3}$"
        },
        {
          "fieldName": "recipient.phone",
          "mandatory": "No",
          "validationPattern": "^[0-9]{0,15}$",
          "specialNotes": "Mandatory if equal to or above PHP 500,000",
          "lastUpdatedTime": "2025-05-14T00:53:31.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "550",
          "additionalFieldName": "Transaction Target Type",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:54:22.000+00:00"
        },
        {
          "fieldName": "purpose_of_payment",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "specialNotes": "Mandatory if equal to or above PHP 500,000",
          "lastUpdatedTime": "2025-05-14T00:54:25.000+00:00",
          "supportedValues": [
            {
              "id": "1",
              "name": "FAMILY MAINTENANCE"
            },
            {
              "id": "2",
              "name": "EDUCATION"
            },
            {
              "id": "3",
              "name": "MEDICAL"
            },
            {
              "id": "4",
              "name": "TOURIST"
            },
            {
              "id": "6",
              "name": "PERSONAL"
            },
            {
              "id": "18",
              "name": "TRANSFER TO NRE ACCOUNT"
            },
            {
              "id": "21",
              "name": "INVESTMENT IN MUTUAL FUND/INSURANCE"
            },
            {
              "id": "22",
              "name": "INVESTMENT THROUGH BANK"
            },
            {
              "id": "23",
              "name": "PURCHASE OF REAL ESTATE"
            },
            {
              "id": "24",
              "name": "EDUCATION/TUITION/BOARDING"
            },
            {
              "id": "25",
              "name": "HOTEL ACCOMODATIONS"
            },
            {
              "id": "26",
              "name": "TRAVEL AGENT"
            },
            {
              "id": "28",
              "name": "UTILITY PROVIDER"
            },
            {
              "id": "29",
              "name": "TAX PAYMENT"
            },
            {
              "id": "30",
              "name": "LOAN PAYMENT TO BANK"
            },
            {
              "id": "31",
              "name": "PRIME MINISTERS NATIONAL RELIEF FUND (INDIA)"
            },
            {
              "id": "32",
              "name": "HOSPITAL OR MEDICAL INSTITUTION"
            },
            {
              "id": "43",
              "name": "TRADE RELATED SERVICES"
            },
            {
              "id": "44",
              "name": "TRADE REALISATION OF EXPORT BILLS"
            },
            {
              "id": "45",
              "name": "TRADE ADVANCE RECEIPT AGAINST EXPORT"
            }
          ]
        },
        {
          "fieldName": "sender.first_name",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z-]{2,}([ ]{1}[a-zA-Z-]{2,}){1,3}$",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:32.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "^[0-9]{0,10}$",
          "additionalFieldId": "430",
          "additionalFieldName": "Payer Payee Relationship"
        },
        {
          "fieldName": "sender.address.country_subdivision",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "specialNotes": "Only mandatory if sender address country is USA or Canada. Format according to the respective official country address standard.",
          "lastUpdatedTime": "2025-05-14T00:53:38.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "^[a-zA-Z]{0,3}$",
          "additionalFieldId": "630",
          "additionalFieldName": "Beneficiary Bank Account Type",
          "lastUpdatedTime": "2025-05-14T00:53:42.000+00:00"
        },
        {
          "fieldName": "fx_type.forward.receiver_currency",
          "mandatory": "Yes",
          "validationPattern": "^[a-zA-Z]{3}$",
          "specialNotes": "Not SupportedMandatory in case of Forward Flow",
          "lastUpdatedTime": "2025-05-14T00:53:34.000+00:00"
        },
        {
          "fieldName": "sender_account_uri",
          "mandatory": "Yes",
          "validationPattern": "^[0-9a-zA-Z+ ]{0,35}$",
          "specialNotes": "Ensure validation before mapping"
        },
        {
          "fieldName": "sender.middle_name",
          "mandatory": "No",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:54:24.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "510",
          "additionalFieldName": "Reference Timestamp",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:42.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "validationPattern": "[ -z\\n\\t\\p{L}Â°]{1,}",
          "additionalFieldId": "830",
          "additionalFieldName": "Requested Rate Id",
          "lastUpdatedTime": "2025-05-14T00:53:42.000+00:00"
        },
        {
          "fieldName": "additional_data",
          "mandatory": "No",
          "additionalFieldId": "831",
          "additionalFieldName": "Applied Rate Id",
          "lastUpdatedTime": "2025-05-14T00:53:42.000+00:00"
        },
        {
          "fieldName": "receiving_bank_branch_name",
          "mandatory": "No",
          "specialNotes": "Not Supported",
          "lastUpdatedTime": "2025-05-14T00:53:32.000+00:00"
        }
      ]
    }
  }
]
```

#### Rejected Response:

A few examples of Failed Retrieve calls are:  

#### 1.Rejected Response for Unknown Resource:

```JSON
{  
  "Errors": {    
    "Error": [      
      {       
        "Source": "endpoint",        
        "ReasonCode": "RESOURCE_UNKNOWN",        
        "Description": "Record Not Found",        
        "Recoverable": "false",        
        "Details": {          
          "Detail": {            
            "Name": "ErrorDetailCode",            
            "Value": "110507"
          }
        }
      }    
    ]
  }
}
```

#### 2.Rejected Response for Missing Required Input:

```JSON
{
  "Errors": {
    "Error": [
      {
        "Source": "Missing Required Input",
        "ReasonCode": "MISSING_REQUIRED_INPUT",
        "Description": "Missing required input value.",
        "Recoverable": "false",
        "Details": {
          "Detail": {
            "Name": "ErrorDetailCode",
            "Value": "092000"
          }
        }
      }
    ]
  }
}
```

#### 3.Rejected Response for Invalid Input Value:

```JSON
{
  "Errors": {
    "Error": [
      {
        "Source": "destCountry",
        "ReasonCode": "INVALID_INPUT_VALUE",
        "Description": "Invalid input Value",
        "Recoverable": "false",
        "Details": {
          "Detail": {
            "Name": "ErrorDetailCode",
            "Value": "082000"
          }
        }
      }
    ]
  }
}
```

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/endpoint-guide-adapter_api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/endpoint-guide-adapter_api/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/endpoint-guide-adapter_api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/endpoint-guide-adapter_api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/endpoint-guide-adapter_api/#sandbox-testing)
*   [Sample Requests](https://developer.mastercard.com/cross-border-services/documentation/api-ref/endpoint-guide-adapter_api/#sample-requests)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/endpoint-guide-adapter_api/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/endpoint-guide-adapter_api/#error-codes)

---
title: Status Change Push
---

The Status Change Push Notification is offered as an opt-in functionality to obtain a near real-time status update.  

*   For Customers using the [Quote Confirmation Service](https://developer.mastercard.com/cross-border-services/documentation/api-ref/quote-confirmation-apis/), the status is obtained for both a Quote and Payment Transaction.  
    
*   For Customers using Carded Rates, a status is obtained for the Transaction only.  
    
*   For Customers foregoing use of a Rate Identifier prior to submitting a Payment, be it a Quote API Proposal ID or a Carded Rate ID, a status is obtained for the Payment only.

# Environment Domains

The Status Change Push Notification is notification and electronic webhook to provide status updates on Customers using this service when leveraging Payment API, Payment with Quotes/Confirmed Quotes and Quote Confirmations.

# API

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/#operation/Status%20Change%20PUSH)

Provide near real-time payment status updates.

https://static.developer.mastercard.com/webhook

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/ json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example - application/json

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

Not Applicable

# Sample Requests

## 1\. Quote Status Update - “CONFIRMATION PENDING TO PENDING”

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "eventRef": "ABDGA51fdhskHkjlhjk78971212HLKHS",
  "eventType": "STATUS_CHG",
  "transactionReference": "0975453fsdhfwsdew74575734573GTRWDF_4747",
  "transactionType": "QUOTE",
  "quote": {
    "proposalId": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
    "confirmStatus": {
      "status": "PENDING",
      "pendingStage": "Expired",
      "statusTimestamp": "2021-06-25T15:41:00-05:00"
    },
    "proposals": [
      {
        "id": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
        "feesIncluded": true,
        "expirationDate": "2021-06-25T15:46:00-05:00",
        "quoteFxRate": 3.7833456828,
        "chargedAmount": {
          "amount": 19.52,
          "currency": "USD"
        },
        "creditedAmount": {
          "amount": 129.15,
          "currency": "GBP"
        },
        "principalAmount": {
          "amount": 164.45,
          "currency": "USD"
        },
        "additionalDataList": {
          "resourceType": "list",
          "itemCount": 1,
          "data": {
            "dataFields": [
              {
                "name": 700,
                "value": "USA"
              }
            ]
          }
        },
        "confirmationExpiryTime": "2021-06-25T15:46:00-05:00"
      }
    ]
  },
  "transactionHistories": [
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "PENDING",
      "stage": "Expired",
      "timestamp": "2021-06-25T15:41:00-05:00"
    },
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "PENDING",
      "stage": "Ambiguous",
      "timestamp": "2021-06-25T15:40:00-05:00"
    }
  ]
}
```

## 2\. Quote Status Update - “CONFIRMATION PENDING TO CONFIRM”

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "eventRef": "ABDGA51fdhskHkjlhjk78971212HLKHS",
  "eventType": "STATUS_CHG",
  "transactionReference": "0975453fsdhfwsdew74575734573GTRWDF_4747",
  "transactionType": "QUOTE",
  "quote": {
    "proposalId": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
    "confirmStatus": {
      "status": "CONFIRMED",
      "statusTimestamp": "2021-06-25T15:41:00-05:00"
    },
    "paymentSubmissionExpiryTime": "2021-06-25T19:41:08-05:00",
    "proposals": [
      {
        "id": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
        "feesIncluded": true,
        "expirationDate": "2021-06-25T15:46:00-05:00",
        "quoteFxRate": 3.7833456828,
        "chargedAmount": {
          "amount": 19.52,
          "currency": "USD"
        },
        "creditedAmount": {
          "amount": 129.15,
          "currency": "GBP"
        },
        "principalAmount": {
          "amount": 164.45,
          "currency": "USD"
        },
        "additionalDataList": {
          "resourceType": "list",
          "itemCount": 1,
          "data": {
            "dataFields": [
              {
                "name": 700,
                "value": "USA"
              }
            ]
          }
        },
        "confirmationExpiryTime": "2021-06-25T15:46:00-05:00"
      }
    ]
  },
  "transactionHistories": [
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "CONFIRMED",
      "timestamp": "2021-06-25T15:41:00-05:00"
    },
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "PENDING",
      "stage": "Ambiguous",
      "timestamp": "2021-06-25T15:40:00-05:00"
    }
  ]
}
```

## 3\. Quote Status Update - “CONFIRMATION PENDING TO REJECTED”

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "eventRef": "ABDGA51fdhskHkjlhjk78971212HLKHS",
  "eventType": "QUOTE_STATUS_CHG",
  "transactionReference": "0975453fsdhfwsdew74575734573GTRWDF_4747",
  "transactionType": "QUOTE",
  "quote": {
    "proposalId": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
    "confirmStatus": {
      "status": "REJECTED",
      "statusTimestamp": "2021-06-25T15:41:00-05:00",
      "errorCode": "130195",
      "errorMessage": "Confirmation requested for Expired Quote"
    },
    "proposals": [
      {
        "id": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
        "feesIncluded": true,
        "expirationDate": "2021-06-25T15:46:00-05:00",
        "quoteFxRate": 3.7833456828,
        "chargedAmount": {
          "amount": 19.52,
          "currency": "USD"
        },
        "creditedAmount": {
          "amount": 129.15,
          "currency": "GBP"
        },
        "principalAmount": {
          "amount": 164.45,
          "currency": "USD"
        },
        "additionalDataList": {
          "resourceType": "list",
          "itemCount": 1,
          "data": {
            "dataFields": [
              {
                "name": 700,
                "value": "USA"
              }
            ]
          }
        },
        "confirmationExpiryTime": "2021-06-25T15:46:00-05:00"
      }
    ]
  },
  "transactionHistories": [
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "REJECTED",
      "timestamp": "2021-06-25T15:41:00-05:00"
    },
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "PENDING",
      "stage": "Ambiguous",
      "timestamp": "2021-06-25T15:40:00-05:00"
    }
  ]
}
```

## 4\. Quote Status Update - “CANCELLATION PENDING TO PENDING”

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "eventRef": "ABDGA51fdhskHkjlhjk78971212HLKHS",
  "eventType": "STATUS_CHG",
  "transactionReference": "0975453fsdhfwsdew74575734573GTRWDF_4747",
  "transactionType": "QUOTE",
  "quote": {
    "proposalId": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
    "cancelStatus": {
      "status": "PENDING",
      "statusTimestamp": "2021-06-25T15:41:00-05:00"
    },
    "proposals": [
      {
        "id": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
        "feesIncluded": true,
        "expirationDate": "2021-06-25T15:46:00-05:00",
        "quoteFxRate": 3.7833456828,
        "chargedAmount": {
          "amount": 19.52,
          "currency": "USD"
        },
        "creditedAmount": {
          "amount": 129.15,
          "currency": "GBP"
        },
        "principalAmount": {
          "amount": 164.45,
          "currency": "USD"
        },
        "additionalDataList": {
          "resourceType": "list",
          "itemCount": 1,
          "data": {
            "dataFields": [
              {
                "name": 700,
                "value": "USA"
              }
            ]
          }
        },
        "confirmationExpiryTime": "2021-06-25T15:46:00-05:00"
      }
    ]
  },
  "transactionHistories": [
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "PENDING",
      "timestamp": "2021-06-25T15:41:00-05:00"
    },
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "PENDING",
      "stage": "Ambiguous",
      "timestamp": "2021-06-25T15:40:00-05:00"
    }
  ]
}
```

## 5\. Quote Status Update - “CANCELLATION PENDING TO CANCELLED”

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "eventRef": "ABDGA51fdhskHkjlhjk78971212HLKHS",
  "eventType": "STATUS_CHG",
  "transactionReference": "0975453fsdhfwsdew74575734573GTRWDF_4747",
  "transactionType": "QUOTE",
  "quote": {
    "proposalId": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
    "cancelStatus": {
      "status": "CANCELLED",
      "statusTimestamp": "2021-06-25T15:41:00-05:00"
    },
    "releasedReservedAmount": {
      "amount": 195.52,
      "currency": "USD"
    },
    "proposals": [
      {
        "id": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
        "feesIncluded": true,
        "expirationDate": "2021-06-25T15:46:00-05:00",
        "quoteFxRate": 3.7833456828,
        "chargedAmount": {
          "amount": 19.52,
          "currency": "USD"
        },
        "creditedAmount": {
          "amount": 129.15,
          "currency": "GBP"
        },
        "principalAmount": {
          "amount": 164.45,
          "currency": "USD"
        },
        "additionalDataList": {
          "resourceType": "list",
          "itemCount": 1,
          "data": {
            "dataFields": [
              {
                "name": 700,
                "value": "USA"
              }
            ]
          }
        },
        "confirmationExpiryTime": "2021-06-25T15:46:00-05:00"
      }
    ]
  },
  "transactionHistories": [
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "CANCELLED",
      "timestamp": "2021-06-25T15:41:00-05:00"
    },
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "PENDING",
      "stage": "Ambiguous",
      "timestamp": "2021-06-25T15:40:00-05:00"
    }
  ]
}
```

## 6\. Payment Status Update - “PENDING TO SUCCESS”

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "eventRef": "ABDGA51fdhskHkjlhjk78971212HLKHS",
  "eventType": "STATUS_CHG",
  "transactionReference": "0975453fsdhfwsdew74575734573GTRWDF_4748",
  "transactionType": "PAYMENT",
  "payment": {
    "proposalId": "yTP8tzPTNdDPBVZr+Y/+c4CxuTA=",
    "paymentType": "P2P",
    "localDateTime": "1803185505",
    "sendProcessedDateTime": "2021-03-18T14:18:55-05:00",
    "senderAccountUri": "tel:+3312345678",
    "recipientAccountUri": "tel:+3312345679",
    "quoteType": {
      "reverse": {
        "senderCurrency": "USD"
      }
    },
    "transactionStatus": {
      "status": "SUCCESS"
    },
    "fxRate": 3.7833456828,
    "chargedAmount": {
      "amount": 19.52,
      "currency": "USD"
    },
    "creditedAmount": {
      "amount": 129.15,
      "currency": "GBP"
    },
    "principalAmount": {
      "amount": 164.45,
      "currency": "USD"
    },
    "feeAmount": {
      "amount": 13.65,
      "currency": "USD"
    },
    "senderCurrency": "CAD",
    "paymentOriginationCountry": "CAN",
    "sender": {
      "firstName": "John",
      "middleName": "Adam",
      "lastName": "Smith",
      "organizationName": "ABC Company",
      "nationality": "USA",
      "governmentIds": [
        {
          "governmentIdUri": "ppn:123456789;expiration-date=2019-05-27;issue-date=2011-07-12;country=USA"
        }
      ],
      "dateOfBirth": "1985-06-24"
    },
    "recipient": {
      "firstName": "John",
      "middleName": "Adam",
      "lastName": "Smith",
      "organizationName": "ABC Company",
      "nationality": "USA",
      "governmentIds": [
        {
          "governmentIdUri": "ppn:123456789;expiration-date=2019-05-27;issue-date=2011-07-12;country=USA"
        }
      ],
      "phone": "63611152525479998233223439702",
      "email": "customer@gmail.com"
    },
    "purposeOfPayment": "Family Maintenance",
    "settlementDetails": {
      "amount": "10.85",
      "currency": "USD"
    },
    "receivingBankName": "Royal Exchange",
    "receivingBankBranchName": "Quad Cities",
    "bankCode": "NS02",
    "sourceOfIncome": "Salary",
    "paymentFileIdentifier": "AH20765345_873",
    "cashoutCode": "Peaches"
  },
  "transactionHistories": [
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "SUCCESS",
      "timestamp": "2021-06-25T15:41:00-05:00"
    },
    {
      "notificationId": "ABDGA51fdhskHkjlhjk78971212HLKHS",
      "status": "PENDING",
      "stage": "InProgress",
      "timestamp": "2021-06-25T15:40:00-05:00"
    }
  ]
}
```

## 7\. Payment Status Update - “PENDING TO REJECTED”

```JSON
{
  "partnerId": "NewPartnerQC",
  "eventRef": "ref_opGESGTozKvqU9O5LCrD11TKL5SO",
  "eventType": "STATUS_CHG",
  "transactionReference": "064a4b371abf7f46b0b6cb3",
  "transactionType": "PAYMENT",
  "payment": {
    "proposalId": "pen-4000964396222525561977438",
    "paymentType": "P2P",
    "sendProcessedDateTime": "2024-02-13T18:29:03-06:00",
    "senderAccountUri": "tel:+254050005",
    "recipientAccountUri": "tel:+254070000",
    "quoteType": {
      "forward": {
        "feesIncluded": "true",
        "receiverCurrency": "INR"
      }
    },
    "transactionStatus": {
      "status": "REJECTED",
      "errorCode": "082000",
      "errorMessage": "Invalid Input Value"
    },
    "fxRate": "19.12",
    "chargedAmount": {
      "amount": "105.13",
      "currency": "USD"
    },
    "creditedAmount": {
      "amount": "1001.2",
      "currency": "USD"
    },
    "principalAmount": {
      "amount": "100.12",
      "currency": "USD"
    },
    "feeAmount": {
      "amount": "5.01",
      "currency": "USD"
    },
    "paymentOriginationCountry": "USA",
    "sender": {
      "firstName": "John",
      "middleName": "L",
      "lastName": "Doe",
      "nationality": "USA",
      "address": {
        "line1": "123MainStreet",
        "line2": "5A",
        "city": "Arlington",
        "countrySubdivision": "VA",
        "postalCode": "22207",
        "country": "USA"
      },
      "dateOfBirth": "1985-06-24"
    },
    "recipient": {
      "firstName": "Lee",
      "middleName": "M",
      "lastName": "Cardholder",
      "nationality": "USA",
      "address": {
        "line1": "123MainStreet",
        "line2": "5A",
        "city": "Arlington",
        "countrySubdivision": "VA",
        "postalCode": "22207",
        "country": "USA"
      },
      "phone": "0016367224357",
      "email": "customer@gmail.com"
    },
    "settlementDetails": {
      "amount": "23.12",
      "currency": "EUR"
    },
    "receivingBankName": "Royal Exchange",
    "receivingBankBranchName": "Quad Cities",
    "sourceOfIncome": "Sal",
    "cashoutCode": "123456",
    "additionalDataList": {
      "resourceType": "list",
      "itemCount": 3,
      "data": {
        "dataFields": [
          {
            "name": "111",
            "value": "Oak Street"
          },
          {
            "name": "112",
            "value": "any city"
          },
          {
            "name": "880",
            "value": "INR 29.06"
          }
        ]
      }
    }
  },
  "transactionHistories": [
    {
      "notificationId": "ref_opGESGTozKvqU9O5LCrD11TKL5SO",
      "status": "REJECTED",
      "timestamp": "2024-02-13T18:29:05-06:00"
    },
    {
      "status": "PENDING",
      "stage": "InProgress",
      "timestamp": "2024-02-13T18:29:03-06:00"
    }
  ]
}
```

## 8\. Payment Status Update - “SUCCESS to RETURNED” For Return Reason Version 2

```JSON
{
  "partner_id": "QA_LockND",
  "event_ref": "ref_hRS3KQNjBmZT8ecoG1JIf8aB7TXe",
  "event_type": "STATUS_CHG",
  "transaction_reference": "0987e9eed016e240428d793",
  "transaction_type": "PAYMENT",
  "payment_type": "P2P",
  "send_processed_date_time": "2024-03-12T02:29:11-05:00",
  "sender_account_uri": "tel:+254108989",
  "recipient_account_uri": "tel:+254068989",
  "quote_type": {
    "forward": {
      "fees_included": "true"
    }
  },
  "current_transaction_status": "RETURNED",
  "charged_amount": {
    "amount": "105.13",
    "currency": "USD"
  },
  "principal_amount": {
    "amount": "100.12",
    "currency": "USD"
  },
  "credited_amount": {
    "amount": "1001.2",
    "currency": "USD"
  },
  "fee_amount": {
    "amount": "5.01",
    "currency": "USD"
  },
  "payment_origination_country": "USA",
  "sender": {
    "first_name": "John",
    "middle_name": "L",
    "last_name": "Doe",
    "nationality": "USA",
    "address": {
      "line1": "123MainStreet",
      "line2": "#5A",
      "city": "Arlington",
      "country_subdivision": "NA",
      "postal_code": "12345",
      "country": "USA"
    },
    "government_ids": [
      {
        "government_id_uri": "ppn:123456789;expiration-date=2029-05-27;issue-date=2011-07-12;country=USA"
      }
    ],
    "date_of_birth": "1980-01-20"
  },
  "recipient": {
    "first_name": "John",
    "middle_name": "L",
    "last_name": "Doe",
    "nationality": "USA",
    "address": {
      "line1": "123MainStreet",
      "line2": "#5A",
      "city": "Arlington",
      "country_subdivision": "NA",
      "postal_code": "12345",
      "country": "CAN"
    },
    "government_ids": [
      {
        "government_id_uri": "ppn:999956789;expiration-date=2029-05-27;issue-date=2011-07-12;country=USA"
      }
    ],
    "phone": "6361115252",
    "email": "customer@gmail.com"
  },
  "settlement_details": {
    "currency": "EUR",
    "amount": "23.12"
  },
  "receiving_bank_name": "Royal Exchange",
  "receiving_bank_branch_name": "Quad Cities",
  "bank_code": "NP021",
  "source_of_income": "Regular Income",
  "payment_file_identifier": "123456789",
  "cashout_code": "123456",
  "fx_rate": "19.12",
  "return_message": "Returned per sending service provider's request",
  "additional_data": {
    "resource_type": "list",
    "item_count": "4",
    "data": {
      "data_field": [
        {
          "name": "256",
          "value": "2029-05-27"
        },
        {
          "name": "255",
          "value": "2011-07-12"
        },
        {
          "name": "254",
          "value": "USA"
        },
        {
          "name": "240",
          "value": "USA"
        }
      ]
    }
  },
  "purpose_of_payment": "Family Maintenance",
  "transaction_history": [
    {
      "notification_id": "ref_hRS3KQNjBmZT8ecoG1JIf8aB7TXe",
      "status": "RETURNED",
      "timestamp": "2024-03-12T02:29:16-05:00"
    },
    {
      "status": "SUCCESS",
      "timestamp": "2024-03-12T02:29:11-05:00"
    }
  ]
}
```

## 9\. Payment Status Update - “SUCCESS TO RETURNED” For Return Reason Version 3

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "eventRef": "ref_Kkt9inUuM_ajQyXFWyqhYUN2D4l-",
  "eventType": "STATUS_CHG",
  "transactionReference": "06138507fd2c2e4fdcae0b5",
  "transactionType": "PAYMENT",
  "payment": {
    "paymentType": "P2P",
    "sendProcessedDateTime": "2022-11-15T01:19:11-06:00",
    "senderAccountUri": "tel:+254108989",
    "recipientAccountUri": "ban:00801044;bic=BNPAAU2SXXX",
    "quoteType": {
      "forward": {
        "feesIncluded": "false"
      }
    },
    "transactionStatus": {
      "status": "RETURNED",
      "errorCode": "130190",
      "errorMessage": "DECLINE:Invalid Recipient bank account number"
    },
    "fxRate": "1.463874",
    "chargedAmount": {
      "amount": "4",
      "currency": "USD"
    },
    "creditedAmount": {
      "amount": "5.86",
      "currency": "AUD"
    },
    "principalAmount": {
      "amount": "4",
      "currency": "USD"
    },
    "feeAmount": {
      "amount": "0",
      "currency": "USD"
    },
    "paymentOriginationCountry": "USA",
    "sender": {
      "firstName": "John",
      "middleName": "L",
      "lastName": "Doe",
      "nationality": "USA",
      "address": {
        "line1": "123MainStreet",
        "line2": "#5A",
        "city": "Arlington",
        "countrySubdivision": "A_B,C $@ Ã,@%12-3&",
        "postalCode": "411019",
        "country": "USA"
      },
      "dateOfBirth": "1980-01-20"
    },
    "recipient": {
      "firstName": "John",
      "middleName": "L",
      "lastName": "Doe",
      "nationality": "USA",
      "address": {
        "line1": "123MainStreet",
        "line2": "#5A",
        "city": "Arlington",
        "countrySubdivision": "ABC# 1-Ã23&: 1o:1",
        "postalCode": "411019",
        "country": "CAN"
      },
      "email": "customer@gmail.com"
    },
    "purposeOfPayment": "purpose_of_payment",
    "settlementDetails": {
      "amount": "3.98",
      "currency": "USD"
    },
    "receivingBankName": "Royal Exchange",
    "receivingBankBranchName": "Quad Cities",
    "bankCode": "NP021",
    "sourceOfIncome": "Regular Income",
    "paymentFileIdentifier": "123456789",
    "additionalDataList": {
      "resourceType": "list",
      "itemCount": 4,
      "data": {
        "dataFields": [
          {
            "name": 1200,
            "value": "BGD-BK"
          },
          {
            "name": 701,
            "value": "BGD"
          },
          {
            "name": 814,
            "value": "1.486166"
          },
          {
            "name": 840,
            "value": "51p2wreh4t8bwb17sebmatkupgg"
          }
        ]
      }
    }
  },
  "transactionHistories": [
    {
      "notificationId": "ref_Kkt9inUuM_ajQyXFWyqhYUN2D4l-",
      "status": "RETURNED",
      "timestamp": "2022-11-15T02:58:13-06:00"
    },
    {
      "notificationId": "ref_c45_ip-eNCYpnq_rDFRffmKdkkQ7",
      "status": "SUCCESS",
      "timestamp": "2022-11-15T01:24:14-06:00"
    },
    {
      "status": "PENDING",
      "stage": "EligibleForSettlement",
      "timestamp": "2022-11-15T01:19:11-06:00"
    }
  ]
}
```

# Sample Responses

No Response body

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

> [!NOTE]
> 
> *   Contact your mastercard representative for mTLS push notification mastercard public certificate. This certificate needs to be trusted by the receiving application. Also, please share the server certificate chain for validation (via KMP portal), if it’s accepted on Mastercard’s infrastructure.
> *   Once done, data can be sent by Mastercard to the other party.

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/#api)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/#sandbox-testing)
*   [Sample Requests](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/#sample-requests)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/#error-codes)

---
title: Retrieve Payment API
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, refer to [Retrieve Payment API for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-eu-retrieve-payment-api/) and [Retrieve Payment API for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-uk-retrieve-payment-api/) respectively to ensure compliance with the relevant jurisdiction based on Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

You can use this API to retrieve the payment transaction using the transaction Id or transaction Reference.  
When using the Retrieve Payment API resource to check the status of a PENDING payment, it should be used no more than every 30 minutes for each payment being retrieved.

# Environment Domains

## Retrieve Payment by Transaction Id

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/{payment-id}
```

```Production
https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder/{payment-id}
```

## Retrieve Payment by Transaction Reference

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder?ref={payment-reference}
```

```Production
https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder?ref={payment-reference}
```

> [!NOTE]
> 
> **Sandbox** and **MTF** environments share the same url but are differentiated by partner id.

# API

  
Alternatively, here is a tabular view of the request/ response parameter:  (1MB)  
  

## Retrieve Payment by Transaction ID

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#operation/getPayment)

Retrieve the payment transaction using the payment ID.

Sandbox URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/{payment-id}

MTF URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/{payment-id}

Production URL

https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder/{payment-id}

## Retrieve Payment by Transaction Reference

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#operation/transactionStatus)

Retrieve the payment transaction using the transaction reference.

Sandbox URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder

MTF URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder

Production URL

https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder

*   **Formats supported**: XML/ JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example - application/json

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

# Sandbox Test cases

The Sandbox server returns simulated, static responses.

## **Retrieve Payment For Return Reason Message Version 3**

Please refer column ‘Code Value’ to complete list of Return Reason Message Version 3 codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/error-codes/).

### Retrieve Payment by Transaction Id

You can use the following test cases to produce specific responses.

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Retrieve payment by transaction Id | Use the transaction Id of an existing payment transaction. |

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Retrieve a returned Payment by Transaction Id having return message as per the Return Reason Code | 1\. Create Payment with Transaction Reference starting with ‘8’ and ending with RR######, where ‘######’ is one of the Return Reason Code. Example:8XXXXXXRR130101 (where ‘XXXXXX’ can be any alphanumeric value)  <br>2\. Retrieve payment by Transaction Id. |

### Retrieve Payment by Transaction Reference

You can use the following test cases to produce specific responses.

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Retrieve payment by transaction reference | Use the transaction reference Id of an existing payment transaction. |

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Retrieve a returned Payment by Transaction Reference having return message as per the Return Reason Code | 1\. Create Payment with Transaction Reference starting with ‘8’ and ending with RR######, where ‘######’ is one of the Return Reason Code. Example:8XXXXXXRR130101 (where ‘XXXXXX’ can be any alphanumeric value)  <br>2\. Retrieve payment by Transaction Reference. |

# Sample Requests

## Retrieve Payment by Transaction ID

No Request body

## Retrieve Payment by Transaction Reference

No Request body

# Sample Responses

## Retrieve Payment by Transaction ID

### Retrieve success examples

A few examples of successful Retrieve calls are:

#### 1.Successful Payment Response:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
    <transaction_reference>07-GPYT-SR-NFWTIOBVCsdRGH-7009_93103546</transaction_reference>
    <status>SUCCESS</status>
    <id>rem_L1qZ8BLdmK9qUAFaGmpOwrpE6N0</id>
    <resource_type>payment</resource_type>
    <created>2019-09-09T04:32:52-05:00</created>
    <status_timestamp>2019-09-09T05:28:57-05:00</status_timestamp>
    <fees_amount>
        <currency>USD</currency>
        <amount>5.25</amount>
    </fees_amount>
    <charged_amount>
        <currency>USD</currency>
        <amount>10.25</amount>
    </charged_amount>
    <credited_amount>
        <currency>GBP</currency>
        <amount>82.63</amount>
    </credited_amount>
    <principal_amount>
        <currency>USD</currency>
        <amount>105.50</amount>
    </principal_amount>
    <sender_account_uri>tel:+254108989</sender_account_uri>
    <recipient_account_uri>tel:+254068989</recipient_account_uri>
    <payment_amount>
        <currency>USD</currency>
        <amount>121.10</amount>
    </payment_amount>
    <payment_origination_country>USA</payment_origination_country>
    <fx_type>
        <forward>
            <fees_included>true</fees_included>
        </forward>
    </fx_type>
    <receiving_bank_name>Royal Exchange</receiving_bank_name>
    <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
    <bank_code>NP021</bank_code>
    <payment_type>P2B</payment_type>
    <source_of_income>Bank</source_of_income>
    <settlement_details>
        <currency>EUR</currency>
        <amount>23.12</amount>
    </settlement_details>
    <cashout_code>123456</cashout_code>
    <fx_rate>19.12</fx_rate>
    <additional_data_list>
        <resource_type>list</resource_type>
        <item_count>3</item_count>
        <data>
            <data_field>
                <name>810</name>
                <value>123</value>
            </data_field>
            <data_field>
                <name>851</name>
                <value>456</value>
            </data_field>
            <data_field>
                <name>813</name>
                <value>18.22</value>
            </data_field>
        </data>
    </additional_data_list>
    <payment_file_identifier>1jgdhj421</payment_file_identifier>
</payment>
```

```JSON
{
	"payment": {
		"transaction_reference": "07-GPYT-SR-NFWTIOBVCsdRGH-7009_93103546",
		"status": "SUCCESS",
		"id": "rem_L1qZ8BLdmK9qUAFaGmpOwrpE6N0",
		"resource_type": "payment",
		"created": "2019-09-09T04:32:52-05:00",
		"status_timestamp": "2019-09-09T05:28:57-05:00",
		"fees_amount": {
			"currency": "USD",
			"amount": "5.35"
		},
		"charged_amount": {
			"currency": "USD",
			"amount": "10.25"
		},
		"credited_amount": {
			"currency": "GBP",
			"amount": "82.63"
		},
		"principal_amount": {
			"currency": "USD",
			"amount": "105.50"
		},
		"sender_account_uri": "tel:+254108989",
		"recipient_account_uri": "tel:+254068989",
		"payment_amount": {
			"currency": "USD",
			"amount": "121.10"
		},
		"payment_origination_country": "USA",
		"fx_type": {
			"forward": {
				"fees_included": "true"
			}
		},
		"receiving_bank_name": "Royal Exchange",
		"receiving_bank_branch_name": "Quad Cities",
		"bank_code": "NP021",
		"payment_type": "P2B",
		"source_of_income": "Bank",
		"settlement_details": {
			"currency": "EUR",
			"amount": "23.12"
		},
		"cashout_code": "123456",
		"fx_rate": "19.12",
		"additional_data_list": {
			"resource_type": "list",
			"item_count": "3",
			"data": {
				"data_field": [
					{
						"name": "810",
						"value": "123"
					},
					{
						"name": "851",
						"value": "456"
					},
					{
						"name": "813",
						"value": "18.22"
					}
				]
			}
		},
		"payment_file_identifier": "1jgdhj421"
	}
}
```

#### 2.Rejected Payment Response With Source:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
    <transaction_reference>04-GPYT-RRWS-MKMFWYIUVKH-700_swr4567475</transaction_reference>
    <status>REJECTED</status>
    <id>rem_IaCIDKldIs40_EzDRyPv-EPVDK8</id>
    <resource_type>payment</resource_type>
    <rejected_status>
        <Code>082000</Code>
        <Message>INVALID_INPUT_VALUE:Invalid Input Value:Additional Data-121-Sender Mobile Phone Number</Message>
    </rejected_status>
</payment>
```

```JSON
{
   "payment": {
      "transaction_reference": "04-GPYT-RRWS-MKMFWYIUVKH-700_swr4567475",
      "status": "REJECTED",
      "id": "rem_IaCIDKldIs40_EzDRyPv-EPVDK8",
      "resource_type": "payment",
      "rejected_status": {
         "Code": "082000",
         "Message": "INVALID_INPUT_VALUE:Invalid Input Value:Additional Data-121-Sender Mobile Phone Number"
      }
   }
}
```

#### 3.Rejected Payment Response Without Source:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
    <transaction_reference>04-GPYT-RRWTS-FWLBCXWUONBFD_70045674750</transaction_reference>
    <status>REJECTED</status>
    <id>rem_IaCIDKldIs40_EzDRyPv-EPVDK8</id>
    <resource_type>payment</resource_type>
    <rejected_status>
        <Code>130120</Code>
        <Message>DECLINE:Maximum cumulative transactions exceeded by sending consumer</Message>
    </rejected_status>
</payment>
```

```JSON
 {
   "payment": {
      "transaction_reference": "04-GPYT-RRWTS-FWLBCXWUONBFD_70045674750",
      "status": "REJECTED",
      "id": "rem_IaCIDKldIs40_EzDRyPv-EPVDK8",
      "resource_type": "payment",
      "rejected_status": {
         "Code": "130120",
         "Message": "DECLINE:Maximum cumulative transactions exceeded by sending consumer"
      }
   }
}
```

#### 4.Pending Payment Response:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
    <transaction_reference>06-GPYT-PR-TQVNKODDF-7009hajsa673345035</transaction_reference>
    <status>PENDING</status>
    <id>rem_S8XcPv5Jjy6n4llKwnrXXBMAr2Y</id>
    <resource_type>payment</resource_type>
    <created>2019-09-09T05:36:49-05:00</created>
    <status_timestamp>2019-09-09T05:38:31-05:00</status_timestamp>
    <pending_stage>Processing</pending_stage>
    <pending_max_completion_date>2019-09-09T05:41:27.416-05:00</pending_max_completion_date>
    <fees_amount>
        <currency>USD</currency>
        <amount>5.35</amount>
    </fees_amount>
    <charged_amount>
        <currency>USD</currency>
        <amount>10.25</amount>
    </charged_amount>
    <credited_amount>
        <currency>GBP</currency>
        <amount>82.63</amount>
    </credited_amount>
    <principal_amount>
        <currency>USD</currency>
        <amount>105.50</amount>
    </principal_amount>
    <sender_account_uri>tel:+254108989</sender_account_uri>
    <recipient_account_uri>tel:+254068989</recipient_account_uri>
    <payment_amount>
        <currency>USD</currency>
        <amount>121.10</amount>
    </payment_amount>
    <payment_origination_country>USA</payment_origination_country>
    <fx_type>
        <forward>
            <fees_included>true</fees_included>
        </forward>
    </fx_type>
    <receiving_bank_name>Royal Exchange</receiving_bank_name>
    <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
    <bank_code>NP021</bank_code>
    <payment_type>P2B</payment_type>
    <source_of_income>Bank</source_of_income>
    <settlement_details>
        <currency>EUR</currency>
        <amount>23.12</amount>
    </settlement_details>
    <cashout_code>123456</cashout_code>
    <fx_rate>19.19</fx_rate>
    <additional_data_list>
        <resource_type>list</resource_type>
        <item_count>2</item_count>
        <data>
            <data_field>
                <name>810</name>
                <value>123</value>
            </data_field>
            <data_field>
                <name>851</name>
                <value>456</value>
            </data_field>
        </data>
    </additional_data_list>
    <payment_file_identifier>5spltew62</payment_file_identifier>
</payment>
```

```JSON
{
	"payment": {
		"transaction_reference": "06-GPYT-PR-TQVNKODDF-7009hajsa673345035",
		"status": "PENDING",
		"id": "rem_S8XcPv5Jjy6n4llKwnrXXBMAr2Y",
		"resource_type": "payment",
		"created": "2019-09-09T05:36:49-05:00",
		"status_timestamp": "2019-09-09T05:38:31-05:00",
		"pending_stage": "Processing",
		"pending_max_completion_date": "2019-09-09T05:41:27.416-05:00",
		"fees_amount": {
			"currency": "USD",
			"amount": "5.35"
		},
		"charged_amount": {
			"currency": "USD",
			"amount": "10.25"
		},
		"credited_amount": {
			"currency": "GBP",
			"amount": "82.63"
		},
		"principal_amount": {
			"currency": "USD",
			"amount": "105.50"
		},
		"sender_account_uri": "tel:+254108989",
		"recipient_account_uri": "tel:+254068989",
		"payment_amount": {
			"currency": "USD",
			"amount": "121.10"
		},
		"payment_origination_country": "USA",
		"fx_type": {
			"forward": {
				"fees_included": "true"
			}
		},
		"receiving_bank_name": "Royal Exchange",
		"receiving_bank_branch_name": "Quad Cities",
		"bank_code": "NP021",
		"payment_type": "P2B",
		"source_of_income": "Bank",
		"settlement_details": {
			"currency": "EUR",
			"amount": "23.12"
		},
		"cashout_code": "123456",
		"fx_rate": "19.19",
		"additional_data_list": {
			"resource_type": "list",
			"item_count": "2",
			"data": {
				"data_field": [
					{
						"name": "810",
						"value": "123"
					},
					{
						"name": "851",
						"value": "456"
					}
				]
			}
		},
		"payment_file_identifier": "5spltew62"
	}
}
```

#### 5.Returned Payment Response For Returned Reason Version 2:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
  <transaction_reference>099d9b1f09805a407691659</transaction_reference>
  <status>RETURNED</status>
  <id>rem_6JFlIxjCOz4GJZXsldiZejK8b5A</id>
  <resource_type>payment</resource_type>
  <payment_type>P2P</payment_type>
  <return_status>
    <Message>Returned per sending service provider's request</Message>
  </return_status>
</payment>
```

```JSON
{
  "payment": {
    "transaction_reference": "099d9b1f09805a407691659",
    "status": "RETURNED",
    "id": "rem_6JFlIxjCOz4GJZXsldiZejK8b5A",
    "resource_type": "payment",
    "payment_type": "P2P",
    "return_status": {
      "Message": "Returned per sending service provider's request"
    }
  }
}
```

#### 6.Returned Payment Response For Returned Reason Version 3:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
  <transaction_reference>099d9b1f09805a407691659</transaction_reference>
  <status>RETURNED</status>
  <id>rem_6JFlIxjCOz4GJZXsldiZejK8b5A</id>
  <resource_type>payment</resource_type>
  <payment_type>P2P</payment_type>
  <rejected_status>
    <Code>130134</Code>
    <Message> DECLINE:The recipient cannot receive funds due to inactive account </Message>
  </rejected_status>
</payment>
```

```JSON
{
  "payment": {
    "transaction_reference": "099d9b1f09805a407691659",
    "status": "RETURNED",
    "id": "rem_6JFlIxjCOz4GJZXsldiZejK8b5A",
    "resource_type": "payment",
    "payment_type": "P2P",
    "rejected_status": {
      "Code": "130134",
      "Message": "DECLINE:The recipient cannot receive funds due to inactive account"
    }
  }
}
```

### Retrieve failures examples

A few examples of Retrieve failures are:

#### 1.System Failure:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Errors>
    <Error>
        <RequestId>343242</RequestId>
        <Source></Source>
        <ReasonCode>SYSTEM_ERROR</ReasonCode>
        <Description>A system error has occurred</Description>
        <Recoverable>false</Recoverable>
        <Details>
            <Detail>
                <Name>ErrorDetailCode</Name>
                <Value>150001</Value>
            </Detail>
        </Details>
    </Error>
</Errors>
```

```JSON
{
	"Errors": {
		"Error": {
			"RequestId": "343242",
			"Source": "",
			"ReasonCode": "SYSTEM_ERROR",
			"Description": "A system error has occurred",
			"Recoverable": "false",
			"Details": {
				"Detail": {
					"Name": "ErrorDetailCode",
					"Value": "150001"
				}
			}
		}
	}
}
```

#### 2.Payment Id Not Found:

```XML
<?xml version="1.0" encoding="UTF-8" ?>
<Errors>
	<Error>
		<RequestId>38694624</RequestId>
		<Source>GetPayment</Source>
		<ReasonCode>RESOURCE_UNKNOWN</ReasonCode>
		<Description>Record Not Found</Description>
		<Recoverable>false</Recoverable>
		<Details>
			<Detail>
				<Name>ErrorDetailCode</Name>
				<Value>110507</Value>
			</Detail>
		</Details>
	</Error>
</Errors>
```

```JSON
{
    "Errors": {
        "Error": {
            "RequestId": "38694624",
            "Source": "GetPayment",
            "ReasonCode": "RESOURCE_UNKNOWN",
            "Description": "Record Not Found",
            "Recoverable": "false",
            "Details": {
                "Detail": {
                    "Name": "ErrorDetailCode",
                    "Value": "110507"
                }
            }
        }
    }
}
```

## Retrieve Payment by Transaction Reference

### Retrieve success examples

A few examples of successful Retrieve calls are:

#### 1.Successful Payment Response:

```XML
<?xml version="1.0" encoding="UTF-8" ?>
<payment>
  <transaction_reference>05-GPYT-SR-GAWERBNseYIOFUE-009675675_52</transaction_reference>
  <id>rem_CsmBxbCtt9opPMXzD5JGx_DJNWQ</id>
  <resource_type>payment</resource_type>
  <created>2019-09-09T05:36:49-05:00</created>
  <proposal_id>suc_10000807120579256064528158</proposal_id>
  <status>SUCCESS</status>
  <status_timestamp>2019-09-09T05:38:31-05:00</status_timestamp>
  <fees_amount>
    <amount>5.35</amount>
    <currency>USD</currency>
  </fees_amount>
  <charged_amount>
    <amount>10.25</amount>
    <currency>USD</currency>
  </charged_amount>
  <credited_amount>
    <amount>82.63</amount>
    <currency>GBP</currency>
  </credited_amount>
  <principal_amount>
    <amount>105.50</amount>
    <currency>USD</currency>
  </principal_amount>
  <sender_account_uri>tel:+2130000</sender_account_uri>
  <recipient_account_uri>tel:+254060005</recipient_account_uri>
  <payment_amount>
    <amount>121.10</amount>
    <currency>USD</currency>
  </payment_amount>
  <payment_origination_country>USA</payment_origination_country>
  <C>
    <forward>
      <fees_included>true</fees_included>
    </forward>
  </C>
  <receiving_bank_name>Royal Exchange</receiving_bank_name>
  <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
  <payment_type>P2P</payment_type>
  <source_of_income>Sal</source_of_income>
  <settlement_details>
    <amount>23.12</amount>
    <currency>EUR</currency>
  </settlement_details>
  <cashout_code>123456</cashout_code>
  <fx_rate>18.22</fx_rate>
  <additional_data_list>
    <resource_type>list</resource_type>
    <item_count>2</item_count>
    <data>
      <data_field>
        <name>810</name>
        <value>123</value>
      </data_field>
      <data_field>
        <name>851</name>
        <value>456</value>
      </data_field>
    </data>
  </additional_data_list>
</payment>
```

```JSON
{
	"payment": {
		"transaction_reference": "05-GPYT-SR-GAWERBNseYIOFUE-009675675_52",
		"id": "rem_CsmBxbCtt9opPMXzD5JGx_DJNWQ",
		"resource_type": "payment",
		"created": "2019-09-09T05:36:49-05:00",
		"proposal_id": "suc_10000807120579256064528158",
		"status": "SUCCESS",
		"status_timestamp": "2019-09-09T05:38:31-05:00",
		"fees_amount": {
			"amount": "5.35",
			"currency": "USD"
		},
		"charged_amount": {
			"amount": "10.25",
			"currency": "USD"
		},
		"credited_amount": {
			"amount": "82.63",
			"currency": "GBP"
		},
		"principal_amount": {
			"amount": "105.50",
			"currency": "USD"
		},
		"sender_account_uri": "tel:+2130000",
		"recipient_account_uri": "tel:+254060005",
		"payment_amount": {
			"amount": "121.10",
			"currency": "USD"
		},
		"payment_origination_country": "USA",
		"fx_type": {
			"forward": {
				"fees_included": "true"
			}
		},
		"receiving_bank_name": "Royal Exchange",
		"receiving_bank_branch_name": "Quad Cities",
		"payment_type": "P2P",
		"source_of_income": "Sal",
		"settlement_details": {
			"amount": "23.12",
			"currency": "EUR"
		},
		"cashout_code": "123456",
		"fx_rate": "18.22",
		"additional_data_list": {
			"resource_type": "list",
			"item_count": "2",
			"data": {
				"data_field": [
					{
						"name": "810",
						"value": "123"
					},
					{
						"name": "851",
						"value": "456"
					}
				]
			}
		}
	}
}
```

#### 2.Rejected Payment Response With Source:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
    <transaction_reference>04-GPYT-RR-FWLWSTYONBFD_70045674752400</transaction_reference>
    <status>REJECTED</status>
    <id>rem_IaCIDKldIs40_EzDRyPv-EPVDK8</id>
    <resource_type>payment</resource_type>
    <rejected_status>
        <Code>082000</Code>
        <Message>INVALID_INPUT_VALUE:Invalid Input Value:Additional Data-121-Sender Mobile Phone Number</Message>
    </rejected_status>
</payment>
```

```JSON
{
   "payment": {
      "transaction_reference": "04-GPYT-RR-FWLWSTYONBFD_70045674752400",
      "status": "REJECTED",
      "id": "rem_IaCIDKldIs40_EzDRyPv-EPVDK8",
      "resource_type": "payment",
      "rejected_status": {
         "Code": "082000",
         "Message": "INVALID_INPUT_VALUE:Invalid Input Value:Additional Data-121-Sender Mobile Phone Number"
      }
   }
}
```

#### 3.Rejected Payment Response Without Source:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
    <transaction_reference>04-GPYT-RRWS-LWSTYONBFD_70045674752400</transaction_reference>
    <status>REJECTED</status>
    <id>rem_IaCIDKldIs40_EzDRyPv-EPVDK8</id>
    <resource_type>payment</resource_type>
    <rejected_status>
        <Code>130120</Code>
        <Message>DECLINE:Maximum cumulative transactions exceeded by sending consumer</Message>
    </rejected_status>
</payment>
```

```JSON
{
   "payment": {
      "transaction_reference": "04-GPYT-RRWS-LWSTYONBFD_70045674752400",
      "status": "REJECTED",
      "id": "rem_IaCIDKldIs40_EzDRyPv-EPVDK8",
      "resource_type": "payment",
      "rejected_status": {
         "Code": "130120",
         "Message": "DECLINE:Maximum cumulative transactions exceeded by sending consumer"
      }
   }
}
```

#### 4.Pending Payment Response:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
    <transaction_reference>06-GPYT-PR-TQVNKODDF-7009hajsa673345035</transaction_reference>
    <status>PENDING</status>
    <id>rem_S8XcPv5Jjy6n4llKwnrXXBMAr2Y</id>
    <resource_type>payment</resource_type>
    <created>2019-09-09T05:36:49-05:00</created>
    <status_timestamp>2019-09-09T05:38:31-05:00</status_timestamp>
    <pending_stage>Processing</pending_stage>
    <pending_max_completion_date>2019-09-09T05:41:27.416-05:00</pending_max_completion_date>
    <fees_amount>
        <currency>USD</currency>
        <amount>5.95</amount>
    </fees_amount>
    <charged_amount>
        <currency>USD</currency>
        <amount>15.16</amount>
    </charged_amount>
    <credited_amount>
        <currency>GBP</currency>
        <amount>82.63</amount>
    </credited_amount>
    <principal_amount>
        <currency>USD</currency>
        <amount>124.65</amount>
    </principal_amount>
    <sender_account_uri>tel:+254108989</sender_account_uri>
    <recipient_account_uri>tel:+254068989</recipient_account_uri>
    <payment_amount>
        <currency>USD</currency>
        <amount>145.76</amount>
    </payment_amount>
    <payment_origination_country>USA</payment_origination_country>
    <fx_type>
        <forward>
            <fees_included>true</fees_included>
        </forward>
    </fx_type>
    <receiving_bank_name>Royal Exchange</receiving_bank_name>
    <receiving_bank_branch_name>Quad Cities</receiving_bank_branch_name>
    <bank_code>NP021</bank_code>
    <payment_type>P2B</payment_type>
    <source_of_income>Bank</source_of_income>
    <settlement_details>
        <currency>EUR</currency>
        <amount>23.12</amount>
    </settlement_details>
    <cashout_code>123456</cashout_code>
    <fx_rate>19.19</fx_rate>
    <additional_data_list>
        <resource_type>list</resource_type>
        <item_count>2</item_count>
        <data>
            <data_field>
                <name>810</name>
                <value>123</value>
            </data_field>
            <data_field>
                <name>851</name>
                <value>456</value>
            </data_field>
        </data>
    </additional_data_list>
    <payment_file_identifier>6trwqs73</payment_file_identifier>
</payment>
```

```JSON
{
	"payment": {
		"transaction_reference": "06-GPYT-PR-TQVNKODDF-7009hajsa673345035",
		"status": "PENDING",
		"id": "rem_S8XcPv5Jjy6n4llKwnrXXBMAr2Y",
		"resource_type": "payment",
		"created": "2019-09-09T05:36:49-05:00",
		"status_timestamp": "2019-09-09T05:38:31-05:00",
		"pending_stage": "Processing",
		"pending_max_completion_date": "2019-09-09T05:41:27.416-05:00",
		"fees_amount": {
			"currency": "USD",
			"amount": "5.95"
		},
		"charged_amount": {
			"currency": "USD",
			"amount": "15.16"
		},
		"credited_amount": {
			"currency": "GBP",
			"amount": "82.63"
		},
		"principal_amount": {
			"currency": "USD",
			"amount": "124.65"
		},
		"sender_account_uri": "tel:+254108989",
		"recipient_account_uri": "tel:+254068989",
		"payment_amount": {
			"currency": "USD",
			"amount": "145.76"
		},
		"payment_origination_country": "USA",
		"fx_type": {
			"forward": {
				"fees_included": "true"
			}
		},
		"receiving_bank_name": "Royal Exchange",
		"receiving_bank_branch_name": "Quad Cities",
		"bank_code": "NP021",
		"payment_type": "P2B",
		"source_of_income": "Bank",
		"settlement_details": {
			"currency": "EUR",
			"amount": "23.12"
		},
		"cashout_code": "123456",
		"fx_rate": "19.19",
		"additional_data_list": {
			"resource_type": "list",
			"item_count": "2",
			"data": {
				"data_field": [
					{
						"name": "810",
						"value": "123"
					},
					{
						"name": "851",
						"value": "456"
					}
				]
			}
		},
		"payment_file_identifier": "6trwqs73"
	}
}
```

#### 5.Returned Payment Response For Returned Reason Version 2:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
  <transaction_reference>099d9b1f09805a407691659</transaction_reference>
  <status>RETURNED</status>
  <id>rem_6JFlIxjCOz4GJZXsldiZejK8b5A</id>
  <resource_type>payment</resource_type>
  <payment_type>P2P</payment_type>
  <return_status>
    <Message>Returned per sending service provider's request</Message>
  </return_status>
</payment>
```

```JSON
{
  "payment": {
    "transaction_reference": "099d9b1f09805a407691659",
    "status": "RETURNED",
    "id": "rem_6JFlIxjCOz4GJZXsldiZejK8b5A",
    "resource_type": "payment",
    "payment_type": "P2P",
    "return_status": {
      "Message": "Returned per sending service provider's request"
    }
  }
}
```

#### 6.Returned Payment Response For Returned Reason Version 3:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment>
  <transaction_reference>099d9b1f09805a407691659</transaction_reference>
  <status>RETURNED</status>
  <id>rem_6JFlIxjCOz4GJZXsldiZejK8b5A</id>
  <resource_type>payment</resource_type>
  <payment_type>P2P</payment_type>
  <rejected_status>
    <Code>130134</Code>
    <Message> DECLINE:The recipient cannot receive funds due to inactive account </Message>
  </rejected_status>
</payment>
```

```JSON
{
  "payment": {
    "transaction_reference": "099d9b1f09805a407691659",
    "status": "RETURNED",
    "id": "rem_6JFlIxjCOz4GJZXsldiZejK8b5A",
    "resource_type": "payment",
    "payment_type": "P2P",
    "rejected_status": {
      "Code": "130134",
      "Message": "DECLINE:The recipient cannot receive funds due to inactive account"
    }
  }
}
```

### Retrieve failures examples

A few examples of Retrieve failures are provided below:

#### 1.System Failure:

```XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Errors>
    <Error>
        <RequestId>343242</RequestId>
        <Source></Source>
        <ReasonCode>SYSTEM_ERROR</ReasonCode>
        <Description>A system error has occurred</Description>
        <Recoverable>false</Recoverable>
        <Details>
            <Detail>
                <Name>ErrorDetailCode</Name>
                <Value>150001</Value>
            </Detail>
        </Details>
    </Error>
</Errors>
```

```JSON
{
	"Errors": {
		"Error": {
			"RequestId": "343242",
			"Source": "",
			"ReasonCode": "SYSTEM_ERROR",
			"Description": "A system error has occurred",
			"Recoverable": "false",
			"Details": {
				"Detail": {
					"Name": "ErrorDetailCode",
					"Value": "150001"
				}
			}
		}
	}
}
```

#### 2.Transaction Reference Not Found:

```XML
<?xml version="1.0" encoding="UTF-8" ?>
<Errors>
	<Error>
		<RequestId>38694624</RequestId>
		<Source>GetPayment</Source>
		<ReasonCode>RESOURCE_UNKNOWN</ReasonCode>
		<Description>Record Not Found</Description>
		<Recoverable>false</Recoverable>
		<Details>
			<Detail>
				<Name>ErrorDetailCode</Name>
				<Value>110507</Value>
			</Detail>
		</Details>
	</Error>
</Errors>
```

```JSON
{
    "Errors": {
        "Error": {
            "RequestId": "38694624",
            "Source": "GetPayment",
            "ReasonCode": "RESOURCE_UNKNOWN",
            "Description": "Record Not Found",
            "Recoverable": "false",
            "Details": {
                "Detail": {
                    "Name": "ErrorDetailCode",
                    "Value": "110507"
                }
            }
        }
    }
}
```

# Error Codes

Refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/). For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#sandbox-testing)
*   [Sandbox Test cases](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#sandbox-test-cases)
*   [Sample Requests](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#sample-requests)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/retrieve-payment-api/#error-codes)


---
title: RFI APIs
---

Request for Information, commonly referred to as “RFI”, is the process Cross-Border Services uses to enable information to be requested by a Receiving Service Provider (RSP), and responses to be shared between a Customer and RSP.  
For more details, please see [How it Works](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/how-it-works/).

# Open a Request

Information is requested when information is needed to continue processing a payment. One RFI request can be created for **one or more payment** transactions.

# Request Status

After a request is created, it is in an Open status and assigned to a Customer for response. After a response is submitted by Customer, the information is reviewed by the Mastercard RFI Team (“RFI Team”). As a request goes through its workflow, the status will indicate its progress. Once no additional information is needed, the request is closed.  
  
The requestStatus determines the next action for the Customer. When requestStatus is OPEN or INPROGRESS, the Customer is expected to respond back to the request.  
  
The RFI Team may Cancel a request at any time. If this happens, the Customer receives a notification and the RFI status will change to Cancelled.  
  
Statuses are provided in the table below:

| Status | Description |
| --- | --- |
| OPEN | The request is assigned to a Customer. The Customer needs to respond to the request. |
| REVIEW | The RFI Team is assigned to review the received Customer response. |
| INPROGRESS | The RFI Team requires additional information.  <br>  <br>The RFI has been reassigned to the Customer and the Customer needs to respond with the amendments or additional information. |
| CLOSED | The RFI Team reviewed and approved the request responses, and the request is now complete.  <br>  <br>Or, no response was received within 15 calendar days and the request has expired. |
| CANCELLED | The RFI Team cancelled a request because the information was no longer required. |

# RFI Push Notifications

When a RFI request is created, the Customer receives a webhook notification. Notifications will be dispatched as the request is updated, informing the Customer of any changes or pending actions. Depending on the information added or requested, a Customer might have to complete one or more actions from the below tables to respond.

# Actions to obtain a RFI request

| Actions | API | Description |
| --- | --- | --- |
| Customer is notified of the RFI request, or any associated updates | [RFI Push Notification](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/notification/) | The RFI system will send a webhook notification to the Customer which contains the information being requested. The initial notification will be the RequestId. It is a unique value assigned to each RFI request. |
| Download documents attached to RFI request | [Download Document API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/download-document-api/) | The webhook notification may indicate that the RFI Team has attached documents to the request for the Customer to review and retrieve. If so, each attached document will have a unique value (documentId). This ID is required for the Customer to download the document using Download Document API.  <br>[FIND OUT MORE](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/how-it-works/#documents-attached-to-rfi-request) |

# Actions to respond to a RFI request

| Actions | API | Description |
| --- | --- | --- |
| Upload a document to  <br>RFI system | [Upload Document API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/upload-document-api/) | Required only if the Customer wants to upload documents which can be later linked to a request.  <br>[FIND OUT MORE](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/how-it-works/#upload-a-document) |
| Provide Customer response  <br>to a RFI request | [Update API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/update-request-api/) | Mandatory step to respond to a request.  <br>[FIND OUT MORE](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/how-it-works/#submit-response) |

# Actions to retrieve a RFI request

| Actions | API | Description |
| --- | --- | --- |
| Retrieve the existing RFI Request | [Retrieve RFI Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/retrieve-request-api/) | This is used to retrieve the latest information of a RFI request. |

# RFI Response review and request closure

The RFI Team will review the additional information provided by the Customer. If all the information is approved, then the RFI will transition to a **Closed status**. When Closed, no further activity is required for the request. The request remains available in read-only mode.  
  
The RFI Team may require additional information to the original details provided. If this occurs, the request will be re-assigned to the Customer. The Customer receives a webhook notification with requestStatus =**InProgress**. The Customer will be informed of the rejected response data, or additional information required. Review comments may be added indicating why the information was rejected, and what additional information is required. The Customer is required to edit the rejected information and submit an updated response, after which the RFI will transition to **Review** status, and the review workflow will begin once again.


---
title: Notification
---

# API

  
This RFI Push Notification will inform a Customer of the current status of a RFI request. Look at the RFI process description and [How it works](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/how-it-works) for details on how to use the Push Notification for a cross border RFI solution.  

For more information on configuring a push notification, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/push-notifications-details/).

# Environment domains

This is a push notification and webhook endpoint will need to be provided by you for Mastercard to send the RFI Request notifications.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/notification/#operation/Webhook)

Inform the customer of the current status of a RFI request.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/webhooks

MTF URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/webhooks

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/webhooks

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/ json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example- application/json

# Payload Encryption

The payload sent by Mastercard will be encrypted. You will need to decrypt the payload sent by Mastercard.  
For more detailed information on payload **Encryption/Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

Not Applicable

# Sample Requests

## 1\. RFI request created and assigned to Customer requesting for Sender’s full name for single payment transaction; Notification for requestStatus Open.

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "transactionType": "RFI",
  "eventRef": "69aa98a4-a93a-4cab-b179-bbe7433e8b58",
  "eventType": "CREATED",
  "notification": {
    "assignee": "BEL_MASEND5ged2",
    "creator": "Mastercard",
    "lastUpdatedDate": "2021-10-25T11:05:00.000+00:00",
    "other": {
      "requestDocuments": {
        "response": {
          "value": []
        }
      },
      "responseDocuments": {
        "response": {
          "value": {
            "request": {
              "label": "Additional attachments",
              "kind": "multi_file"
            },
            "response": {
              "value": []
            }
          }
        }
      }
    },
    "requestCreateDate": "2021-10-25T11:05:00.000+00:00",
    "requestId": "20ef5aef-0598-4741-9945-c0bafc7b5a98",
    "requestInstruction": "Please provide the information requested.",
    "requestStatus": "OPEN",
    "responseType": "NoResponse",
    "sender": {
      "fullName": {
        "request": {
          "label": "Full name",
          "kind": "text"
        },
        "response": {
          "value": ""
        }
      }
    },
    "transactions": [
      {
        "paymentDateTime": "2021-10-15T11:05:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "Trans3999034810154901"
      }
    ]
  },
  "requestStatus": {
    "requestHistory": [
      {
        "eventActor": "Mastercard",
        "eventRef": "20da8559-ff57-48ec-855a-be159dcdde45",
        "eventType": "REQUEST_CREATED",
        "timestamp": "2021-10-25T11:05:00.000+00:00"
      }
    ]
  }
}
```

## 2\. RFI request created and assigned to Customer requesting for Sender’s full name for multiple payment transactions; Notification for requestStatus Open.

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "transactionType": "RFI",
  "eventRef": "69aa98a4-a93a-4cab-b179-bbe7433e8b58",
  "eventType": "CREATED",
  "notification": {
    "assignee": "BEL_MASEND5ged2",
    "creator": "Mastercard",
    "lastUpdatedDate": "2021-10-25T11:05:00.000+00:00",
    "other": {
      "requestDocuments": {
        "response": {
          "value": []
        }
      }
    },
    "requestCreateDate": "2021-10-25T11:05:00.000+00:00",
    "requestId": "20ef5aef-0598-4741-9945-c0bafc7b5a98",
    "requestInstruction": "Please provide the information requested.",
    "requestStatus": "OPEN",
    "responseType": "NoResponse",
    "sender": {
      "fullName": {
        "request": {
          "label": "Full name",
          "kind": "text"
        }
      }  
    },
    "transactions": [
      {
        "paymentDateTime": "2021-10-18T11:05:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "Trans199034810154901"
      },
{
        "paymentDateTime": "2021-10-20T11:05:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "Trans2999034810154901"
      },
{
        "paymentDateTime": "2021-10-15T11:05:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "Trans3999034810154901"
      }
    ]
  },
  "requestStatus": {
    "requestHistory": [
      {
        "eventActor": "Mastercard",
        "eventRef": "20da8559-ff57-48ec-855a-be159dcdde45",
        "eventType": "REQUEST_CREATED",
        "timestamp": "2021-10-25T11:05:00.000+00:00"
      }
    ]
  }
}
```

## 3\. RFI request assigned to Customer with a file attached by MC RFI Team(requestDocument); Notification for requestStatus Open.

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "transactionType": "RFI",
  "eventRef": "69aa98a4-a93a-4cab-b179-bbe7473e8b58",
  "eventType": "CREATED",
  "notification": {
    "assignee": "BEL_MASEND5ged2",
    "creator": "Mastercard",
    "lastUpdatedDate": "2021-10-25T18:33:01.331732549Z",
    "other": {
      "requestDocuments": {
        "response": {
          "value": [
            "c08a3ea5-9c1f-4b22-96ae-db1446004136",
            "30a8fbb8-ef0f-4dfb-ac0b-5d4327795c34",
            "d0204872-6890-46b7-ae6a-70a2168a50f8"
          ]
        }
      },
      "responseDocuments": {
        "response": {
          "value": {
            "request": {
              "label": "Additional attachments",
              "kind": "multi_file"
            },
            "response": {
              "value": []
            }
          }
        }
      }
    },
    "requestCreateDate": "2021-10-25T18:33:01.331732549Z",
    "requestId": "30240814-582c-4a96-86d1-72db20d9afb0",
    "requestInstruction": "Please provide the information requested.",
    "requestStatus": "OPEN",
    "responseType": "NoResponse",
    "sender": {
      "fullName": {
        "request": {
          "label": "Full name",
          "kind": "text"
        },
        "response": {
          "value": ""
        }
      }
    },
    "transactions": [
      {
        "paymentDateTime": "2021-10-25T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "0999999034810154901"
      }
    ]
  },
  "requestStatus": {
    "requestHistory": [
      {
        "eventActor": "Mastercard",
        "eventRef": "70b30d2b-4c42-4904-b596-c00e193169dc",
        "eventType": "REQUEST_CREATED",
        "timestamp": "2021-10-25T13:33:01.351385506-05:00"
      }
    ]
  }
}
```

## 4\. RFI request created and assigned to Customer requesting recipient’s passport details; Notification for requestStatus Open.

```JSON
{
	"partnerId": "BEL_MASEND5ged2",
	"transactionType": "RFI",
	"eventRef": "69aa98a4-a93a-4cab-b179-bbe7433e8b58",
	"eventType": "CREATED",
	"notification": {
		"assignee": "BEL_MASEND5ged2",
		"creator": "Mastercard",
		"lastUpdatedDate": "2021-10-25T22:29:42.149617073Z",
		"other": {
			"requestDocuments": {
				"response": {
					"value": []
				}
			}
},
		"recipient": {
			"additionalQuestion": {
        "request": {
          "label": "Passport details",
          "kind": "text"
        }
      }  
		},
		"requestCreateDate": "2021-10-25T22:29:42.149617073Z",
		"requestId": "20d5fc18-f506-4cff-a28e-2d3ad5667e70",
		"requestInstruction": "Please provide the information requested.",
		"requestStatus": "OPEN",
		"responseType": "NoResponse",
		"transactions": [
			{
				"paymentDateTime": "2021-10-18T12:00:00.000+00:00",
				"recipientUri": "",
				"senderUri": "",
				"transactionReference": "0999999034810154901"
			}
		]
	},
	"requestStatus": {
		"requestHistory": [
			{
				"eventActor": "Mastercard",
				"eventRef": "20e73791-3e23-4d40-b66f-8898c1fade10",
				"eventType": "REQUEST_CREATED",
				"timestamp": "2021-10-25T17:29:42.176966855-05:00"
			}
		]
	}
}
```

## 5\. RFI request created and assigned to Customer requesting Sender, recipient and paymentAndDocs; Notification for requestStatus Open.

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "transactionType": "RFI",
  "eventRef": "69aa98a4-a93a-4cab-b179-bbe7433e8b58",
  "eventType": "CREATED",
  "notification": {
    "assignee": "BEL_MASEND5ged2",
    "creator": "Mastercard",
    "lastUpdatedDate": "2021-10-25T22:29:42.149617073Z",
    "other": {
      "requestDocuments": {
        "response": {
          "value": []
        }
      },
      "responseDocuments": {
        "response": {
          "value": {
            "request": {
              "label": "Additional attachments",
              "kind": "multi_file"
            },
            "response": {
              "value": []
            }
          }
        }
      }
    },
    "paymentAndDocs": {
      "additionalQuestion": {
        "request": {
          "label": "Explain in detail why there are three separate payments to beneficiary on same day",
          "kind": "text"
        },
        "response": {
          "value": ""
        }
      }
    },
    "recipient": {
      "additionalQuestion": {
        "request": {
          "label": "Passport details",
          "kind": "text"
        },
        "response": {
          "value": ""
        }
      }
    },
    "requestCreateDate": "2021-10-25T22:29:42.149617073Z",
    "requestId": "20d5fc18-f506-4cff-a28e-2d3ad5667e70",
    "requestInstruction": "Please provide the information requested.",
    "requestStatus": "OPEN",
    "responseType": "NoResponse",
    "sender": {
      "additionalQuestion": {
        "request": {
          "label": "Sender's occupation",
          "kind": "text"
        },
        "response": {
          "value": ""
        }
      }
    },
    "transactions": [
      {
        "paymentDateTime": "2021-10-18T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "0999999034810154901"
      },
      {
        "paymentDateTime": "2021-10-18T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "ABC9999034810154901"
      },
      {
        "paymentDateTime": "2021-10-18T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "DEF9999034810154901"
      }
    ]
  },
  "requestStatus": {
    "requestHistory": [
      {
        "eventActor": "Mastercard",
        "eventRef": "20e73791-3e23-4d40-b66f-8898c1fade10",
        "eventType": "REQUEST_CREATED",
        "timestamp": "2021-10-25T17:29:42.176966855-05:00"
      }
    ]
  }
}
```

## 6\. RFI request created and assigned to Customer requesting some additional documents related to payment; Notification for requestStatus Open.

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "transactionType": "RFI",
  "eventRef": "69aa98a4-a93a-4cab-b179-bbe7433e8b58",
  "eventType": "CREATED",
  "notification": {
    "assignee": "BEL_MASEND5ged2",
    "creator": "Mastercard",
    "lastUpdatedDate": "2021-10-28T19:23:19.095090761Z",
    "other": {
      "requestDocuments": {
        "response": {
          "value": []
        }
      }
    },
    "paymentAndDocs": {
      "additionalDocuments": {
        "request": {
          "label": "If sender’s source of funds is his/her SALARY, kindly provide 3 consecutive pay stubs",
          "kind": "multi_file"
        }
      }
    },
    "requestCreateDate": "2021-10-28T19:23:19.095090761Z",
    "requestId": "00de63a7-b99a-4e53-940f-b1c2cd08f292",
    "requestInstruction": "Please provide the information requested.",
    "requestStatus": "OPEN",
    "transactions": [
      {
        "paymentDateTime": "2021-10-28T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "0999999034810154901"
      }
    ]
  },
  "requestStatus": {
    "requestHistory": [
      {
        "eventActor": "Mastercard",
        "eventRef": "d0171607-6b40-4d35-a021-78a8bcd93524",
        "eventType": "REQUEST_CREATED",
        "timestamp": "2021-10-28T14:23:19.113474483-05:00"
      }
    ]
  }
}
```

## 7\. RFI request created and assigned to Customer requesting multiple documents; Notification for requestStatus Open.

```JSON
{
  "partnerId": "BEL_MASEND5ged2",
  "transactionType": "RFI",
  "eventRef": "69aa98a4-a93a-4cab-b179-bbe7433e8b58",
  "eventType": "CREATED",
  "notification": {
    "assignee": "BEL_MASEND5ged2",
    "creator": "Mastercard",
    "lastUpdatedDate": "2021-10-28T19:23:19.095090761Z",
    "other": {
      "requestDocuments": {
        "response": {
          "value": []
        }
      },
      "responseDocuments": {
        "response": {
          "value": {
            "request": {
              "label": "Additional attachments",
              "kind": "multi_file"
            },
            "response": {
              "value": []
            }
          }
        }
      }
    },
    "paymentAndDocs": {
      "additionalDocuments": {
        "request": {
          "label": "If sender’s source of funds is his/her SALARY, kindly provide 3 consecutive pay stubs",
          "kind": "multi_file"
        },
        "response": {
          "value": []
        }
      },
      "supportingDocs": {
        "request": {
          "label": "Copy of supporting documentation for business payments (e.g. invoice, collaboration agreements, etc.)",
          "kind": "multi_file"
        },
        "response": {
          "value": []
        }
      }
    },
    "recipient": {
      "additionalDocuments": {
        "request": {
          "label": "Addition proof of Identity such as a passport, an ID card, a driver license",
          "kind": "multi_file"
        },
        "response": {
          "value": []
        }
      }
    },
    "requestCreateDate": "2021-10-28T19:23:19.095090761Z",
    "requestId": "00de63a7-b99a-4e53-940f-b1c2cd08f292",
    "requestInstruction": "Please provide the information requested.",
    "requestStatus": "OPEN",
    "responseType": "NoResponse",
    "sender": {
      "additionalDocuments": {
        "request": {
          "label": "Proof of residence such as a utility bill or account statement",
          "kind": "multi_file"
        },
        "response": {
          "value": []
        }
      },
      "fullAddress": {
        "documents": {
          "request": {
            "label": "Proof of address",
            "kind": "multi_file"
          },
          "response": {
            "value": []
          }
        },
        "request": {
          "label": "Full address",
          "kind": "address"
        }
      },
      "governmentId": {
        "documents": {
          "request": {
            "label": "Copy of ID",
            "kind": "multi_file"
          },
          "response": {
            "value": []
          }
        }
      }
    },
    "transactions": [
      {
        "paymentDateTime": "2021-10-28T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "0999999034810154901"
      }
    ]
  },
  "requestStatus": {
    "requestHistory": [
      {
        "eventActor": "Mastercard",
        "eventRef": "d0171607-6b40-4d35-a021-78a8bcd93524",
        "eventType": "REQUEST_CREATED",
        "timestamp": "2021-10-28T14:23:19.113474483-05:00"
      }
    ]
  }
}
```

## 8\. RFI request assigned to Customer where additional information is requested by MC RFI team for Sender’s name; previous response provided by Customer is rejected; Notification for requestStatus INPROGRESS.

```JSON
{
    "partnerId": "BEL_MASEND5ged2",
    "transactionType": "RFI",
    "eventRef": "69aa98a4-a93a-4cab-b179-bbe7433e8b58",
    "eventType": "STATUS_CHG",
    "notification": {
        "assignee": "BEL_MASEND5ged2",
        "creator": "Mastercard",
        "firstResponseDate": "2021-10-25T11:10:00.000+00:00",
        "lastUpdatedDate": "2021-10-25T11:55:00.000+00:00",
        "other": {
            "comments": [
                {
                    "creator": "Mastercard",
                    "text": "Name provided for Sender does not match payment details. Please validate",
                    "timestamp": "2021-06-15T04:07:00-05:00"
                }
            ],
            "requestDocuments": {
                "response": {
                    "value": []
                }
            },
            "responseDocuments": {
                "response": {
                    "value": {
                        "review": {
              "status": "Approved"
            },
                        "request": {
                            "label": "Additional attachments",
                            "kind": "multi_file"
                        },
                        "response": {
                            "value": []
                        }
                    }
                }
            }
        },
        "requestCreateDate": "2021-10-25T11:05:00.000+00:00",
        "requestId": "20ef5aef-0598-4741-9945-c0bafc7b5a98",
        "requestInstruction": "Please provide the information requested.",
        "requestStatus": "INPROGRESS",
        "responseType": "PartialResponse",
        "sender": {
      "fullName": {
        "review": {
          "status": "Rejected"
        },
        "request": {
          "label": "Full name",
          "kind": "text"
        },
        "response": {
          "value": "John Doe"
        }
      }
				},
      "transactions": [
          {
          "paymentDateTime": "2021-10-18T11:05:00.000+00:00",
          "recipientUri": "",
          "senderUri": "",
          "transactionReference": "0999999034810154901"
         }
        ]      
            },
            "requestStatus": {
                "requestHistory": [
                    {
                        "eventActor": "Mastercard",
                        "eventRef": "f01e0d8c-a591-474c-abf4-3daff165c845",
                        "eventType": "CHANGES_REQUESTED",
                        "timestamp": "2021-10-25T11:55:00.000+00:00"
                    },
                    {
                        "eventActor": "BEL_MASEND5ged2",
                        "eventRef": "f05bd8a9-9361-486a-a499-ba7fc2802753",
                        "eventType": "RESPONSE_SUBMITTED",
                        "timestamp": "2021-10-25T11:10:00.000+00:00"
                    },
                    {
                        "eventActor": "Mastercard",
                        "eventRef": "20da8559-ff57-48ec-855a-be159dcdde45",
                        "eventType": "REQUEST_CREATED",
                        "timestamp": "2021-10-25T11:05:00.000+00:00"
                    }
                ]
            }
        }
```

## 9\. RFI request assigned to Customer where amendments/additional information is requested by MC RFI team; where Sender’s full name response is approved, Sender’s Government ID response is rejected and Notification for requestStatus INPROGRESS.

```JSON
{
    "partnerId": "BEL_MASEND5ged2",
    "transactionType": "RFI",
    "eventRef": "69aa98a4-a93a-4cab-b179-bbe7433e8b58",
    "eventType": "STATUS_CHG",
    "notification": {
        "assignee": "BEL_MASEND5ged2",
        "creator": "Mastercard",
        "firstResponseDate": "2021-10-25T11:10:00.000+00:00",
        "lastUpdatedDate": "2021-10-25T11:55:00.000+00:00",
        "other": {
            "comments": [
                {
                    "creator": "Mastercard",
                    "text": "Please upload pictures with maximum resolution",
                    "timestamp": "2021-06-15T04:07:00-05:00"
                }
            ],
            "requestDocuments": {
                "response": {
                    "value": []
                }
            },
            "responseDocuments": {
                "response": {
                    "value": {
                        "review": {
              "status": "Approved"
            },
                        "request": {
                            "label": "Additional attachments",
                            "kind": "multi_file"
                        },
                        "response": {
                            "value": []
                        }
                    }
                }
            }
        },
        "requestCreateDate": "2021-10-25T11:05:00.000+00:00",
        "requestId": "20ef5aef-0598-4741-9945-c0bafc7b5a98",
        "requestInstruction": "Please provide the information requested.",
        "requestStatus": "INPROGRESS",
        "responseType": "PartialResponse",
        "sender": {
      "fullName": {
        "review": {
          "status": "Approved"
        },
        "request": {
          "label": "Full name",
          "kind": "text"
        },
        "response": {
          "value": "John Doe"
        }
      },
      "governmentId": {
        "type": {
					"request": {
            "label": "Share details",
						"kind": "string"
          },
          "review": {
            "status": "Approved"
          },
          "response": {
            "value": "Answer"
					}
				},
        "documents": {
            "request": {
              "label": "Copy of Id",
              "kind": "string"
            },
            "review": {
              "status": "Rejected"
            },
            "response": {
              "value": [
                "3fa85f64-5717-4562-b3fc-2c963f66afa6"
              ]
            }
          }
        }
      },
     		"transactions": [
        {
          "paymentDateTime": "2021-10-18T11:05:00.000+00:00",
          "recipientUri": "",
          "senderUri": "",
          "transactionReference": "0999999034810154901"
        }
       ]      
     },
            "requestStatus": {
                "requestHistory": [
                    {
                        "eventActor": "Mastercard",
                        "eventRef": "f01e0d8c-a591-474c-abf4-3daff165c845",
                        "eventType": "CHANGES_REQUESTED",
                        "timestamp": "2021-10-25T11:55:00.000+00:00"
                    },
                    {
                        "eventActor": "BEL_MASEND5ged2",
                        "eventRef": "f05bd8a9-9361-486a-a499-ba7fc2802753",
                        "eventType": "RESPONSE_SUBMITTED",
                        "timestamp": "2021-10-25T11:10:00.000+00:00"
                    },
                    {
                        "eventActor": "Mastercard",
                        "eventRef": "20da8559-ff57-48ec-855a-be159dcdde45",
                        "eventType": "REQUEST_CREATED",
                        "timestamp": "2021-10-25T11:05:00.000+00:00"
                    }
                ]
            }
        }
```

## 10\. RFI request is closed; Notification for requestStatus CLOSED .

```JSON
{
    "partnerId": "BEL_MASEND5ged2",
    "transactionType": "RFI",
    "eventRef": "69aa98a4-a93a-4cab-b179-bbe7433e8b58",
    "eventType": "STATUS_CHG",
    "notification": {
        "assignee": "BEL_MASEND5ged2",
        "creator": "Mastercard",
        "firstResponseDate": "2021-10-25T11:10:00.000+00:00",
        "lastUpdatedDate": "2021-10-25T11:55:00.000+00:00",
        "other": {
            "comments": [
                {
                    "creator": "Mastercard",
                    "text": "RFI closed as required details no provided on time",
                    "timestamp": "2021-06-15T04:07:00-05:00"
                }
            ],
            "requestDocuments": {
                "response": {
                    "value": []
                }
            },
            "responseDocuments": {
                "response": {
                    "value": {
                        "review": {
              "status": "Approved"
            },
                        "request": {
                            "label": "Additional attachments",
                            "kind": "multi_file"
                        },
                        "response": {
                            "value": []
                        }
                    }
                }
            }
        },
        "requestCreateDate": "2021-10-25T11:05:00.000+00:00",
        "requestId": "20ef5aef-0598-4741-9945-c0bafc7b5a98",
        "requestInstruction": "Please provide the information requested.",
        "requestStatus": "CLOSED",
        "responseType": "PartialResponse",
        "sender": {
            "fullName": {
        "review": {
          "status": "Rejected"
        },
        "request": {
          "label": "Full name",
          "kind": "text"
        },
        "response": {
          "value": "John Doe"
        }
      },          
            "governmentId": {
                "type": {
	  "request": {
            "label": "Share details",
	    "kind": "string"
          },
          "review": {
            "status": "Approved"
          },
          "response": {
            "value": "Answer"
					}
				},
                "documents": {
                        "request": {
                            "label": "Copy of Id",
                            "kind": "string"
                        },
                        "review": {
                            "status": "Approved"
                        },
                        "response": {
              "value": [
                "3fa85f64-5717-4562-b3fc-2c963f66afa6"
              ]
            }
                        }
                    }
                },
       "transactions": [
                    {
                        "paymentDateTime": "2021-10-18T11:05:00.000+00:00",
                        "recipientUri": "",
                        "senderUri": "",
                        "transactionReference": "0999999034810154901"
                    }
                ]
            },
       "requestStatus": {
                "requestHistory": [
                    {
                        "eventActor": "Mastercard",
                        "eventRef": "f01e0d8c-a591-474c-abf4-3daff165c845",
                        "eventType": "CLOSED",
                        "timestamp": "2021-10-25T11:55:00.000+00:00"
                    },
                    {
                        "eventActor": "BEL_MASEND5ged2",
                        "eventRef": "f05bd8a9-9361-486a-a499-ba7fc2802753",
                        "eventType": "RESPONSE_SUBMITTED",
                        "timestamp": "2021-10-25T11:10:00.000+00:00"
                    },
                    {
                        "eventActor": "Mastercard",
                        "eventRef": "20da8559-ff57-48ec-855a-be159dcdde45",
                        "eventType": "REQUEST_CREATED",
                        "timestamp": "2021-10-25T11:05:00.000+00:00"
                    }
                ]
            }
        }
```

## 11\. RFI request is cancelled; Notification for requestStatus CANCELLED .

```JSON
{
	"partnerId": "BEL_MASEND5ged2",
	"transactionType": "RFI",
	"eventRef": "69aa98a4-a93a-4cab-b179-bbe7433e8b58",
	"eventType": "STATUS_CHG",
	"notification": {
		"assignee": "BEL_MASEND5ged2",
		"creator": "Mastercard",
		"firstResponseDate": "2021-10-25T11:10:00.000+00:00",
		"lastUpdatedDate": "2021-10-25T11:55:00.000+00:00",
		"other": {
			"comments": [
				{
					"creator": "Mastercard",
					"text": "Response no longer required as OI has cancelled the payment",
					"timestamp": "2021-06-15T04:07:00-05:00"
				}
			],
			"requestDocuments": {
				"response": {
					"value": []
				}
			},
			"responseDocuments": {
				"response": {
					"value": {
						"request": {
							"label": "Additional attachments",
							"kind": "multi_file"
						},
						"response": {
							"value": []
						}
					}
				}
			}
		},
		"requestCreateDate": "2021-10-25T11:05:00.000+00:00",
		"requestId": "20ef5aef-0598-4741-9945-c0bafc7b5a98",
		"requestInstruction": "Please provide the information requested.",
		"requestStatus": "CANCELLED",
		"responseType": "NoResponse",
		"sender": {
			"fullName": {
				"request": {
					"label": "Full name",
					"kind": "text"
				}
			}
		},
				"transactions": [
					{
						"paymentDateTime": "2021-10-18T11:05:00.000+00:00",
						"recipientUri": "",
						"senderUri": "",
						"transactionReference": "0999999034810154901"
					}
				]
			},
			"requestStatus": {
				"requestHistory": [
					{
						"eventActor": "Mastercard",
						"eventRef": "f05bd8a9-9361-486a-a499-ba7fc2802753",
						"eventType": "CANCELLED",
						"timestamp": "2021-10-25T11:10:00.000+00:00"
					},
					{
						"eventActor": "Mastercard",
						"eventRef": "20da8559-ff57-48ec-855a-be159dcdde45",
						"eventType": "REQUEST_CREATED",
						"timestamp": "2021-10-25T11:05:00.000+00:00"
					}
				]
			}
}
```

# Sample Responses

No Response body

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

## Timeout

Please allow at least 40 seconds to receive a response from the RFI APIs before considering the request to have timed out, at which point you may retry the call. If consistent timeouts occur, please contact the Cross Border Services Customer Support team at **[crossborder.services.support@mastercard.com](mailto:crossborder.services.support@mastercard.com)**.

On this page

*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/notification/#api)
*   [Environment domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/notification/#environment-domains)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/notification/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/notification/#sandbox-testing)
*   [Sample Requests](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/notification/#sample-requests)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/notification/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/notification/#error-codes)

---
title: Download Document API
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, please proceed to [Download Document Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/psd2-eu-download-document-api/) and [Download Document Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/psd2-uk-download-document-api/) respectively to ensure compliance with the relevant jurisdiction based on Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

# API

  
This API will be used by the Customer to download a document assigned to a request. Look at the RFI process description [How it works](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/how-it-works) for details on how to use the Download Document API for a cross border RFI solution.

# Environment Domains

```Sandbox
https://sandbox.api.mastercard.com/send/partners/{partner_id}/crossborder/rfi/documents/{document_id}
```

```Production
https://api.mastercard.com/send/partners/{partner_id}/crossborder/rfi/documents/{document_id}
```

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/download-document-api/#operation/DownloadDocument)

Download a document assigned to a request.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/documents/{document\_id}

MTF URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/documents/{document\_id}

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/documents/{document\_id}

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/ json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example- application/json

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required OAuth 1.0a Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

## Test cases

| Status | Test Case | Action |
| --- | --- | --- |
| SUCCESS | Download a document/file from MC system | 1\. Trigger Upload Document with FileName (with file extension) and File content.  <br>2\. MC system would return a documentId is response.  <br>3\. Trigger Download Document using the documentId from Step2. |
| Rejected with specific error | Download Document with specific error code | 1\. Trigger Download Document using ‘documentId' starting with ‘1’ and ending with the desired error code. For example: ‘1XXXXXXX-XXXX-XXXX-XXXX-XXXXXX082000’ will REJECT download and return 082000 error code in response. |

# Sample Request

No Request Body

# Sample Responses

```JSON
{
  "downloadDocumentResponse": {
    "file": "77+977+9EeChsRrvv70AAAAAAAAAAAAAAAAAAAAAPgADAO+/ve+/vQkABgAAAAAAAAAAAAAAAQAAACAAAAAAAAAAABAAAO+/ve+/ve+/ve+/vQAAAADvv73vv73vv73vv70AAAAAHwAAAO+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/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AQAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAQAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAgAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAgAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9ABAAAAAAAAEAIADvv70gAAAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAABQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAAFQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAAFQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAAFQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAAFQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAAFQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAAFQAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAACwAAAO+/ve+/vSDvv73vv70gAQAAAAAA77+9ABAADwAAAO+/ve+/vSDvv73vv70gQS5JLu+/vQvvv70AEAARAAAA77+977+9IO+/ve+/vSDvv71/77+9f++/vR/vv70AEAAFACsA77+977+9IO+/ve+/vSAAAAAAAADvv70AEAAFACkA77+977+9IO+/ve+/vSAAAAAAAADvv70AEAAFACwA77+977+9IO+/ve+/vSAAAAAAAADvv70AEAAFACoA77+977+9IO+/ve+/vSAAAAAAAADvv70AEAATAAAA77+977+9IO+/ve+/vSAAAAAAAADvv70AEAAKAAAA77+977+9IO+/ve+/vSABAAAAAADvv70AEAAHAAAA77+977+9IO+/ve+/vSBAfQAAAADvv70AEAAIAAAA77+977+9IO+/ve+/vSBAWQAAAADvv70AEAAJAAAA77+977+9IO+/ve+/vSDvv71iAAAAAO+/vQAQAAkAAADvv73vv70g77+977+9IAAAAAAAAO+/vQAQAA0AAADvv73vv70g77+977+9IEEuSS7vv70L77+9ABAAEAAAAO+/ve+/vSDvv73vv70g77+9aQAAAADvv70AEAAMAAAA77+977+9IO+/ve+/vSABAAAAAADvv70AEAAFAAAA77+977+9IO+/ve+/vSBBLEksFgvvv70AEAAOAAAA77+977+9IO+/ve+/vSBBfkl+77+9H++/vQAQAAUACQDvv73vv70g77+977+9IAAAAAAAAO+/vQAQAAYAAADvv73vv70g77+977+9IAAAAAAAAO+/vQAQABQAAADvv73vv70g77+977+9IO+/vX0BfAAA77+9ABAAEgAAAO+/ve+/vSDvv73vv70gAAAAAAAA77+9AhAAEAANMjAlIC0gQWNjZW50Me+/vQhNAO+/vQgAAAAAAAAAAAAAAQQe77+9DQAyADAAJQAgAC0AIABBAGMAYwBlAG4AdAAxAAAAAwABAAwABwRlZu+/ve+/ve+/ve+/vQUADAAHAQAAAAAA77+9JQAFAALvv70CEAARAA0yMCUgLSBBY2NlbnQy77+9CE0A77+9CAAAAAAAAAAAAAABBCLvv70NADIAMAAlACAALQAgAEEAYwBjAGUAbgB0ADIAAAADAAEADAAHBWVm77+977+977+977+9BQAMAAcBAAAAAADvv70lAAUAAu+/vQIQABIADTIwJSAtIEFjY2VudDPvv70ITQDvv70IAAAAAAAAAAAAAAEEJu+/vQ0AMgAwACUAIAAtACAAQQBjAGMAZQBuAHQAMwAAAAMAAQAMAAcGZWbvv73vv73vv73vv70FAAwABwEAAAAAAO+/vSUABQAC77+9AhAAEwANMjAlIC0gQWNjZW50NO+/vQhNAO+/vQgAAAAAAAAAAAAAAQQq77+9DQAyADAAJQAgAC0AIABBAGMAYwBlAG4AdAA0AAAAAwABAAwABwdlZu+/ve+/ve+/ve+/vQUADAAHAQAAAAAA77+9JQAFAALvv70CEAAUAA0yMCUgLSBBY2NlbnQ177+9CE0A77+9CAAAAAAAAAAAAAABBC7vv70NADIAMAAlACAALQAgAEEAYwBjAGUAbgB0ADUAAAADAAEADAAHCGVm77+977+977+977+9BQAMAAcBAAAAAADvv70lAAUAAu+/vQIQABUADTIwJSAtIEFjY2VudDbvv70ITQDvv70IAAAAAAAAAAAAAAEEMu+/vQ0AMgAwACUAIAAtACAAQQBjAGMAZQBuAHQANgAAAAMAAQAMAAcJZWbvv73vv73vv73vv70FAAwABwEAAAAAAO+/vSUABQAC77+9AhAAFgANNDAlIC0gQWNjZW50Me+/vQhNAO+/vQgAAAAAAAAAAAAAAQQf77+9DQA0ADAAJQAgAC0AIABBAGMAYwBlAG4AdAAxAAAAAwABAAwABwTvv71M77+977+977+977+9BQAMAAcBAAAAAADvv70lAAUAAu+/vQIQABcADTQwJSAtIEFjY2VudDLvv70ITQDv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AwABAAwABe+/vQAA77+977+977+977+9BQAMAAXvv70AAO+/vVcA77+9JQAFAALvv70CBAAA77+9AO+/ve+/vQgzAO+/vQgAAAAAAAAAAAAAAQEA77+9BgBOAG8AcgBtAGEAbAAAAAIABQAMAAcBAAAAAADvv70lAAUAAu+/vQIHADgABE5vdGXvv70IYgDvv70IAAAAAAAAAAAAAAECCu+/vQQATgBvAHQAZQAAAAUAAQAMAAXvv70AAO+/ve+/ve+/ve+/vQYADgAF77+9AADvv73vv73vv73vv70BAAcADgAF77+9AADvv73vv73vv73vv70BAAgADgAF77+9AADvv73vv73vv73vv70BAAkADgAF77+9AADvv73vv73vv73vv70BAO+/vQIJADkABk91dHB1dO+/vQh3AO+/vQgAAAAAAAAAAAAAAQIV77+9BgBPAHUAdABwAHUAdAAAAAcAAQAMAAXvv70AAO+/ve+/ve+/ve+/vQUADAAF77+9AAA/Pz/vv70lAAUAAgYADgAF77+9AAA/Pz/vv70BAAcADgAF77+9AAA/Pz/vv70BAAgADgAF77+9AAA/Pz/vv70BAAkADgAF77+9AAA/Pz/vv70BAO+/vQIEADrvv70F77+977+9CCQA77+9CAAAAAAAAAAAAAABBQXvv70HAFAAZQByAGMAZQBuAHQAAAAAAO+/vQIIADsABVRpdGxl77+9CDEA77+9CAAAAAAAAAAAAAABAw/vv70FAFQAaQB0AGwAZQAAAAIABQAMAAcDAABEVGrvv70lAAUAAe+/vQIIADwABVRvdGFs77+9CE0A77+9CAAAAAAAAAAAAAABAxnvv70FAFQAbwB0AGEAbAAAAAQABQAMAAcBAAAAAADvv70lAAUAAgYADgAHBAAARHLvv73vv70BAAcADgAHBAAARHLvv73vv70GAO+/vQIPAD0ADFdhcm5pbmcgVGV4dO+/vQg/AO+/vQgAAAAAAAAAAAAAAQIL77+9DABXAGEAcgBuAGkAbgBnACAAVABlAHgAdAAAAAIABQAMAAXvv70AAO+/vQAA77+9JQAFAALvv70A77+9ADgAAAAAAO+/ve+/ve+/vQDvv70AAAAA77+9AAAAAO+/vQDvv73vv70AAO+/vQDvv70AAO+/ve+/vQDvv70AAAAA77+9AAAAAO+/vQDvv73vv70AAO+/vQDvv70AAO+/ve+/vQDvv73vv73vv70A77+977+977+9AO+/ve+/ve+/vQDvv70zZgDvv73vv73vv70A77+977+977+9AGYAZgDvv73vv73vv70AAGbvv70A77+977+977+9AAAA77+9AO+/vQDvv70A77+977+9AAAA77+977+9AO+/vQDvv70A77+9AAAAAO+/ve+/vQAAAO+/vQAA77+977+9AO+/ve+/ve+/vQDvv73vv73vv70A77+977+977+9AO+/ve+/ve+/vQDvv73vv73vv70AzJnvv70A77+977+977+9ADNm77+9ADPvv73vv70A77+977+9AADvv73vv70AAO+/ve+/vQAA77+9ZgAAZmbvv70A77+977+977+9AAAzZgAz77+9ZgAAMwAAMzMAAO+/vTMAAO+/vTNmADMz77+9ADMzMwDvv70ADQBCGwAAAAAGU2hlZXQxCgAAAAkICAAABhAAClTvv70HCwIMAAAAAAAAAAAAJhwAAA0AAgABAAwAAgBkAA8AAgABABEAAgAAABAACADvv73vv73vv73vv71NYlA/XwACAAEAKgACAAAAKwACAAAA77+9AAIAAQDvv70ACAAAAAAAAAAAACUCBAAAACIB77+9AAQAAQABAO+/vQACAO+/vQQUAAAAFQAAAO+/vQACAAAA77+9AAIAAAAmAAgAZmZmZmZm77+9PycACABmZmZmZmbvv70/KAAIAAAAAAAAAO+/vT8pAAgAAAAAAAAA77+9P++/vQAiAAAAAQABAAEAAQBEADEAAO+/vTMzMzMzM++/vT8zMzMzMzPvv70/77+9AFUAAgAIAAACCgAAAAAAAAAAAAAAPQASAO+/vX/vv71/FDfvv70cOAAAAAAAAQBYAj4CCgDvv70GAAAAAAAAAAAdAA8AAwoAAQAAAAEACgAKAAEBCgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA77+977+9AAAKAAIAAAAAAAAAAAAAAAAAAAAAAAEAAADvv73vv73vv73vv73vv71PaBDvv73vv70IACsn77+977+9MAAAAO+/vQAAAAcAAAABAAAAQAAAAAQAAABIAAAACAAAAFwAAAASAAAAcAAAAAwAAADvv70AAAANAAAA77+9AAAAEwAAAO+/vQAAAAIAAADvv70EAAAeAAAADAAAAEpvaG4sIFN1c2FuAB4AAAAMAAAASm9obiwgU3VzYW4AHgAAABAAAABNaWNyb3NvZnQgRXhjZWwAQAAAAABy77+9PAdt77+9AUAAAAAA77+9FFIHbe+/vQEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADvv73vv70AAAoAAgAAAAAAAAAAAAAAAAAAAAAAAQAAAALvv73vv73VnC4bEO+/ve+/vQgAKyzvv73vv70wAAAA77+9AAAABgAAAAEAAAA4AAAADwAAAEAAAAALAAAATAAAABAAAABUAAAADQAAAFwAAAAMAAAAbwAAAAIAAADvv70EAAAeAAAABAAAAAAAAAALAAAAAAAAAAsAAAAAAAAAHhAAAAEAAAAHAAAAU2hlZXQxAAwQAAACAAAAHgAAAAsAAABXb3Jrc2hlZXRzAAMAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAgAAAAMAAAAEAAAABQAAAAYAAAAHAAAACAAAAAkAAAAKAAAACwAAAAwAAAANAAAADgAAAO+/ve+/ve+/ve+/vRAAAAARAAAAEgAAABMAAAAUAAAAFQAAABYAAADvv73vv73vv73vv70YAAAAGQAAABoAAAAbAAAAHAAAAB0AAAAeAAAA77+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+9UgBvAG8AdAAgAEUAbgB0AHIAeQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYABQHvv73vv73vv73vv73vv73vv73vv73vv70CAAAAEAgCAAAAAADvv70AAAAAAABGAAAAAAAAAAAAAAAAAAAAAAAAAADvv73vv73vv73vv70AAAAAAAAAAEIAbwBvAGsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKAAIB77+977+977+977+977+977+977+977+977+977+977+977+9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHUcAAAAAAAABQBTAHUAbQBtAGEAcgB5AEkAbgBmAG8AcgBtAGEAdABpAG8AbgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACgAAgEBAAAAAwAAAO+/ve+/ve+/ve+/vQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAEAAAAAAAAAUARABvAGMAdQBtAGUAbgB0AFMAdQBtAG0AYQByAHkASQBuAGYAbwByAG0AYQB0AGkAbwBuAAAAAAAAAAAAAAA4AAIB77+977+977+977+977+977+977+977+977+977+977+977+9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFwAAAAAQAAAAAAAA",
    "fileName": "Additional proof.xls",
    "referenceId": "904c63a6-6220-4d94-8abd-a1d1f19354c1"
  }
}
```

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

## Timeout

Please allow at least 40 seconds to receive a response from the RFI APIs before considering the request to have timed out, at which point you may retry the call. If consistent timeouts occur, please contact the Cross Border Services Customer Support team at **[crossborder.services.support@mastercard.com](mailto:crossborder.services.support@mastercard.com)**.

On this page

*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/download-document-api/#api)
*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/download-document-api/#environment-domains)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/download-document-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/download-document-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/download-document-api/#sandbox-testing)
*   [Sample Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/download-document-api/#sample-request)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/download-document-api/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/download-document-api/#error-codes)


---
title: Upload Document API
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, please proceed to [Upload Document API Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/psd2-eu-upload-document-api/) and [Upload Document API Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/psd2-uk-upload-document-api/) respectively to ensure compliance with the relevant jurisdiction based on Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/partners/{partner_id}/crossborder/rfi/documents
```

```Production
https://api.mastercard.com/send/partners/{partner_id}/crossborder/rfi/documents
```

# API

  
This API will be used by the Customer to upload a document to the MC system. Look at the RFI process description [How it works](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/how-it-works) for details on how to use the Upload Document API for a cross border RFI solution.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/upload-document-api/#operation/UploadDocument)

Upload a document to RFI tool.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/documents

MTF URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/documents

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/documents

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/ json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example- application/json

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required OAuth 1.0a Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

## Test Cases

| Status | Test Case | Action |
| --- | --- | --- | --- |
| SUCCESS | Upload a document/file (file size less than 1 MB) to MC system | 1\. Trigger Upload Document with FileName and File content.  <br>2\. MC system would return a documentId is response. |
| REJECTION | Upload a document/file (file size exceeds1 MB) to MC system | 1\. Trigger UploadDocument with FileName and File string along with x-encrypted= true in header.  <br>2\. System will return 130214 error. |
| REJECTION | Upload a document/file with an unsupported file format( eg.. txt file) to MC system | 1\. Trigger Upload Document with FileName and File content.  <br>2\. System will return 062000 error. |
| Rejected with specific error | Upload a Document with specific error code | 1\. Trigger Upload Document using ‘FileName' starting with ‘1’ and ending with the desired error code. For example: ‘1XXXXXXXX082000’ will REJECT download and return 082000 error code in response. |  

# Sample Requests

```JSON
{
  "uploadDocumentRequest": {
    "fileName": "Passport copy.pdf",
    "file": "JVBERi0xLjcNCiW1tbW1DQoxIDAgb2JqDQo8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFIvTGFuZyhlbi1VUykgL1N0cnVjdFRyZWVSb290IDEzIDAgUi9PdXRsaW5lcyAxMCAwIFIvTWFya0luZm88PC9NYXJrZWQgdHJ1ZT4+L01ldGFkYXRhIDI2IDAgUi9WaWV3ZXJQcmVmZXJlbmNlcyAyNyAwIFI+Pg0KZW5kb2JqDQoyIDAgb2JqDQo8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1sgMyAwIFJdID4+DQplbmRvYmoNCjMgMCBvYmoNCjw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvUmVzb3VyY2VzPDwvRXh0R1N0YXRlPDwvR1M1IDUgMCBSL0dTNiA2IDAgUj4+L0ZvbnQ8PC9GMSA3IDAgUj4+L1Byb2NTZXRbL1BERi9UZXh0L0ltYWdlQi9JbWFnZUMvSW1hZ2VJXSA+Pi9NZWRpYUJveFsgMCAwIDYxMiA3OTJdIC9Db250ZW50cyA0IDAgUi9Hcm91cDw8L1R5cGUvR3JvdXAvUy9UcmFuc3BhcmVuY3kvQ1MvRGV2aWNlUkdCPj4vVGFicy9TL1N0cnVjdFBhcmVudHMgMD4+DQplbmRvYmoNCjQgMCBvYmoNCjw8L0ZpbHRlci9GbGF0ZURlY29kZS9MZW5ndGggMjI1Pj4NCnN0cmVhbQ0KeJxtkEtrAjEUhfeB/IezTARn7r2TzAMGF45WKgiVCXRRXLhwBkRLH4v+/SYi1LZuksA9537nBPkT2jbfdI8L0GyG+aLDu1YEyoiI64IZJQuqRvBx0Op5gtc4ziqPL63yVe8xfib9Sisw1ojHEcn/y9ZrtY2C5aYDboh8JcY95WUPY9RKCgfvCJXE62IfJokpLjH/ov6r+zskuemWmhE1MR7d6TYPsdcDo0YYUqBUhSG+zsTDly5zHuGccozXMC+mt1ybvZ1KYc52yqV5syLmFJ+NOdgdwlqrZfj5g2/3DUhGDQplbmRzdHJlYW0NCmVuZG9iag0KNSAwIG9iag0KPDwvVHlwZS9FeHRHU3RhdGUvQk0vTm9ybWFsL0NBIDE+Pg0KZW5kb2JqDQo2IDAgb2JqDQo8PC9UeXBlL0V4dEdTdGF0ZS9CTS9Ob3JtYWwvY2EgMT4+DQplbmRvYmoNCjcgMCBvYmoNCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1RydWVUeXBlL05hbWUvRjEvQmFzZUZvbnQvQkNERUVFK0NhbGlicmkvRW5jb2RpbmcvV2luQW5zaUVuY29kaW5nL0ZvbnREZXNjcmlwdG9yIDggMCBSL0ZpcnN0Q2hhciA4My9MYXN0Q2hhciAxMTIvV2lkdGhzIDI0IDAgUj4+DQplbmRvYmoNCjggMCBvYmoNCjw8L1R5cGUvRm9udERlc2NyaXB0b3IvRm9udE5hbWUvQkNERUVFK0NhbGlicmkvRmxhZ3MgMzIvSXRhbGljQW5nbGUgMC9Bc2NlbnQgNzUwL0Rlc2NlbnQgLTI1MC9DYXBIZWlnaHQgNzUwL0F2Z1dpZHRoIDUyMS9NYXhXaWR0aCAxNzQzL0ZvbnRXZWlnaHQgNDAwL1hIZWlnaHQgMjUwL1N0ZW1WIDUyL0ZvbnRCQm94WyAtNTAzIC0yNTAgMTI0MCA3NTBdIC9Gb250RmlsZTIgMjUgMCBSPj4NCmVuZG9iag0KOSAwIG9iag0KPDwvVGl0bGUoKSAvQXV0aG9yKEpvaG4sIFN1c2FuKSAvU3ViamVjdCgpIC9LZXl3b3JkcygpIC9DcmVhdGlvbkRhdGUoRDoyMDIxMDYyOTExMzE0MC0wNScwMCcpIC9Nb2REYXRlKEQ6MjAyMTA2MjkxMTMxNDAtMDUnMDAnKSAvUHJvZHVjZXIo/v8ATQBpAGMAcgBvAHMAbwBmAHQArgAgAFYAaQBzAGkAbwCuACAAMgAwADEANikgL0NyZWF0b3Io/v8ATQBpAGMAcgBvAHMAbwBmAHQArgAgAFYAaQBzAGkAbwCuACAAMgAwADEANikgPj4NCmVuZG9iag0KMTAgMCBvYmoNCjw8L1R5cGUvT3V0bGluZXMvRmlyc3QgMTEgMCBSL0xhc3QgMTIgMCBSPj4NCmVuZG9iag0KMTEgMCBvYmoNCjw8L1RpdGxlKERyYXdpbmcyKSAvUGFyZW50IDEwIDAgUi9GaXJzdCAxMiAwIFIvTGFzdCAxMiAwIFIvQ291bnQgLTEvRGVzdFsgMyAwIFIvWFlaIDAgNzkyIDBdID4+DQplbmRvYmoNCjEyIDAgb2JqDQo8PC9UaXRsZShQYWdlLTEpIC9QYXJlbnQgMTEgMCBSL0Rl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dHJlYW0NCmVuZG9iag0KMjYgMCBvYmoNCjw8L1R5cGUvTWV0YWRhdGEvU3VidHlwZS9YTUwvTGVuZ3RoIDMyNjQ+Pg0Kc3RyZWFtDQo8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IjMuMS03MDEiPgo8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgo8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiAgeG1sbnM6cGRmPSJodHRwOi8vbnMuYWRvYmUuY29tL3BkZi8xLjMvIj4KPHBkZjpQcm9kdWNlcj5NaWNyb3NvZnTCriBWaXNpb8KuIDIwMTY8L3BkZjpQcm9kdWNlcj48cGRmOktleXdvcmRzPjwvcGRmOktleXdvcmRzPjwvcmRmOkRlc2NyaXB0aW9uPgo8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIj4KPGRjOnRpdGxlPjxyZGY6QWx0PjxyZGY6bGkgeG1sOmxhbmc9IngtZGVmYXVsdCI+PC9yZGY6bGk+PC9yZGY6QWx0PjwvZGM6dGl0bGU+PGRjOmNyZWF0b3I+PHJkZjpTZXE+PHJkZjpsaT5Kb2huLCBTdXNhbjwvcmRmOmxpPjwvcmRmOlNlcT48L2RjOmNyZWF0b3I+PGRjOmRlc2NyaXB0aW9uPjxyZGY6QWx0PjxyZGY6bGkgeG1sOmxhbmc9IngtZGVmYXVsdCI+PC9yZGY6bGk+PC9yZGY6QWx0PjwvZGM6ZGVzY3JpcHRpb24+PC9yZGY6RGVzY3JpcHRpb24+CjxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iPgo8eG1wOkNyZWF0b3JUb29sPk1pY3Jvc29mdMKuIFZpc2lvwq4gMjAxNjwveG1wOkNyZWF0b3JUb29sPjx4bXA6Q3JlYXRlRGF0ZT4yMDIxLTA2LTI5VDExOjMxOjQwLTA1OjAwPC94bXA6Q3JlYXRlRGF0ZT48eG1wOk1vZGlmeURhdGU+MjAyMS0wNi0yOVQxMTozMTo0MC0wNTowMDwveG1wOk1vZGlmeURhdGU+PC9yZGY6RGVzY3JpcHRpb24+CjxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiICB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyI+Cjx4bXBNTTpEb2N1bWVudElEPnV1aWQ6NjcwNjI1OEQtODdFOC00N0ZELUExMzMtM0JBRTYyQkEwQjI3PC94bXBNTTpEb2N1bWVudElEPjx4bXBNTTpJbnN0YW5jZUlEPnV1aWQ6NjcwNjI1OEQtODdFOC00N0ZELUExMzMtM0JBRTYyQkEwQjI3PC94bXBNTTpJbnN0YW5jZUlEPjwvcmRmOkRlc2NyaXB0aW9uPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKPC9yZGY6UkRGPjwveDp4bXBtZXRhPjw/eHBhY2tldCBlbmQ9InciPz4NCmVuZHN0cmVhbQ0KZW5kb2JqDQoyNyAwIG9iag0KPDwvRGlzcGxheURvY1RpdGxlIHRydWU+Pg0KZW5kb2JqDQoyOCAwIG9iag0KPDwvVHlwZS9YUmVmL1NpemUgMjgvV1sgMSA0IDJdIC9Sb290IDEgMCBSL0luZm8gOSAwIFIvSURbPDhEMjUwNjY3RTg4N0ZENDdBMTMzM0JBRTYyQkEwQjI3Pjw4RDI1MDY2N0U4ODdGRDQ3QTEzMzNCQUU2MkJBMEIyNz5dIC9GaWx0ZXIvRmxhdGVEZWNvZGUvTGVuZ3RoIDEwNT4+DQpzdHJlYW0NCnicNcwxEkBADAXQv9YuWzIuQEnpLg6gUxkncACdwziNMyi1K/JJkTeZJB+QitFIL4CXg1yKuRVbk4FsStorrlF8SyZyAomkVHDEk4zkJCXfZZC/rPsnSwxJZBdKjQ6LMq7KvAMPJ2ELWA0KZW5kc3RyZWFtDQplbmRvYmoNCnhyZWYNCjAgMjkNCjAwMDAwMDAwMTMgNjU1MzUgZg0KMDAwMDAwMDAxNyAwMDAwMCBuDQowMDAwMDAwMTgyIDAwMDAwIG4NCjAwMDAwMDAyMzggMDAwMDAgbg0KMDAwMDAwMDUwMiAwMDAwMCBuDQowMDAwMDAwODAxIDAwMDAwIG4NCjAwMDAwMDA4NTQgMDAwMDAgbg0KMDAwMDAwMDkwNyAwMDAwMCBuDQowMDAwMDAxMDc1IDAwMDAwIG4NCjAwMDAwMDEzMTQgMDAwMDAgbg0KMDAwMDAwMTU3OCAwMDAwMCBuDQowMDAwMDAxNjQxIDAwMDAwIG4NCjAwMDAwMDE3NTYgMDAwMDAgbg0KMDAwMDAwMDAxNCA2NTUzNSBmDQowMDAwMDAwMDE1IDY1NTM1IGYNCjAwMDAwMDAwMTYgNjU1MzUgZg0KMDAwMDAwMDAxNyA2NTUzNSBmDQowMDAwMDAwMDE4IDY1NTM1IGYNCjAwMDAwMDAwMTkgNjU1MzUgZg0KMDAwMDAwMDAyMCA2NTUzNSBmDQowMDAwMDAwMDIxIDY1NTM1IGYNCjAwMDAwMDAwMjIgNjU1MzUgZg0KMDAwMDAwMDAyMyA2NTUzNSBmDQowMDAwMDAwMDAwIDY1NTM1IGYNCjAwMDAwMDIzMjIgMDAwMDAgbg0KMDAwMDAwMjQxNyAwMDAwMCBuDQowMDAwMDI1MjE1IDAwMDAwIG4NCjAwMDAwMjg1NjIgMDAwMDAgbg0KMDAwMDAyODYwNyAwMDAwMCBuDQp0cmFpbGVyDQo8PC9TaXplIDI5L1Jvb3QgMSAwIFIvSW5mbyA5IDAgUi9JRFs8OEQyNTA2NjdFODg3RkQ0N0ExMzMzQkFFNjJCQTBCMjc+PDhEMjUwNjY3RTg4N0ZENDdBMTMzM0JBRTYyQkEwQjI3Pl0gPj4NCnN0YXJ0eHJlZg0KMjg5MTINCiUlRU9GDQp4cmVmDQowIDANCnRyYWlsZXINCjw8L1NpemUgMjkvUm9vdCAxIDAgUi9JbmZvIDkgMCBSL0lEWzw4RDI1MDY2N0U4ODdGRDQ3QTEzMzNCQUU2MkJBMEIyNz48OEQyNTA2NjdFODg3RkQ0N0ExMzMzQkFFNjJCQTBCMjc+XSAvUHJldiAyODkxMi9YUmVmU3RtIDI4NjA3Pj4NCnN0YXJ0eHJlZg0KMjk2NDgNCiUlRU9G"
  }
}
```

# Sample Responses

```JSON
{
  "uploadDocumentResponse": {
    "documentId": "8039a6f3-2bdc-4880-8b0f-1cfa8d8e6f7a",
    "referenceId": "NocC33m8MckSscgecRWb1vRts4AUKSLf"
  }
}
```

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

## Timeout

Please allow at least 40 seconds to receive a response from the RFI APIs before considering the request to have timed out, at which point you may retry the call. If consistent timeouts occur, please contact the Cross Border Services Customer Support team at **[crossborder.services.support@mastercard.com](mailto:crossborder.services.support@mastercard.com)**.

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/upload-document-api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/upload-document-api/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/upload-document-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/upload-document-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/upload-document-api/#sandbox-testing)
*   [Sample Requests](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/upload-document-api/#sample-requests)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/upload-document-api/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/upload-document-api/#error-codes)


---
title: Update Request API
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, please proceed to [Update Request API Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/psd2-eu-update-request-api/) and [Update Request API Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/psd2-uk-update-request-api/) respectively to ensure compliance with the relevant jurisdiction based on Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

# API

  
This API will be used by a Customer to provide a response to a RFI request assigned to the Customer. Look at the RFI process description [How it works](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/how-it-works) for details on how to use the Update Request API for a cross border RFI solution.

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/update-request-api/#operation/UpdateRequest)

Provide response to an RFI request.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/requests/{request\_id}

MTF URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/requests/{request\_id}

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/requests/{request\_id}

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/ json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example- application/json

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/partners/{partner_id}/crossborder/rfi/requests/{request_id} 
```

```Production
 https://api.mastercard.com/send/partners/{partner_id}/crossborder/rfi/requests/{request_id}
```

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required OAuth 1.0a Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

## Test Cases

| Status | Test Case | Action |
| --- | --- | --- | --- |
| Success | Customer wants to attach a document in response to an RFI requests. RFI status is moved to Review. | 1\. Trigger Upload Document with FileName and File content.  <br>2\. MC system will return a documentId in response.  <br>3\. Then Trigger Update Request with request-id starting with "011". For example - "011XXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" Use the documentId returned from Step 2 for one of the fields which accepts documents.  <br>4\. System will return request status "REVIEW" in response. |
| Success | Mastercard needs additional details for a RFI which was responded to by Customer. | 1\. Trigger Retrieve Request with request-id starting with "022". For example - "022XXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX".  <br>2\. Status of the RFI will be INPROGRESS.  <br>3\. Then Trigger Update Request for same request -id.  <br>4\. System will return request status "REVIEW" in response. |
| Success | Closure of RFI request | 1\. Trigger Update Request with request-id starting with "033". For example - "033XXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX".  <br>2\. System will return request status "REVIEW" in response.  <br>3\. Trigger Retrieve Request for the same request-id after 10 mins.  <br>4\. System will return status of "CLOSED" for RFI. |
| Rejected with specific error | Update Document with specific error code | 1.Trigger Update Request with request-id starting with ‘1’ and ending with the desired error code. For example: ‘1XXXXXXX-XXXX-XXXX-XXXX-XXXXXX082000’ will REJECT upload and return 082000 error code in response. |  

# Sample Request

## 1\. Customer response for Sender’s full name.

```JSON
{
	"updateRequest": {
		"sender": {
			"fullName": "John Doe"
		}
	}
}
```

## 2\. Customer response for Sender’s full name with comments.

```JSON
{
	"updateRequest": {
		"sender": {
			"fullName": "John Doe"
		}
	},
	"other": {
		"comment": " Name was recently updated due to marriage"
	}
}
```

## 3\. Response for all data fields.

```JSON
{
	"updateRequest": {
		"sender": {
			"fullName": "John Doe",
			"dateOfBirth": "1956-04-24",
			"placeOfBirth": "USA",
			"nationality": "USA",
			"governmentId": {
				"type": "Passport",
				"number": "KJ3479D2"
			},
			"fullAddress": {
				"addressLine1": "42 WEST ELM AVENUE",
				"addressLine2": "Suite 100",
				"city": "ANYTOWN",
				"countrySubdivision": "New Mexico",
				"country": "USA",
				"postalCode": "69999"
			},
			"sourceOfIncome": "Salary"
		},
		"recipient": {
			"fullName": "Joseph Bloggs",
			"dateOfBirth": "1983-10-12",
			"placeOfBirth": "BEL",
			"nationality": "BEL",
			"governmentId": {
				"type": "Driver's License",
				"number": "ABCF-4658776"
			},
			"fullAddress": {
				"addressLine1": "Global AVENUE",
				"addressLine2": "No-5432",
				"city": "XYZPlace",
				"country": "BEL",
				"postalCode": "1234"
			}
		},
		"paymentAndDocs": {
			"senderRecipientRelation": "Friend",
			"paymentPurpose": "Child support"
		},
		"other": {
			"comment": "Added Details"
		}
	}
}
```

## 4.Customer response for copy of recipient’s address.

```JSON
{
	"updateRequest": {
		"recipient": {
			"fullAddress": {
				"documents": [
					"70787e97-d223-445a-98f3-dcc247f149e7"
				]
			}
	}
}
}
```

## 5.RFI response with field which accepts document id.

```JSON
{
	"updateRequest": {
		"sender": {
			"governmentId": {
				"documents": [
					"30028494-f6b1-4a10-a94f-f6ffe2f76e2b"
				]
			},
			"fullAddress": {
				"documents": [
					"301c32f1-f148-431b-8eaa-42d7d31d5957"
				]
			},
			"additionalDocuments": [
				"c04acab8-538d-4a3a-9cd3-5f28303c36b3"
			]
		},
		"recipient": {
			"governmentId": {
				"documents": [
					"8039a6f3-2bdc-4880-8b0f-1cfa8d8e6f7a"
				]
			},
			"fullAddress": {
				"documents": [
					"70787e97-d223-445a-98f3-dcc247f149e7"
				]
			},
			"additionalDocuments": [
				"d05c1475-794a-4bc9-b6e5-21f633f25dba"
			]
		},
		"paymentAndDocs": {
			"supportingDocs": [
				"904c63a6-6220-4d94-8abd-a1d1f19354c1"
			],
			"additionalDocuments": [
				"8039a6f3-2bdc-4880-8b0f-1cfa8d8e6f7a"
			]
		},
		"other": {
			"additionalDocuments": [
				"8039a6f3-2bdc-4880-8b0f-1cfa8d8e6f7a",
				"301c32f1-f148-431b-8eaa-42d7d31d5957",
				"8039a6f3-2bdc-4880-8b0f-1cfa8d8e6f7a"
			]
		}
	}
}
```

### 6.RFI response when additional questions are requested.

```JSON
{
  "updateRequest": {
		"sender": {
      "additionalQuestion": "Friend stays with me"
    },
    "recipient": {
      "additionalQuestion": "PassportId -GTU35789"
    },
    "paymentAndDocs": {
      "additionalQuestion": "Reason for three different payment in 24 hours to same beneficiary is because of limit on amount for one transactions"
    },
    "other": {
      "comment": "Added Details"
     }
    }
}
```

# Sample Response

```JSON
{
  "updateResponse": {
    "referenceId": "dlitsjsbTV77MrAHEKolaATXdaWiHgHB",
    "requestStatus": "REVIEW"
  }
}
```

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

## Timeout

Please allow at least 40 seconds to receive a response from the RFI APIs before considering the request to have timed out, at which point you may retry the call. If consistent timeouts occur, please contact the Cross Border Services Customer Support team at **[crossborder.services.support@mastercard.com](mailto:crossborder.services.support@mastercard.com)**.

On this page

*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/update-request-api/#api)
*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/update-request-api/#environment-domains)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/update-request-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/update-request-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/update-request-api/#sandbox-testing)
*   [Sample Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/update-request-api/#sample-request)
*   [Sample Response](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/update-request-api/#sample-response)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/update-request-api/#error-codes)


---
title: Retrieve Request API
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, please proceed to [Retrieve Request API Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/psd2-eu-retrieve-request-api/) and [Retrieve Request API Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/psd2-uk-retrieve-request-api/) respectively to ensure compliance with the relevant jurisdiction based on Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/partners/{partner_id}/crossborder/rfi/requests/{request_id} 
```

```Production
https://api.mastercard.com/send/partners/{partner_id}/crossborder/rfi/requests/{request_id}
```

# API

  
This API will be used to retrieve the latest information of a RFI request. The response provides the latest status of the request, information requested of the Customer, response provided by the Customer (when available) and the review status for each field (when available).

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/retrieve-request-api/#operation/RetrieveRequest)

Retrieve the latest status of an RFI request.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/requests/{request\_id}

MTF URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/requests/{request\_id}

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/rfi/requests/{request\_id}

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/ json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example- application/json

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required OAuth 1.0a Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

## Test cases

| Request Status | Test Case | Action |
| --- | --- | --- |
| OPEN | Retrieve a request with status Open created for single payment | 1\. Trigger Retrieve Request with request-id starting with "11". For example - "11XXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX.  <br>2\. System will return status of "OPEN" for RFI. |
| OPEN | Retrieve a request with status Open created for multiple (3) payments | 1\. Trigger Retrieve Request with request-id starting with "22". For example - "22XXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX.  <br>2\. System will return status of "OPEN" for RFI. |
| OPEN | Retrieve a request with status Open and request creator has attached a document to the request | 1\. Trigger Retrieve Request with request-id starting with "33". For example - "33XXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX.  <br>2\. System will return status of "OPEN" for RFI, along with documentId for the document attached.  <br>3\. Trigger Download Document with the documentId (from Step2) to retrieve the document. |
| OPEN | Retrieve a request with status Open -> with additional data requested for Sender | 1\. Trigger Retrieve Request with request-id starting with "44". For example - "44XXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX.  <br>2\. System will return status of "OPEN" for RFI. |
| OPEN | Retrieve a request with status Open -> with additional document(s) requested for Recipient | 1\. Trigger Retrieve Request with request-id starting with "55". For example - "55XXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX.  <br>2\. System will return status of "OPEN" for RFI. |
| Review | Retrieve a request with status Review with comments | 1\. Trigger Retrieve Request with request-id starting with "66". For example - "66XXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX.  <br>2\. System will return status of "REVIEW" for RFI. |
| INPRORESS | Retrieve a request with status INPROGRESS, where part of the response is accepted.  <br>Requesting modification for Sender's Government-Id and all other responses are approved. | 1\. Trigger Retrieve Request with request-id starting with "77". For example - "77XXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX.  <br>2\. System will return status of "INPROGRESS” for RFI where status for Sender’s Government ID Number will be rejected. |

# Sample Requests

No Request Body

# Sample Responses

## 1\. Requeststatus Open, created for multiple payment transactions.

```JSON
{
  "retrieveResponse": {
    "assignee": "BEL_MASEND5ged2",
    "creator": "Mastercard",
    "lastUpdatedDate": "2021-10-25T11:05:00.000+00:00",
    "other": {
      "requestDocuments": {
        "response": {
          "value": []
        }
      },
      "responseDocuments": {
        "response": {
          "value": {
            "request": {
              "label": "Additional attachments",
              "kind": "multi_file"
            },
            "response": {
              "value": []
            }
          }
        }
      }
    },
    "requestCreateDate": "2021-10-25T11:05:00.000+00:00",
    "requestId": "20ef5aef-0598-4741-9945-c0bafc7b5a98",
    "requestInstruction": "Please provide the information requested.",
    "requestStatus": "OPEN",
    "responseType": "NoResponse",
    "sender": {
      "fullName": {
        "request": {
          "label": "Full name",
          "kind": "text"
        },
        "response": {
          "value": ""
        }
      }
    },
    "transactions": [
      {
        "paymentDateTime": "2021-10-18T11:05:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "Trans199034810154901"
      },
      {
        "paymentDateTime": "2021-10-20T11:05:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "Trans2999034810154901"
      },
      {
        "paymentDateTime": "2021-10-15T11:05:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "Trans3999034810154901"
      }
    ]
  },
  "requestStatus": {
    "requestHistory": [
      {
        "eventActor": "Mastercard",
        "eventRef": "20da8559-ff57-48ec-855a-be159dcdde45",
        "eventType": "REQUEST_CREATED",
        "timestamp": "2021-10-25T11:05:00.000+00:00"
      }
    ]
  }
}
```

## 2\. Requeststatus Open, where multiple documents are attached by RFI team.

```JSON
{
  "retrieveResponse": {
    "assignee": "BEL_MASEND5ged2",
    "creator": "Mastercard",
    "lastUpdatedDate": "2021-10-25T18:33:01.331732549Z",
    "other": {
      "requestDocuments": {
        "response": {
          "value": [
            "c08a3ea5-9c1f-4b22-96ae-db1446004136",
            "30a8fbb8-ef0f-4dfb-ac0b-5d4327795c34",
            "d0204872-6890-46b7-ae6a-70a2168a50f8"
          ]
        }
      },
      "responseDocuments": {
        "response": {
          "value": {
            "request": {
              "label": "Additional attachments",
              "kind": "multi_file"
            },
            "response": {
              "value": []
            }
          }
        }
      }
    },
    "requestCreateDate": "2021-10-25T18:33:01.331732549Z",
    "requestId": "30240814-582c-4a96-86d1-72db20d9afb0",
    "requestInstruction": "Please provide the information requested.",
    "requestStatus": "OPEN",
    "responseType": "NoResponse",
    "sender": {
      "fullName": {
        "request": {
          "label": "Full name",
          "kind": "text"
        },
        "response": {
          "value": ""
        }
      }
    },
    "transactions": [
      {
        "paymentDateTime": "2021-10-25T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "0999999034810154901"
      }
    ]
  },
  "requestStatus": {
    "requestHistory": [
      {
        "eventActor": "Mastercard",
        "eventRef": "70b30d2b-4c42-4904-b596-c00e193169dc",
        "eventType": "REQUEST_CREATED",
        "timestamp": "2021-10-25T13:33:01.351385506-05:00"
      }
    ]
  }
}
```

## 3\. Requeststatus Open, consisting of additional questions.

```JSON
{
  "retrieveResponse": {
    "assignee": "BEL_MASEND5ged2",
    "creator": "Mastercard",
    "lastUpdatedDate": "2021-10-25T22:29:42.149617073Z",
    "other": {
      "requestDocuments": {
        "response": {
          "value": []
        }
      },
      "responseDocuments": {
        "response": {
          "value": {
            "request": {
              "label": "Additional attachments",
              "kind": "multi_file"
            },
            "response": {
              "value": []
            }
          }
        }
      }
    },
    "paymentAndDocs": {
      "additionalQuestion": {
        "request": {
          "label": "Explain in detail why there are three separate payments to beneficiary on same day",
          "kind": "text"
        },
        "response": {
          "value": ""
        }
      }
    },
    "recipient": {
      "additionalQuestion": {
        "request": {
          "label": "Passport details",
          "kind": "text"
        },
        "response": {
          "value": ""
        }
      }
    },
    "requestCreateDate": "2021-10-25T22:29:42.149617073Z",
    "requestId": "20d5fc18-f506-4cff-a28e-2d3ad5667e70",
    "requestInstruction": "Please provide the information requested.",
    "requestStatus": "OPEN",
    "responseType": "NoResponse",
    "sender": {
      "additionalQuestion": {
        "request": {
          "label": "Sender's occupation",
          "kind": "text"
        },
        "response": {
          "value": ""
        }
      }
    },
    "transactions": [
      {
        "paymentDateTime": "2021-10-18T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "0999999034810154901"
      },
      {
        "paymentDateTime": "2021-10-18T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "ABC9999034810154901"
      },
      {
        "paymentDateTime": "2021-10-18T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "DEF9999034810154901"
      }
    ]
  },
  "requestStatus": {
    "requestHistory": [
      {
        "eventActor": "Mastercard",
        "eventRef": "20e73791-3e23-4d40-b66f-8898c1fade10",
        "eventType": "REQUEST_CREATED",
        "timestamp": "2021-10-25T17:29:42.176966855-05:00"
      }
    ]
  }
}
```

## 4\. Requeststatus Open, requesting additional documents.

```JSON
{
  "retrieveResponse": {
    "assignee": "Mastercard O and T BizOps",
    "creator": "Mastercard",
    "lastUpdatedDate": "2021-10-28T19:23:19.095090761Z",
    "other": {
      "requestDocuments": {
        "response": {
          "value": []
        }
      },
      "responseDocuments": {
        "response": {
          "value": {
            "request": {
              "label": "Additional attachments",
              "kind": "multi_file"
            },
            "response": {
              "value": []
            }
          }
        }
      }
    },
    "paymentAndDocs": {
      "additionalDocuments": {
        "request": {
          "label": "If sender’s source of funds is his/her SALARY, kindly provide 3 consecutive pay stubs",
          "kind": "multi_file"
        },
        "response": {
          "value": []
        }
      },
      "supportingDocs": {
        "request": {
          "label": "Copy of supporting documentation for business payments (e.g. invoice, collaboration agreements, etc.)",
          "kind": "multi_file"
        },
        "response": {
          "value": []
        }
      }
    },
    "recipient": {
      "additionalDocuments": {
        "request": {
          "label": "Addition proof of Identity such as a passport, an ID card, a driver license",
          "kind": "multi_file"
        },
        "response": {
          "value": []
        }
      }
    },
    "requestCreateDate": "2021-10-28T19:23:19.095090761Z",
    "requestId": "00de63a7-b99a-4e53-940f-b1c2cd08f292",
    "requestInstruction": "Please provide the information requested.",
    "requestStatus": "OPEN",
    "responseType": "NoResponse",
    "sender": {
      "additionalDocuments": {
        "request": {
          "label": "Proof of residence such as a utility bill or account statement",
          "kind": "multi_file"
        },
        "response": {
          "value": []
        }
      },
      "fullAddress": {
        "documents": {
          "request": {
            "label": "Proof of address",
            "kind": "multi_file"
          },
          "response": {
            "value": []
          }
        },
        "request": {
          "label": "Full address",
          "kind": "address"
        }
      },
      "governmentId": {
        "documents": {
          "request": {
            "label": "Copy of ID",
            "kind": "multi_file"
          },
          "response": {
            "value": []
          }
        }
      }
    },
    "transactions": [
      {
        "paymentDateTime": "2021-10-28T12:00:00.000+00:00",
        "recipientUri": "",
        "senderUri": "",
        "transactionReference": "0999999034810154901"
      }
    ]
  },
  "requestStatus": {
    "requestHistory": [
      {
        "eventActor": "Mastercard",
        "eventRef": "d0171607-6b40-4d35-a021-78a8bcd93524",
        "eventType": "REQUEST_CREATED",
        "timestamp": "2021-10-28T14:23:19.113474483-05:00"
      }
    ]
  }
}
```

## 5\. Retrieve Request when amendments are requested with mix of approved and rejected responses.

```JSON
{
    "retrieveResponse": {
        "assignee": "BEL_MASEND5ged2",
        "creator": "Mastercard",
        "firstResponseDate": "2021-10-25T11:10:00.000+00:00",
        "lastUpdatedDate": "2021-10-25T11:55:00.000+00:00",
        "other": {
      "comments": [
        {
          "creator": "Mastercard",
          "text": "Please upload pictures with maximum resolution",
          "timestamp": "2021-06-15T04:07:00-05:00"
        }
      ],
            "requestDocuments": {
                "response": {
                    "value": []
                }
            },
            "responseDocuments": {
                "response": {
                    "value": {
                         "review": {
              "status": "Approved"
            },
                        "request": {
                            "label": "Additional attachments",
                            "kind": "multi_file"
                        },
                        "response": {
                            "value": []
                        }
                    }
                }
            }
        },
        "requestCreateDate": "2021-10-25T11:05:00.000+00:00",
        "requestId": "20ef5aef-0598-4741-9945-c0bafc7b5a98",
        "requestInstruction": "Please provide the information requested.",
        "requestStatus": "INPROGRESS",
        "responseType": "PartialResponse",
        "sender": {
            "fullName": {
                "review": {
                    "status": "Approved"
                },
                "request": {
                    "label": "Full name",
                    "kind": "text"
                },
                "response": {
                    "value": "John Doe"
                }
            },
            "governmentId": {
                   "type": {
		"request": {
            	"label": "Share details",
		"kind": "string"
          },
          "review": {
            "status": "Approved"
          },
          "response": {
            "value": "Answer"
					}
				},
                "documents": {
          "request": {
            "label": "Copy of Id",
            "kind": "string"
          },
          "review": {
            "status": "Rejected"
          },
          "response": {
            "value": [
              "3fa85f64-5717-4562-b3fc-2c963f66afa6"
            ]
          }
        }
							 }
					},
        "transactions": [
                {
                    "paymentDateTime": "2021-10-18T11:05:00.000+00:00",
                    "recipientUri": "",
                    "senderUri": "",
                    "transactionReference": "0999999034810154901"
                }
            ]
       },
        "requestStatus": {
            "requestHistory": [
                {
                    "eventActor": "Mastercard",
                    "eventRef": "f01e0d8c-a591-474c-abf4-3daff165c845",
                    "eventType": "CHANGES_REQUESTED",
                    "timestamp": "2021-10-25T11:55:00.000+00:00"
                },
                {
                    "eventActor": "BEL_MASEND5ged2",
                    "eventRef": "f05bd8a9-9361-486a-a499-ba7fc2802753",
                    "eventType": "RESPONSE_SUBMITTED",
                    "timestamp": "2021-10-25T11:10:00.000+00:00"
                },
                {
                    "eventActor": "Mastercard",
                    "eventRef": "20da8559-ff57-48ec-855a-be159dcdde45",
                    "eventType": "REQUEST_CREATED",
                    "timestamp": "2021-10-25T11:05:00.000+00:00"
                }
            ]
        }  
}
```

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

## Timeout

Please allow at least 40 seconds to receive a response from the RFI APIs before considering the request to have timed out, at which point you may retry the call. If consistent timeouts occur, please contact the Cross Border Services Customer Support team at **[crossborder.services.support@mastercard.com](mailto:crossborder.services.support@mastercard.com)**.

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/retrieve-request-api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/retrieve-request-api/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/retrieve-request-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/retrieve-request-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/retrieve-request-api/#sandbox-testing)
*   [Sample Requests](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/retrieve-request-api/#sample-requests)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/retrieve-request-api/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/retrieve-request-api/#error-codes)


---
title: Cancel Payment API
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, please proceed to [Cancel Payment API Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-eu-cancel-payment-api/) and [Cancel Payment API Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-uk-cancel-payment-api/) respectively to ensure compliance with the relevant jurisdiction based Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

# Environment Domains

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/{payment-id}/cancel
```

```Production
https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder/{payment-id}/cancel
```

> [!NOTE]
> 
> **Sandbox** and **MTF** environments share the same url but are differentiated by partner id.

You can use this API to cancel a request for a transaction that is in PENDING status. Any payment with a payment status as “Pending” and Pending Stage as “Insufficient Balance” can be cancelled. Additionally, for cash-out and some mobile money providers, the payment with status “Pending” can be cancelled irrespective of the Pending stage of that payment.

# API

  
Alternatively, here is a tabular view of the request/ response parameter:  (349KB)  
  

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cancel-payment-api/#operation/cancelRequest)

Cancel a payment that is in pending status.

Sandbox URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/{payment-id}/cancel

MTF URL

https://sandbox.api.mastercard.com/send/v1/partners/{partner-id}/crossborder/{payment-id}/cancel

Production URL

https://api.mastercard.com/send/v1/partners/{partner-id}/crossborder/{payment-id}/cancel

*   **Formats supported**: XML/ JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/json  
    content-length: Length of the inbound content body in octets.  
    Accept: Format of the expected response must be provided in this header field. Example - application/json

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by  
Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from an API tool, your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

## Sandbox Test cases

The Sandbox server returns simulated, static responses. You can use the following test cases to produce specific responses.

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Cancel Payment  <br>Response is “Success” indicating the Request was delivered. | Send a Cancel Payment populating the transaction reference ID or payment ID of a pending payment. |

**Note**: For test scenarios to make a Payment API call, please look at the **Sandbox Test cases** section [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/payment-api/). A payment can be cancelled only if the payment transaction is in **pending** status.

# Sample Requests

```XML
<?xml version="1.0" encoding="utf-8" ?>
<cancelpaymentrequest>  
</cancelpaymentrequest>
```

```JSON
{
   "cancelpaymentrequest": ""
}
```

# Sample Responses

```XML
<?xml version="1.0" encoding="utf-8" ?>
<cancelpayment>
        <status>SUCCESS</status>  
</cancelpayment>
```

```JSON
{
   "cancelpayment": {
      "status": "SUCCESS"
   }
}
```

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cancel-payment-api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cancel-payment-api/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cancel-payment-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cancel-payment-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cancel-payment-api/#sandbox-testing)
*   [Sample Requests](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cancel-payment-api/#sample-requests)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cancel-payment-api/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/cancel-payment-api/#error-codes)


---
title: Balance API
---

> [!ALERT]
> 
> If you are a Customer contracted with MTS EU or MTS UK, please proceed to [Balance API Specifications for EU](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-eu-balance-api/) and [Balance API Specification for UK](https://developer.mastercard.com/cross-border-services/documentation/api-ref/psd2-uk-balance-api/) respectively to ensure compliance with the relevant jurisdiction based Regulatory Technical Standards (either EU or UK) derived from the Revised Payment Services Directive (PSD2).

You can use this API to obtain account details including balances if you are contracted with a MTS legal entity and enabled for [prefunding settlement or collateral settlement](https://developer.mastercard.com/cross-border-services/documentation/api-ref/settlement-model/).

# Environment Domains

### Retrieve All Accounts and Balances

```Sandbox/MTF
https://sandbox.api.mastercard.com/send/partners/{partner_id}/crossborder/accounts
```

```Production
https://api.mastercard.com/send/partners/{partner_id}/crossborder/accounts
```

### Retrieve Account Balances by Account ID

```Sandbox
https://sandbox.api.mastercard.com/send/partners/{partner_id}/crossborder/accounts/{account_id}
```

```Production
https://api.mastercard.com/send/partners/{partner_id}/crossborder/accounts/{account_id}
```

> [!NOTE]
> 
> **Sandbox** and **MTF** environments share the same url but are differentiated by partner id.

# API

## Retrieve All Accounts and Balances

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/#operation/getAllAccountBalances)

Retrieve all the accounts and their respective balances.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts

MTF URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts

## Retrieve Account Balances by Account ID

[](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/#operation/getAccountBalance)

To retrieve a specific pre-funded account associated with a provided partner ID.

Sandbox URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts/{account\_id}

MTF URL

https://sandbox.api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts/{account\_id}

Production URL

https://api.mastercard.com/send/partners/{partner\_id}/crossborder/accounts/{account\_id}

*   **Formats supported**: JSON  
    
*   **HTTP Version**: 1.0/ 1.1
*   **Required HTTP header parameters**:  
    content-type : Format of the inbound content being submitted. example: application/ json  
    content-length: Length of the inbound content body in octets.

# API Convention

Take a look at the [API Conventions](https://developer.mastercard.com/cross-border-services/documentation/api-basics/api-conventions/) for general guidelines.

# Payload Encryption

All the request payload sent by you to Mastercard must be encrypted. And you will need to decrypt the payload sent by Mastercard.  
For more detailed information on payload **Encryption/ Decryption**, please see [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/)

# Sandbox Testing

You can make API calls to the Sandbox server from your application code using the [tutorials](https://developer.mastercard.com/cross-border-services/documentation/tutorials/), which involves creating a Mastercard Developers project and using the Sandbox keys to generate the required OAuth 1.0a Authorization Header.

> [!TIP]
> 
> During the onboarding process, Mastercard will assign a registered partner ID to test in the higher environments (MTF Test and Production). This partner ID will not be able to access the sandbox environment, but the customer can still access sandbox by using the non-registered partner ID.  
> Any correctly formatted partner ID can be used in the sandbox. As a best practice, use the first 15 digits of your institution’s name (alphanumeric and/or special characters, no spaces) as the Partner\_ID.  
> For testing in sandbox, please use unique transaction\_reference on each run.

> [!NOTE]
> 
> The sandbox does not return parameters unique to a specific Customer; such as pricing, limits, and corridor-specific data requirements, but allows you to test general call structure and responses outside of the production environment. After sandbox testing is completed, Customers meeting the eligibility requirements will be assigned a project manager to do integrated testing in the test environment that has been configured to include requested receiving corridors, current foreign exchange rates, and fixed and variable fees specific to the Customer.

## Test cases

The Sandbox server returns simulated, static responses.

### Retrieve all Active Accounts

You can use the following test cases to produce specific responses.

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Retrieve all active Accounts return message “Returned response with all active accounts”. | Send request to Balance API with include\_balance=false in the request. |

### Retrieve all Active Accounts Balances

You can use the following test cases to produce specific responses.

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Retrieve reserved and available balances for all active accounts (queuedBalance is not included). | Send Request to Balance API with the include\_balance=true in request. |

### Retrieve Account Balances by Account Id

You can use the following test cases to produce specific responses.

| Status | Test Case | Action |
| --- | --- | --- |
| Success | Retrieve balances (other than queuedBalance) of Single Account by Account Id with balance included having return message  <br>“Returned response with active account number with all balances“ . | Send request to Balance API with accountId. |
| Success for Prefund queuing | Retrieve balances of Single Account by Account Id with balance  <br>included having return message “Returned response with active  <br>account number with all balances including queuedBalance". | Send request to Balance API with accountId acct\_ssq |
| Rejected | Retrieve balances of Single Account by Account Id with Invalid  <br>Input value having return message “Rejected response Invalid  <br>Input Value with error code 082000”. | Send request to Balance API with invalid accountId acct++@bc . |
| Rejected | Retrieve balances of Single Account by Account Id with Invalid  <br>Input length having return message “Rejected response Invalid  <br>Input Length with error code 072000”. | Send request to Balance API with input value more than 30 characters. |
| Rejected | Retrieve balances of Single Account by Error code having return message “Rejected response  <br>PROVIDER\_NOT\_ENABLED\_PRE\_FUND with error code 130192”. | Send request to Balance API with accountId ERR\_130192. |
| Rejected | Retrieve balances of Single Account by Error Code having return message “Rejected response  <br>SETTLEMENT\_ACCOUNT\_NOT\_FOUND with error code 130193”. | Send request to Balance API with accountId ERR\_130193. |

# Sample Request

## Retrieve all Active Accounts

No Request body

## Retrieve all Active Accounts Balances

No Request body

## Retrieve Account Balances by Account Id

No Request body

# Sample Responses

## Retrieve all Active Accounts

A few examples of successful Retrieve calls are provided below:

### Successful Balance API Response :

```JSON
[
  {
    "accountId": "acct_1001",
    "accountState": "ACTIVE"
  },
  {
    "accountId": "acct_1002",
    "accountState": "ACTIVE"
  }
]
```

## Retrieve all Active Accounts Balances

A few examples of successful Retrieve calls are provided below:

### Successful Balance API Response when not opted for Prefund queuing:

```JSON
[
  {
    "accountId": "acct_1001",
    "accountState": "ACTIVE",
    "openingBalanceTimestamp": "08:00:00-04:00",
    "balanceAsOfTimestamp": "2021-07-12T08:16:34-04:00",
    "balanceDetails": {
      "openingBalance": {
        "amount": "10000.75",
        "currency": "USD"
      },
      "processedAmount": {
        "amount": "2000.25",
        "currency": "USD"
      },
      "reservedBalance": {
        "amount": "100.00",
        "currency": "USD"
      },
      "availableBalance": {
        "amount": "8000.50",
        "currency": "USD"
      },
      "settlementAccountBalance":{
         "amount": "8100.50",
         "currency": "USD"
      },
      "thresholdAmount": {
        "amount": "100.00",
        "currency": "USD"
      }
    }
  },
  {
    "accountId": "acct_1002",
    "accountState": "ACTIVE",
    "openingBalanceTimestamp": "08:00:00+09:00",
    "balanceAsOfTimestamp": "2021-07-12T21:16:34+09:00",
    "balanceDetails": {
      "openingBalance": {
        "amount": "7000",
        "currency": "JPY"
      },
      "processedAmount": {
        "amount": "7600",
        "currency": "JPY"
      },
      "reservedBalance": {
        "amount": "100",
        "currency": "JPY"
      },
     "availableBalance": {
        "amount": "-600",
        "currency": "JPY"
      },
      "settlementAccountBalance":{
        "amount": "-500",
        "currency": "JPY"
      },
      "thresholdAmount": {
        "amount": "-1000",
        "currency": "JPY"
      }
    }
  },
  {
    "accountId": "acct_1003",
    "accountState": "ACTIVE",
    "openingBalanceTimestamp": "08:00:00+03:00",
    "balanceAsOfTimestamp": "2021-07-12T15:16:34+03:00",
    "balanceDetails": {
      "openingBalance": {
        "amount": "15000.570",
        "currency": "BHD"
      },
      "processedAmount": {
        "amount": "2000.230",
        "currency": "BHD"
      },
      "reservedBalance": {
        "amount": "100.170",
        "currency": "BHD"
      },
      "availableBalance": {
        "amount": "13000.340",
        "currency": "BHD"
      },
      "settlementAccountBalance":{
        "amount": "13100.510",
        "currency": "BHD"
      }
    }
  }
]
```

### Successful Balance API Response when opted for Prefund queuing:

```JSON
[
  {
    "accountId": "acct_1001",
    "accountState": "ACTIVE",
    "openingBalanceTimestamp": "08:00:00-04:00",
    "balanceAsOfTimestamp": "2021-07-12T08:16:34-04:00",
    "balanceDetails": {
      "openingBalance": {
        "amount": "10000.75",
        "currency": "USD"
      },
      "processedAmount": {
        "amount": "2000.25",
        "currency": "USD"
      },
      "reservedBalance": {
        "amount": "100.00",
        "currency": "USD"
      },
      "availableBalance": {
        "amount": "8000.50",
        "currency": "USD"
      },
      "settlementAccountBalance":{
         "amount": "8100.50",
         "currency": "USD"
      },
      "queuedBalance": {
        "amount": "246.02",
        "currency": "USD"
      },
      "thresholdAmount": {
        "amount": "100.00",
        "currency": "USD"
      }
    }
  },
  {
    "accountId": "acct_1002",
    "accountState": "ACTIVE",
    "openingBalanceTimestamp": "08:00:00+09:00",
    "balanceAsOfTimestamp": "2021-07-12T21:16:34+09:00",
    "balanceDetails": {
      "openingBalance": {
        "amount": "7000",
        "currency": "JPY"
      },
      "processedAmount": {
        "amount": "7600",
        "currency": "JPY"
      },
      "reservedBalance": {
        "amount": "100",
        "currency": "JPY"
      },
     "availableBalance": {
        "amount": "-600",
        "currency": "JPY"
      },
      "queuedBalance": {
        "amount": "246.02",
        "currency": "USD"
      },
      "settlementAccountBalance":{
        "amount": "-500",
        "currency": "JPY"
      },
      "thresholdAmount": {
        "amount": "-1000",
        "currency": "JPY"
      }
    }
  },
  {
    "accountId": "acct_1003",
    "accountState": "ACTIVE",
    "openingBalanceTimestamp": "08:00:00+03:00",
    "balanceAsOfTimestamp": "2021-07-12T15:16:34+03:00",
    "balanceDetails": {
      "openingBalance": {
        "amount": "15000.570",
        "currency": "BHD"
      },
      "processedAmount": {
        "amount": "2000.230",
        "currency": "BHD"
      },
      "reservedBalance": {
        "amount": "100.170",
        "currency": "BHD"
      },
      "availableBalance": {
        "amount": "13000.340",
        "currency": "BHD"
      },
      "queuedBalance": {
        "amount": "246.02",
        "currency": "USD"
      },
      "settlementAccountBalance":{
        "amount": "13100.510",
        "currency": "BHD"
      }
    }
  }
]
```

## Retrieve Account Balances by Account Id

A few examples of successful Retrieve calls are provided below:

### Successful Balance API Response when not opted for Prefund queuing:

```JSON
{
    "accountId": "acct_1001",
    "accountState": "ACTIVE",
    "openingBalanceTimestamp": "08:00:00-04:00",
    "balanceAsOfTimestamp": "2021-07-12T08:16:34-04:00",
    "balanceDetails": {
      "openingBalance": {
        "amount": "10000.75",
        "currency": "USD"
      },
      "processedAmount": {
        "amount": "2000.25",
        "currency": "USD"
      },
      "reservedBalance": {
        "amount": "100.00",
        "currency": "USD"
      },
      "availableBalance": {
        "amount": "8000.50",
        "currency": "USD"
      },
      "settlementAccountBalance":{
        "amount": "8100.50",
        "currency": "USD"
      },
      "thresholdAmount": {
        "amount": "100.00",
        "currency": "USD"
      }
    }
  }
```

### Successful Balance API Response when opted for Prefund queuing:

```JSON
{
    "accountId": "acct_1001",
    "accountState": "ACTIVE",
    "openingBalanceTimestamp": "08:00:00-04:00",
    "balanceAsOfTimestamp": "2021-07-12T08:16:34-04:00",
    "balanceDetails": {
      "openingBalance": {
        "amount": "10000.75",
        "currency": "USD"
      },
      "processedAmount": {
        "amount": "2000.25",
        "currency": "USD"
      },
      "reservedBalance": {
        "amount": "100.00",
        "currency": "USD"
      },
      "availableBalance": {
        "amount": "8000.50",
        "currency": "USD"
      },
      "queuedBalance": {
        "amount": "246.02",
        "currency": "USD"
      },
      "settlementAccountBalance":{
        "amount": "8100.50",
        "currency": "USD"
      },
      "thresholdAmount": {
        "amount": "100.00",
        "currency": "USD"
      }
    }
  }
```

A few examples of Retrieve failures are provided below:

## Rejected Response With Error Code:

### 1.Invalid Input Value:

```JSON
{
   "Errors": {
      "Error": {
         "RequestId": "7623048",
         "Source": "Additional Data-1200-Destination Service Tag",
         "ReasonCode": "INVALID_INPUT_VALUE",
         "Description": "Invalid Input Value",
         "Recoverable": "false",
         "Details": {
            "Detail": {
               "Name": "ErrorDetailCode",
               "Value": "082000"
            }
         }
      }
   }
}
```

### 2.Invalid Input Length:

```JSON
{
   "Errors": {
      "Error": {
         "RequestId": "7623048",
         "Source": " ",
         "ReasonCode": "INVALID_INPUT_LENGTH",
         "Description": "Invalid Input Length",
         "Recoverable": "false",
         "Details": {
            "Detail": {
               "Name": "ErrorDetailCode",
               "Value": "072000"
            }
         }
      }
   }
}
```

### 3.Provider Not Enabled Pre Fund:

```JSON
{
   "Errors": {
      "Error": {
         "RequestId": "7623048",
         "Source": " ",
         "ReasonCode": "PROVIDER_NOT_ENABLED_PRE_FUND",
         "Description": "Provider Not Enabled Pre Fund",
         "Recoverable": "false",
         "Details": {
            "Detail": {
               "Name": "ErrorDetailCode",
               "Value": "130192"
            }
         }
      }
   }
}
```

### 4.Settlement Account Not Found:

```JSON
{
  "Errors": {
    "Error": {
      "RequestId": "45736538",
      "Source": "",
      "ReasonCode": "SETTLEMENT_ACCOUNT_NOT_FOUND",
      "Description": "Settlement account not found",
      "Recoverable": "false",
      "Details": {
        "Detail": {
          "Name": "ErrorDetailCode",
          "Value": "130193"
        }
      }
    }
  }
}
```

# Error Codes

Please refer to complete list of error codes [here](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/).

For information about the HTTP response codes that may be returned for your API requests, see [HTTP Response Codes](https://developer.mastercard.com/cross-border-services/documentation/response-error-codes/http-response-codes/).

On this page

*   [Environment Domains](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/#environment-domains)
*   [API](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/#api)
*   [API Convention](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/#api-convention)
*   [Payload Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/#payload-encryption)
*   [Sandbox Testing](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/#sandbox-testing)
*   [Sample Request](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/#sample-request)
*   [Sample Responses](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/#sample-responses)
*   [Error Codes](https://developer.mastercard.com/cross-border-services/documentation/api-ref/balance-api/#error-codes)

---
title: Payload Encryption
---

# Introduction

Mastercard APIs are secured through an authentication process where only authorized clients, with a valid digital signature are granted access. Payload encryption provides an additional layer of security.

The encrypted payload is structured in JSON Web Encryption (JWE) format, the plain text JSON body is encrypted to form a JWE encrypted payload that is inserted into the request body(replacing the plain text data). The encryption process uses the appropriate public encryption key for the environment.

For further details, refer to the [JWE IETF standard - (RFC 7516)](https://tools.ietf.org/html/rfc7516#section-3.1)

# How to Enable Encryption

Customers may set up payload encryption for partner-initiated transactions (such as for Quotes, Payment and Retrieve Payment APIs) on their own by following these steps:

**Step 1:** Create Encryption keys. See [How to Create Encryption Keys](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#how-to-create-encryption-keys) section below.  
**Step 2:** Provide encrypted payload. See [How to Encrypt Payload](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#how-to-encrypt-payload) section below.  
**Step 3:** Include the **x-encrypted: true** HTTP Header. Please refer the [HTTP header](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#http-header-parameters) section below.

# How to Create Encryption Keys

Once you log into your Mastercard Developers account on [Mastercard Developer site](https://developer.mastercard.com/account/log-in), there are two ways to create encryption keys.

**Option 1:** Create keys with new project creation:  
The [Quick Start Guide](https://developer.mastercard.com/cross-border-services/documentation/tutorials/guide-create-project/) provides detailed information about creating a project and the project keys in Sandbox/MTF environment. For creating encryption keys in production, you can request Production access for your project (refer [step-by-step guide](https://developer.mastercard.com/cross-border-services/documentation/tutorials/guide-move-to-production/) )

**Option 2:** Add Keys to existing project:  
To add keys to an existing project, simply click “Add Key” (next to the Client Encryption Keys)

# How to Encrypt Payload

Please follow the below steps to encrypt the payload as per above format:

**Step 1:** Construct the original JSON or XML Request per the API specification.  
**Step 2:** Use JWE to encrypt the original request in compact serialized form using the below JOSE headers:

| JOSE Header | Value | Description |
| --- | --- | --- |
| enc | A256GCM | Content encryption algorithm. |
| alg | RSA-OAEP-256 | Key encryption algorithm. |
| cty (content type) | Application/JSON or Application/XML | The application can use this value to disambiguate among the different kinds of objects that might be present. |
| kid | Public Fingerprint ID | The Public Fingerprint ID or client key will be used to identify the private key needed to decrypt the message. |

**Kid example:**

![client-encryption-key](https://static.developer.mastercard.com/content/cross-border-services/documentation/api-ref/encryption/../../images/EncryptionKidExample.PNG)

**Step 3:** Construct payload with below HTTP header parameters, and payload structure.  
  

##### HTTP Header Parameters:

| Param Name | Example Value | Description |
| --- | --- | --- |
| Content-Type | application/json | This is the format of the request content being submitted. |
| Content-Length | 380 | This is the length of the request content body in octets. |
| Accept | application/ JSON | This is the acceptable format for response content. |
| x-encrypted | TRUE | Flag to indicate the request body content is encrypted. This must be always set to true. |
| Authorization | Please see: The Authorization Header | OAuth authorization header. |

# Request Structure

The following structure is needed when encrypting a payload.

```JSON
{
"encrypted_payload": {
"data": "JWE encrypted payload"
}
}
```

or

```
<encrypted_payload>
<data>JWE encrypted payload</data>
</encrypted_payload>
```

### Sample Request Payload

Encrypted Request Body Example:

```JSON
{
  "encrypted_payload": {
    "data": "eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIiwiY3R5IjoiYXBwbGljYXRpb24veG1sIiwia2lkIjoiODI2NTk3YzQ2MTRlMWY2ODZhOTllNmY5MTAzYmYxNmJhNTVjNDhmMDU3MmE1YTlkNmI5MmY5YzJiNDA3NDZhNiJ9.fLRDis0rBPUp-YSB4CmKemGZhxiQ2Bzk1F73_vjn2nrf9LF223EBqppto6RgoSdTUyEzCblSMT94r2ipsJ7h_mNFvsv-POcxqKJncYyrmQCvkuYrY-P8BhHun-HATY7OUzeYW2VQdcmVIFOHFWVSznqZ3Db6UcYNC3GSys0q8n-_oV0VcWLHYBopF0oo3nuPKOMUM68Hr9TU8mHQzMYxaclDjOTlX4y0a04OzuWXsWHEkmAtT7eC7Z7SUdtNb6Fh81qHXpEfGy880vCVJE91ymfTCutQXKdL6bykxv4rNM4Db1aWuZbrHj5ffmNo-1yzb6shBBNRHNPNc7hclZcuaA"
  }
}
```

# Decrypting Response Payload

Mastercard Cross-Border Service will respond with an encrypted response for all encrypted requests which are able to be processed.

### Response Structure

The following Response payload structure will be used for encrypted responses.

```JSON
{
"encrypted_payload": {
"data": "JWE encrypted payload"
}
}
```

or

```
<encrypted_payload>
<data>JWE encrypted payload</data>
</encrypted_payload>
```

The below HTTP header parameters content type application/json or application/xml will be specified, additionally **x-encrypted: true** header will be returned in HTTP Response header.

| HTTP Header Parameters | Example Value | Description |
| --- | --- | --- |
| Content-Type | application/json | This is the format of the response content. |
| x-encrypted | TRUE | Value would be ’true’ to indicate the response content is encrypted. |

Mastercard will set the kid property to a value of the fingerprint displayed under Mastercard Encryption Keys when sending their encrypted response. In turn, the kid property on the JWE JOSE header can be used to identify the correct private key for decryption.

### Mastercard Encryption Key example:

![mc-encryption-key](https://static.developer.mastercard.com/content/cross-border-services/documentation/api-ref/encryption/../../images/MA_EncryptionKeyExample.PNG)

### Sample Response Payload

Encrypted Response Body Example:

```JSON
{
"encrypted_payload": {
"data": "eyJlbmMiOiJBMTI4R0NNIiwiYWxnIjoiUlNBLU9BRVAtMjU2In0.g8iwx7vrRYJJ9EzJnOvlwM0e3RceeYK7M9dST56HVi36MjmhW2a2Ap-h2MtRHALzpYA6BWbfT0QhV4QUz5PWfVjRsCr2Zw1gC8zEIKNSKQWOqDcnAntT-h3F7DRccdXXTdQli1WJJXLUR9DkbkNzuJDpj16bBnHghtXTEEJpznMpaJmDXIL9ItYjZv1Iz-WK90SdFJ9Iv-oXVMHSCXjgTyPwwjQk6TLNufOKsWCuztXC6SaMBZuAHy9TAPO2aDLMYq2BfoXJCWDS_-jidiL-HfTJw8u2s6UvcUMAbIRp57R_r-eycysVsa7CAG-mRuLlQFa0JHD3e7O-b3ER8dFDrg.0O2AuD6mL__dfB0e.ps2uDrU9wt7Nk9Cmt9sq3vPwJjoMOuLahHwaDe3Km38b5IKMNpIKe_mG5tpWm7cm9uGKXYc4RlPMMproZ-hDXks70BGCs5O0aBMM4AOl4sBFa4xRxa8B99cIBebYssRaJXxcoulU7FAUc6Ol0ShxN8pA7D--FpCMW4bnaKpXgHM9YNh9HWPTJLJKguGDm2qrqkSoKnWQS3J6XrW9VOV97lezAvYV4dLWOzU0IVxipF-RfvMoXK6XI-1sP3rgv2gIkObwho6yD2gcBO1A9uKi-kOCkvJaD7ouw5o67VwPjdF3ye-hTRSn9raq018ICW1cJPhE9auIWaKbI9EguqlMHfhF6grp2GHDcNilwVikPStEZAEisnUBMxR0nGmmQsW4foNDvWTXz8Adz0fC7h-zMgDmV0WUv1jKR2oa565K3WiYYb8Jx6Ymz1YI-Om6InbKkHvizkcFh8hAGXAGrID_sbGvcPjDguzutL_6LNy7hV4Zud9DOtSRyQJzLXHqEE77tKGR7NJw-QWoGI6YDSvYB3Mw6v-vC4lKNxgAAP5X3ysYIPtUXli31kzYkvwQxwjDnfRDFBLo9yS8XenYLNaCP089_kjb4tZy4G7rb4O9_vgTrs2iBZ2zdjHVam0eKJoOF3gOIIdLAAzJmn3RzdQa.te6ngAa6zahgREnOQeUhyg"
}
}
```

# Error Handling

Error message responses, including Rejected payments, are not encrypted. The exact error structure documented from the original API will be provided in response.

### HTTP Header Parameters

| Param Name | Example Value | Description |
| --- | --- | --- |
| Content-Type | application/json | This is the format of the response content. |

### Sample Error Response Payload

Response Body:

```JSON
{
    "Errors": {
        "Error": {
            "Description": "Value contains invalid character",
            "Details": {
                "Detail": {
                    "Name": "ErrorDetailCode",
                    "Value": "062000"
                }
            },
            "ReasonCode": "INVALID_INPUT_FORMAT",
            "Recoverable": "false",
            "RequestId": null,
            "Source": "Encrypted Payload"
        }
    }
}
```

# Testing Encrypted Payload

**Live customers** wanting to test API payload encryption for partner-initiated transactions (such as Quotes, Payment and Retrieve payment APIs) can self-validate in the MTF and production environments by following the above steps then confirming:  

1.  Successful Response  
    
2.  X-encrypted field set to True in HTTP header.

If support is needed, live customers should reach out to their Mastercard Customer Support team.

**New customers** will test basic API payload encryption in Sandbox environment. Specialized testing scenarios will be performed with the Customer Implementation Services (CIS) team during onboarding.

# Encrypted Push Notifications

**Live** and **New customers** wanting to set up encryption for push notifications (such as Status change and Carded rates) will need to coordinate MTF/Production testing with the Customer Implementation Services team by opening a project.

The CIS Team will ask for the Open API Client ID for both MTF and Production when setting up the encrypted push notifications.  
Test accounts to initiate push transactions will be provided if necessary.

On this page

*   [Introduction](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#introduction)
*   [How to Enable Encryption](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#how-to-enable-encryption)
*   [How to Create Encryption Keys](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#how-to-create-encryption-keys)
*   [How to Encrypt Payload](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#how-to-encrypt-payload)
*   [Request Structure](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#request-structure)
*   [Decrypting Response Payload](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#decrypting-response-payload)
*   [Error Handling](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#error-handling)
*   [Testing Encrypted Payload](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#testing-encrypted-payload)
*   [Encrypted Push Notifications](https://developer.mastercard.com/cross-border-services/documentation/api-ref/encryption/#encrypted-push-notifications)

---
title: Push Notifications Details
---

Mastercard Cross-Border Services offers the following push notifications as opt-in Services:

1.  [Status Change Push](https://developer.mastercard.com/cross-border-services/documentation/api-ref/status-change-api/)  
    
2.  [Carded Rate Push](https://developer.mastercard.com/cross-border-services/documentation/api-ref/carded-rate-api/)  
    
3.  [RFI Push](https://developer.mastercard.com/cross-border-services/documentation/api-ref/rfi-apis/notification/)  
    
4.  [Account Validation Push](https://developer.mastercard.com/cross-border-services/documentation/api-ref/account-validation-apis/account-validation-api/)  
    

Mastercard Cross-Border Services expects HTTP Response Code 200 for all push notifications. In the event of a timeout or error, Mastercard Cross-Border Services will resend the notification with a maximum of three retries. This ould unknowingly cause duplicate notifications. So Mastercard Cross-Border Services recommends Customer to build logic in their systems to identify the `eventRef` and ignore any duplicate notifications with the same `eventRef`.

# Push Notification Setup

*   Push APIs involve a Mutual Secure Connection to be established between Mastercard and the External partner server which exposes the webhook endpoint (URL). This is achieved through Mutual TLS (mTLS) authentication method.

## Step 1: Provide Push API Notification Webhook URL

You will provide the Webhook URL for both the MTF and the PROD environments. The Webhook URLs must be active on your network. Mastercard API Gateway (APIGW) does not perform any connectivity check explicitly after onboarding your Webhook. You should confirm your domain is getting pinged from the internet before submitting Webhook URL.

**Follow the below guidelines for the endpoint URL.**

*   You should provide endpoint URL.
*   The URL needs to be public and reachable on internet.
*   It needs to be FQDN (Fully Qualified Domain Name) and HTTPS.
*   The domain name should be resolvable and webhook should not be created with IP.
*   The URL should end with /Webhook – no other query parameter in URL or header is allowed/required.  
    Ex: Not accepted: api.fakecompany.com/?id=xxx.  
    Ex: Accepted : api.fakecompany.com/xbs/status/webhook.
*   You should not create a webhook expecting Oauth token to be sent.
*   You should not create a webhook waiting for a POST parameter containing the api-key (fixed value).
*   Mastercard supports different destination paths for push notifications in both mtf and production environments.

> [!NOTE]
> 
>   
> 
> *   Mastercard does not recommend using IP address allow-listing as a security measure for inbound or outbound services. This method is not seen as robust or scalable for securing webhook communications or API integrations.
> *   However, if your organization needs the list of outbound IP addresses used by the API Gateway for firewall configuration, your Mastercard Customer Implementation Services (CIS) Representative can provide these details upon request.

## Step 2: Exchange certificate

### Configuration Details

> [!NOTE]
> 
>   
> 
> *   Use these configuration details only with options 1 and 2 when a Mastercard-issued client certificate is used in the MTLS flow for push notifications.
> *   For option 3, you must define the Distinguished Name (DN) and Mastercard creates the CSR according to those requirements, as the client certificate will be issued by your Certificate Authority (CA).

Partners and customers using Mastercard products or services via push notifications to partner webhook endpoints should refer to the following certificate Distinguished Name (DN):

```Member-Test-Facility_(MTF)
CN=CrossborderServicesNotification-mtf.mastercard.com, OU=admin, O=MasterCard International Incorporated, L=O'Fallon, ST=Missouri, C=US
```

```Production
CN=CrossborderServicesNotification-prod.mastercard.com, OU=admin, O=MasterCard International Incorporated, L=O'Fallon, ST=Missouri, C=US
```

### Option 1: CA Trust method for the MTLS

Mastercard certificate authority (CA) is DigiCert. If you trust all certificates issued by DigiCert as CA, there are no action required by you. In this case, you should already be trusting the DigiCert CA Chain that has signed Mastercard domain certificate.

You can download the outbound DigiCert CA certificates directly from the [CA website](https://www.digicert.com/kb/digicert-root-certificates.htm#roots:~:text=0F%3AFA%3AE1%3AF3%3A1A%3A2B%3A43%3A3C%3A3D%3A9A%3AE1%3A6D%3A64%3A3B%3A58%3A8B):

*   /C=US/O=DigiCert Inc/CN=DigiCert Assured ID Client CA G2
*   /C=US/O=DigiCert Inc/OU=www.digicert.com/CN= DigiCert Assured ID Root G2

> [!NOTE]
> 
>   
> 
> *   If necessary, Mastercard can also share the CA certificates with you through the Key Management Portal in Mastercard Connect.
> *   As pre-requisite, you must have access to the Key management portal (KMP) in Mastercard Connect and must have registered the KMP security officers through the same application.
> *   The Inbound and Outbound CA certificates are different. Inbound CA certificates are used for services initiated by the customer to Mastercard, while Outbound CA certificates are used for services initiated by Mastercard to the customer. The DigiCert CA certificates used by Mastercard are:
>     *   **Inbound**: DigiCert Global G2 TLS RSA SHA256 2020 CA1 and DigiCert Global Root G2
>     *   **Outbound**: DigiCert Assured ID Client CA G2 and DigiCert Assured ID Root G2 1

### Option 2: Non-standard MTLS validation

> [!NOTE]
> 
> Mastercard recommends using option 1 from the given options for the issued certificate.

A non-standard MTLS validation such as certificate pinning or to locally store the end-entity client certificate for infrastructure requirement, requires Mastercard to share the full CA chain with the customer including the Mastercard client leaf certificate.

1.  The CIS implementation representative initiates the request for the key exchange process to the Mastercard Key Management team only after ensuring that the customer can access the KMP portal and can register their KMP security officers.
    
2.  After the key exchange over KMP, you need to download and configure the CA certificates in addition to the Mastercard client certificate in your server trust store for a successful mTLS authentication for outbound services.
    
3.  Follow the instructions [here](https://developer.mastercard.com/cross-border-services/documentation/api-ref/push-api-notification-mtls-setup/) to push the API Notification Mutual TLS setup.
    

### Option 3: Third-Party certificates handling process

If your infrastructure does not support external Certificate Authorities (CAs) like DigiCert for inclusion in your trust store, and instead relies on your own designated CAs to authenticate server connections for outbound communication, then follow these steps for handeling the third-party certificates:

1.  Reach out to the Mastercard implementation representative with a request to allow own preferred CAs for authentication.
2.  The representative works internally to request handling of the third party client certificates.
3.  Once approved, you will get an email from the Key Management team within Mastercard to proceed.
4.  Login to KMP and download the CSR.
5.  Provide the client certificate signed by your Third-Party CA in the same KMP portal.

  
Once the configuration is completed, your Mastercard implementation representative informs you to proceed with the testing phase.

# How to identify

Contact your organization technical team (IT support or operations) that support your servers or APIs that Mastercard connects to and ask them to confirm whether your middleware is configured for the CA Trust method of validating mutually authenticated transport layer security (mTLS) for API’s, or if the existing certificates are located in the trust store of your servers. If your middleware does require end-entity certificates to be stored in the trust store, then add (import) the new previously mentioned certificates into your trust store as additional valid certificates.

On this page

*   [Push Notification Setup](https://developer.mastercard.com/cross-border-services/documentation/api-ref/push-notifications-details/#push-notification-setup)
*   [How to identify](https://developer.mastercard.com/cross-border-services/documentation/api-ref/push-notifications-details/#how-to-identify)